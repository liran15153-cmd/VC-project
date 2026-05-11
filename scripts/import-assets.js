#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  ROOT_DIR,
  PUBLIC_REGISTRY_PATH,
  REGISTRY_PATH,
  ensureDir,
  findLicense,
  getImageDimensions,
  hashFile,
  inferAtlasImage,
  inferCategory,
  inferEngines,
  inferRoleHints,
  inferScale,
  inferSubcategory,
  inferTags,
  inferType,
  inferVariant,
  listFiles,
  parseArgs,
  readRegistry,
  relativePath,
  slugify,
  titleize,
  toPosixPath,
  writeRegistry
} = require('./asset-utils');

const RUNTIME_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.gif',
  '.svg',
  '.glb',
  '.gltf',
  '.fbx',
  '.obj',
  '.mtl',
  '.mp3',
  '.wav',
  '.ogg',
  '.json',
  '.xml',
  '.tmx',
  '.tmj',
  '.tsx',
  '.txt',
  '.md'
]);

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sourceDir = path.resolve(ROOT_DIR, args.source || path.join('assets-library', 'raw'));
  const pack = slugify(args.pack || path.basename(sourceDir));

  if (!fs.existsSync(sourceDir)) {
    console.error(`Asset source does not exist: ${sourceDir}`);
    process.exitCode = 1;
    return;
  }

  const now = new Date().toISOString();
  const license = args.license || findLicense(sourceDir);
  const registry = readRegistry();
  const assets = args['replace-pack']
    ? registry.assets.filter((asset) => !isPackAsset(asset, pack))
    : [...registry.assets];
  const byFilePath = new Map(assets.map((asset, index) => [asset.filePath, index]));

  const warnings = [];
  let found = 0;
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const sourcePath of listFiles(sourceDir)) {
    const ext = path.extname(sourcePath).toLowerCase();
    if (!RUNTIME_EXTENSIONS.has(ext)) {
      skipped += 1;
      continue;
    }

    const type = inferType(sourcePath);
    if (!type) {
      skipped += 1;
      warnings.push(`Unsupported asset type: ${relativePath(ROOT_DIR, sourcePath)}`);
      continue;
    }

    found += 1;
    const relFromSource = relativePath(sourceDir, sourcePath);
    const relDir = path.dirname(relFromSource) === '.' ? '' : path.dirname(relFromSource);
    const cleanRelDir = relDir
      .split(/[\\/]+/)
      .map(slugify)
      .filter(Boolean)
      .join('/');
    const fileBase = slugify(path.basename(sourcePath, ext));
    const runtimeRelPath = toPosixPath(path.join(pack, cleanRelDir, `${fileBase}${ext}`));
    const processedPath = path.join(ROOT_DIR, 'assets-library', 'processed', runtimeRelPath);
    const publicFilePath = path.join(ROOT_DIR, 'public', 'assets', 'library', runtimeRelPath);
    const hash = hashFile(sourcePath);
    const stats = fs.statSync(sourcePath);

    ensureDir(path.dirname(processedPath));
    ensureDir(path.dirname(publicFilePath));
    fs.copyFileSync(sourcePath, processedPath);
    fs.copyFileSync(sourcePath, publicFilePath);

    const parts = cleanRelDir ? cleanRelDir.split('/') : [];
    const metadataParts = [pack, ...parts];
    const category = inferCategory(metadataParts, path.basename(sourcePath), type);
    const subcategory = inferSubcategory(category, metadataParts, path.basename(sourcePath), type);
    const engineCompatibility = inferEngines(type, ext.slice(1));
    const dimensions = ['image', 'spritesheet'].includes(type) ? getImageDimensions(sourcePath) : null;
    const roleHints = inferRoleHints(metadataParts, path.basename(sourcePath), category, subcategory, type);
    const id = slugify([pack, cleanRelDir, fileBase, ext.slice(1)].filter(Boolean).join('-'));
    const filePath = toPosixPath(path.relative(ROOT_DIR, processedPath));
    const publicPath = `/assets/library/${runtimeRelPath}`;

    const nextAsset = {
      id,
      name: titleize(path.basename(sourcePath, ext)),
      type,
      category,
      subcategory,
      tags: inferTags(metadataParts, path.basename(sourcePath), type, category, subcategory, engineCompatibility),
      pack,
      sourcePack: pack,
      sourceRelativePath: relFromSource,
      roleHints,
      variant: inferVariant(metadataParts, path.basename(sourcePath)),
      scale: inferScale(metadataParts, path.basename(sourcePath)),
      atlasImage: inferAtlasImage(sourcePath, type),
      engineCompatibility,
      filePath,
      publicPath,
      thumbnailPath: null,
      source: args.source ? 'local-import' : 'local-raw',
      license,
      dimensions,
      fileSize: stats.size,
      format: ext.slice(1),
      hash,
      createdAt: now,
      updatedAt: now
    };

    const existingIndex = byFilePath.get(filePath);
    if (existingIndex === undefined) {
      assets.push(nextAsset);
      byFilePath.set(filePath, assets.length - 1);
      added += 1;
    } else {
      const existing = assets[existingIndex];
      assets[existingIndex] = {
        ...existing,
        ...nextAsset,
        createdAt: existing.createdAt || nextAsset.createdAt,
        updatedAt: now
      };
      updated += 1;
    }
  }

  const nextRegistry = {
    schemaVersion: 1,
    generatedAt: now,
    assets: ensureUniqueAssetIds(assets).sort((a, b) => a.id.localeCompare(b.id))
  };

  writeRegistry(nextRegistry, REGISTRY_PATH);
  writeRegistry(nextRegistry, PUBLIC_REGISTRY_PATH);

  console.log(`Asset import summary`);
  console.log(`source: ${relativePath(ROOT_DIR, sourceDir)}`);
  console.log(`pack: ${pack}`);
  console.log(`found: ${found}`);
  console.log(`added: ${added}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped: ${skipped}`);
  console.log(`warnings: ${warnings.length}`);
  for (const warning of warnings) console.warn(`- ${warning}`);
}

function ensureUniqueAssetIds(assets) {
  const used = new Set();
  return assets.map((asset) => {
    let id = asset.id;
    if (!used.has(id)) {
      used.add(id);
      return asset;
    }

    const format = asset.format ? slugify(asset.format) : 'asset';
    const base = `${id}-${format}`;
    id = base;
    let suffix = 2;
    while (used.has(id)) {
      id = `${base}-${suffix}`;
      suffix += 1;
    }

    used.add(id);
    return { ...asset, id };
  });
}

function isPackAsset(asset, pack) {
  return String(asset.filePath || '').startsWith(`assets-library/processed/${pack}/`) ||
    String(asset.publicPath || '').startsWith(`/assets/library/${pack}/`);
}

main();
