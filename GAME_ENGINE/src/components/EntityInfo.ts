import type { Component } from '../core/types';

/** Stable identity metadata for AI-authored rules and selectors. */
export class EntityInfo implements Component {
  static readonly type = 'EntityInfo';
  readonly type = EntityInfo.type;

  key = '';
  name?: string;
  tags = new Set<string>();
  data: Record<string, unknown> = {};

  constructor(init: { key: string; name?: string; tags?: string[]; data?: Record<string, unknown> }) {
    this.key = init.key;
    this.name = init.name;
    this.tags = new Set(init.tags ?? []);
    this.data = { ...(init.data ?? {}) };
  }

  hasTag(tag: string): boolean {
    return this.tags.has(tag);
  }
}
