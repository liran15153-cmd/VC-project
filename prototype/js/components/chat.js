/* ============================================================================
   Chat Component
   ============================================================================
   Manages the AI chat conversation UI.
   ========================================================================= */

const Chat = {

  init() {
    this.attachEvents();
    this.welcomeMessage();
  },

  attachEvents() {
    const input = document.getElementById('chat-input');
    const sendBtn = document.getElementById('btn-send');

    if (input) {
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          this.handleSubmit();
        }
      });

      // Auto-resize textarea
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.handleSubmit());
    }

    // Suggestion chips
    document.querySelectorAll('.suggestion-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        input.value = chip.dataset.prompt;
        input.dispatchEvent(new Event('input'));
        input.focus();
      });
    });
  },

  welcomeMessage() {
    this.addMessage('ai', `׳©׳׳•׳! נ‘‹ ׳׳ ׳™ <b>Vibe AI</b>, ׳™׳•׳¢׳¥ ׳₪׳™׳×׳•׳— ׳”׳׳©׳—׳§׳™׳ ׳©׳׳.<br><br>
׳×׳׳¨ ׳׳™ ׳׳™׳–׳” ׳׳©׳—׳§ ׳׳×׳” ׳¨׳•׳¦׳” ׳׳™׳¦׳•׳¨ ג€” ׳׳“׳•׳’׳׳”: "׳‘׳ ׳” ׳׳™ ׳₪׳׳˜׳₪׳•׳¨׳׳¨ ׳¢׳ ׳“׳¨׳§׳•׳ ׳™׳" ׳׳• "׳¦׳•׳¨ ׳׳©׳—׳§ ׳—׳׳ ׳¢׳ ׳™׳•׳¨׳”".<br><br>
׳׳ ׳™ ׳׳©׳׳ ׳׳•׳×׳ ׳›׳׳” ׳©׳׳׳•׳× ׳§׳¦׳¨׳•׳× ׳•׳׳– ׳׳¦׳•׳¨ ׳׳× ׳”׳׳©׳—׳§ ׳×׳•׳ ׳©׳ ׳™׳•׳×. ג¨`);
  },

  handleSubmit() {
    const input = document.getElementById('chat-input');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    input.style.height = 'auto';

    AppState.handleUserMessage(text);
  },

  /**
   * Add a message to the chat
   */
  addMessage(sender, content) {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const msg = document.createElement('div');
    msg.className = `message ${sender}`;

    const time = new Date().toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (sender === 'user') bubble.textContent = content;
    else bubble.innerHTML = this.sanitizeMessageHTML(content);

    const meta = document.createElement('div');
    meta.className = 'message-meta';
    const author = document.createElement('span');
    author.textContent = sender === 'user' ? 'אתה' : 'Vibe AI';
    const separator = document.createElement('span');
    separator.textContent = '·';
    const timeEl = document.createElement('span');
    timeEl.textContent = time;
    meta.append(author, separator, timeEl);

    msg.append(bubble, meta);
    messages.appendChild(msg);
    this.scrollToBottom();
    return msg;
  },

  /**
   * Show MCQ questions
   */
  addMCQs(mcqsData, onSubmit) {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const intro = document.createElement('div');
    intro.className = 'message ai';
    intro.innerHTML = `
      <div class="message-bubble">
        ׳׳¦׳•׳™׳! ׳׳ ׳™ ׳׳–׳”׳” ׳©׳׳×׳” ׳¨׳•׳¦׳” ׳׳©׳—׳§ <b>${this.escape(this.genreLabel(mcqsData.gameType))}</b>.<br>
        ׳¢׳ ׳” ׳¢׳ ${mcqsData.questions.length} ׳©׳׳׳•׳× ׳›׳“׳™ ׳׳”׳×׳׳™׳ ׳׳× ׳”׳׳©׳—׳§ ׳‘׳“׳™׳•׳§ ׳׳˜׳¢׳׳:
      </div>
    `;
    messages.appendChild(intro);

    const answers = {};
    const mcqsContainer = document.createElement('div');
    mcqsContainer.className = 'message ai';

    mcqsData.questions.forEach((q, idx) => {
      const card = document.createElement('div');
      card.className = 'mcq-container';
      card.dataset.questionId = q.id;

      const optionsHTML = q.options.map(opt => `
        <button class="mcq-option" data-value="${this.escapeAttr(opt.value)}">
          <div class="mcq-option-radio"></div>
          <span>${this.escape(opt.label)}</span>
        </button>
      `).join('');

      card.innerHTML = `
        <div class="mcq-question">
          <span class="mcq-question-number">${idx + 1}</span>
          ${this.escape(q.question)}
        </div>
        <div class="mcq-options">${optionsHTML}</div>
      `;

      card.querySelectorAll('.mcq-option').forEach(opt => {
        opt.addEventListener('click', () => {
          card.querySelectorAll('.mcq-option').forEach(o => o.classList.remove('selected'));
          opt.classList.add('selected');
          answers[q.id] = opt.dataset.value;
          updateSubmitState();
        });
      });

      mcqsContainer.appendChild(card);
    });

    // Submit button
    const submitBtn = document.createElement('button');
    submitBtn.className = 'mcq-submit';
    submitBtn.textContent = '׳¦׳•׳¨ ׳׳©׳—׳§! ג¨';
    submitBtn.disabled = true;
    submitBtn.addEventListener('click', () => {
      // Disable all MCQ interactions after submit
      mcqsContainer.querySelectorAll('.mcq-option').forEach(o => o.style.pointerEvents = 'none');
      submitBtn.disabled = true;
      submitBtn.textContent = '׳™׳•׳¦׳¨ ׳׳©׳—׳§... נ€';
      onSubmit(answers);
    });
    mcqsContainer.appendChild(submitBtn);

    messages.appendChild(mcqsContainer);
    this.scrollToBottom();

    function updateSubmitState() {
      const total = mcqsData.questions.length;
      const answered = Object.keys(answers).length;
      submitBtn.disabled = answered < total;
      submitBtn.textContent = `׳¦׳•׳¨ ׳׳©׳—׳§! ג¨ (${answered}/${total})`;
    }
    updateSubmitState();
  },

  /**
   * Show typing indicator
   */
  showTyping() {
    const messages = document.getElementById('chat-messages');
    if (!messages) return;

    const typing = document.createElement('div');
    typing.id = 'typing-indicator';
    typing.className = 'message ai';
    typing.innerHTML = `
      <div class="typing-indicator">
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
      </div>
    `;
    messages.appendChild(typing);
    this.scrollToBottom();
  },

  hideTyping() {
    const t = document.getElementById('typing-indicator');
    if (t) t.remove();
  },

  scrollToBottom() {
    const messages = document.getElementById('chat-messages');
    if (messages) {
      setTimeout(() => { messages.scrollTop = messages.scrollHeight; }, 50);
    }
  },

  clear() {
    const messages = document.getElementById('chat-messages');
    if (messages) messages.innerHTML = '';
  },

  sanitizeMessageHTML(content) {
    return this.escape(content)
      .replace(/&lt;br\s*\/?&gt;/gi, '<br>')
      .replace(/&lt;b&gt;/gi, '<b>')
      .replace(/&lt;\/b&gt;/gi, '</b>');
  },

  escape(value) {
    const div = document.createElement('div');
    div.textContent = String(value || '');
    return div.innerHTML;
  },

  escapeAttr(value) {
    return this.escape(value).replace(/"/g, '&quot;');
  },

  genreLabel(g) {
    const labels = {
      platformer: '׳₪׳׳˜׳₪׳•׳¨׳׳¨',
      shooter: '׳™׳¨׳™׳•׳× ׳—׳׳',
      runner: '׳¨׳™׳¦׳” ׳׳™׳ ׳¡׳•׳₪׳™׳×',
      breakout: '׳©׳•׳‘׳¨ ׳׳‘׳ ׳™׳',
      rpg: 'RPG ׳׳‘׳•׳',
      'explorer-fp': '׳—׳•׳§׳¨ ׳×׳׳×-׳׳׳“'
    };
    return labels[g] || g;
  }
};

window.Chat = Chat;
