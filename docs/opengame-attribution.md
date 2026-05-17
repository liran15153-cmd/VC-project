# OpenGame Attribution

LOOMIER incorporates ideas adapted from the
[OpenGame](https://github.com/leigest519/OpenGame) open-source project,
licensed under the Apache License, Version 2.0. See
[`third_party/opengame/`](../third_party/opengame/) for the full license text,
NOTICE file, and per-file attribution table.

## Why this document exists

Apache 2.0 (section 4(d)) requires that derivative works retain attribution
notices contained in the upstream NOTICE file. This document is the
narrative-form counterpart to the machine-readable NOTICE in
`third_party/opengame/NOTICE`.

## What was adapted

### Stage 1 — Debug diagnostics (current)

The `prototype/backend/src/debugProtocol/` module was inspired by OpenGame's
`agent-test/debug-skill/` package. The specific adaptations are:

| LOOMIER file | OpenGame inspiration | Adaptation summary |
| ------------ | -------------------- | ------------------ |
| `types.js` | `src/types.ts` | Re-expressed `DebugEntry`/`FailureSignature` as CommonJS constants tuned for declarative JSON checks. Dropped `FixType = 'shell' \| 'create' \| 'delete'` because LOOMIER never executes shell commands. |
| `validator.js` | `src/validator.ts` | OpenGame walks the filesystem and greps TypeScript source. LOOMIER walks the in-memory, already-schema-validated `GameDefinition` object instead. The *categories* of check (asset-key consistency, scene-registration consistency, animation-key consistency) carry over; the implementations are pure JavaScript object traversal. |
| `diagnostics.js` | `src/debug-loop.ts` (entry shape) | Stage 1 is detection only. The full REPEAT loop (`verify → diagnose → repair`) is **not** ported. No LLM is invoked. |
| `seed-protocol.json` | `seed-protocol/protocol.json` | LOOMIER-native entries only. None of OpenGame's TypeScript-specific entries (e.g. `TS2339`, `TextureNotFound` Phaser texture errors) were copied. |

### What was deliberately *not* taken

- `runner.ts` and `debug-loop.ts` — invoke `npm run build/test/dev` on the
  generated project, which has no analogue in LOOMIER's declarative model.
- `repairer.ts` — applies patches to source files. Stage 1 only reports.
- `diagnoser.ts` — LLM fallback for unknown errors. Stage 1 is deterministic.
- `generalizer.ts` and `evolve.ts` — protocol-evolution machinery. Deferred.
- The entire Phaser 3 template pipeline (`packages/cli`, `packages/core`,
  `agent-test/templates/`). LOOMIER's runtime is hybrid Three.js + Phaser +
  Rapier with no AI-generated code.

## License compliance checklist

- [x] Apache 2.0 LICENSE text bundled at `third_party/opengame/LICENSE`.
- [x] NOTICE file at `third_party/opengame/NOTICE` enumerating adapted areas.
- [x] Per-file headers in adapted source files referencing the upstream path.
- [x] Original copyright lines (Google LLC, Qwen, OpenGame contributors)
      preserved in the NOTICE.
- [x] No verbatim copy of upstream source code in this repository.
