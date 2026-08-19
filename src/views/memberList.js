import {
  getAllMembers,
  getMemberCount,
  getTodayCheckinCount,
  searchMembers,
  seedDemoData,
} from '../db.js';
import { navigate } from '../router.js';
import { getDaysRemaining, getCardTypeLabel, escapeHtml } from '../utils.js';

export async function renderMemberList() {
  const app = document.getElementById('app');
  const totalCount = await getMemberCount();

  if (totalCount === 0) {
    app.innerHTML = `
      <div class="list-view">
        <div class="top-bar">
          <button class="btn-icon" onclick="window.__back()">‹</button>
          <h1>会员管理</h1>
          <div style="width:36px"></div>
        </div>
        <div class="empty-state">
          <div class="empty-icon">👥</div>
          <h3>还没有会员</h3>
          <p>添加第一个会员开始使用</p>
          <button class="btn btn-primary" id="btn-first-member">+ 新增会员</button>
          <button class="btn btn-secondary" id="btn-demo-data" style="margin-top:8px">加载演示数据</button>
        </div>
      </div>
    `;
    document.getElementById('btn-first-member').onclick = () => navigate('/members/new');
    document.getElementById('btn-demo-data').onclick = async () => {
      await seedDemoData();
      renderMemberList();
    };
    return;
  }

  const todayCheckins = await getTodayCheckinCount();
  const members = await getAllMembers();
  members.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));

  app.innerHTML = `
    <div class="list-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>会员管理</h1>
        <div style="width:36px"></div>
      </div>
      <div class="stats-row">
        <div class="stat-box">
          <div class="stat-number">${todayCheckins}</div>
          <div class="stat-label">今日签到</div>
        </div>
        <div class="stat-box">
          <div class="stat-number">${totalCount}</div>
          <div class="stat-label">会员总数</div>
        </div>
      </div>
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input type="search" id="search-input" placeholder="搜索姓名 / 手机号 / 卡号" />
      </div>
      <div class="list-content" id="member-list">
        ${renderMemberItems(members)}
      </div>
      <button class="fab" id="btn-add-member">+</button>
    </div>
  `;

  document.getElementById('search-input').oninput = async (e) => {
    const query = e.target.value.trim();
    const results = query ? await searchMembers(query) : await getAllMembers();
    results.sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    document.getElementById('member-list').innerHTML = renderMemberItems(results);
    bindMemberClicks();
  };

  document.getElementById('btn-add-member').onclick = () => navigate('/members/new');
  bindMemberClicks();
}

function renderMemberItems(members) {
  if (members.length === 0) {
    return '<div class="empty-state"><p>没有匹配的会员</p></div>';
  }

  return members.map(m => {
    const label = getCardTypeLabel(m.cardType);
    let subtitle = label || '仅私教';
    let meta = '';
    let metaSub = '';

    if (m.cardType === 'count') {
      meta = m.remainingCount;
      metaSub = `/ ${m.totalCount}`;
    } else if (m.cardType === 'month' || m.cardType === 'year') {
      const days = getDaysRemaining(m.expiryDate);
      if (days !== null && days >= 0) {
        meta = `${days}天`;
        metaSub = '剩余';
      } else if (days !== null) {
        meta = '已过期';
        metaSub = '';
      }
    }

    return `
      <div class="list-item" data-id="${escapeHtml(m.id)}">
        <div class="list-item-avatar">${m.name.charAt(0)}</div>
        <div class="list-item-info">
          <div class="item-title">${escapeHtml(m.name)}</div>
          <div class="item-subtitle">${escapeHtml(subtitle)}${m.cardNo ? ` · ${escapeHtml(m.cardNo)}` : ''}</div>
        </div>
        <div class="list-item-meta">
          ${meta ? `<div class="meta-primary">${meta}</div>` : ''}
          ${metaSub ? `<div class="meta-secondary">${metaSub}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function bindMemberClicks() {
  document.querySelectorAll('#member-list .list-item').forEach(el => {
    el.onclick = () => navigate('/members/' + encodeURIComponent(el.dataset.id));
  });
}
