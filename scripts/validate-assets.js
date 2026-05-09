#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT_DIR,
  REGISTRY_PATH,
  VALID_ASSET_TYPES,
  VALID_ENGINES,
  readRegistry
} = require('./asset-utils');

const MAX_WARN_BYTES = 10 * 1024 * 1024;

function publicPathToFile(publicPath) {
  const clean = String(publicPath || '').replace(/^\/+/, '');
  return path.join(ROOT_DIR, 'public', clean.replace(/^assets[\\/]/, 'assets/'));
}

function main() {
  const errors = [];
  const warnings = [];

  if (!fs.existsSync(REGISTRY_PATH)) {
    errors.push(`Missing registry: ${REGISTRY_PATH}`);
  }

  let registry;
  try {
    registry = readRegistry();
  } catch (err) {
    errors.push(`Invalid registry JSON: ${err.message}`);
    registry = { assets: [] };
  }

  const seenIds = new Set();
  for (const asset of registry.assets) {
    if (!asset.id) errors.push('Asset is missing id');
    else if (seenIds.has(asset.id)) errors.push(`Duplicate asset id: ${asset.id}`);
    else seenIds.add(asset.id);

    if (!asset.type || !VALID_ASSET_TYPES.has(asset.type)) errors.push(`${asset.id || '<unknown>'}: invalid type "${asset.type}"`);
    if (!asset.category) errors.push(`${asset.id || '<unknown>'}: missing category`);

    if (!Array.isArray(asset.engineCompatibility)) {
      errors.push(`${asset.id || '<unknown>'}: engineCompatibility must be an array`);
    } else {
      for (const engine of asset.engineCompatibility) {
        if (!VALID_ENGINES.has(engine)) errors.push(`${asset.id}: invalid engine "${engine}"`);
      }
    }

    if (!asset.filePath) errors.push(`${asset.id || '<unknown>'}: missing filePath`);
    else if (!fs.existsSync(path.join(ROOT_DIR, asset.filePath))) errors.push(`${asset.id}: filePath does not exist: ${asset.filePath}`);

    if (!asset.publicPath) errors.push(`${asset.id || '<unknown>'}: missing publicPath`);
    else if (!fs.existsSync(publicPathToFile(asset.publicPath))) errors.push(`${asset.id}: publicPath does not exist: ${asset.publicPath}`);

    if (Number(asset.fileSize) > MAX_WARN_BYTES) {
      warnings.push(`${asset.id}: large file (${asset.fileSize} bytes)`);
    }
  }

  console.log(`Asset validation summary`);
  console.log(`registry assets: ${registry.assets.length}`);
  console.log(`errors: ${errors.length}`);
  console.log(`warnings: ${warnings.length}`);

  for (const warning of warnings) console.warn(`warning: ${warning}`);
  for (const error of errors) console.error(`error: ${error}`);

  if (errors.length > 0) process.exitCode = 1;
}

main();
