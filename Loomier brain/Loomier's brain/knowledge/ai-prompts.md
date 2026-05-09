# AI Prompting Notes

Prompts should create editable game structures, not one-off code.

---

## Prompt Goals

AI should output:

- concise MCQs
- game plans
- asset plans
- validated game definitions
- constrained edit patches

AI should not output:

- unbounded code blobs
- hidden business logic
- unsafe HTML/script
- assets that do not exist

---

## MCQ Prompt Rules

For new game creation:

- produce at least 4 questions
- keep questions short
- make every question relevant to the user prompt
- ask about additions/changes, not generic preferences
- keep options easy to choose

---

## Generation Prompt Rules

The system prompt must require:

- JSON only
- schema compliance
- runtime compatibility
- asset manifest references
- editable structure
- no external unknown assets
- validation checklist before final answer

---

## Edit Prompt Rules

Edits should preserve existing game identity.

Bad:

```txt
Regenerate the whole game from scratch.
```

Good:

```txt
Patch the existing GameDefinition while preserving ids and unrelated behavior.
```

---

## Provider Strategy

Use an adapter layer. Do not bake product logic into OpenAI/OpenRouter/Gemini-specific code.

---

## Related

- [[HOME]]
- [[docs/agents]]
- [[CLAUDE]]
- [[docs/adr/ADR-003-ai-adapters]]
- [[Workflows/game-creation-flow]]
