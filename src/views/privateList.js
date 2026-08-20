import {
  getAllCourses,
  getCourseCount,
  searchCourses,
  getAllMembers,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml } from '../utils.js';

export async function renderPrivateList() {
  const app = document.getElementById('app');
  const count = await getCourseCount();

  if (count === 0) {
    app.innerHTML = `
      <div class="list-view">
        <div class="top-bar">
          <button class="btn-icon" id="btn-back">‹</button>
          <h1>私教管理</h1>
          <div style="width:44px"></div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">🏋️</div>
          <h3>还没有课包</h3>
          <p>创建私教课包开始管理</p>
          <button class="btn btn-primary" id="btn-new-course">+ 创建课包</button>
        </div>
      </div>
    `;
    document.getElementById('btn-back').onclick = () => navigate('/');
    document.getElementById('btn-new-course').onclick = () => navigate('/training/new');
    return;
  }

  const courses = await getAllCourses();
  const members = await getAllMembers();
  const memberMap = {};
  members.forEach(m => { memberMap[m.id] = m; });

  courses.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  app.innerHTML = `
    <div class="list-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>私教管理</h1>
        <div style="width:44px"></div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-number">${count}</div>
          <div class="stat-label">课包数量</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${courses.reduce((s, c) => s + (c.remainingLessons || 0), 0)}</div>
          <div class="stat-label">剩余课时</div>
        </div>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" id="search-input" placeholder="搜索客户 / 教练 / 课程" />
      </div>
      <div class="list-content" id="course-list">
        ${renderCourseItems(courses, memberMap)}
      </div>
      <button class="fab" id="btn-add-course">+</button>
    </div>
  `;

  document.getElementById('btn-back').onclick = () => navigate('/');
  document.getElementById('search-input').oninput = async (e) => {
    const query = e.target.value.trim();
    const results = query ? await searchCourses(query) : await getAllCourses();
    results.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    document.getElementById('course-list').innerHTML = renderCourseItems(results, memberMap);
    bindCourseClicks();
  };

  document.getElementById('btn-add-course').onclick = () => navigate('/training/new');
  bindCourseClicks();
}

function renderCourseItems(courses, memberMap) {
  if (courses.length === 0) {
    return '<div class="empty-state"><p>没有匹配的课包</p></div>';
  }

  return courses.map(c => {
    const member = memberMap[c.memberId];
    const name = c.clientName || member?.name || '未命名客户';
    const phone = c.clientPhone || member?.phone || '';
    const remaining = c.remainingLessons || 0;
    const total = c.totalLessons || 0;
    const used = total - remaining;

    return `
      <div class="list-item" data-id="${escapeHtml(c.id)}">
        <div class="list-item-avatar">${escapeHtml(name.charAt(0) || '?')}</div>
        <div class="list-item-info">
          <div class="item-title">${escapeHtml(name)}</div>
          <div class="item-subtitle">${escapeHtml(c.packageName || '私教课')}${c.coachName ? ` · ${escapeHtml(c.coachName)}` : ''}${phone ? ` · ${escapeHtml(phone)}` : ''}</div>
        </div>
        <div class="list-item-meta">
          <div class="meta-primary">${remaining}/${total}</div>
          <div class="meta-secondary">${used > 0 ? `已消${used}节` : ''}</div>
        </div>
      </div>
    `;
  }).join('');
}

function bindCourseClicks() {
  document.querySelectorAll('#course-list .list-item').forEach(el => {
    el.onclick = () => navigate('/training/' + encodeURIComponent(el.dataset.id));
  });
}
