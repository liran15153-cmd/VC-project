# 🎮 Gaming Vibe Coding - Claude.md (CTO Guide)

## Project Overview

**Gaming Vibe Coding** is an AI-powered game development platform that enables anyone without programming or game development experience to create full games through natural language prompts and MCQ-based interactions.

**Core Value Proposition**: Users describe their game idea → AI asks clarifying questions → AI generates production-ready 2D/3D games → Users can iteratively edit and enhance.

---

## 🎯 Key Specifications

| Aspect | Details |
|--------|---------|
| **Target Users** | Non-technical users, anyone wanting to create games |
| **Game Types** | All genres (2D, 3D, RPG, Platformers, Puzzles, etc.) |
| **Game Engines** | Phaser.js (2D), Three.js (3D), Rapier (Physics) |
| **AI Models** | Claude / Gemini (with open-source exploration) |
| **Output Format** | JSON (structured) + Template Builder (runtime) |
| **Monetization** | Token-based subscriptions |
| **Game Delivery** | Browser-playable (iframe/embed) + Downloadable |
| **Editing Model** | Iterative chat-based prompts with memory |
| **Version Control** | Single latest version (no history) |
| **Storage** | On user's servers (cloud architecture TBD) |
| **Game Generation Time** | Minutes |
| **Code State** | Ready-to-play with iterative improvement |

---

## 🏗️ System Architecture

### High-Level Flow

```
User Input
    ↓
[Chat Interface]
    ↓
User writes Prompt → "Build me a fantasy RPG"
    ↓
[AI Processing Layer]
    ↓
AI generates MCQ Questions (1-2 answer choices each)
    ↓
User answers MCQs
    ↓
AI generates JSON Game Config
    ↓
[Validation Loop] (in system prompt)
    ↓
JSON is valid? → Yes
    ↓
[Template Builder]
    ↓
JSON → HTML/JS Executable
    ↓
[Game Renderer]
    ↓
Game runs in browser (iframe)
    ↓
User can:
  - Play game
  - Edit game (new prompt)
  - Download game
```

---

## 🤖 AI Workflow (The Brain)

### Phase 1: Question Generation

**Trigger**: User sends initial prompt

**AI Task**:
- Parse user's intent
- Dynamically generate MCQ questions relevant to their game idea
- Questions should be 1-2 answer choices (American MCQ style)

**Example**:
```
User: "Build me a fantasy RPG"

AI generates MCQs:
Q1: How many playable characters?
  A) Single player
  B) Multiplayer (2-4 players)

Q2: What's the combat system?
  A) Real-time action
  B) Turn-based strategy

Q3: Game scope?
  A) Short (30 min playtime)
  B) Long (2+ hours)

(etc., 5-8 questions total)
```

### Phase 2: Game Generation

**Trigger**: User answers all MCQs

**AI Task**:
- Remember the original prompt
- Remember MCQ answers
- Generate complete JSON game configuration
- Include: game logic, scenes, mechanics, physics, story elements, UI

**System Prompt Includes**:
- Validation loop: Does the JSON compile? Are all required fields present?
- Retry mechanism: If JSON has errors, fix and retry
- Quality gate: Only output valid JSON

**Output**: Valid JSON game config (see schema below)

---

## 📋 JSON Game Schema

The AI outputs JSON in this structure (example for Phaser RPG):

```json
{
  "metadata": {
    "gameTitle": "Dragon's Quest",
    "description": "A fantasy RPG where you battle dragons",
    "genre": "RPG",
    "targetAudience": "All ages",
    "estimatedPlaytime": "45 minutes",
    "createdAt": "2025-04-30T12:00:00Z"
  },
  
  "gameConfig": {
    "width": 1024,
    "height": 768,
    "renderer": "phaser",
    "physics": {
      "system": "arcade",
      "gravity": 300,
      "debug": false
    }
  },
  
  "scenes": [
    {
      "name": "PreloadScene",
      "type": "preload",
      "code": {
        "preload": "this.load.image('player', 'assets/player.png'); ..."
      }
    },
    {
      "name": "MainScene",
      "type": "play",
      "code": {
        "preload": "// Load all assets",
        "create": "// Initialize game state, create sprites, etc.",
        "update": "// Game loop logic"
      }
    }
  ],
  
  "assets": [
    {
      "type": "image",
      "key": "player",
      "url": "/assets/generated/player.png"
    },
    {
      "type": "spritesheet",
      "key": "enemy",
      "url": "/assets/generated/enemy.png",
      "frameWidth": 32,
      "frameHeight": 32
    }
  ],
  
  "gameLogic": {
    "mechanics": [
      {
        "name": "playerMovement",
        "description": "Arrow keys move player left/right",
        "implementation": "// Code snippet"
      },
      {
        "name": "enemySpawning",
        "description": "Enemies spawn every 3 seconds",
        "implementation": "// Code snippet"
      }
    ],
    "inventory": {
      "enabled": true,
      "maxSlots": 20,
      "items": [
        { "id": "sword", "name": "Iron Sword", "quantity": 1 }
      ]
    },
    "ui": {
      "healthBar": true,
      "inventory": true,
      "minimap": false
    }
  },
  
  "story": {
    "narrative": "You are a brave warrior...",
    "characters": [
      { "name": "Dragon King", "role": "antagonist", "dialogue": "..." }
    ]
  }
}
```

---

## 🔨 Template Builder (The Translator)

**Purpose**: Convert JSON → Playable HTML/JavaScript

**How it Works**:
1. Take JSON input
2. Validate schema
3. Inject values into HTML template
4. Return complete HTML file

**Code Example** (Pseudocode):

```javascript
// backend/templateBuilder.js

function buildGameHTML(gameJSON) {
  validateJSON(gameJSON); // Throws error if invalid
  
  const template = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${gameJSON.metadata.gameTitle}</title>
      <script src="https://cdn.jsdelivr.net/npm/phaser@3.55.0/dist/phaser.js"></script>
    </head>
    <body>
      <div id="game"></div>
      <script>
        // Dynamic config from JSON
        const config = {
          type: Phaser.AUTO,
          width: ${gameJSON.gameConfig.width},
          height: ${gameJSON.gameConfig.height},
          physics: {
            default: 'arcade',
            arcade: {
              gravity: { y: ${gameJSON.gameConfig.physics.gravity} },
              debug: ${gameJSON.gameConfig.physics.debug}
            }
          },
          scene: {
            preload: function() {
              ${gameJSON.scenes[0].code.preload}
            },
            create: function() {
              ${gameJSON.scenes[0].code.create}
            },
            update: function() {
              ${gameJSON.scenes[0].code.update}
            }
          }
        };
        
        const game = new Phaser.Game(config);
      </script>
    </body>
    </html>
  `;
  
  return template;
}
```

---

## 🎮 Game Generation Workflow (Complete Flow)

### Initial Creation (New Game)

```
1. User logs in
   ↓
2. User clicks "Create New Game"
   ↓
3. User writes prompt: "Fantasy RPG with dragons"
   ↓
4. Backend:
   - Validates user has tokens available
   - Deducts estimated tokens
   - Sends prompt to AI with instruction:
     "Generate 5-8 MCQ questions based on this game idea"
   ↓
5. AI responds with MCQs
   ↓
6. Frontend displays MCQs to user
   ↓
7. User selects answers (1-2 choices per question)
   ↓
8. Backend sends to AI:
   - Original prompt
   - User's MCQ answers
   - Instruction: "Generate complete JSON game config"
   ↓
9. AI generates JSON
   ↓
10. Backend validation loop:
    - Is JSON valid?
    - Are all required fields present?
    - Does code compile?
    - If errors: Retry with correction prompt
    ↓
11. JSON is valid → Proceed
    ↓
12. Template Builder:
    - buildGameHTML(JSON)
    - Returns HTML string
    ↓
13. Backend stores:
    - gameJSON in database
    - htmlString in database
    - metadata (userId, createdAt, etc.)
    ↓
14. Frontend:
    - Renders game in iframe
    - User can play immediately
    ↓
15. User can:
    - Play
    - Download (ZIP with assets)
    - Edit (see next section)
```

---

## ✏️ Game Editing Workflow

### When User Wants to Modify Game

```
1. User opens existing game
   ↓
2. User writes edit prompt: "Add a health potion item"
   ↓
3. Backend:
   - Validates user has tokens
   - Retrieves old gameJSON from database
   - Sends to AI:
     * Original gameJSON
     * Edit prompt: "Add a health potion item"
     * Instruction: "Modify the JSON to include this feature.
       Remember the existing code and extend/modify it."
   ↓
4. AI:
   - Remembers old JSON
   - Understands context
   - Modifies JSON (adds inventory item, updates mechanics)
   - Returns updated JSON
   ↓
5. Backend validation loop (same as before)
   ↓
6. Template Builder converts new JSON → HTML
   ↓
7. Old JSON deleted (NO version history)
   ↓
8. Frontend re-renders game with changes
```

**Key Point**: System remembers previous code via database, so AI can intelligently modify instead of recreate.

---

## 💾 Database Design (Preliminary)

### Required Tables

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR UNIQUE NOT NULL,
  password_hash VARCHAR,
  created_at TIMESTAMP,
  subscription_tier VARCHAR, -- 'free', 'pro', 'enterprise'
  total_tokens INT DEFAULT 0
);

-- Games table
CREATE TABLE games (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  title VARCHAR NOT NULL,
  description TEXT,
  genre VARCHAR,
  game_json JSONB NOT NULL, -- Full JSON config
  html_string TEXT, -- Compiled HTML
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  is_published BOOLEAN DEFAULT false
);

-- Tokens usage table
CREATE TABLE token_usage (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  game_id UUID REFERENCES games(id),
  tokens_spent INT,
  action_type VARCHAR, -- 'create' or 'edit'
  created_at TIMESTAMP
);

-- Prompts history table
CREATE TABLE prompts_history (
  id UUID PRIMARY KEY,
  game_id UUID REFERENCES games(id),
  prompt TEXT NOT NULL,
  mcq_questions JSONB, -- Array of MCQ questions
  mcq_answers JSONB, -- User's answers
  created_at TIMESTAMP
);

-- Analytics table
CREATE TABLE analytics (
  id UUID PRIMARY KEY,
  user_id UUID,
  game_id UUID,
  event_type VARCHAR, -- 'generation_started', 'generation_failed', 'game_played', etc.
  generation_time_ms INT,
  error_message TEXT,
  created_at TIMESTAMP
);
```

---

## 🔌 API Endpoints (MVP)

### Authentication
```
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
```

### Game CRUD
```
POST /api/games/create
  - Body: { prompt: "...", userMCQAnswers: {...} }
  - Returns: { gameId, gameJSON, htmlString, gamePreview }

POST /api/games/:gameId/edit
  - Body: { editPrompt: "..." }
  - Returns: { gameJSON, htmlString, updatedGame }

GET /api/games/:gameId
  - Returns: { gameJSON, htmlString, metadata }

GET /api/user/games
  - Returns: [ { id, title, thumbnail, createdAt }, ... ]

DELETE /api/games/:gameId
  - Soft delete or hard delete (TBD)

GET /api/games/:gameId/download
  - Returns: ZIP file with HTML + assets
```

### Token Management
```
GET /api/user/tokens
  - Returns: { tokensRemaining, tokensTotal, subscription }

POST /api/user/upgrade
  - Body: { tier: 'pro' }
  - Returns: { newTokenAllocation }
```

### Analytics (Internal)
```
GET /api/analytics/dashboard
  - Returns: { totalGamesGenerated, avgGenerationTime, errors, etc. }
```

---

## 🔐 Validation & Error Handling

### JSON Validation Loop (System Prompt Instruction)

```
SYSTEM PROMPT INSTRUCTION:

"When generating game JSON:
1. Validate all required fields are present
2. Check code syntax is valid
3. Verify physics properties are realistic
4. Test JSON can be parsed
5. If any error:
   - Identify problem
   - Fix it
   - Return corrected JSON
6. Only return valid JSON, never invalid"
```

### Error Handling Strategies

```
If generation fails:
  - User does NOT get tokens refunded (per spec)
  - User gets error message: "Game generation failed: [reason]"
  - Log error for analytics
  - Option to retry (may cost more tokens)

If JSON is invalid after retry:
  - Return fallback: Simple template game
  - Notify user
  - Suggest simpler prompt
```

---

## 📊 Analytics & Logging

**Track Everything**:
- ✅ All prompts sent
- ✅ Generation time (seconds)
- ✅ Errors encountered
- ✅ User tokens spent
- ✅ Games downloaded
- ✅ Games edited
- ✅ AI model performance

**Use Cases**:
- Improve AI performance
- Monitor costs
- Understand user behavior
- Optimize latency

---

## 💰 Token System (TODO)

**Status**: Research phase

**Questions to Answer**:
- Token cost for creating new game?
- Token cost for editing existing game?
- Token refund policy if generation fails?
- Pricing tiers (Free, Pro, Enterprise)?

**Current Understanding**:
- Users get limited tokens based on subscription
- Each generation/edit consumes tokens
- When tokens depleted, user can't use platform until renewal

---

## 🚀 Development Roadmap (MVP Phase)

### Phase 1: Core Infrastructure
- [ ] Backend setup (Node.js / Python - TBD)
- [ ] Database design + migration scripts
- [ ] User authentication (Email/Password or OAuth - TBD)
- [ ] API endpoints (CRUD for games)

### Phase 2: AI Integration
- [ ] Prompt engineering for MCQ generation
- [ ] Prompt engineering for JSON game generation
- [ ] Integration with Claude/Gemini API (or open-source exploration)
- [ ] Validation loop implementation
- [ ] Error handling + retries

### Phase 3: Game Rendering
- [ ] Template Builder implementation
- [ ] JSON → HTML conversion
- [ ] Phaser.js integration
- [ ] Three.js integration (for 3D)
- [ ] Rapier physics integration

### Phase 4: Frontend
- [ ] Chat interface (User writes prompts)
- [ ] MCQ display
- [ ] Game preview/iframe rendering
- [ ] Download functionality
- [ ] User dashboard

### Phase 5: Monetization
- [ ] Token system implementation
- [ ] Subscription tier management
- [ ] Payment integration (Stripe/PayPal - TBD)
- [ ] Analytics dashboard

---

## 🔄 Current Decisions vs. TBD

### ✅ Decided
- **Output Format**: JSON + Template Builder
- **Game Engines**: Phaser.js, Three.js, Rapier
- **Editing Model**: Chat-based iterative prompts with memory
- **Version Control**: Single version only (latest)
- **Monetization**: Token-based subscriptions
- **MCQ Style**: American MCQ (1-2 answer choices)
- **MCQ Generation**: AI generates questions dynamically based on user intent
- **Validation**: Validation loop in system prompt before delivery
- **Download**: User can export game
- **Analytics**: Track everything
- **Game State**: Ready-to-play with iterative improvements

### 🔍 TBD (To Be Determined)
- **Full Stack**: Frontend framework (React/Vue/etc.)
- **Backend Language**: Node.js vs. Python
- **Database**: PostgreSQL vs. MongoDB
- **AI Model**: Claude vs. Gemini vs. Open-source (GPU, deployment)
- **Storage Strategy**: VPS vs. Cloud (AWS S3, etc.)
- **Token Pricing**: Cost per action (create/edit)
- **Assets Generation**: Dall-E vs. Stable Diffusion vs. Procedural vs. Placeholder
- **Security Measures**: Sandbox, CSP, etc.
- **API Priority**: Which endpoints first?
- **Deployment**: VPS with GPU? Cloud? Hybrid?
- **Auth Method**: Email/Password vs. OAuth (Google/Discord)?
- **MCQ Question Set**: What are the standard questions to ask?

---

## 🎯 Next Steps (Immediate Action Items)

1. **Decide on full stack** (Frontend framework, Backend language, Database)
2. **Research AI model strategy**:
   - Use Claude/Gemini API (faster, easier, higher cost)
   - Use open-source locally (slower setup, lower cost, full control)
3. **Design JSON schema** (finalize the structure)
4. **Prompt engineering**:
   - MCQ question generator prompt
   - Game JSON generator prompt
   - Validation loop prompt
5. **Prototype Template Builder** (simple 50-line function)
6. **Test AI integration** (end-to-end: prompt → MCQs → JSON → HTML)
7. **Research assets generation** (images, sounds, etc.)
8. **Monetization model** (finalize token costs)

---

## 📌 Key Principles

1. **No-Code Game Dev**: User never sees/writes code. Everything is through prompts.
2. **AI-Driven**: AI makes ALL creative decisions (story, mechanics, visuals, physics).
3. **Iterative**: Games improve through conversation, not manual editing.
4. **Production Ready**: Games are playable immediately, not just sketches.
5. **Memory**: System remembers game state so edits are intelligent, not complete rewrites.
6. **Fast**: Minutes from idea to playable game.
7. **Accessible**: No coding, design, or game dev knowledge required.

---

## 📚 Resources & References

- **Phaser.js**: https://phaser.io/
- **Three.js**: https://threejs.org/
- **Rapier Physics**: https://www.rapier.rs/
- **Claude API**: https://www.anthropic.com/
- **Gemini API**: https://ai.google.dev/
- **Node.js**: https://nodejs.org/
- **PostgreSQL**: https://www.postgresql.org/
- **MongoDB**: https://www.mongodb.com/

---

## 🤝 Notes

- This document is a living document. Update as you make decisions on TBD items.
- When you decide on tech stack, create implementation guides.
- Start with smallest possible MVP (e.g., single game type before supporting all).
- Test AI prompts extensively before production.

---

**Last Updated**: April 30, 2025
**Status**: MVP Planning Phase
**Author**: CTO (Gaming Vibe Coding)
