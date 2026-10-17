import puppeteer from "puppeteer-core";
import http from "node:http";
import net from "node:net";
import https from "node:https";
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

// Download discovered PDFs through the same public-address boundary. The socket
// uses a checked IP while TLS still verifies the original hostname.
export async function downloadPublicPdf(value, redirects = 0) {
  const url = checkedUrl(value);
  if (redirects > 5) throw new Error("Too many PDF redirects.");
  const address = await publicAddress(url.hostname);
  const response = await new Promise((resolve, reject) => {
    const request = (url.protocol === "https:" ? https : http).get(
      url,
      {
        lookup: (_host, options, callback) => {
          const entry = { address, family: net.isIP(address) };
          if (options.all) callback(null, [entry]);
          else callback(null, address, entry.family);
        },
        headers: {
          Accept: "application/pdf",
          "User-Agent": "SuperFlow-public-reference/1.0",
        },
      },
      resolve,
    );
    request.setTimeout(30000, () =>
      request.destroy(new Error("PDF download timed out.")),
    );
    request.on("error", reject);
  });
  if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
    const location = response.headers.location;
    response.destroy();
    if (!location) throw new Error("Missing PDF redirect location.");
    return downloadPublicPdf(new URL(location, url).href, redirects + 1);
  }
  if (response.statusCode !== 200) {
    response.destroy();
    throw new Error(`PDF download failed (HTTP ${response.statusCode}).`);
  }
  const parts = [];
  let size = 0;
  for await (const part of response) {
    size += part.length;
    if (size > 10 * 1024 * 1024) {
      response.destroy();
      throw new Error("PDF exceeds 10 MB.");
    }
    parts.push(part);
  }
  const data = Buffer.concat(parts);
  if (!data.subarray(0, 5).equals(Buffer.from("%PDF-")))
    throw new Error("The result is not a PDF.");
  return { url: url.href, content: data.toString("base64") };
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

export async function captureWebsite(value, executablePath, options = {}) {
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
      (!response?.ok() &&
        !(
          options.search &&
          options.scanSearch &&
          [403, 429, 503].includes(response?.status())
        )) ||
      !response.headers()["content-type"]?.includes("text/html")
    ) {
      throw new Error(
        `The website did not return accessible HTML (HTTP ${response?.status() || "unavailable"}).`,
      );
    }
    const screenshots = [];
    const height = await page.evaluate(
      () => document.documentElement.scrollHeight,
    );
    for (const y of options.search && !options.scanSearch
      ? []
      : [
          0,
          ...(height > 900 && options.maxScreenshots !== 1
            ? [Math.min(900, height - 900)]
            : []),
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
      links: Array.from(document.querySelectorAll("a[href]"))
        .map((a) => ({
          url: a.href,
          result_heading: Boolean(a.querySelector("h3")),
          title: (a.querySelector("h3")?.textContent || a.textContent || "")
            .trim()
            .slice(0, 240),
        }))
        .filter((a) => a.title && /^https?:/.test(a.url))
        .slice(0, 500),
    }));
    if (!content.text.trim())
      throw new Error("No visible text was found on the website.");
    if (options.search) {
      const results = [];
      const seen = new Set();
      for (const link of content.links) {
        try {
          let target = new URL(link.url);
          if (
            target.hostname.endsWith("google.com") &&
            target.pathname === "/url"
          )
            target = new URL(
              target.searchParams.get("q") || target.searchParams.get("url"),
            );
          if (
            (options.searchAll
              ? !link.result_heading ||
                /(^|\.)google\.[a-z.]+$/.test(target.hostname)
              : !["ojk.go.id", "www.ojk.go.id"].includes(target.hostname)) ||
            seen.has(target.href)
          )
            continue;
          checkedUrl(target.href);
          seen.add(target.href);
          results.push({ ...link, url: target.href });
        } catch {
          /* Ignore non-result links. */
        }
      }
      if (!results.length && !options.scanSearch)
        throw new Error(
          "Google returned no accessible OJK results. It may require consent or CAPTCHA; no bypass or synthetic results are used.",
        );
      return {
        query: options.search,
        search_url: url.href,
        captured_at: new Date().toISOString(),
        results: results.slice(0, 10),
        engine: "google-puppeteer",
        blocked: !response.ok() || results.length === 0,
        http_status: response.status(),
        ...(options.scanSearch
          ? {
              ...content,
              url: url.href,
              requested_url: url.href,
              screenshots,
              coverage:
                "First Google results viewport; result URLs come from DOM links, not model output.",
            }
          : {}),
      };
    }
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
    const {
      url,
      executablePath,
      search,
      searchAll,
      scanSearch,
      maxScreenshots,
      downloadPdf,
    } = JSON.parse(input);
    if (downloadPdf) {
      process.stdout.write(JSON.stringify(await downloadPublicPdf(url)));
      process.exit(0);
    }
    const target = search
      ? `https://www.google.com/search?q=${encodeURIComponent(`${searchAll ? "" : "site:ojk.go.id "}${String(search).slice(0, 200)}`)}&num=10`
      : url;
    process.stdout.write(
      JSON.stringify(
        await captureWebsite(target, executablePath, {
          search,
          searchAll,
          scanSearch,
          maxScreenshots,
        }),
      ),
    );
  } catch (error) {
    process.stderr.write(error.message);
    process.exitCode = 1;
  }
}
