/**
 * Unified App Header
 * Usage:
 *   headerHTML = renderHeader('标题', { back: true, right: { action: 'add' } })
 *   After inserting into DOM, call bindHeader({ back: fn, right: fn })
 */
import { escapeHtml } from '../utils.js';
import { navigate } from '../router.js';

export function renderHeader(title, opts = {}) {
  const hasBack = opts.back === true || typeof opts.back === 'string';
  const backPath = typeof opts.back === 'string' ? opts.back : null;
  const hasRight = opts.right && (opts.right.action || opts.right.html);

  return `
    <div class="app-header">
      <div class="header-left">
        ${hasBack ? `<button class="header-btn" id="header-back">‹</button>` : ''}
      </div>
      <h1 class="header-title">${escapeHtml(title)}</h1>
      <div class="header-right">
        ${hasRight ? (opts.right.html || `<button class="header-btn" id="header-right-btn">${escapeHtml(opts.right.label || '')}</button>`) : ''}
      </div>
    </div>
  `;
}

export function bindHeader(opts = {}) {
  const backBtn = document.getElementById('header-back');
  if (backBtn) {
    backBtn.onclick = () => {
      if (typeof opts.back === 'function') {
        opts.back();
      } else if (typeof opts.back === 'string') {
        navigate(opts.back);
      } else {
        navigate('/');
      }
    };
  }

  const rightBtn = document.getElementById('header-right-btn');
  if (rightBtn && opts.right && typeof opts.right.action === 'function') {
    rightBtn.onclick = opts.right.action;
  }
}

/**
 * Simplified header for views: returns HTML, caller puts in top of view.
 * After mount, call onMount with { back, right }
 */
export function header(title, backTo, rightLabel) {
  const right = rightLabel ? { label: rightLabel, html: `<button class="header-btn" id="header-right-btn">${escapeHtml(rightLabel)}</button>` } : null;
  return renderHeader(title, { back: !!backTo, right });
}

export function mountHeader({ back, right }) {
  bindHeader({ back, right });
}
