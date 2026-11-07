#!/usr/bin/env node
/**
 * Builds distributable zips of the extension into dist/:
 *   - <name>-<version>-store.zip      manifest.json at the zip root (Chrome Web Store, Edge Add-ons)
 *   - TaskRecorderScreenshot-<version>.zip   files inside a TaskRecorderScreenshot/ folder (unzip + Load unpacked)
 *
 * Validates the manifest and every file it references before writing.
 * No dependencies: writes standard deflate zips with node:zlib.
 */
const fs = require("node:fs");
const path = require("node:path");
const zlib = require("node:zlib");

const ROOT = path.join(__dirname, "..");
const EXTENSION_DIR = path.join(ROOT, "TaskRecorderScreenshot");
const FOLDER_NAME = "TaskRecorderScreenshot";
const STORE_SLUG = "d365fo-tr-plus-screenshots";
const MAX_NAME_LENGTH = 75;
const MAX_DESCRIPTION_LENGTH = 132;
const FORBIDDEN_EXTENSIONS = [".pem", ".crx", ".zip", ".map"];

function listFiles(dir, base = dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith("."))
    .flatMap((entry) => {
      const full = path.join(dir, entry.name);
      return entry.isDirectory()
        ? listFiles(full, base)
        : [path.relative(base, full).split(path.sep).join("/")];
    })
    .sort();
}

function referencedFiles(manifest) {
  const refs = new Set();
  const addAll = (value) => {
    if (typeof value === "string") refs.add(value);
    else if (value && typeof value === "object") Object.values(value).forEach(addAll);
  };
  addAll(manifest.icons);
  addAll(manifest.action && manifest.action.default_icon);
  addAll(manifest.action && manifest.action.default_popup);
  addAll(manifest.background && manifest.background.service_worker);
  for (const script of manifest.content_scripts || []) {
    (script.js || []).forEach((file) => refs.add(file));
    (script.css || []).forEach((file) => refs.add(file));
  }

  const popup = manifest.action && manifest.action.default_popup;
  if (popup) {
    const html = fs.readFileSync(path.join(EXTENSION_DIR, popup), "utf8");
    for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) refs.add(match[1]);
  }
  const worker = manifest.background && manifest.background.service_worker;
  if (worker) {
    const source = fs.readFileSync(path.join(EXTENSION_DIR, worker), "utf8");
    for (const match of source.matchAll(/importScripts\(([^)]*)\)/g)) {
      for (const file of match[1].matchAll(/["']([^"']+)["']/g)) refs.add(file[1]);
    }
  }
  return [...refs];
}

function validate(files) {
  const errors = [];
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.join(EXTENSION_DIR, "manifest.json"), "utf8"));
  } catch (error) {
    throw new Error(`manifest.json is not valid JSON: ${error.message}`);
  }

  if (manifest.manifest_version !== 3) errors.push("manifest_version must be 3");
  if (!/^\d+(\.\d+){0,3}$/.test(manifest.version || "")) {
    errors.push(`version "${manifest.version}" must be 1-4 dot-separated integers`);
  }
  if (!manifest.name || manifest.name.length > MAX_NAME_LENGTH) {
    errors.push(`name must be 1-${MAX_NAME_LENGTH} characters`);
  }
  if (!manifest.description || manifest.description.length > MAX_DESCRIPTION_LENGTH) {
    errors.push(`description must be 1-${MAX_DESCRIPTION_LENGTH} characters (is ${(manifest.description || "").length})`);
  }
  if (!manifest.icons || !manifest.icons["128"]) errors.push("a 128px icon is required");

  for (const ref of referencedFiles(manifest)) {
    if (!files.includes(ref)) errors.push(`referenced file is missing: ${ref}`);
  }
  for (const file of files) {
    if (FORBIDDEN_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      errors.push(`file must not be packaged: ${file}`);
    }
  }

  if (errors.length) {
    throw new Error(`Package validation failed:\n  - ${errors.join("\n  - ")}`);
  }
  return manifest;
}

function dosDateTime(date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time, day };
}

function createZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const { name, data, modified } of entries) {
    const nameBuffer = Buffer.from(name, "utf8");
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = zlib.crc32(data);
    const { time, day } = dosDateTime(modified);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(compressed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, nameBuffer, compressed);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(8, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(compressed.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBuffer.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBuffer);

    offset += local.length + nameBuffer.length + compressed.length;
  }

  const centralSize = centrals.reduce((sum, buffer) => sum + buffer.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...centrals, end]);
}

function buildPackages({ outDir = path.join(ROOT, "dist") } = {}) {
  const files = listFiles(EXTENSION_DIR);
  const manifest = validate(files);
  const entries = files.map((file) => {
    const full = path.join(EXTENSION_DIR, file);
    return { file, data: fs.readFileSync(full), modified: fs.statSync(full).mtime };
  });

  fs.mkdirSync(outDir, { recursive: true });
  const store = path.join(outDir, `${STORE_SLUG}-${manifest.version}-store.zip`);
  const unpacked = path.join(outDir, `${FOLDER_NAME}-${manifest.version}.zip`);
  fs.writeFileSync(store, createZip(entries.map((e) => ({ ...e, name: e.file }))));
  fs.writeFileSync(
    unpacked,
    createZip(entries.map((e) => ({ ...e, name: `${FOLDER_NAME}/${e.file}` })))
  );
  return { version: manifest.version, files, store, unpacked };
}

if (require.main === module) {
  try {
    const result = buildPackages();
    const size = (file) => `${(fs.statSync(file).size / 1024).toFixed(1)} KB`;
    console.log(`D365FO TR Plus Screenshots ${result.version} — ${result.files.length} files`);
    console.log(`  Store upload:   ${path.relative(ROOT, result.store)} (${size(result.store)})`);
    console.log(`  Load unpacked:  ${path.relative(ROOT, result.unpacked)} (${size(result.unpacked)})`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { buildPackages };
