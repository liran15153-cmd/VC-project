const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT_DIR = path.resolve(__dirname, '..');
const REGISTRY_PATH = path.join(ROOT_DIR, 'assets-library', 'manifests', 'asset-registry.json');
const PUBLIC_REGISTRY_PATH = path.join(ROOT_DIR, 'public', 'assets', 'library', 'asset-registry.json');

const VALID_ASSET_TYPES = new Set(['image', 'spritesheet', 'atlas', 'tilemap', 'gltf', 'audio', 'json', 'text', 'arrayBuffer']);
const VALID_ENGINES = new Set(['phaser', 'three', 'rapier', 'godot']);

const EXTENSION_TYPE = new Map([
  ['.png', 'image'],
  ['.jpg', 'image'],
  ['.jpeg', 'image'],
  ['.webp', 'image'],
  ['.gif', 'image'],
  ['.svg', 'image'],
  ['.glb', 'gltf'],
  ['.gltf', 'gltf'],
  ['.fbx', 'gltf'],
  ['.obj', 'gltf'],
  ['.mtl', 'text'],
  ['.mp3', 'audio'],
  ['.wav', 'audio'],
  ['.ogg', 'audio'],
  ['.json', 'json'],
  ['.tmj', 'tilemap'],
  ['.tsx', 'tilemap'],
  ['.txt', 'text'],
  ['.md', 'text']
]);

const STOP_TAGS = new Set(['format', 'models', 'model', 'textures', 'texture', 'previews', 'preview', 'assets', 'asset', 'library']);

function toPosixPath(value) {
  return value.replace(/\\/g, '/');
}

function relativePath(from, to) {
  return toPosixPath(path.relative(from, to));
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-') || 'asset';
}

function titleize(value) {
  return String(value)
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listFiles(fullPath));
    else if (entry.isFile()) files.push(fullPath);
  }
  return files;
}

function hashFile(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function readRegistry(registryPath = REGISTRY_PATH) {
  if (!fs.existsSync(registryPath)) {
    return { schemaVersion: 1, generatedAt: null, assets: [] };
  }
  const parsed = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  if (Array.isArray(parsed)) return { schemaVersion: 1, generatedAt: null, assets: parsed };
  return {
    schemaVersion: parsed.schemaVersion || 1,
    generatedAt: parsed.generatedAt || null,
    assets: Array.isArray(parsed.assets) ? parsed.assets : []
  };
}

function writeRegistry(registry, registryPath = REGISTRY_PATH) {
  ensureDir(path.dirname(registryPath));
  fs.writeFileSync(registryPath, `${JSON.stringify(registry, null, 2)}\n`);
}

function inferType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const lower = filePath.toLowerCase();
  if (ext === '.json' && lower.includes('atlas')) return 'atlas';
  if ((ext === '.json' || ext === '.tmj') && (lower.includes('tilemap') || lower.includes('map'))) return 'tilemap';
  if (EXTENSION_TYPE.has(ext)) return EXTENSION_TYPE.get(ext);
  return null;
}

function inferEngines(type, format) {
  if (['image', 'spritesheet', 'atlas', 'tilemap', 'json'].includes(type)) return ['phaser'];
  if (type === 'gltf') return ['three', 'godot'];
  if (format === 'mtl') return ['three', 'godot'];
  if (type === 'audio') return ['phaser', 'three', 'godot'];
  if (format === 'txt' || type === 'text') return [];
  return [];
}

function inferCategory(parts, fileName) {
  const source = [...parts, fileName.replace(/\.[^.]+$/, '')].map((part) => slugify(part)).filter(Boolean);
  const joined = source.join(' ');

  if (/(character|player|hero|enemy|npc|warrior|archer|oobi|oodi|ooli|oopi|oozi)/.test(joined)) return 'character';
  if (/(coin|key|heart|star|jewel|collectible|pickup)/.test(joined)) return 'collectible';
  if (/(spike|trap|saw|hazard|bomb)/.test(joined)) return 'hazard';
  if (/(button|bar|paper|ui|ribbon|avatar|icon)/.test(joined)) return 'ui';
  if (/(music|sound|audio|sfx)/.test(joined)) return 'audio';
  if (/(tree|grass|forest|snow|rock|stone|platform|block|ground|tile|environment|fence|crate|barrel|ladder|pipe|plant|flower|mushroom|hedge)/.test(joined)) {
    return 'environment';
  }
  return 'misc';
}

function inferSubcategory(category, parts, fileName) {
  const source = [...parts, fileName.replace(/\.[^.]+$/, '')].map((part) => slugify(part)).filter(Boolean);
  const joined = source.join(' ');

  if (category === 'environment') {
    if (/(forest|grass|tree|plant|flower|mushroom|hedge)/.test(joined)) return 'flora';
    if (/(snow|ice)/.test(joined)) return 'snow';
    if (/(platform|block|ground|tile|ladder|pipe)/.test(joined)) return 'terrain';
    if (/(rock|stone)/.test(joined)) return 'rocks';
    return 'props';
  }
  if (category === 'character') return 'playable';
  if (category === 'collectible') return 'pickup';
  if (category === 'hazard') return 'obstacle';
  if (category === 'ui') return 'interface';
  if (category === 'audio') return 'sfx';
  return 'general';
}

function inferTags(parts, fileName, type, category, subcategory, engineCompatibility) {
  const nameParts = fileName.replace(/\.[^.]+$/, '').split(/[^a-zA-Z0-9]+/);
  const raw = [...parts, ...nameParts, type, category, subcategory, ...engineCompatibility];
  return [...new Set(raw.map(slugify).filter((tag) => tag && tag.length > 1 && !STOP_TAGS.has(tag)))].sort();
}

function getImageDimensions(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const buffer = fs.readFileSync(filePath);

  if (ext === '.png' && buffer.length >= 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }

  if ((ext === '.jpg' || ext === '.jpeg') && buffer.length > 4) {
    let offset = 2;
    while (offset < buffer.length) {
      if (buffer[offset] !== 0xff) break;
      const marker = buffer[offset + 1];
      const length = buffer.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xc3) {
        return { width: buffer.readUInt16BE(offset + 7), height: buffer.readUInt16BE(offset + 5) };
      }
      offset += 2 + length;
    }
  }

  if (ext === '.webp' && buffer.length >= 30 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
    const chunk = buffer.toString('ascii', 12, 16);
    if (chunk === 'VP8X') {
      return {
        width: 1 + buffer.readUIntLE(24, 3),
        height: 1 + buffer.readUIntLE(27, 3)
      };
    }
  }

  return null;
}

function findLicense(sourceDir) {
  const candidates = ['License.txt', 'LICENSE.txt', 'LICENSE', 'license.txt'];
  for (const name of candidates) {
    const filePath = path.join(sourceDir, name);
    if (!fs.existsSync(filePath)) continue;
    const text = fs.readFileSync(filePath, 'utf8').toLowerCase();
    if (text.includes('cc0') || text.includes('creative commons zero')) return 'CC0';
    if (text.includes('mit license')) return 'MIT';
    return titleize(name);
  }
  return 'unknown';
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

module.exports = {
  ROOT_DIR,
  REGISTRY_PATH,
  PUBLIC_REGISTRY_PATH,
  VALID_ASSET_TYPES,
  VALID_ENGINES,
  ensureDir,
  findLicense,
  getImageDimensions,
  hashFile,
  inferCategory,
  inferEngines,
  inferSubcategory,
  inferTags,
  inferType,
  listFiles,
  parseArgs,
  readRegistry,
  relativePath,
  slugify,
  titleize,
  toPosixPath,
  writeRegistry
};
