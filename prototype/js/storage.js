// LocalStorage management for games and user data

const Storage = {
  KEYS: {
    GAMES: 'gvc_games',
    TOKENS: 'gvc_tokens',
    USER: 'gvc_user',
  },

  // Games
  getGames() {
    const games = localStorage.getItem(this.KEYS.GAMES);
    return games ? JSON.parse(games) : [];
  },

  saveGame(game) {
    const games = this.getGames();
    const existingIndex = games.findIndex(g => g.id === game.id);

    if (existingIndex >= 0) {
      games[existingIndex] = { ...game, updatedAt: new Date().toISOString() };
    } else {
      games.push({ ...game, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
    }

    localStorage.setItem(this.KEYS.GAMES, JSON.stringify(games));
    return game;
  },

  getGame(id) {
    return this.getGames().find(g => g.id === id);
  },

  deleteGame(id) {
    const games = this.getGames().filter(g => g.id !== id);
    localStorage.setItem(this.KEYS.GAMES, JSON.stringify(games));
  },

  // Tokens
  getTokens() {
    const tokens = localStorage.getItem(this.KEYS.TOKENS);
    return tokens !== null ? parseInt(tokens) : 100; // Default: 100 tokens
  },

  setTokens(amount) {
    localStorage.setItem(this.KEYS.TOKENS, amount.toString());
  },

  spendTokens(amount) {
    const current = this.getTokens();
    const newAmount = Math.max(0, current - amount);
    this.setTokens(newAmount);
    return newAmount;
  },

  refundTokens(amount) {
    const current = this.getTokens();
    this.setTokens(current + amount);
    return current + amount;
  },

  // Reset everything (for demo)
  resetAll() {
    localStorage.removeItem(this.KEYS.GAMES);
    localStorage.removeItem(this.KEYS.TOKENS);
    localStorage.removeItem(this.KEYS.USER);
  },

  // Utility
  generateId() {
    return 'game_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
};
