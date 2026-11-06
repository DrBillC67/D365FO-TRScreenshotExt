const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const EXTENSION_DIR = path.join(__dirname, "..", "TaskRecorderScreenshot");

function loadHosts() {
  const context = vm.createContext({ URL });
  vm.runInContext(
    fs.readFileSync(path.join(EXTENSION_DIR, "hosts.js"), "utf8"),
    context
  );
  return {
    suffixes: vm.runInContext("TR_ALLOWED_HOST_SUFFIXES", context),
    isAllowed: vm.runInContext("isAllowedDynamicsUrl", context),
  };
}

const manifest = JSON.parse(
  fs.readFileSync(path.join(EXTENSION_DIR, "manifest.json"), "utf8")
);

test("allows Finance and operations hosts", () => {
  const { isAllowed } = loadHosts();
  for (const url of [
    "https://contoso.operations.dynamics.com/?cmp=USMF",
    "https://contoso-uat.sandbox.operations.dynamics.com/",
    "https://contoso.operations.eu.dynamics.com/",
    "https://contoso.operations.uae.dynamics.com/",
    "https://devbox-1devaos.cloudax.dynamics.com/",
    "https://contoso.operations.gov.microsoftdynamics.us/",
    "https://contoso.operations.high.microsoftdynamics.us/",
    "https://CONTOSO.OPERATIONS.DYNAMICS.COM/",
  ]) {
    assert.equal(isAllowed(url), true, url);
  }
});

test("rejects non-F&O Dynamics hosts, lookalikes, and non-HTTPS", () => {
  const { isAllowed } = loadHosts();
  for (const url of [
    "https://attacker.crm.dynamics.com/WebResources/x.html",
    "https://contoso.crm.microsoftdynamics.us/",
    "https://lcs.dynamics.com/",
    "https://operations.dynamics.com/",
    "https://evil-operations.dynamics.com/",
    "https://contoso.operations.dynamics.com.evil.example/",
    "https://evil.example/?u=contoso.operations.dynamics.com",
    "http://contoso.operations.dynamics.com/",
    "https://login.microsoftonline.com/",
    "not a url",
    "",
    undefined,
  ]) {
    assert.equal(isAllowed(url), false, String(url));
  }
});

test("manifest content script matches mirror hosts.js", () => {
  const { suffixes } = loadHosts();
  const expected = [...suffixes].map((suffix) => `https://*${suffix}/*`).sort();
  assert.equal(manifest.content_scripts.length, 2);
  for (const script of manifest.content_scripts) {
    assert.deepEqual([...script.matches].sort(), expected);
  }
});

test("manifest permissions are minimal", () => {
  assert.deepEqual([...manifest.permissions].sort(), ["scripting", "tabs"]);
  assert.deepEqual(manifest.host_permissions, ["<all_urls>"]);
  assert.equal(manifest.externally_connectable, undefined);
  assert.equal(manifest.web_accessible_resources, undefined);
});

test("no source references chrome.tabs.captureTab", () => {
  for (const file of fs.readdirSync(EXTENSION_DIR)) {
    if (file.endsWith(".js")) {
      const source = fs.readFileSync(path.join(EXTENSION_DIR, file), "utf8");
      assert.doesNotMatch(source, /captureTab\b/, file);
    }
  }
});
