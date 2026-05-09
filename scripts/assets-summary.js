#!/usr/bin/env node

const { readRegistry } = require('./asset-utils');

function countBy(assets, key) {
  const counts = new Map();
  for (const asset of assets) {
    const values = Array.isArray(asset[key]) ? asset[key] : [asset[key] || 'unknown'];
    for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])));
}

function printCounts(title, counts) {
  console.log(`\n${title}`);
  for (const [key, count] of counts) console.log(`${key}: ${count}`);
}

function main() {
  const registry = readRegistry();
  const assets = registry.assets;
  const totalSize = assets.reduce((sum, asset) => sum + (Number(asset.fileSize) || 0), 0);

  console.log('Asset registry summary');
  console.log(`schemaVersion: ${registry.schemaVersion}`);
  console.log(`generatedAt: ${registry.generatedAt || 'never'}`);
  console.log(`assets: ${assets.length}`);
  console.log(`totalSizeBytes: ${totalSize}`);

  printCounts('By type', countBy(assets, 'type'));
  printCounts('By category', countBy(assets, 'category'));
  printCounts('By engine', countBy(assets, 'engineCompatibility'));
  printCounts('By source', countBy(assets, 'source'));
}

main();
