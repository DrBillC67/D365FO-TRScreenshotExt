const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const zlib = require("node:zlib");
const { buildPackages } = require("../scripts/package.js");

function readZip(buffer) {
  const end = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  assert.ok(end >= 0, "end of central directory found");
  const count = buffer.readUInt16LE(end + 10);
  let pointer = buffer.readUInt32LE(end + 16);
  const entries = {};
  for (let i = 0; i < count; i += 1) {
    assert.equal(buffer.readUInt32LE(pointer), 0x02014b50);
    const crc = buffer.readUInt32LE(pointer + 16);
    const compressedSize = buffer.readUInt32LE(pointer + 20);
    const nameLength = buffer.readUInt16LE(pointer + 28);
    const localOffset = buffer.readUInt32LE(pointer + 42);
    const name = buffer.toString("utf8", pointer + 46, pointer + 46 + nameLength);
    const dataStart = localOffset + 30 + buffer.readUInt16LE(localOffset + 26) + buffer.readUInt16LE(localOffset + 28);
    const data = zlib.inflateRawSync(buffer.subarray(dataStart, dataStart + compressedSize));
    assert.equal(zlib.crc32(data), crc, `CRC matches for ${name}`);
    entries[name] = data;
    pointer += 46 + nameLength;
  }
  return entries;
}

test("store and unpacked zips contain the extension with the right layout", () => {
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "trplus-package-"));
  try {
    const { version, files, store, unpacked } = buildPackages({ outDir });
    const manifest = JSON.parse(
      fs.readFileSync(path.join(__dirname, "..", "TaskRecorderScreenshot", "manifest.json"), "utf8")
    );
    assert.equal(version, manifest.version);

    const storeEntries = readZip(fs.readFileSync(store));
    assert.deepEqual(Object.keys(storeEntries).sort(), files);
    assert.ok(storeEntries["manifest.json"], "manifest.json at the zip root");
    assert.equal(JSON.parse(storeEntries["manifest.json"]).version, version);
    assert.ok(!Object.keys(storeEntries).some((name) => name.startsWith(".") || name.includes("/.")));

    const unpackedEntries = readZip(fs.readFileSync(unpacked));
    assert.deepEqual(
      Object.keys(unpackedEntries).sort(),
      files.map((file) => `TaskRecorderScreenshot/${file}`)
    );
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
});
