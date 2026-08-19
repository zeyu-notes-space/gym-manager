import {
  getAllMembers,
  getTodayCheckinCount,
  getMemberCount,
  searchMembers,
  seedDemoData,
} from '../db.js';
import { navigate } from '../router.js';
import { getDaysRemaining, getCardTypeLabel, escapeHtml } from '../utils.js';

export async function renderHome() {
  const app = document.getElementById('app');
  const totalCount = await getMemberCount();

  // Empty state
  if (totalCount === 0) {
    app.innerHTML = `
      <div class="home-view">
        <div class="top-bar glass">
          <h1>健身房会员</h1>
        </div>
        <div class="empty-state-full">
          <div class="empty-icon">
            <svg width="64" height="64" viewBox="0 0 100 100">
              <rect x="25" y="38" width="50" height="24" rx="6" fill="#2dd4bf" opacity="0.9"/>
              <rect x="18" y="31" width="10" height="38" rx="5" fill="#2dd4bf" opacity="0.7"/>
              <rect x="72" y="31" width="10" height="38" rx="5" fill="#2dd4bf" opacity="0.7"/>
            </svg>
          </div>
          <h2>还没有会员</h2>
          <p>添加第一个会员开始使用</p>
          <button class="btn-primary" id="btn-first-member">+ 新增会员</button>
          <button class="btn-secondary" id="btn-demo-data">加载演示数据</button>
        </div>
      </div>
    `;

    document.getElementById('btn-first-member').onclick = () => navigate('/member/new');
    document.getElementById('btn-demo-data').onclick = async () => {
      await seedDemoData();
      renderHome();
    };
    return;
  }

  // Normal view
  const members = await getAllMembers();
  const todayCount = await getTodayCheckinCount();

  app.innerHTML = `
    <div class="home-view">
      <div class="top-bar glass">
        <h1>健身房会员</h1>
      </div>

      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" id="search-input" placeholder="搜索姓名 / 手机号" autocomplete="off">
      </div>

      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-value">${todayCount}</span>
          <span class="stat-label">今日签到</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">${totalCount}</span>
          <span class="stat-label">会员总数</span>
        </div>
      </div>

      <div class="member-list" id="member-list">
        ${members.map(renderMemberItem).join('')}
      </div>

      <div class="fab" id="fab-add">
        <span>+</span>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('search-input').oninput = async (e) => {
    const query = e.target.value.trim();
    const results = query ? await searchMembers(query) : await getAllMembers();
    const list = document.getElementById('member-list');
    if (results.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <p>没有找到会员</p>
          <button class="btn-primary" id="search-add-btn">+ 新增会员</button>
        </div>
      `;
      document.getElementById('search-add-btn').onclick = () => navigate('/member/new');
    } else {
      list.innerHTML = results.map(renderMemberItem).join('');
      bindMemberItemClicks();
    }
  };

  document.getElementById('fab-add').onclick = () => navigate('/member/new');
  bindMemberItemClicks();
}

function renderMemberItem(member) {
  let statusText = '';
  let statusClass = '';

  if (member.cardType === 'count') {
    if (member.remainingCount <= 0) {
      statusClass = 'status-expired';
      statusText = '次卡 · 已用完';
    } else if (member.remainingCount <= 3) {
      statusClass = 'status-warning';
      statusText = `次卡 · 剩余 ${member.remainingCount} 次`;
    } else {
      statusText = `次卡 · 剩余 ${member.remainingCount} 次`;
    }
  } else {
    const daysLeft = getDaysRemaining(member.expiryDate);
    const label = getCardTypeLabel(member.cardType);
    if (daysLeft < 0) {
      statusClass = 'status-expired';
      statusText = `${label} · 已过期`;
    } else if (daysLeft <= 7) {
      statusClass = 'status-warning';
      statusText = `${label} · 剩余 ${daysLeft} 天`;
    } else {
      statusText = `${label} · 剩余 ${daysLeft} 天`;
    }
  }

  return `<div class="member-item" data-id="${escapeHtml(member.id)}">
    <div class="member-name">${escapeHtml(member.name)}</div>
    <div class="member-status ${statusClass}">${statusText}</div>
  </div>`;
}

function bindMemberItemClicks() {
  document.querySelectorAll('.member-item').forEach((el) => {
    el.onclick = () => navigate('/member/' + encodeURIComponent(el.dataset.id));
  });
}
