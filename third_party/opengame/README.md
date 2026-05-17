# third_party/opengame

This directory documents LOOMIER's use of ideas and patterns adapted from
**OpenGame** (Apache License 2.0). It exists to satisfy the attribution
requirements of section 4 of the License.

## What is OpenGame?

[OpenGame](https://github.com/leigest519/OpenGame) is an open-source agentic
framework for end-to-end web-game creation from a prompt, built on Phaser 3
+ TypeScript. Version 0.6.0.

## What did LOOMIER take from it?

Only **ideas** — no OpenGame source files are bundled or copied verbatim in
LOOMIER. The concepts that were adapted are:

1. **Debug protocol data shape** — the (signature, root cause, fix) entry
   structure (`agent-test/debug-skill/src/types.ts`).
2. **Validator taxonomy** — the categories of pre-execution consistency
   checks (`agent-test/debug-skill/src/validator.ts`): asset-key consistency,
   scene-registration consistency, animation-key consistency, etc.
3. **Seed protocol format** — the on-disk JSON shape used to catalog known
   diagnostics (`agent-test/debug-skill/seed-protocol/protocol.json`).

These ideas were re-implemented in CommonJS JavaScript to operate on
LOOMIER's declarative GameDefinition JSON object rather than on TypeScript
Phaser source files.

See [`./NOTICE`](./NOTICE) for the per-file attribution table and
[`docs/opengame-attribution.md`](../../docs/opengame-attribution.md) for the
narrative summary.

## What did LOOMIER *not* take?

- OpenGame's Phaser TypeScript code generator
- The REPEAT-loop debug runner (`runner.ts`, `debug-loop.ts`)
- The automatic repairer (`repairer.ts`) — Stage 1 is deterministic
  diagnostics only, no patching
- LLM-driven rule generalization (`generalizer.ts`, `evolve.ts`)
- The Ink CLI / Qwen agent surface

## Versioning

When the upstream OpenGame snapshot is updated, update the commit SHA in
[`./NOTICE`](./NOTICE) and re-confirm that the adapted ideas still match
the upstream shape.
