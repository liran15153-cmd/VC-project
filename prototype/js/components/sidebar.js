/* ============================================================================
   Sidebar Component
   ============================================================================
   Renders the games list and updates token display.
   ========================================================================= */

const Sidebar = {

  init() {
    this.renderGames();
    this.updateTokens();
    this.attachEvents();
  },

  attachEvents() {
    const newGameBtn = document.getElementById('btn-new-game');
    if (newGameBtn) {
      newGameBtn.addEventListener('click', () => {
        if (window.AppState) AppState.newGame();
      });
    }
  },

  renderGames() {
    const list = document.getElementById('games-list');
    if (!list) return;

    const games = Storage.getGames();
    const currentId = AppState && AppState.current ? AppState.current.id : null;

    if (games.length === 0) {
      list.innerHTML = '<div class="empty-games">׳׳™׳ ׳׳©׳—׳§׳™׳ ׳¢׳“׳™׳™׳.<br>׳¦׳•׳¨ ׳׳× ׳”׳¨׳׳©׳•׳! ג¨</div>';
      return;
    }

    // Sort by updatedAt descending
    games.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    list.innerHTML = games.map(g => {
      const icon = this.genreIcon(g.metadata.genre);
      const isActive = g.id === currentId;
      return `
        <div class="game-item ${isActive ? 'active' : ''}" data-game-id="${this.escapeAttr(g.id)}">
          <span class="game-item-icon">${this.escape(icon)}</span>
          <div class="game-item-info">
            <div class="game-item-title">${this.escape(g.metadata.gameTitle)}</div>
            <div class="game-item-genre">${this.escape(g.metadata.genre)} · ${this.escape(g.metadata.dimension)}</div>
          </div>
        </div>
      `;
    }).join('');

    // Attach click handlers
    list.querySelectorAll('.game-item').forEach(item => {
      item.addEventListener('click', () => {
        const id = item.dataset.gameId;
        if (window.AppState) AppState.loadGame(id);
      });
    });
  },

  updateTokens() {
    const el = document.getElementById('token-amount');
    if (el) el.textContent = Storage.getTokens();
  },

  genreIcon(genre) {
    const icons = {
      platformer: 'נƒ',
      shooter: 'נ€',
      runner: 'ג¡',
      breakout: 'נ§±',
      rpg: 'ג”ן¸',
      'explorer-fp': 'נ—÷',
      'adventure-tp': 'נ®',
      'platformer-3d': 'נ”',
      'racing': 'נ'
    };
    return icons[genre] || 'נ®';
  },

  escape(str) {
    const div = document.createElement('div');
    div.textContent = str || '';
    return div.innerHTML;
  },

  escapeAttr(str) {
    return this.escape(str).replace(/"/g, '&quot;');
  }
};

window.Sidebar = Sidebar;
