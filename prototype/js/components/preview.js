/* ============================================================================
   Preview Component
   ============================================================================
   Game preview panel — manages iframe, JSON tab, code tab.
   ========================================================================= */

const Preview = {

  init() {
    this.attachEvents();
  },

  attachEvents() {
    // Tabs
    document.querySelectorAll('.preview-tab').forEach(tab => {
      tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
    });

    // Action buttons
    const downloadBtn = document.getElementById('btn-download');
    if (downloadBtn) {
      downloadBtn.addEventListener('click', () => {
        if (AppState.current && AppState.current.gameJSON) {
          TemplateBuilder.download(AppState.current.gameJSON);
          Toast.success('המשחק ירד למחשב!');
        }
      });
    }

    const fullscreenBtn = document.getElementById('btn-fullscreen');
    if (fullscreenBtn) {
      fullscreenBtn.addEventListener('click', () => {
        const iframe = document.getElementById('game-iframe');
        if (iframe && iframe.requestFullscreen) iframe.requestFullscreen();
      });
    }

    const deleteBtn = document.getElementById('btn-delete');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => {
        if (AppState.current && confirm('בטוח שאתה רוצה למחוק את המשחק?')) {
          AppState.deleteCurrentGame();
        }
      });
    }
  },

  showGame(gameJSON) {
    if (!gameJSON) return;

    // Build HTML and load into iframe
    try {
      const html = TemplateBuilder.build(gameJSON);
      const iframe = document.getElementById('game-iframe');

      if (iframe) {
        iframe.srcdoc = html;
        iframe.style.display = 'block';
      }

      // Hide empty state
      const empty = document.getElementById('empty-state');
      if (empty) empty.style.display = 'none';

      // Show actions
      const actions = document.getElementById('preview-actions');
      if (actions) actions.style.display = 'flex';

      // Update JSON tab
      const jsonDisplay = document.getElementById('json-display');
      if (jsonDisplay) {
        jsonDisplay.textContent = JSON.stringify(gameJSON, null, 2);
      }

      // Update code tab
      const codeDisplay = document.getElementById('code-display');
      if (codeDisplay) {
        codeDisplay.textContent = html;
      }

      // Switch to game tab
      this.switchTab('game');
    } catch (err) {
      console.error('Preview build error:', err);
      Toast.error('שגיאה בטעינת המשחק: ' + err.message);
    }
  },

  switchTab(tabName) {
    document.querySelectorAll('.preview-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    const iframe = document.getElementById('game-iframe');
    const json = document.getElementById('json-display');
    const code = document.getElementById('code-display');
    const empty = document.getElementById('empty-state');

    if (iframe) iframe.style.display = tabName === 'game' && AppState.current ? 'block' : 'none';
    if (json) json.style.display = tabName === 'json' && AppState.current ? 'block' : 'none';
    if (code) code.style.display = tabName === 'code' && AppState.current ? 'block' : 'none';

    if (!AppState.current && empty) empty.style.display = 'block';
  },

  clear() {
    const iframe = document.getElementById('game-iframe');
    if (iframe) {
      iframe.srcdoc = '';
      iframe.style.display = 'none';
    }
    const empty = document.getElementById('empty-state');
    if (empty) empty.style.display = 'block';
    const actions = document.getElementById('preview-actions');
    if (actions) actions.style.display = 'none';
    this.switchTab('game');
  }
};

window.Preview = Preview;
