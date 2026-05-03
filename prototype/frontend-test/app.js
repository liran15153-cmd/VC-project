const STORE = {
  token: 'gvc.frontendTest.token',
  apiBase: 'gvc.frontendTest.apiBase',
  currentGameId: 'gvc.frontendTest.currentGameId'
};

const genres = {
  '2D': ['platformer', 'shooter', 'runner', 'breakout', 'rpg', 'puzzle'],
  '3D': ['explorer-fp', 'adventure-tp', 'platformer-3d', 'runner-3d', 'racing', 'flying']
};

const state = {
  token: localStorage.getItem(STORE.token) || '',
  user: null,
  tokens: null,
  games: [],
  currentGame: null,
  currentHTML: '',
  currentAssets: [],
  mcqQuestions: [],
  mcqAnswers: {}
};

const $ = (id) => document.getElementById(id);

function apiBase() {
  return $('apiBase').value.replace(/\/$/, '');
}

function authHeaders(extra = {}) {
  return {
    ...extra,
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {})
  };
}

function toast(message, type = 'ok') {
  const node = document.createElement('div');
  node.className = `toast ${type}`;
  node.textContent = message;
  $('toastHost').appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

function setBusy(on, title = 'Working...', text = '׳׳—׳›׳” ׳׳×׳©׳•׳‘׳” ׳׳”׳©׳¨׳×') {
  $('busy').classList.toggle('hidden', !on);
  $('busyTitle').textContent = title;
  $('busyText').textContent = text;
}

function showError(err) {
  const message = err?.message || 'Unknown error';
  toast(message, 'bad');
  console.error(err);
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  const headers = authHeaders(body ? { 'Content-Type': 'application/json' } : {});
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });

  if (raw) {
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res;
  }

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `${res.status} ${res.statusText}`);
  }
  return data;
}

function syncGenres() {
  const dimension = $('dimension').value;
  $('gameType').innerHTML = genres[dimension]
    .map((genre) => `<option value="${genre}">${genre}</option>`)
    .join('');
}

function renderAuth() {
  const loggedIn = Boolean(state.token && state.user);
  $('authForms').classList.toggle('hidden', loggedIn);
  $('userBox').classList.toggle('hidden', !loggedIn);
  $('btnLogout').classList.toggle('hidden', !loggedIn);

  if (loggedIn) {
    $('userEmail').textContent = state.user.email;
    $('userRole').textContent = state.user.role;
    $('tokenBalance').textContent = state.tokens?.tokensRemaining ?? '-';
    $('grantUserId').value = state.user.id;
  }
}

function renderGames() {
  const box = $('gamesList');
  if (!state.games.length) {
    box.innerHTML = '<div class="status muted">׳׳™׳ ׳׳©׳—׳§׳™׳ ׳¢׳“׳™׳™׳</div>';
    return;
  }

  box.innerHTML = state.games.map((game) => `
    <div class="game-item" data-id="${game.id}">
      <strong>${escapeHTML(game.title || game.id)}</strong>
      <span>${game.id}</span>
      <small>${game.genre || '-'} | ${game.dimension || '-'}</small>
    </div>
  `).join('');

  box.querySelectorAll('.game-item').forEach((item) => {
    item.addEventListener('click', () => loadGame(item.dataset.id));
  });
}

function renderMCQ() {
  const box = $('mcqBox');
  if (!state.mcqQuestions.length) {
    box.className = 'mcq-box empty';
    box.textContent = '׳׳™׳ ׳©׳׳׳•׳× ׳¢׳“׳™׳™׳';
    return;
  }

  box.className = 'mcq-box';
  box.innerHTML = state.mcqQuestions.map((q, index) => `
    <div class="question">
      <strong>${index + 1}. ${escapeHTML(q.question)}</strong>
      <div class="options">
        ${q.options.map((option) => `
          <label class="option">
            <input type="radio" name="${escapeAttr(q.id)}" value="${escapeAttr(option.value)}" ${state.mcqAnswers[q.id] === option.value ? 'checked' : ''}>
            <span>${escapeHTML(option.id)}. ${escapeHTML(option.label)}</span>
          </label>
        `).join('')}
      </div>
    </div>
  `).join('');

  box.querySelectorAll('input[type="radio"]').forEach((input) => {
    input.addEventListener('change', () => {
      state.mcqAnswers[input.name] = input.value;
    });
  });
}

function renderCurrentGame() {
  const game = state.currentGame;
  $('btnDownload').disabled = !game?.id;
  $('editGameId').value = game?.id || $('editGameId').value || '';

  if (!game) {
    $('gameTitle').textContent = '׳׳™׳ ׳׳©׳—׳§ ׳˜׳¢׳•׳';
    $('gameMeta').textContent = '׳¦׳•׳¨ ׳׳• ׳˜׳¢׳ ׳׳©׳—׳§ ׳׳”׳¨׳©׳™׳׳”';
    $('jsonOut').textContent = '';
    $('assetsOut').textContent = '';
    $('htmlOut').textContent = '';
    $('gameFrame').removeAttribute('srcdoc');
    return;
  }

  $('gameTitle').textContent = game.title || game.gameJSON?.metadata?.gameTitle || 'Untitled';
  $('gameMeta').textContent = `${game.genre || game.gameJSON?.metadata?.genre || '-'} | ${game.dimension || game.gameJSON?.metadata?.dimension || '-'} | ${game.id || 'unsaved'}`;
  $('jsonOut').textContent = JSON.stringify(game.gameJSON || game, null, 2);
  $('assetsOut').textContent = JSON.stringify(state.currentAssets || game.assetManifest || [], null, 2);
  $('htmlOut').textContent = state.currentHTML || game.htmlString || '';
  $('gameFrame').srcdoc = state.currentHTML || game.htmlString || '<p>No HTML</p>';
}

async function refreshMe() {
  if (!state.token) {
    state.user = null;
    state.tokens = null;
    renderAuth();
    return;
  }
  const data = await request('/auth/me');
  state.user = data.user;
  state.tokens = data.tokens;
  renderAuth();
}

async function refreshGames() {
  if (!state.token) return;
  const data = await request('/games');
  state.games = data.items || [];
  renderGames();
}

async function loadGame(id) {
  try {
    setBusy(true, 'Loading game', id);
    const game = await request(`/games/${encodeURIComponent(id)}`);
    state.currentGame = game;
    state.currentHTML = game.htmlString || '';
    state.currentAssets = game.assetManifest || [];
    localStorage.setItem(STORE.currentGameId, game.id);
    renderCurrentGame();
    activateTab('preview');
    toast('׳”׳׳©׳—׳§ ׳ ׳˜׳¢׳');
  } catch (err) {
    showError(err);
  } finally {
    setBusy(false);
  }
}

async function checkHealth() {
  try {
    const data = await request('/health');
    $('healthStatus').className = 'status ok';
    $('healthStatus').textContent = `${data.status || 'ok'} | DB: ${data.services?.database || '-'} | OpenAI: ${data.services?.openai || data.openaiConfigured || '-'}`;
  } catch (err) {
    $('healthStatus').className = 'status bad';
    $('healthStatus').textContent = err.message;
  }
}

async function register() {
  const body = {
    email: $('email').value,
    password: $('password').value,
    displayName: $('displayName').value || undefined
  };
  const data = await request('/auth/register', { method: 'POST', body });
  state.token = data.token;
  localStorage.setItem(STORE.token, state.token);
  state.user = data.user;
  state.tokens = data.tokens;
  renderAuth();
  await refreshGames();
  toast('׳ ׳¨׳©׳׳× ׳‘׳”׳¦׳׳—׳”');
}

async function login() {
  const body = {
    email: $('email').value,
    password: $('password').value
  };
  const data = await request('/auth/login', { method: 'POST', body });
  state.token = data.token;
  localStorage.setItem(STORE.token, state.token);
  state.user = data.user;
  state.tokens = data.tokens;
  renderAuth();
  await refreshGames();
  toast('׳”׳×׳—׳‘׳¨׳× ׳‘׳”׳¦׳׳—׳”');
}

function logout() {
  state.token = '';
  state.user = null;
  state.tokens = null;
  state.games = [];
  state.currentGame = null;
  localStorage.removeItem(STORE.token);
  renderAuth();
  renderGames();
  renderCurrentGame();
}

async function generateMCQ() {
  const body = buildGenerationBody(false);
  setBusy(true, 'Generating MCQ', 'OpenAI ׳׳™׳™׳¦׳¨ ׳©׳׳׳•׳× ׳”׳‘׳”׳¨׳”');
  const data = await request('/mcq/generate', { method: 'POST', body });
  state.mcqQuestions = data.questions || [];
  state.mcqAnswers = {};
  state.mcqQuestions.forEach((q) => {
    if (q.options?.[0]) state.mcqAnswers[q.id] = q.options[0].value;
  });
  if (data.meta?.tokens) state.tokens = data.meta.tokens;
  renderAuth();
  renderMCQ();
  toast(data.meta?.fallback ? '׳ ׳•׳¦׳¨׳• ׳©׳׳׳•׳× ׳‘׳׳¦׳‘ Demo Fallback' : '׳ ׳•׳¦׳¨׳• ׳©׳׳׳•׳× MCQ');
}

async function generateGame() {
  const body = buildGenerationBody(true);
  setBusy(true, 'Generating game', '׳–׳” ׳™׳›׳•׳ ׳׳§׳—׳× ׳§׳¦׳× ׳–׳׳');
  const data = await request('/generate-game', { method: 'POST', body });
  state.currentGame = {
    id: data.gameId,
    title: data.gameJSON?.metadata?.gameTitle,
    genre: data.gameJSON?.metadata?.genre,
    dimension: data.gameJSON?.metadata?.dimension,
    gameJSON: data.gameJSON,
    htmlString: data.htmlString,
    assetManifest: data.assetManifest || []
  };
  state.currentHTML = data.htmlString || '';
  state.currentAssets = data.assetManifest || [];
  if (data.meta?.tokens) state.tokens = data.meta.tokens;
  renderAuth();
  renderCurrentGame();
  await refreshGames();
  activateTab('preview');
  toast(data.meta?.fallback ? '׳”׳׳©׳—׳§ ׳ ׳•׳¦׳¨ ׳‘׳׳¦׳‘ Demo Fallback' : '׳”׳׳©׳—׳§ ׳ ׳•׳¦׳¨');
}

async function editGame() {
  const gameId = $('editGameId').value.trim() || state.currentGame?.id;
  if (!gameId) throw new Error('׳׳™׳ Game ID ׳׳¢׳¨׳™׳›׳”');
  const body = {
    gameId,
    editPrompt: $('editPrompt').value,
    model: $('model').value || undefined,
    saveToDb: true
  };
  setBusy(true, 'Editing game', '׳׳¢׳“׳›׳ ׳׳× ׳”׳׳©׳—׳§ ׳”׳§׳™׳™׳');
  const data = await request('/edit-game', { method: 'POST', body });
  state.currentGame = {
    id: data.gameId || gameId,
    title: data.gameJSON?.metadata?.gameTitle,
    genre: data.gameJSON?.metadata?.genre,
    dimension: data.gameJSON?.metadata?.dimension,
    gameJSON: data.gameJSON,
    htmlString: data.htmlString,
    assetManifest: data.assetManifest || []
  };
  state.currentHTML = data.htmlString || '';
  state.currentAssets = data.assetManifest || [];
  if (data.meta?.tokens) state.tokens = data.meta.tokens;
  renderAuth();
  renderCurrentGame();
  await refreshGames();
  activateTab('preview');
  toast(data.meta?.fallback ? '׳”׳׳©׳—׳§ ׳¢׳•׳“׳›׳ ׳‘׳׳¦׳‘ Demo Fallback' : '׳”׳׳©׳—׳§ ׳¢׳•׳“׳›׳');
}

async function fetchAssets() {
  const id = $('editGameId').value.trim() || state.currentGame?.id;
  if (!id) throw new Error('׳׳™׳ Game ID');
  const data = await request(`/games/${encodeURIComponent(id)}/assets`);
  state.currentAssets = data.assets || [];
  renderCurrentGame();
  activateInspector('assets');
  toast('Assets ׳ ׳˜׳¢׳ ׳•');
}

async function deleteCurrentGame() {
  const id = $('editGameId').value.trim() || state.currentGame?.id;
  if (!id) throw new Error('׳׳™׳ Game ID ׳׳׳—׳™׳§׳”');
  if (!confirm(`׳׳׳—׳•׳§ ׳׳× ${id}?`)) return;
  await request(`/games/${encodeURIComponent(id)}`, { method: 'DELETE' });
  state.currentGame = null;
  state.currentHTML = '';
  state.currentAssets = [];
  renderCurrentGame();
  await refreshGames();
  toast('׳”׳׳©׳—׳§ ׳ ׳׳—׳§');
}

async function downloadCurrent() {
  const id = state.currentGame?.id;
  if (!id) return;
  const res = await request(`/games/${encodeURIComponent(id)}/download`, { raw: true });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${id}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function loadStats() {
  const data = await request('/stats');
  $('statsOut').textContent = JSON.stringify(data, null, 2);
}

async function grantTokens() {
  const body = {
    userId: $('grantUserId').value.trim(),
    amount: Number($('grantAmount').value)
  };
  const data = await request('/user/tokens/grant', { method: 'POST', body });
  toast(`׳¢׳•׳“׳›׳ ׳• ׳˜׳•׳§׳ ׳™׳: ${data.tokensRemaining}`);
  if (state.user?.id === body.userId) {
    await refreshMe();
  }
}

function buildGenerationBody(includeAnswers) {
  const body = {
    prompt: $('gamePrompt').value,
    gameType: $('gameType').value,
    dimension: $('dimension').value,
    model: $('model').value || undefined
  };
  if (includeAnswers) {
    body.answers = { ...state.mcqAnswers };
    body.saveToDb = true;
  }
  return body;
}

function activateTab(name) {
  document.querySelectorAll('.tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.tab === name));
  document.querySelectorAll('.view').forEach((view) => view.classList.remove('active'));
  $(`tab${name[0].toUpperCase()}${name.slice(1)}`).classList.add('active');
}

function activateInspector(name) {
  document.querySelectorAll('.mini-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.inspector === name));
  $('jsonOut').classList.toggle('hidden', name !== 'json');
  $('assetsOut').classList.toggle('hidden', name !== 'assets');
  $('htmlOut').classList.toggle('hidden', name !== 'html');
}

function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeAttr(value) {
  return escapeHTML(value).replaceAll('`', '&#96;');
}

function bind(id, event, handler) {
  $(id).addEventListener(event, async () => {
    try {
      await handler();
    } catch (err) {
      showError(err);
    } finally {
      setBusy(false);
    }
  });
}

async function boot() {
  const savedBase = localStorage.getItem(STORE.apiBase);
  if (savedBase) $('apiBase').value = savedBase;

  syncGenres();
  renderAuth();
  renderGames();
  renderMCQ();
  renderCurrentGame();

  $('apiBase').addEventListener('change', () => localStorage.setItem(STORE.apiBase, apiBase()));
  $('dimension').addEventListener('change', syncGenres);

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('click', () => activateTab(tab.dataset.tab));
  });
  document.querySelectorAll('.mini-tab').forEach((tab) => {
    tab.addEventListener('click', () => activateInspector(tab.dataset.inspector));
  });

  bind('btnHealth', 'click', checkHealth);
  bind('btnRegister', 'click', register);
  bind('btnLogin', 'click', login);
  bind('btnLogout', 'click', logout);
  bind('btnRefreshGames', 'click', refreshGames);
  bind('btnGenerateMcq', 'click', async () => {
    await generateMCQ();
    setBusy(false);
  });
  bind('btnGenerateGame', 'click', async () => {
    await generateGame();
    setBusy(false);
  });
  bind('btnClearMcq', 'click', () => {
    state.mcqQuestions = [];
    state.mcqAnswers = {};
    renderMCQ();
  });
  bind('btnReloadFrame', 'click', () => renderCurrentGame());
  bind('btnDownload', 'click', downloadCurrent);
  bind('btnEditGame', 'click', async () => {
    await editGame();
    setBusy(false);
  });
  bind('btnLoadCurrent', 'click', () => loadGame($('editGameId').value.trim()));
  bind('btnAssets', 'click', fetchAssets);
  bind('btnDeleteGame', 'click', deleteCurrentGame);
  bind('btnStats', 'click', loadStats);
  bind('btnGrant', 'click', grantTokens);

  await checkHealth();
  if (state.token) {
    try {
      await refreshMe();
      await refreshGames();
      const currentId = localStorage.getItem(STORE.currentGameId);
      if (currentId) await loadGame(currentId);
    } catch (err) {
      logout();
      showError(err);
    }
  }
}

boot();

