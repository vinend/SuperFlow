import { test } from "node:test";
import assert from "node:assert/strict";
// @ts-expect-error Node test imports a repository-native ESM browser worker.
import { checkedUrl, publicAddress } from "../../scripts/capture-website.mjs";

test("browser rejects credentials, local protocols and nonstandard ports", () => {
  for (const url of [
    "file:///C:/secret",
    "https://user:password@example.com",
    "http://example.com:8000",
  ]) {
    assert.throws(() => checkedUrl(url));
  }
  assert.equal(checkedUrl("https://example.com/path").pathname, "/path");
});

test("browser rejects private, mapped, loopback and mixed public/private DNS", async () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "169.254.169.254",
    "192.168.1.1",
    "100.64.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:127.0.0.1",
    "224.0.0.1",
  ]) {
    await assert.rejects(publicAddress("host", async () => [{ address }]));
  }
  await assert.rejects(
    publicAddress("host", async () => [
      { address: "8.8.8.8" },
      { address: "10.0.0.1" },
    ]),
  );
  assert.equal(
    await publicAddress("host", async () => [{ address: "8.8.8.8" }]),
    "8.8.8.8",
  );
});
