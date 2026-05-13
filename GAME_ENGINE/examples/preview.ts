/**
 * LOOMIER preview iframe entry.
 *
 * This file is intentionally thin: protocol parsing, lifecycle and error
 * handling live in PreviewController. Everything here is wiring between the
 * browser (postMessage / DOM / window-level errors) and the controller.
 */

import {
  PreviewController,
  isPreviewCommand,
  type PreviewEvent,
} from '../src/preview';
import { Engine } from '../src/core/Engine';
import { GameRuntime } from '../src/runtime/GameRuntime';

const gameRoot = document.querySelector<HTMLDivElement>('#game-root');
const fallback = document.querySelector<HTMLDivElement>('#fallback');
if (!gameRoot || !fallback) {
  throw new Error('preview.html is missing #game-root or #fallback nodes.');
}

let parentOrigin: string | null = readReferrerOrigin();

function postToParent(event: PreviewEvent): void {
  if (!window.parent || window.parent === window) return;
  // When we don't know the parent yet (no referrer) fall back to '*'. The
  // parent still validates event.source so this is acceptable for first
  // contact only.
  const target = parentOrigin ?? '*';
  window.parent.postMessage(event, target);
}

const controller = new PreviewController({
  container: gameRoot,
  emit: (event) => {
    updateFallback(event);
    postToParent(event);
  },
  engineFactory: (config) => new Engine(config),
  runtimeFactory: (engine) => new GameRuntime(engine),
});

window.addEventListener('message', (event) => {
  // Lock to the first origin we observe so subsequent messages from
  // different windows are rejected. Synthetic events in some environments
  // have an empty origin; allow those through (the source check below is
  // the primary defence).
  if (parentOrigin === null && event.origin) {
    parentOrigin = event.origin;
  } else if (parentOrigin && event.origin && event.origin !== parentOrigin) {
    return;
  }
  if (event.source !== window.parent) return;
  if (!isPreviewCommand(event.data)) return;
  void controller.handleCommand(event.data);
});

window.addEventListener('error', (event) => {
  controller.reportRuntimeError(event.error ?? event.message);
});
window.addEventListener('unhandledrejection', (event) => {
  controller.reportRuntimeError(event.reason);
});

// Expose for dev-console debugging.
(window as unknown as { __loomierPreview: PreviewController }).__loomierPreview = controller;

// Announce ourselves to the parent — must happen after listeners are wired.
controller.announce(window.location.origin);

function readReferrerOrigin(): string | null {
  if (!document.referrer) return null;
  try {
    return new URL(document.referrer).origin;
  } catch {
    return null;
  }
}

function updateFallback(event: PreviewEvent): void {
  if (!fallback) return;
  switch (event.type) {
    case 'preview:hello':
      fallback.textContent = 'Preview ready. Waiting for GameDefinition…';
      fallback.className = 'fallback ready';
      return;
    case 'preview:loading':
      fallback.textContent = `Loading game: ${event.phase}…`;
      fallback.className = 'fallback loading';
      return;
    case 'preview:loaded':
      fallback.textContent = '';
      fallback.className = 'fallback hidden';
      return;
    case 'preview:error': {
      const lines = [
        `<strong>${escapeHtml(humanCategory(event.error.category))}</strong>`,
        escapeHtml(event.error.message),
      ];
      if (event.error.failedAssets?.length) {
        lines.push(
          '<ul>' +
            event.error.failedAssets.map((a) => `<li>${escapeHtml(a.key)} — ${escapeHtml(a.reason)}</li>`).join('') +
            '</ul>',
        );
      }
      if (event.error.issues?.length) {
        lines.push(
          '<ul>' +
            event.error.issues.slice(0, 6).map((i) => `<li>${escapeHtml(i.path || '(root)')}: ${escapeHtml(i.message)}</li>`).join('') +
            '</ul>',
        );
      }
      fallback.innerHTML = lines.join('<br>');
      fallback.className = 'fallback error';
      return;
    }
    case 'preview:destroyed':
      fallback.textContent = 'Preview destroyed.';
      fallback.className = 'fallback ready';
      return;
    default:
      return;
  }
}

function humanCategory(category: string): string {
  switch (category) {
    case 'validation':
      return 'GameDefinition validation failed';
    case 'asset-unsupported':
      return 'Unsupported asset type';
    case 'asset-missing-reference':
      return 'Asset reference missing';
    case 'asset-load':
      return 'Asset failed to load';
    case 'engine-init':
      return 'Engine could not start';
    case 'runtime':
      return 'Runtime error';
    case 'protocol':
      return 'Protocol error';
    default:
      return category;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return c;
    }
  });
}
