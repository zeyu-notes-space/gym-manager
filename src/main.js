import './style.css';
import { getDB } from './db.js';
import { initRouter } from './router.js';
import { renderHome } from './views/home.js';
import { renderMemberDetail } from './views/memberDetail.js';
import { renderMemberForm } from './views/memberForm.js';
import { testPersistence, diagnoseReport } from './debug.js';

// Expose diagnostics for DevTools
window.__testPersistence = testPersistence;
window.__diagnoseReport = diagnoseReport;

async function init() {
  await getDB();

  initRouter([
    ['/', () => renderHome()],
    ['/member/new', () => renderMemberForm()],
    ['/member/:id', (params) => renderMemberDetail(params.id)],
    ['/member/:id/edit', (params) => renderMemberForm(params.id)],
  ]);

  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('sw.js');
    } catch (e) {
      console.log('SW registration skipped:', e.message);
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  init().catch((e) => {
    console.error('Init error:', e);
    document.getElementById('app').innerHTML = `
      <div class="empty-state-full">
        <h2>启动失败</h2>
        <p>${e.message}</p>
        <button class="btn-primary" onclick="location.reload()">重试</button>
      </div>
    `;
  });
});
