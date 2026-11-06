/**
 * End-to-end tests: loads the unpacked extension into Chrome for Testing and
 * serves fake Finance and operations / non-F&O pages over local HTTPS.
 *
 * Requires: npm install && npx puppeteer browsers install chrome
 */
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const puppeteer = require("puppeteer");

const EXTENSION_DIR = path.join(__dirname, "..", "TaskRecorderScreenshot");
const FNO_HOST = "contoso.operations.dynamics.com";
const CRM_HOST = "attacker.crm.dynamics.com";
const THIRD_PARTY_HOST = "thirdparty.example";
const PANE_WIDTH = 300;
const BAR_WIDTH = 100;
const MARKER = "#screenshotExtensionIsInstalled";

let tmpDir;
let server;
let port;
let browser;
let extensionId;
let worker;

function fixturePage(iframeSrc) {
  return `<!doctype html>
<html><head><style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #ff0000; }
  #bar { position: fixed; left: 0; top: 0; width: ${BAR_WIDTH}px; height: 100%; background: #00ff00; }
  #asidePane { position: fixed; right: 0; top: 0; width: ${PANE_WIDTH}px; height: 100%; background: #0000ff; }
  iframe { position: fixed; left: 200px; top: 10px; width: 50px; height: 50px; border: 0; }
</style>
<script>
  window.__shots = [];
  window.addEventListener("message", (e) => {
    if (typeof e.data === "string" && e.data.startsWith("data:image/png")) {
      window.__shots.push(e.data);
    }
  });
  // Minimal jQuery stand-in: .on() binds a native listener and passes a
  // wrapper exposing originalEvent; .trigger() calls handlers without one.
  (function () {
    const handlers = [];
    window.jQuery = function (el) {
      return {
        on(type, fn) {
          const name = type.split(".")[0];
          handlers.push(fn);
          el.addEventListener(name, (e) => fn({ type: name, originalEvent: e }));
        },
        trigger(name) {
          handlers.forEach((fn) => fn({ type: name }));
        },
      };
    };
    window.jQuery.fn = {};
  })();
</script></head>
<body><div id="bar"></div><div id="asidePane"></div>${
    iframeSrc ? `<iframe src="${iframeSrc}"></iframe>` : ""
  }</body></html>`;
}

function handleRequest(req, res) {
  const host = (req.headers.host || "").split(":")[0];
  res.setHeader("Content-Type", "text/html");
  if (host === THIRD_PARTY_HOST) {
    res.end("<!doctype html><body>third party</body>");
  } else if (req.url.startsWith("/with-iframe")) {
    res.end(fixturePage(`https://${THIRD_PARTY_HOST}:${port}/frame`));
  } else {
    res.end(fixturePage());
  }
}

const url = (host, pathname = "/") => `https://${host}:${port}${pathname}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function openPage(pageUrl) {
  const page = await browser.newPage();
  await page.goto(pageUrl, { waitUntil: "load" });
  return page;
}

async function openFnoPage() {
  const page = await openPage(url(FNO_HOST));
  await page.waitForSelector(MARKER, { timeout: 10000 });
  await page.waitForFunction(() => window.jQuery.__trScreenshotHooked === true, {
    timeout: 5000,
  });
  return page;
}

async function collectShots(page, action, expected, settleMs = 1500) {
  await page.evaluate(() => {
    window.__shots = [];
  });
  const started = Date.now();
  await page.evaluate(action);
  if (expected > 0) {
    await page.waitForFunction((n) => window.__shots.length >= n, { timeout: 15000 }, expected);
  }
  const elapsed = Date.now() - started;
  await sleep(settleMs);
  return { shots: await page.evaluate(() => window.__shots), elapsed };
}

function analyzeShot(page, dataUrl) {
  return page.evaluate(async (src) => {
    const img = new Image();
    img.src = src;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const row = ctx.getImageData(0, Math.floor(canvas.height / 2), canvas.width, 1).data;
    let greenEnd = 0;
    let bluePixels = 0;
    for (let x = 0; x < canvas.width; x += 1) {
      const [r, g, b] = [row[x * 4], row[x * 4 + 1], row[x * 4 + 2]];
      if (g > 200 && r < 60 && b < 60) greenEnd = x + 1;
      if (b > 200 && r < 60 && g < 60) bluePixels += 1;
    }
    return {
      width: canvas.width,
      height: canvas.height,
      greenEnd,
      bluePixels,
      dpr: window.devicePixelRatio,
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
    };
  }, dataUrl);
}

async function findTabId(urlPrefix) {
  return worker.evaluate(async (prefix) => {
    const tabs = await chrome.tabs.query({});
    const tab = tabs.find((t) => t.url && t.url.startsWith(prefix));
    return tab ? tab.id : null;
  }, urlPrefix);
}

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "trplus-e2e-"));
  const keyPath = path.join(tmpDir, "key.pem");
  const certPath = path.join(tmpDir, "cert.pem");
  execFileSync("openssl", [
    "req", "-x509", "-newkey", "rsa:2048", "-nodes",
    "-keyout", keyPath, "-out", certPath, "-days", "1",
    "-subj", "/CN=trplus-e2e",
    "-addext", `subjectAltName=DNS:${FNO_HOST},DNS:${CRM_HOST},DNS:${THIRD_PARTY_HOST}`,
  ], { stdio: "ignore" });

  server = https.createServer(
    { key: fs.readFileSync(keyPath), cert: fs.readFileSync(certPath) },
    handleRequest
  );
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = server.address().port;

  const resolverRules = [FNO_HOST, CRM_HOST, THIRD_PARTY_HOST]
    .map((host) => `MAP ${host} 127.0.0.1`)
    .join(",");

  browser = await puppeteer.launch({
    headless: true,
    pipe: true,
    enableExtensions: true,
    acceptInsecureCerts: true,
    defaultViewport: null,
    args: [
      `--host-resolver-rules=${resolverRules}`,
      "--ignore-certificate-errors",
      "--window-size=1200,800",
      "--force-device-scale-factor=2",
    ],
  });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => (server ? server.close(resolve) : resolve()));
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

test("reinjection targets only the top frame and skips tabs that already have the script", async () => {
  // Open the page before installing so the manifest content scripts never run.
  const page = await openPage(url(FNO_HOST, "/with-iframe"));

  extensionId = await browser.installExtension(EXTENSION_DIR);
  const workerTarget = await browser.waitForTarget(
    (t) => t.type() === "service_worker" && t.url() === `chrome-extension://${extensionId}/background.js`
  );
  worker = await workerTarget.worker();

  assert.equal(await page.$(MARKER), null, "no content script before reinjection");

  const tabId = await findTabId(url(FNO_HOST, "/with-iframe"));
  assert.ok(tabId, "found F&O tab");
  assert.equal(await worker.evaluate((id) => ensureScriptsInjected(id), tabId), true);
  await page.waitForSelector(MARKER, { timeout: 5000 });

  const thirdParty = page.frames().find((f) => f.url().includes(THIRD_PARTY_HOST));
  assert.ok(thirdParty, "third-party iframe loaded");
  assert.deepEqual(
    await thirdParty.evaluate(() => ({
      marker: !!document.getElementById("screenshotExtensionIsInstalled"),
      bridge: !!globalThis.__trPlusPageBridgeLoaded,
    })),
    { marker: false, bridge: false }
  );

  assert.equal(
    await worker.evaluate((id) => ensureScriptsInjected(id), tabId),
    false,
    "second call is a no-op"
  );
  await page.close();
});

test("native screenshot event yields exactly one cropped, unstretched image", async () => {
  const page = await openFnoPage();
  const { shots } = await collectShots(page, () => document.dispatchEvent(new Event("screenshot")), 1);
  assert.equal(shots.length, 1, "native + jQuery paths deduplicated");

  const shot = await analyzeShot(page, shots[0]);
  assert.equal(shot.dpr, 2);
  assert.equal(shot.width, (shot.innerWidth - PANE_WIDTH) * shot.dpr, "pane cropped off");
  assert.equal(shot.height, shot.innerHeight * shot.dpr);
  assert.equal(shot.bluePixels, 0, "no Task Recorder pane pixels");
  assert.ok(
    Math.abs(shot.greenEnd - BAR_WIDTH * shot.dpr) <= 1,
    `bar keeps its width (got ${shot.greenEnd}px, want ${BAR_WIDTH * shot.dpr}px)`
  );
  await page.close();
});

test("rapid requests are queued and throttled, not dropped", async () => {
  const page = await openFnoPage();
  const { shots, elapsed } = await collectShots(
    page,
    () => {
      for (let i = 0; i < 4; i += 1) document.dispatchEvent(new Event("screenshot"));
    },
    4
  );
  assert.equal(shots.length, 4);
  assert.ok(elapsed >= 3 * 500, `captures spaced for the 2/sec quota (took ${elapsed}ms)`);
  await page.close();
});

test("jQuery-only trigger yields one image", async () => {
  const page = await openFnoPage();
  const { shots } = await collectShots(page, () => window.jQuery(document).trigger("screenshot"), 1);
  assert.equal(shots.length, 1);
  await page.close();
});

test("hidden Task Recorder pane returns the full viewport", async () => {
  const page = await openFnoPage();
  await page.evaluate(() => {
    document.getElementById("asidePane").style.display = "none";
  });
  const { shots } = await collectShots(page, () => document.dispatchEvent(new Event("screenshot")), 1);
  const shot = await analyzeShot(page, shots[0]);
  assert.equal(shot.width, shot.innerWidth * shot.dpr);
  await page.close();
});

test("content scripts cannot call popup-only messages", async () => {
  const page = await openFnoPage();
  let realm;
  for (let i = 0; i < 20 && !realm; i += 1) {
    realm = page.extensionRealms()[0];
    if (!realm) await sleep(100);
  }
  assert.ok(realm, "content script realm available");
  const results = await realm.evaluate(async () => ({
    testCapture: await chrome.runtime.sendMessage({ name: "testCapture", tabId: 1 }),
    ensureInjected: await chrome.runtime.sendMessage({ name: "ensureInjected", tabId: 1 }),
  }));
  assert.deepEqual(results, {
    testCapture: { error: "Unauthorized sender" },
    ensureInjected: { error: "Unauthorized sender" },
  });
  await page.close();
});

test("non-F&O Dynamics host gets no content script and no captures", async () => {
  const page = await openPage(url(CRM_HOST));
  await sleep(1500);
  assert.equal(await page.$(MARKER), null);
  assert.equal(page.extensionRealms().length, 0);
  assert.equal(await page.evaluate(() => !!globalThis.__trPlusPageBridgeLoaded), false);

  const { shots } = await collectShots(page, () => document.dispatchEvent(new Event("screenshot")), 0);
  assert.equal(shots.length, 0);
  await page.close();
});

test("toolbar popup diagnoses and test-captures the F&O tab", async () => {
  const page = await openFnoPage();
  await page.bringToFront();
  const extension = (await browser.extensions()).get(extensionId);
  await page.triggerExtensionAction(extension);
  const popupTarget = await browser.waitForTarget(
    (t) => t.url() === `chrome-extension://${extensionId}/popup.html`
  );
  const popup = await popupTarget.asPage();

  await popup.click("#diagnose");
  await popup.waitForFunction(
    () => document.getElementById("status").className !== "info",
    { timeout: 10000 }
  );
  const status = await popup.$eval("#status", (el) => ({ kind: el.className, text: el.textContent }));
  assert.equal(status.kind, "ok", status.text);
  assert.match(status.text, /Extension version: 2\.3\.0/);

  await popup.click("#testCapture");
  await popup.waitForSelector("#preview img", { timeout: 10000 });
  assert.equal(await popup.$eval("#status", (el) => el.className), "ok");
  await popup.close();
  await page.close();
});
