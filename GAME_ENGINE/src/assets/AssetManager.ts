export type AssetType = 'image' | 'spritesheet' | 'atlas' | 'tilemap' | 'gltf' | 'audio' | 'json' | 'text' | 'arrayBuffer';

export interface AssetDefinition {
  key: string;
  type: AssetType;
  url: string;
  crossOrigin?: '' | 'anonymous' | 'use-credentials';
  frameWidth?: number;
  frameHeight?: number;
  margin?: number;
  spacing?: number;
}

export type LoadedAsset = HTMLImageElement | HTMLAudioElement | unknown | string | ArrayBuffer;

/**
 * Central asset cache with request de-duplication.
 * Generated games should reference assets by key, never fetch the same URL ad hoc.
 */
export class AssetManager {
  private readonly assets = new Map<string, LoadedAsset>();
  private readonly pending = new Map<string, Promise<LoadedAsset>>();

  async load(definition: AssetDefinition): Promise<LoadedAsset> {
    this.validateDefinition(definition);
    const cached = this.assets.get(definition.key);
    if (cached) return cached;

    const inFlight = this.pending.get(definition.key);
    if (inFlight) return inFlight;

    const promise = this.loadByType(definition)
      .then((asset) => {
        this.assets.set(definition.key, asset);
        this.pending.delete(definition.key);
        return asset;
      })
      .catch((error) => {
        this.pending.delete(definition.key);
        throw error;
      });

    this.pending.set(definition.key, promise);
    return promise;
  }

  async loadMany(definitions: readonly AssetDefinition[]): Promise<Map<string, LoadedAsset>> {
    await Promise.all(definitions.map((definition) => this.load(definition)));
    return this.assets;
  }

  get<T extends LoadedAsset = LoadedAsset>(key: string): T | undefined {
    return this.assets.get(key) as T | undefined;
  }

  require<T extends LoadedAsset = LoadedAsset>(key: string): T {
    const asset = this.get<T>(key);
    if (!asset) throw new Error(`Asset "${key}" is not loaded.`);
    return asset;
  }

  has(key: string): boolean {
    return this.assets.has(key);
  }

  unload(key: string): void {
    this.assets.delete(key);
    this.pending.delete(key);
  }

  clear(): void {
    this.assets.clear();
    this.pending.clear();
  }

  private async loadByType(definition: AssetDefinition): Promise<LoadedAsset> {
    switch (definition.type) {
      case 'image':
      case 'spritesheet':
      case 'atlas':
        return this.loadImage(definition);
      case 'audio':
        return this.loadAudio(definition);
      case 'json':
      case 'tilemap':
        return this.fetch(definition).then((response) => response.json());
      case 'text':
        return this.fetch(definition).then((response) => response.text());
      case 'arrayBuffer':
      case 'gltf':
        return this.fetch(definition).then((response) => response.arrayBuffer());
      default:
        return assertNever(definition.type);
    }
  }

  private async fetch(definition: AssetDefinition): Promise<Response> {
    const response = await globalThis.fetch(definition.url);
    if (!response.ok) throw new Error(`Failed to load asset "${definition.key}" (${response.status} ${response.statusText}).`);
    return response;
  }

  private loadImage(definition: AssetDefinition): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const image = new Image();
      if (definition.crossOrigin !== undefined) image.crossOrigin = definition.crossOrigin;
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Failed to load image asset "${definition.key}" from ${definition.url}.`));
      image.src = definition.url;
    });
  }

  private loadAudio(definition: AssetDefinition): Promise<HTMLAudioElement> {
    return new Promise((resolve, reject) => {
      const audio = new Audio();
      if (definition.crossOrigin !== undefined) audio.crossOrigin = definition.crossOrigin;
      audio.oncanplaythrough = () => resolve(audio);
      audio.onerror = () => reject(new Error(`Failed to load audio asset "${definition.key}" from ${definition.url}.`));
      audio.src = definition.url;
      audio.load();
    });
  }

  private validateDefinition(definition: AssetDefinition): void {
    if (!definition.key.trim()) throw new Error('Asset key cannot be empty.');
    if (!definition.url.trim()) throw new Error(`Asset "${definition.key}" URL cannot be empty.`);
    if (!isAllowedAssetUrl(definition.url)) {
      throw new Error(`Asset "${definition.key}" URL must be same-origin relative or data:.`);
    }
  }
}

function isAllowedAssetUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('//') || trimmed.includes('..')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed)) return trimmed.startsWith('data:');
  return true;
}

function assertNever(value: never): never {
  throw new Error(`Unsupported asset type: ${String(value)}`);
}
