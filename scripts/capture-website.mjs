import puppeteer from "puppeteer-core";
import http from "node:http";
import net from "node:net";
import { lookup } from "node:dns/promises";
import { pathToFileURL } from "node:url";
import ipaddr from "ipaddr.js";

// Every outbound connection is pinned to a checked IP, including redirects and
// subresources. Chromium never resolves the destination itself (DNS rebinding).
export async function publicAddress(host, resolve = lookup) {
  const addresses = await resolve(host.replace(/^\[|\]$/g, ""), { all: true });
  if (
    !addresses.length ||
    addresses.some(({ address }) => {
      const parsed = ipaddr.process(address);
      return parsed.range() !== "unicast";
    })
  )
    throw new Error("Only public internet addresses are allowed.");
  return addresses[0].address;
}

export function checkedUrl(value) {
  const url = new URL(value);
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    (url.port && !["80", "443"].includes(url.port))
  ) {
    throw new Error(
      "Use a public HTTP(S) URL on port 80 or 443 without credentials.",
    );
  }
  return url;
}

async function safeProxy() {
  const sockets = new Set();
  const server = http.createServer(async (request, response) => {
    try {
      const url = checkedUrl(request.url);
      if (url.protocol !== "http:" || request.method !== "GET")
        throw new Error("Blocked");
      const address = await publicAddress(url.hostname);
      const upstream = http.request(
        {
          hostname: address,
          port: Number(url.port) || 80,
          path: url.pathname + url.search,
          method: "GET",
          headers: { ...request.headers, host: url.host },
          timeout: 15000,
        },
        (result) => {
          response.writeHead(result.statusCode, result.headers);
          let bytes = 0;
          result.on("data", (chunk) => {
            bytes += chunk.length;
            if (bytes > 10_000_000) result.destroy();
          });
          result.pipe(response);
        },
      );
      upstream.on("timeout", () => upstream.destroy());
      upstream.on("error", () => response.destroy());
      upstream.end();
    } catch {
      response.writeHead(403).end();
    }
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  server.on("connect", async (request, socket, head) => {
    try {
      const url = checkedUrl(`https://${request.url}`);
      const address = await publicAddress(url.hostname);
      const upstream = net.connect(Number(url.port) || 443, address);
      sockets.add(upstream);
      upstream.on("close", () => sockets.delete(upstream));
      upstream.on("error", () => socket.destroy());
      socket.on("error", () => upstream.destroy());
      socket.on("close", () => upstream.destroy());
      upstream.setTimeout(20000, () => upstream.destroy());
      let bytes = 0;
      upstream.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 20_000_000) upstream.destroy();
      });
      upstream.once("connect", () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        if (head.length) upstream.write(head);
        socket.pipe(upstream).pipe(socket);
      });
    } catch {
      socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    }
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: server.address().port,
    close: () => {
      for (const socket of sockets) socket.destroy();
      server.close();
    },
  };
}

export async function captureWebsite(value, executablePath) {
  const url = checkedUrl(value);
  await publicAddress(url.hostname);
  const proxy = await safeProxy();
  let browser;
  const timer = setTimeout(() => browser?.close(), 45000);
  try {
    const browserPath =
      executablePath ||
      (await import("@playwright/test")).chromium.executablePath();
    browser = await puppeteer.launch({
      executablePath: browserPath,
      headless: true,
      args: [
        `--proxy-server=http://127.0.0.1:${proxy.port}`,
        "--proxy-bypass-list=<-loopback>",
        "--disable-quic",
        "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1",
        "--force-webrtc-ip-handling-policy=disable_non_proxied_udp",
        "--disable-background-networking",
        "--disable-extensions",
      ],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await page.setBypassServiceWorker(true);
    await page.setRequestInterception(true);
    let requests = 0;
    page.on("request", (request) => {
      try {
        checkedUrl(request.url());
        if (
          ++requests > 160 ||
          request.method() !== "GET" ||
          ["media", "websocket", "eventsource"].includes(request.resourceType())
        )
          throw new Error();
        void request.continue().catch(() => {});
      } catch {
        void request.abort().catch(() => {});
      }
    });
    page.on("dialog", (dialog) => void dialog.dismiss().catch(() => {}));
    browser.on("targetcreated", async (target) => {
      try {
        if (target.type() === "page" && target.url() !== "about:blank") {
          const popup = await target.page();
          if (popup && popup !== page) await popup.close();
        }
      } catch {
        /* Target may already be closed by the capture deadline. */
      }
    });
    const response = await page.goto(url.href, {
      waitUntil: "networkidle2",
      timeout: 30000,
    });
    if (
      !response?.ok() ||
      !response.headers()["content-type"]?.includes("text/html")
    ) {
      throw new Error("The website did not return an accessible HTML page.");
    }
    const screenshots = [];
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    for (const y of [
      0,
      ...(height > 900 ? [Math.min(900, height - 900)] : []),
    ]) {
      await page.evaluate((offset) => window.scrollTo(0, offset), y);
      const image = await page.screenshot({ type: "png", encoding: "base64" });
      if (image.length > 4_000_000)
        throw new Error("Website screenshot exceeds the capture limit.");
      screenshots.push({
        y,
        image,
        sha256: (await import("node:crypto"))
          .createHash("sha256")
          .update(Buffer.from(image, "base64"))
          .digest("hex"),
      });
    }
    const content = await page.evaluate(() => ({
      title: document.title.slice(0, 200),
      text: document.body.innerText.slice(0, 100000),
      text_truncated: document.body.innerText.length > 100000,
    }));
    if (!content.text.trim())
      throw new Error("No visible text was found on the website.");
    return {
      ...content,
      requested_url: url.href,
      url: checkedUrl(page.url()).href,
      captured_at: new Date().toISOString(),
      screenshots,
      coverage:
        "Top two viewports (maximum 1800 vertical pixels); not a complete crawl.",
    };
  } finally {
    clearTimeout(timer);
    await browser?.close();
    proxy.close();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    let input = "";
    for await (const part of process.stdin) {
      input += part;
      if (input.length > 8192) throw new Error("Input too large");
    }
    const { url, executablePath } = JSON.parse(input);
    process.stdout.write(
      JSON.stringify(await captureWebsite(url, executablePath)),
    );
  } catch (error) {
    process.stderr.write(error.message);
    process.exitCode = 1;
  }
}
