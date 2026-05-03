/* ============================================================================
   Toast Notifications
   ========================================================================= */

const Toast = {
  show(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span class="toast-icon">${icons[type] || icons.info}</span>
      <span class="toast-content">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'toastSlideIn 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg, dur) { this.show(msg, 'success', dur); },
  error(msg, dur) { this.show(msg, 'error', dur); },
  info(msg, dur) { this.show(msg, 'info', dur); },
  warning(msg, dur) { this.show(msg, 'warning', dur); }
};

window.Toast = Toast;
