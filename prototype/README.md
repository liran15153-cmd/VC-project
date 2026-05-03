# נ® Gaming Vibe Coding - Prototype

> **AI-powered game creation platform**
> Chat with AI ג†’ answer 5 questions ג†’ get a playable game.

## נ€ Quick Start

**׳׳™׳ ׳¦׳•׳¨׳ ׳‘-npm install. ׳׳™׳ ׳©׳¨׳×. ׳¨׳§:**

1. ׳₪׳×׳— ׳׳× `index.html` ׳‘׳“׳₪׳“׳₪׳ (Chrome/Edge ׳׳•׳׳׳¦׳™׳)
2. ׳×׳׳¨ ׳׳©׳—׳§ ׳‘׳¦'׳׳˜
3. ׳¢׳ ׳” ׳¢׳ 5 ׳©׳׳׳•׳× MCQ
4. ׳©׳—׳§!

## נ“ ׳׳‘׳ ׳”

```
prototype/
ג”ג”€ג”€ index.html              ג† ׳ ׳§׳•׳“׳× ׳›׳ ׳™׳¡׳”
ג”ג”€ג”€ DOCUMENTATION.html      ג† ׳×׳™׳¢׳•׳“ ׳׳׳ (׳₪׳×׳— ׳’׳ ׳‘׳“׳₪׳“׳₪׳!)
ג”ג”€ג”€ README.md               ג† ׳”׳§׳•׳‘׳¥ ׳”׳–׳”
ג”ג”€ג”€ css/
ג”‚   ג”ג”€ג”€ main.css           ג† Layout & theme
ג”‚   ג”ג”€ג”€ components.css     ג† UI components
ג”‚   ג””ג”€ג”€ animations.css     ג† Animations
ג””ג”€ג”€ js/
    ג”ג”€ג”€ app.js             ג† Bootstrap
    ג”ג”€ג”€ state.js           ג† State management
    ג”ג”€ג”€ storage.js         ג† LocalStorage
    ג”ג”€ג”€ ai/
    ג”‚   ג”ג”€ג”€ systemPrompt2D.js
    ג”‚   ג”ג”€ג”€ systemPrompt3D.js
    ג”‚   ג”ג”€ג”€ mcqGenerator.js
    ג”‚   ג””ג”€ג”€ mockAI.js
    ג”ג”€ג”€ builder/
    ג”‚   ג”ג”€ג”€ validator.js
    ג”‚   ג”ג”€ג”€ gameTemplates.js
    ג”‚   ג””ג”€ג”€ templateBuilder.js
    ג”ג”€ג”€ components/
    ג”‚   ג”ג”€ג”€ sidebar.js
    ג”‚   ג”ג”€ג”€ chat.js
    ג”‚   ג””ג”€ג”€ preview.js
    ג””ג”€ג”€ utils/
        ג””ג”€ג”€ toast.js
```

## ג¨ ׳₪׳™׳¦'׳¨׳™׳

### נ₪– AI Chatbot
- ׳׳–׳”׳” ׳¡׳•׳’ ׳׳©׳—׳§ ׳׳×׳™׳׳•׳¨ ׳˜׳‘׳¢׳™ (׳¢׳‘׳¨׳™׳× + ׳׳ ׳’׳׳™׳×)
- ׳׳™׳™׳¦׳¨ 5 MCQs ׳׳•׳×׳׳׳•׳×
- ׳™׳•׳¦׳¨ JSON ׳×׳§׳™׳ ׳¢׳ validation loop
- ׳¢׳•׳¨׳ ׳׳©׳—׳§׳™׳ ׳“׳¨׳ ׳”׳¦'׳׳˜

### נ® Game Templates (Phaser.js + Three.js)
- נƒ **Platformer** - ׳§׳₪׳™׳¦׳•׳×, ׳׳•׳™׳‘׳™׳, ׳׳˜׳‘׳¢׳•׳×
- נ€ **Shooter** - ׳™׳¨׳™׳•׳× ׳—׳׳
- ג¡ **Endless Runner** - ׳¨׳™׳¦׳” ׳׳™׳ ׳¡׳•׳₪׳™׳×
- נ§± **Brick Breaker** - ׳©׳•׳‘׳¨ ׳׳‘׳ ׳™׳ ׳§׳׳׳¡׳™
- ג”ן¸ **RPG Maze** - ׳׳‘׳•׳ ׳¢׳ ׳׳•׳¦׳¨׳•׳×
- נ—÷ **3D Explorer** - ׳—׳•׳§׳¨ ׳×׳׳×-׳׳׳“ (Three.js + PointerLock)

### ג… Validation Loop
- 5 ׳©׳›׳‘׳•׳× ׳‘׳“׳™׳§׳” (structural, type, range, semantic, playability)
- Auto-fix ׳׳‘׳¢׳™׳•׳× ׳ ׳₪׳•׳¦׳•׳×
- Fallback ׳׳×׳‘׳ ׳™׳× ׳‘׳˜׳•׳—׳” ׳׳ ׳”׳•׳׳™׳“׳¦׳™׳” ׳ ׳›׳©׳׳×

### נ’ Token System
- 100 tokens ׳”׳×׳—׳׳×׳™׳™׳
- 5 tokens ׳׳™׳¦׳™׳¨׳× ׳׳©׳—׳§
- 2 tokens ׳׳¢׳¨׳™׳›׳”
- ׳›׳₪׳×׳•׳¨ Reset נ”„ ׳‘׳›׳•׳×׳¨׳×

### נ“¥ Download
- ׳›׳ ׳׳©׳—׳§ ׳ ׳™׳×׳ ׳׳”׳•׳¨׳“׳” ׳›-HTML ׳¢׳¦׳׳׳™
- ׳₪׳•׳×׳— ׳‘׳›׳ ׳“׳₪׳“׳₪׳ ׳׳׳ ׳×׳׳•׳×

## נ¯ ׳“׳•׳’׳׳׳•׳× ׳׳‘׳§׳©׳•׳×

׳ ׳¡׳”:
- "׳‘׳ ׳” ׳׳™ ׳׳©׳—׳§ ׳₪׳׳˜׳₪׳•׳¨׳׳¨ ׳¢׳ ׳“׳¨׳§׳•׳ ׳™׳"
- "׳¦׳•׳¨ ׳׳©׳—׳§ ׳—׳׳ ׳¢׳ ׳™׳•׳¨׳” ׳׳׳׳¢׳׳”"
- "׳‘׳ ׳” ׳׳©׳—׳§ ׳¨׳™׳¦׳” ׳׳™׳ ׳¡׳•׳₪׳™׳× ׳¢׳ ׳׳›׳©׳•׳׳™׳"
- "׳¦׳•׳¨ ׳׳©׳—׳§ ׳©׳•׳‘׳¨ ׳׳‘׳ ׳™׳ ׳§׳׳׳¡׳™"
- "׳‘׳ ׳” ׳׳©׳—׳§ RPG ׳¢׳ ׳׳•׳¦׳¨׳•׳× ׳•׳׳‘׳•׳"
- "׳¦׳•׳¨ ׳׳©׳—׳§ 3D first person explorer"

## גן¸ ׳¢׳¨׳™׳›׳” ׳“׳¨׳ ׳¦'׳׳˜

׳׳—׳¨׳™ ׳©׳™׳© ׳׳ ׳׳©׳—׳§, ׳ ׳¡׳”:
- "׳×׳”׳₪׳•׳ ׳׳× ׳”׳׳©׳—׳§ ׳׳§׳©׳” ׳™׳•׳×׳¨"
- "׳×׳•׳¡׳™׳£ ׳™׳•׳×׳¨ ׳׳•׳™׳‘׳™׳"
- "׳×׳©׳ ׳” ׳׳× ׳”׳¦׳‘׳¢ ׳׳›׳—׳•׳"
- "׳×׳•׳¡׳™׳£ ׳™׳•׳×׳¨ ׳׳˜׳‘׳¢׳•׳×"
- "׳×׳•׳¨׳™׳“ ׳—׳™׳™׳"

## נ“ ׳¨׳•׳¦׳” ׳׳”׳‘׳™׳ ׳”׳›׳?

׳₪׳×׳— ׳׳× **`DOCUMENTATION.html`** ׳‘׳“׳₪׳“׳₪׳ - ׳™׳© ׳©׳ ׳”׳¡׳‘׳¨ ׳׳₪׳•׳¨׳˜ ׳¢׳:
- ׳׳¨׳›׳™׳˜׳§׳˜׳•׳¨׳”
- System Prompts
- Validation Loop
- ׳ ׳™׳×׳•׳— ׳׳×׳—׳¨׳™׳
- ׳׳¢׳‘׳¨ ׳׳₪׳¨׳•׳“׳§׳©׳

## נ›  Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | Vanilla JS + CSS |
| Fonts | Heebo + Orbitron + JetBrains Mono |
| 2D Engine | Phaser.js 3.70 (CDN) |
| 3D Engine | Three.js r155 (CDN) |
| Storage | LocalStorage |
| AI | Mock (deterministic, ready for OpenAI swap) |

## נ”„ ׳׳¢׳‘׳¨ ׳-Production

׳¨׳׳” DOCUMENTATION.html ג†’ ׳¡׳§׳¦׳™׳” 11 ("׳׳¢׳‘׳¨ ׳׳₪׳¨׳•׳“׳§׳©׳").
TL;DR: ׳¨׳§ ׳׳”׳—׳׳™׳£ ׳׳× `mockAI.js` ׳‘׳§׳¨׳™׳׳•׳× ׳-OpenAI API.

---

**Built with נ’ for the Gaming Vibe Coding project**

