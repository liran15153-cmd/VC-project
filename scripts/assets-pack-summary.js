#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const { ROOT_DIR, readRegistry } = require('./asset-utils');
const { createAssetRegistryIndex } = require('../prototype/backend/src/services/assetRegistryService');

const MANIFEST_PATH = path.join(ROOT_DIR, 'assets-library', 'manifests', 'pack-summaries.json');
const PUBLIC_PATH = path.join(ROOT_DIR, 'public', 'assets', 'library', 'pack-summaries.json');

function main() {
  const registry = readRegistry();
  const index = createAssetRegistryIndex(registry);
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    packCount: index.packSummaries.length,
    packs: index.packSummaries
  };

  writeJson(MANIFEST_PATH, payload);
  writeJson(PUBLIC_PATH, payload);

  console.log('Asset pack summary');
  console.log(`packs: ${payload.packCount}`);
  for (const pack of payload.packs) {
    console.log(`${pack.packId}: ${pack.assetCount} assets, ${pack.dimension}, engines=${pack.engines.join('|') || 'none'}, roles=${pack.roles.slice(0, 8).join('|') || 'none'}`);
  }
}

function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

main();
