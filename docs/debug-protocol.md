# Debug Protocol

Stages 1, 1.5, 2A, and 2B of the LOOMIER diagnostic pipeline.

| Stage | Status | What it does |
| ----- | ------ | ------------ |
| 1     | done   | Deterministic detection. No repair, no LLM. |
| 1.5   | done   | Exposes diagnostics in API + frontend panel. |
| 2A    | done   | Deterministic JSON-patch repairer for a narrow whitelist of codes. No LLM. |
| 2B    | done   | Audit, integration tests, documentation. No new repair behavior. |

## What diagnostics are

After a GameDefinition passes Zod schema validation and normalization, the debug
protocol runs a second pass of cross-reference checks that the schema cannot express.
Each check is a pure function of the normalized definition object.

The result is an array of `Diagnostic` records, each with:

| Field | Type | Description |
|---|---|---|
| `code` | `string` | Machine-readable identifier (e.g. `UNUSED_ASSET`) |
| `severity` | `"error" \| "warning"` | Errors block repair candidates; warnings are informational |
| `message` | `string` | Human-readable explanation |
| `jsonPointer` | `string` (RFC 6901) | Path into the definition where the issue was found |
| `expected` | `unknown` | What the value should have been |
| `actual` | `unknown` | What the value actually is |
| `suggestedFixText` | `string` | Plain English fix advice — **not** an executable patch |

## Where they appear

### API response — `/api/engine/from-brief`

Three new top-level fields on every successful response:

```json
{
  "gameDefinition": { ... },
  "normalizationWarnings": [ ... ],
  "debugDiagnostics": [
    {
      "code": "UNUSED_ASSET",
      "severity": "warning",
      "message": "Asset \"hero-sprite\" is declared but never referenced.",
      "jsonPointer": "/assets/1",
      "suggestedFixText": "Reference the asset from an entity sprite or remove it."
    }
  ],
  "debugDiagnosticsSummary": {
    "errorCount": 0,
    "warningCount": 1,
    "codes": { "UNUSED_ASSET": 1 }
  },
  "meta": {
    "debugDiagnosticErrorCount": 0,
    "debugDiagnosticWarningCount": 1,
    ...
  }
}
```

### Frontend

Displayed as a collapsible panel below the GAME_ENGINE preview, above the "Show
GameDefinition JSON" toggle. Errors appear before warnings. Each item shows:
- Code chip (color-coded by severity)
- Message
- JSON pointer
- Fix advice

### Logs (pino)

Every successful generation emits a structured log line:

```json
{
  "msg": "GAME_ENGINE GameDefinition validation passed",
  "attempt": 1,
  "schemaOk": true,
  "normalizationWarningCount": 2,
  "diagnostics": { "error": 0, "warning": 3, "total": 3, "codes": ["UNUSED_ASSET","SCENE_HAS_CAMERA_NO_TARGET","RIGIDBODY_NO_VISUAL"] }
}
```

## Current diagnostic codes

All codes are defined in `prototype/backend/src/debugProtocol/types.js`.
Full catalog with diagnosis and suggested fixes: `prototype/backend/src/debugProtocol/seed-protocol.json`.

### Camera

| Code | Severity | When |
|---|---|---|
| `SCENE_HAS_CAMERA_NO_TARGET` | warning | Scene has `camera` in `systems` but no entity has `cameraTarget` |
| `CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM` | warning | Entity declares `cameraTarget` but scene doesn't include `camera` system |

### Visibility

| Code | Severity | When |
|---|---|---|
| `ZERO_TRANSFORM_SCALE` | warning | `transform.scale.x/y/z === 0` on an entity with a visual component |
| `ZERO_MODEL_SCALE` | warning | `model.scale.x/y/z === 0` |
| `ZERO_MESH_DIMENSION` | warning | `mesh.size.x/y/z === 0` |

### Assets

| Code | Severity | When |
|---|---|---|
| `DUPLICATE_ASSET_KEY` | **error** | Two `assets[]` entries share the same `key` |
| `UNUSED_ASSET` | warning | An asset is declared but no entity/audio/behavior references it |

### Behaviors

| Code | Severity | When |
|---|---|---|
| `BEHAVIOR_TARGET_MISSING` | warning | `action.target` references an entity key that doesn't exist (excludes runtime refs: `collisionOther`, `collisionSelf`, `spawned`, `all`) |
| `BEHAVIOR_STATE_KEY_MISSING` | warning | `setState` / `incrementState` / `decrementState` reference a key not declared in top-level `state` |

### Tweens

| Code | Severity | When |
|---|---|---|
| `TWEEN_TARGET_MISSING` | warning | `tween.target` entity key doesn't exist |

### Engine flags

| Code | Severity | When |
|---|---|---|
| `THREE_D_DISABLED_BUT_HAS_3D` | warning | `engine.enable3D=false` but entities have `mesh`/`model` or lights exist |
| `TWO_D_DISABLED_BUT_HAS_2D` | warning | `engine.enable2D=false` but entities have `sprite` or UI elements |
| `PHYSICS_DISABLED_BUT_RIGIDBODY` | warning | `engine.enablePhysics=false` but entities have `rigidBody` |

> Note: the schema normalizer auto-corrects these flags before diagnostics runs.
> These codes fire only on data that somehow bypassed normalization.

### Physics

| Code | Severity | When |
|---|---|---|
| `RIGIDBODY_NO_VISUAL` | warning | Entity has `rigidBody` but no `mesh`, `model`, or `sprite` (invisible collider — may be intentional) |
| `COLLIDER_DEFAULTED_NO_MESH` | warning | Reserved; not yet emitted. Planned for Stage 2. |

### Input

| Code | Severity | When |
|---|---|---|
| `INPUT_BINDINGS_EMPTY_WITH_PLAYER` | warning | A dynamic player-like entity exists but `inputBindings` is empty |

## Which codes are candidates for Stage 2 automatic repair

Stage 2 will add a deterministic JSON-patch repairer that can auto-fix known issues
without calling the LLM. Candidates ranked by repair confidence:

| Code | Repair approach | Confidence |
|---|---|---|
| `ZERO_TRANSFORM_SCALE` | Set 0 axes to 1 | High — safe default |
| `ZERO_MODEL_SCALE` | Set 0 axes to 1 | High — safe default |
| `ZERO_MESH_DIMENSION` | Set 0 axes to 1 | High — safe default |
| `CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM` | Add `"camera"` to `scene.systems` | High — additive |
| `SCENE_HAS_CAMERA_NO_TARGET` | Add `cameraTarget: {}` to the player entity | Medium — needs player heuristic |
| `INPUT_BINDINGS_EMPTY_WITH_PLAYER` | Inject default platform bindings | High — already done in normalizer |
| `DUPLICATE_ASSET_KEY` | Rename the duplicate | Medium — need to pick canonical |

## Which codes should stay warning-only

These codes describe intentional patterns or require human judgment:

| Code | Reason |
|---|---|
| `UNUSED_ASSET` | The asset might be used later; auto-removing could delete intentional placeholders |
| `RIGIDBODY_NO_VISUAL` | Invisible trigger volumes and walls are valid design choices |
| `THREE_D_DISABLED_BUT_HAS_3D` | Should never fire post-normalization; if it does, something broke higher up |
| `BEHAVIOR_STATE_KEY_MISSING` | Some engines create-on-write; premature to error |
| `BEHAVIOR_TARGET_MISSING` | May be a future entity not yet declared; warn only |

## Stage 2A — Deterministic repairer

After diagnostics run, `tryRepairAndValidate` (in `engineGenerationService.js`)
checks for diagnostic codes in a tightly scoped whitelist. If any match, it
deep-clones the GameDefinition, applies safe JSON patches, re-validates, and
re-runs diagnostics. The repaired candidate is accepted **only** if:

1. Schema validation still passes after the patches.
2. No more repairable diagnostics remain.

Otherwise the loop falls back to the original validation result. The hard
iteration cap is **3**. Production never runs more than 3 repair passes per
generation attempt. The existing AI retry/correction prompt behavior is
**not** changed by the repairer — if repair cannot accept, the same retry
prompt fires as before.

### Repair cases implemented

| Code | Patch | Why it is safe |
|------|-------|----------------|
| `ZERO_TRANSFORM_SCALE`  | each zero axis of `entity.transform.scale` → 1 | Visibility fix. Cannot break schema (1 is a valid finite number). |
| `ZERO_MODEL_SCALE`      | each zero axis of `entity.model.scale` → 1     | Same. |
| `ZERO_MESH_DIMENSION`   | each zero axis of `entity.mesh.size` → 1       | Same. Mesh primitives accept positive numbers. |
| `CAMERA_TARGET_BUT_NO_CAMERA_SYSTEM` | append `"camera"` to `scene.systems` if entity has `cameraTarget` | Additive. `"camera"` is in the scene system whitelist. |
| `PHYSICS_DISABLED_BUT_RIGIDBODY` | `engine.enablePhysics = true` when any entity has `rigidBody` | Safer-than-silent default. Normalizer usually fixes this earlier; repair is the backstop. |

### Repair cases intentionally skipped in Stage 2A

These require human judgement or invention and stay warning-only:

- `DUPLICATE_ASSET_KEY` — picking which copy to keep is a content decision.
- `UNUSED_ASSET` — the asset may be referenced by later edits.
- `RIGIDBODY_NO_VISUAL` — invisible trigger volumes are a valid pattern.
- `BEHAVIOR_TARGET_MISSING` — inventing an entity key would fabricate gameplay.
- `TWEEN_TARGET_MISSING` — same reason.
- `SCENE_HAS_CAMERA_NO_TARGET` — choosing which entity gets `cameraTarget` is content.
- `BEHAVIOR_STATE_KEY_MISSING` — inventing state keys would fabricate game logic.
- `INPUT_BINDINGS_EMPTY_WITH_PLAYER` — the normalizer already injects defaults
  when it can detect the player; the diagnostic only fires when detection fails.

### Repairer safety rules (Stage 2A invariants)

1. **Never mutates the input.** `repairGameDefinition` deep-clones via
   `JSON.parse(JSON.stringify(...))` and returns a new object.
2. **Never invents content.** No new assets, entities, scene keys, behavior
   targets, animation keys, prefab keys, or asset URLs are created.
3. **Every patch is auditable.** Each patch carries `op`, `path`, `value`,
   `reason`, and `diagnosticCode`.
4. **Schema is re-checked after every iteration.** A patched candidate that
   fails schema is rejected; the original validation result is returned.
5. **Diagnostics are re-checked after every iteration.** A patched candidate
   that still has repairable diagnostics is fed back into another iteration,
   up to the hard cap of 3.
6. **Existing retry behavior is untouched.** If repair cannot accept, the same
   correction prompt fires as in Stage 1.

### Known limitations

- The schema normalizer already fixes `enable3D=false-with-3D-content` and
  similar engine-flag mismatches before diagnostics run. The repair handler
  for `PHYSICS_DISABLED_BUT_RIGIDBODY` is therefore a backstop and will rarely
  fire on real model output.
- The repairer does **not** call any LLM. If a code needs LLM judgement (e.g.
  picking which asset to keep on `DUPLICATE_ASSET_KEY`), Stage 2A leaves it
  for the existing retry/correction prompt to handle.
- The `COLLIDER_DEFAULTED_NO_MESH` code is declared in `seed-protocol.json`
  but is **not** emitted by the current validator (it would require seeing
  pre-normalization data). Reserved for a later stage.

### debugRepair in the API response

`/api/engine/from-brief` returns:

```json
{
  "debugRepair": {
    "attempted": true,
    "accepted": true,
    "appliedPatches": [
      {
        "op": "replace",
        "path": "/scenes/0/entities/0/transform/scale/x",
        "value": 1,
        "reason": "axis \"x\" was 0 — entity would be invisible; set to 1",
        "diagnosticCode": "ZERO_TRANSFORM_SCALE"
      }
    ],
    "skippedCount": 0
  },
  "meta": {
    "debugRepairAccepted": true,
    "debugRepairPatchCount": 1,
    ...
  }
}
```

The frontend shows a small `auto-repaired` badge next to the model/duration
line when `debugRepair.accepted === true`. The full patch list is in the JSON
response for tooling and debugging.

### Stage 2B — audit & validation

Stage 2B adds:

- `prototype/backend/tests/repair-integration.test.js` — four scenario tests:
  - **Case A** — ZERO_TRANSFORM_SCALE is patched, accepted, scale fixed.
  - **Case B** — BEHAVIOR_TARGET_MISSING is **not** repaired, no entity invented.
  - **Case C** — mixed repairable + non-repairable; only repairable patched.
  - **Case D** — a malicious test-only repair that breaks schema is rejected
    and the original (non-repaired) result is returned.
- A `repair` injection point in `tryRepairAndValidate` for test use only.
  Production calls the real repairer.
- Two extra coverage tests: no-op when no repairable diagnostics exist, and
  the hard iteration cap is honored even with a stubborn repair function.

#### Real prompt validation status

Stage 2B asks for running `scripts/sample-prompts.js` against the live
backend with a real OpenRouter key. **Not completed in this sandbox** — the
local backend was not running and no API key was available. The script is in
place and ready to run when the user has a local backend + key:

```bash
npm run backend:dev               # in one terminal
OPENROUTER_API_KEY=sk-… node scripts/sample-prompts.js
```

When run, the script reports per-prompt: GameDefinition created, diagnostics
count, top diagnostic codes, normalization warning count, and repair status
once the repair fields are wired into the script's output format.

## Running sample prompts

```bash
# Start the backend first
npm run backend:dev

# In a second terminal (requires a real API key):
OPENROUTER_API_KEY=sk-... node scripts/sample-prompts.js

# Or against a specific URL:
node scripts/sample-prompts.js --url=http://localhost:3000
```

The script records for each of 5 representative prompts:
- Whether the GameDefinition was created
- Diagnostics count (error / warning split)
- Top diagnostic codes
- Normalization warning count

## Files

| Path | Purpose |
|---|---|
| `prototype/backend/src/debugProtocol/types.js` | SEVERITY enum, DIAGNOSTIC_CODES, createDiagnostic factory |
| `prototype/backend/src/debugProtocol/validator.js` | 8 check-categories, runAllChecks |
| `prototype/backend/src/debugProtocol/diagnostics.js` | Public API: runDebugDiagnostics, summarizeDiagnostics, buildDiagnosticsSummary |
| `prototype/backend/src/debugProtocol/seed-protocol.json` | On-disk catalog — human-readable reference, synced to DIAGNOSTIC_CODES |
| `prototype/backend/src/routes/engine.js` | Exposes debugDiagnostics, normalizationWarnings, debugDiagnosticsSummary |
| `frontend/src/features/game-builder/GameBuilderPage.tsx` | DiagnosticsPanel component |
| `frontend/src/types/api.ts` | DebugDiagnostic, DebugDiagnosticsSummary, NormalizationWarning types |
| `scripts/sample-prompts.js` | 5-prompt diagnostic sampling script |
| `third_party/opengame/` | Apache 2.0 attribution for OpenGame inspiration |
| `docs/opengame-attribution.md` | Narrative attribution document |
