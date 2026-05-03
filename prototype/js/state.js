/* ============================================================================
   App State
   ============================================================================
   Central state management - the brain of the app.
   Coordinates Chat, Preview, Sidebar, AI, and Storage.
   ========================================================================= */

const AppState = {

  // Current state
  current: null,           // Currently active game
  pendingPrompt: null,     // Prompt waiting for MCQ answers
  pendingMCQs: null,       // MCQ data being shown
  isProcessing: false,     // Locks during AI processing

  // Token costs
  COST_NEW_GAME: 5,
  COST_EDIT: 2,

  /**
   * Handle new user message in chat
   */
  async handleUserMessage(text) {
    if (this.isProcessing) {
      Toast.warning('AI עדיין עובד...');
      return;
    }

    Chat.addMessage('user', text);

    // Determine intent: new game vs edit
    if (this.current) {
      // Editing existing game
      await this.editGame(text);
    } else {
      // Creating new game
      await this.startNewGameFlow(text);
    }
  },

  /**
   * Start a new game creation flow
   */
  async startNewGameFlow(prompt) {
    // Check tokens
    if (Storage.getTokens() < this.COST_NEW_GAME) {
      Chat.addMessage('ai', `אין לך מספיק tokens! צריך ${this.COST_NEW_GAME} tokens ויש לך ${Storage.getTokens()}. <br>(זה דמו - לחץ על 🔄 בכותרת לאפס.)`);
      return;
    }

    this.isProcessing = true;
    this.pendingPrompt = prompt;

    Chat.showTyping();

    try {
      // Phase 1: Generate MCQs
      const mcqsData = await MockAI.generateMCQs(prompt);
      this.pendingMCQs = mcqsData;

      Chat.hideTyping();
      Chat.addMCQs(mcqsData, async (answers) => {
        await this.completeNewGame(answers);
      });
    } catch (err) {
      Chat.hideTyping();
      Chat.addMessage('ai', `שגיאה: ${err.message}`);
      console.error(err);
    } finally {
      this.isProcessing = false;
    }
  },

  /**
   * Complete game creation after MCQ answers
   */
  async completeNewGame(answers) {
    if (!this.pendingPrompt || !this.pendingMCQs) return;

    this.isProcessing = true;
    this.showLoading('יוצר את המשחק...');

    try {
      // Step through loading phases
      this.updateLoadingStep(1);
      await this.delay(400);

      this.updateLoadingStep(2);
      await this.delay(500);

      this.updateLoadingStep(3);

      // Phase 2: Generate game JSON
      const gameJSON = await MockAI.generateGame(
        this.pendingPrompt,
        answers,
        this.pendingMCQs.gameType,
        this.pendingMCQs.dimension
      );

      this.updateLoadingStep(4);
      await this.delay(400);

      // Save to storage
      const game = {
        id: Storage.generateId(),
        gameJSON,
        prompt: this.pendingPrompt,
        mcqAnswers: answers,
        metadata: gameJSON.metadata
      };
      Storage.saveGame(game);

      // Spend tokens
      Storage.spendTokens(this.COST_NEW_GAME);

      // Update UI
      this.current = game;
      this.hideLoading();

      Chat.addMessage('ai', `🎮 <b>${gameJSON.metadata.gameTitle}</b> מוכן!<br>
        <span class="genre-badge">${gameJSON.metadata.genre}</span>
        <span class="genre-badge">${gameJSON.metadata.difficulty}</span><br><br>
        ${gameJSON.metadata.description}<br><br>
        <i>טיפ: כתוב לי "תהפוך לקשה יותר", "תוסיף יותר אויבים" או "תשנה לכחול" כדי לערוך! ✏️</i>`);

      Preview.showGame(gameJSON);
      Sidebar.renderGames();
      Sidebar.updateTokens();

      Toast.success(`המשחק "${gameJSON.metadata.gameTitle}" נוצר!`);

      // Reset pending
      this.pendingPrompt = null;
      this.pendingMCQs = null;
    } catch (err) {
      this.hideLoading();
      Chat.addMessage('ai', `שגיאה ביצירת המשחק: ${err.message}`);
      console.error(err);
    } finally {
      this.isProcessing = false;
    }
  },

  /**
   * Edit existing game based on user message
   */
  async editGame(editPrompt) {
    if (!this.current) return;

    if (Storage.getTokens() < this.COST_EDIT) {
      Chat.addMessage('ai', `אין לך מספיק tokens! צריך ${this.COST_EDIT} tokens.`);
      return;
    }

    this.isProcessing = true;
    Chat.showTyping();

    try {
      const updatedJSON = await MockAI.editGame(this.current.gameJSON, editPrompt);

      this.current.gameJSON = updatedJSON;
      this.current.metadata = updatedJSON.metadata;
      Storage.saveGame(this.current);
      Storage.spendTokens(this.COST_EDIT);

      Chat.hideTyping();
      Chat.addMessage('ai', `✅ עדכנתי את המשחק!<br>
        גרסה: <b>${updatedJSON.metadata.version}</b> · קושי: <b>${updatedJSON.metadata.difficulty}</b><br>
        <i>תוכל להמשיך לערוך או להוריד את המשחק. 🎮</i>`);

      Preview.showGame(updatedJSON);
      Sidebar.renderGames();
      Sidebar.updateTokens();

      Toast.success('המשחק עודכן!');
    } catch (err) {
      Chat.hideTyping();
      Chat.addMessage('ai', `שגיאה: ${err.message}`);
      console.error(err);
    } finally {
      this.isProcessing = false;
    }
  },

  /**
   * Load existing game from sidebar
   */
  loadGame(id) {
    const game = Storage.getGame(id);
    if (!game) return;

    this.current = game;
    Chat.clear();
    Chat.addMessage('ai', `טענתי את <b>${game.metadata.gameTitle}</b>!<br>
      <span class="genre-badge">${game.metadata.genre}</span>
      <span class="genre-badge">${game.metadata.difficulty}</span><br><br>
      תוכל לערוך אותו דרך הצ'אט - לדוגמה "תוסיף יותר אויבים" או "תהפוך לקל יותר".`);

    Preview.showGame(game.gameJSON);
    Sidebar.renderGames();
  },

  /**
   * Start new game (clear current)
   */
  newGame() {
    this.current = null;
    this.pendingPrompt = null;
    this.pendingMCQs = null;
    Chat.clear();
    Chat.welcomeMessage();
    Preview.clear();
    Sidebar.renderGames();
    Toast.info('מוכן ליצור משחק חדש!');
  },

  /**
   * Delete current game
   */
  deleteCurrentGame() {
    if (!this.current) return;
    Storage.deleteGame(this.current.id);
    Toast.success('המשחק נמחק');
    this.newGame();
  },

  /**
   * Loading overlay control
   */
  showLoading(text = 'טוען...') {
    const overlay = document.getElementById('loading-overlay');
    const textEl = document.getElementById('loading-text');
    if (textEl) textEl.textContent = text;
    if (overlay) overlay.style.display = 'flex';

    // Reset progress
    document.querySelectorAll('.progress-step').forEach(s => {
      s.classList.remove('active', 'done');
    });
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = '0%';
  },

  updateLoadingStep(stepNum) {
    const steps = document.querySelectorAll('.progress-step');
    steps.forEach((s, i) => {
      const num = i + 1;
      s.classList.remove('active');
      if (num < stepNum) s.classList.add('done');
      if (num === stepNum) s.classList.add('active');
    });
    const fill = document.getElementById('progress-fill');
    if (fill) fill.style.width = (stepNum * 25) + '%';

    const subtexts = {
      1: 'מנתח את הדרישות שלך...',
      2: 'מעצב את הוויזואל...',
      3: 'בונה לוגיקה ופיזיקה...',
      4: 'מריץ validation loop...'
    };
    const sub = document.getElementById('loading-subtext');
    if (sub && subtexts[stepNum]) sub.textContent = subtexts[stepNum];
  },

  hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  },

  delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }
};

window.AppState = AppState;
