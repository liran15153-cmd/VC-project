# AI Game Systems

The engine is designed for AI-generated games without executing AI-generated code.
The AI emits declarative JSON; the engine validates it and runs it through whitelisted
systems.

## Core Runtime Systems

- `state` - typed game variables such as score, lives, quest flags, timers, and unlocks.
- `inputBindings` - maps semantic actions like `jump` or `attack` to keyboard codes.
- `behaviors` - safe trigger/action rules for game logic.
- `prefabs` - reusable entity recipes.
- `spawners` - places or schedules prefabs in a scene.
- `animations` - tween-style transform animation for polish and feedback.
- `ui` - HUD text and bars bound to game state.
- `audio` - event-driven sound playback rules.
- `lights` - scene-level lighting for Three.js scenes.

## AI Prompting Rule

Prompt builders should include `ENGINE_CAPABILITIES` from `src/runtime/capabilities.ts`
so the model only emits supported triggers, actions, asset types, shapes, selectors, and
UI elements.

## Example

See `examples/ai-game-definition.json` for a compact game definition that uses:

- state
- input bindings
- collision behaviors
- scene transitions
- prefabs
- spawners
- UI
- lights
- tween animation
