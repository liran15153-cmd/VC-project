/* ============================================================================
   App Entry Point
   ============================================================================
   Bootstraps the application - initializes all modules.
   ========================================================================= */

(function() {
  'use strict';

  function init() {
    // Initialize components in order
    Sidebar.init();
    Chat.init();
    Preview.init();

    // Header buttons
    const docsBtn = document.getElementById('btn-docs');
    if (docsBtn) {
      docsBtn.addEventListener('click', () => {
        window.open('DOCUMENTATION.html', '_blank');
      });
    }

    const resetBtn = document.getElementById('btn-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (confirm('לאפס את כל הנתונים? זה ימחק את כל המשחקים ויחזיר 100 tokens.')) {
          Storage.resetAll();
          AppState.newGame();
          Sidebar.updateTokens();
          Toast.success('כל הנתונים אופסו!');
        }
      });
    }

    // Load latest game if exists
    const games = Storage.getGames();
    if (games.length > 0) {
      games.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
      // Don't auto-load — let user pick from sidebar
    }

    // Welcome toast
    setTimeout(() => {
      Toast.info('ברוכים הבאים ל-Gaming Vibe Coding! 🎮', 4000);
    }, 500);

    console.log('🎮 Gaming Vibe Coding initialized');
    console.log('Modules loaded:', {
      Storage: !!window.Storage,
      Toast: !!window.Toast,
      MockAI: !!window.MockAI,
      MCQGenerator: !!window.MCQGenerator,
      Validator: !!window.Validator,
      GameTemplates: !!window.GameTemplates,
      TemplateBuilder: !!window.TemplateBuilder,
      Sidebar: !!window.Sidebar,
      Chat: !!window.Chat,
      Preview: !!window.Preview,
      AppState: !!window.AppState
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
