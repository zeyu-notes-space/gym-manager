import './style.css';
import { getDB } from './db.js';
import { initRouter } from './router.js';
import { renderHome } from './views/home.js';
import { renderMemberList } from './views/memberList.js';
import { renderMemberDetail } from './views/memberDetail.js';
import { renderMemberForm } from './views/memberForm.js';
import { renderPrivateList } from './views/privateList.js';
import { renderPrivateDetail } from './views/privateDetail.js';
import { renderPrivateForm } from './views/privateForm.js';
import { renderActivityList } from './views/activityList.js';
import { renderActivityDetail } from './views/activityDetail.js';
import { renderActivityForm } from './views/activityForm.js';
import { renderSettings } from './views/settings.js';
import { testPersistence, diagnoseReport } from './debug.js';

// Expose for DevTools
window.__testPersistence = testPersistence;
window.__diagnoseReport = diagnoseReport;

async function init() {
  await getDB();

  initRouter([
    ['/', () => renderHome()],
    ['/members', () => renderMemberList()],
    ['/members/new', () => renderMemberForm()],
    ['/members/:id', (p) => renderMemberDetail(p.id)],
    ['/members/:id/edit', (p) => renderMemberForm(p.id)],
    ['/training', () => renderPrivateList()],
    ['/training/new', () => renderPrivateForm()],
    ['/training/:id', (p) => renderPrivateDetail(p.id)],
    ['/training/:id/edit', (p) => renderPrivateForm(p.id)],
    ['/activities', () => renderActivityList()],
    ['/activities/new', () => renderActivityForm()],
    ['/activities/:id', (p) => renderActivityDetail(p.id)],
    ['/activities/:id/edit', (p) => renderActivityForm(p.id)],
    ['/settings', () => renderSettings()],
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
      <div class="empty-state">
        <h3>启动失败</h3>
        <p>${e.message}</p>
        <button class="btn btn-primary" onclick="location.reload()">重试</button>
      </div>
    `;
  });
});
