export function formatDateTime(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

export function formatDate(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString + (isoString.includes('T') ? '' : 'T00:00:00'));
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTime(isoString) {
  if (!isoString) return '';
  // If it's a time string like "10:00"
  if (/^\d{1,2}:\d{2}$/.test(isoString)) return isoString;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

export function getDaysRemaining(expiryDateStr) {
  if (!expiryDateStr) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDateStr + 'T00:00:00');
  expiry.setHours(0, 0, 0, 0);
  const diff = expiry.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function getCardTypeLabel(type) {
  switch (type) {
    case 'count': return '次卡';
    case 'month': return '月卡';
    case 'year': return '年卡';
    default: return '';
  }
}

export function getDefaultExpiry(startDate, cardType) {
  const start = new Date(startDate + 'T00:00:00');
  if (cardType === 'month') {
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    end.setDate(end.getDate() - 1);
    return end.toISOString().split('T')[0];
  } else if (cardType === 'year') {
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);
    return end.toISOString().split('T')[0];
  }
  return '';
}

export function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}

export function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

export function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <p>${escapeHtml(message)}</p>
        <div class="modal-buttons">
          <button class="btn btn-secondary" id="modal-cancel">取消</button>
          <button class="btn btn-primary" id="modal-confirm">确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    overlay.querySelector('#modal-cancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(false);
    };
    overlay.querySelector('#modal-confirm').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(true);
    };
  });
}

export function picker(items, title, selectedId) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog picker-dialog">
        <h4>${escapeHtml(title)}</h4>
        <div class="picker-list">
          ${items.map(i => `
            <button class="picker-item${i.id === selectedId ? ' selected' : ''}" data-id="${escapeHtml(i.id)}">
              ${escapeHtml(i.label)}
            </button>
          `).join('')}
        </div>
        <button class="btn btn-secondary" id="picker-cancel">取消</button>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    overlay.querySelectorAll('.picker-item').forEach(el => {
      el.onclick = () => {
        overlay.classList.remove('show');
        setTimeout(() => overlay.remove(), 200);
        resolve(el.dataset.id);
      };
    });
    overlay.querySelector('#picker-cancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(null);
    };
  });
}

export function promptInput(label, placeholder, defaultValue) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <p>${escapeHtml(label)}</p>
        <input type="text" class="input" id="prompt-input" placeholder="${escapeHtml(placeholder)}" value="${escapeHtml(defaultValue || '')}" />
        <div class="modal-buttons">
          <button class="btn btn-secondary" id="prompt-cancel">取消</button>
          <button class="btn btn-primary" id="prompt-confirm">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const input = overlay.querySelector('#prompt-input');
    input.focus();
    input.select();

    overlay.querySelector('#prompt-cancel').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(null);
    };
    overlay.querySelector('#prompt-confirm').onclick = () => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(input.value.trim());
    };
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        overlay.querySelector('#prompt-confirm').click();
      }
    };
  });
}

export function getCategoryLabel(cat) {
  switch (cat) {
    case '儿童': return '儿童';
    case '体验': return '体验';
    case '社区': return '社区';
    case '临时': return '临时';
    default: return cat || '其他';
  }
}
