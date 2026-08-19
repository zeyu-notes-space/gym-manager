import {
  getAllActivities,
  getActivityCount,
  getUpcomingActivities,
  getParticipantsByActivity,
  getAllMembers,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDate, formatTime, getCategoryLabel, showToast } from '../utils.js';

export async function renderActivityList() {
  const app = document.getElementById('app');
  const count = await getActivityCount();

  if (count === 0) {
    app.innerHTML = `
      <div class="list-view">
        <div class="top-bar">
          <button class="btn-icon" onclick="window.__back()">‹</button>
          <h1>活动管理</h1>
          <div style="width:36px"></div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">📋</div>
          <h3>还没有活动</h3>
          <p>创建第一个活动开始管理</p>
          <button class="btn btn-primary" id="btn-new">+ 创建活动</button>
        </div>
      </div>
    `;
    document.getElementById('btn-new').onclick = () => navigate('/activities/new');
    return;
  }

  const activities = await getAllActivities();
  const upcoming = await getUpcomingActivities();
  const allMembers = await getAllMembers();
  const memberMap = {};
  allMembers.forEach(m => { memberMap[m.id] = m; });

  activities.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));

  // Pre-fetch participant counts
  const participantCounts = {};
  for (const a of activities) {
    const participants = await getParticipantsByActivity(a.id);
    participantCounts[a.id] = participants.length;
  }

  app.innerHTML = `
    <div class="list-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>活动管理</h1>
        <div style="width:36px"></div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-number">${count}</div>
          <div class="stat-label">活动总数</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${upcoming.length}</div>
          <div class="stat-label">即将举办</div>
        </div>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" id="search-input" placeholder="搜索活动名称" />
      </div>
      <div class="list-content" id="activity-list">
        ${renderItems(activities, participantCounts)}
      </div>
      <button class="fab" id="btn-add">+</button>
    </div>
  `;

  document.getElementById('search-input').oninput = async (e) => {
    const q = e.target.value.toLowerCase().trim();
    let filtered = activities;
    if (q) {
      filtered = activities.filter(a =>
        (a.title && a.title.toLowerCase().includes(q)) ||
        (a.category && a.category.toLowerCase().includes(q))
      );
    }
    document.getElementById('activity-list').innerHTML = renderItems(filtered, participantCounts);
    bindClicks();
  };

  document.getElementById('btn-add').onclick = () => navigate('/activities/new');
  bindClicks();
}

function renderItems(activities, participantCounts) {
  if (activities.length === 0) {
    return '<div class="empty-state"><p>没有匹配的活动</p></div>';
  }

  return activities.map(a => {
    const count = participantCounts[a.id] || 0;
    const capDisplay = a.capacity ? `${count}/${a.capacity}` : `${count} 人`;

    return `
      <div class="list-item" data-id="${escapeHtml(a.id)}">
        <div class="list-item-avatar">📋</div>
        <div class="list-item-info">
          <div class="item-title">${escapeHtml(a.title || '未命名')}</div>
          <div class="item-subtitle">${escapeHtml(a.startDate || '')} ${a.startTime ? escapeHtml(a.startTime) : ''} · ${escapeHtml(getCategoryLabel(a.category))}</div>
        </div>
        <div class="list-item-meta">
          <div class="meta-primary">${capDisplay}</div>
          <div class="meta-secondary">${a.capacity ? '报名' : '参与'}</div>
        </div>
      </div>
    `;
  }).join('');
}

function bindClicks() {
  document.querySelectorAll('#activity-list .list-item').forEach(el => {
    el.onclick = () => navigate('/activities/' + encodeURIComponent(el.dataset.id));
  });
}

window.__back = () => navigate('/');
