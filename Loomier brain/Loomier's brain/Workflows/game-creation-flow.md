# Game Creation Flow

This is the target product loop.

---

## Flow

```txt
1. User describes game
2. Questions Agent asks focused MCQs
3. User answers
4. Game Brief Agent creates a planning-only Game Brief
5. Asset resolver selects starter assets
6. AI creates GameDefinition
7. Validator checks output
8. GAME_ENGINE previews it
9. User edits via chat
10. Save/export
```

---

## Current Gap

The prototype can already simulate much of this, but the data path is split between old JSON/HTML and new `GAME_ENGINE`.

The next milestone is to make this flow use `GameDefinition`.

The Questions Agent and Game Brief Agent should be OpenRouter-first:

- `AI_MODE=real`: OpenRouter is the primary intelligence layer.
- `AI_MODE=hybrid`: local deterministic logic handles trivial/predictable steps, while OpenRouter handles reasoning-heavy Game Brief work.
- `AI_MODE=mock`: local simulator for tests/offline development only.

MockAI should not own product reasoning. It is a fallback/testing/token-saving utility.

The Game Brief step must not generate full game code. It should define the player fantasy, core loop, missing decisions, runtime plan for the Phaser.js + Three.js + Rapier hybrid runtime, and asset plan.

---

## UX Rule

The user should not feel the architecture.

They should feel:

- "I described it"
- "it asked smart questions"
- "it made something playable"
- "I changed it"
- "it improved"

---

## Related

- [[HOME]]
- [[NEXT]]
- [[docs/agents]]
- [[Agents/15-orchestrator]]
- [[knowledge/ai-prompts]]
- [[knowledge/game-schema]]
