import {
  getMember,
  getCheckinsByMember,
  addCheckin,
  deleteCheckin,
  getLatestCheckin,
  updateMember,
  deleteMember,
  addAdjustment,
  generateId,
  generateCheckinId,
  generateAdjId,
  getCoursesByMember,
} from '../db.js';
import { navigate } from '../router.js';
import {
  formatDateTime,
  getDaysRemaining as calcDaysRemaining,
  getCardTypeLabel,
  escapeHtml,
  showToast,
  showConfirm,
  promptInput,
  getLocalDateString,
} from '../utils.js';

let _checkinLock = false;

export async function renderMemberDetail(memberId) {
  const member = await getMember(memberId);
  if (!member) {
    navigate('/members');
    return;
  }

  const checkins = await getCheckinsByMember(memberId);
  checkins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const courses = await getCoursesByMember(memberId);
  const hasTraining = courses.length > 0;

  const app = document.getElementById('app');
  app.innerHTML = buildHTML(member, checkins, courses, hasTraining);

  document.getElementById('btn-back').onclick = () => navigate('/members');
  
  const checkinBtn = document.getElementById('btn-checkin');
  if (checkinBtn) checkinBtn.onclick = () => handleCheckin(member);

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.onclick = () => handleUndo(member);

  const renewBtn = document.getElementById('btn-renew');
  if (renewBtn) renewBtn.onclick = () => showRenewDialog(member);

  const editBtn = document.getElementById('btn-edit');
  if (editBtn) editBtn.onclick = () => navigate('/members/' + encodeURIComponent(memberId) + '/edit');

  const deleteBtn = document.getElementById('btn-delete');
  if (deleteBtn) deleteBtn.onclick = () => handleDelete(member);

  const trainingLink = document.getElementById('btn-view-training');
  if (trainingLink) trainingLink.onclick = () => navigate('/training?member=' + encodeURIComponent(memberId));
}

function buildHTML(member, checkins, courses, hasTraining) {
  const name = escapeHtml(member.name);
  const typeLabel = getCardTypeLabel(member.cardType);
  const cardNo = member.cardNo ? escapeHtml(member.cardNo) : '';
  const notes = member.notes ? escapeHtml(member.notes) : '';

  let mainValue = '';
  let mainLabel = '';
  let valueClass = '';
  let extraHTML = '';

  if (member.cardType === 'count') {
    const rem = member.remainingCount;
    const total = member.totalCount;
    const used = total > 0 ? total - rem : 0;
    const pct = total > 0 ? (used / total) * 100 : 0;
    mainValue = String(rem);
    mainLabel = rem > 0 ? '剩余次数' : '次数已用完';
    valueClass = rem <= 0 ? 'zero' : '';
    if (total > 0) {
      extraHTML = `
        <div class="progress-section">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div class="progress-text">已使用 ${used} / 总计 ${total}</div>
        </div>
      `;
    }
  } else if (member.cardType === 'month' || member.cardType === 'year') {
    const days = calcDaysRemaining(member.expiryDate);
    if (days === null) {
      mainValue = '—';
      mainLabel = '无期限';
    } else if (days >= 0) {
      mainValue = `${days}`;
      mainLabel = `剩余天数（至 ${member.expiryDate}）`;
    } else {
      mainValue = '已过期';
      mainLabel = `于 ${member.expiryDate} 到期`;
      valueClass = 'expired';
    }
  } else {
    mainValue = '—';
    mainLabel = '仅私教';
    valueClass = '';
  }

  const historyHTML = checkins.length > 0
    ? checkins.map(c => `
      <div class="history-item">
        <span class="history-time">${formatDateTime(c.timestamp)}</span>
        ${c.forced ? '<span class="history-tag">已过期</span>' : ''}
      </div>
    `).join('')
    : '<div class="section-empty">暂无签到记录</div>';

  return `
    <div class="detail-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>${name}</h1>
        <button class="btn-icon" id="btn-edit">✎</button>
      </div>

      <div class="detail-body">
        <div class="detail-card">
          <div class="big-value ${valueClass}">${mainValue}</div>
          <div class="big-value-label">${mainLabel}</div>
          ${extraHTML}
        </div>

        <div class="detail-card">
          <h3>基本信息</h3>
          <div class="info-row"><span class="label">姓名</span><span class="value">${name}</span></div>
          ${member.phone ? `<div class="info-row"><span class="label">手机号</span><span class="value">${escapeHtml(member.phone)}</span></div>` : ''}
          ${cardNo ? `<div class="info-row"><span class="label">会员卡号</span><span class="value">${cardNo}</span></div>` : ''}
          ${typeLabel ? `<div class="info-row"><span class="label">卡类型</span><span class="value">${typeLabel}</span></div>` : ''}
          ${member.startDate ? `<div class="info-row"><span class="label">有效期</span><span class="value">${escapeHtml(member.startDate)} → ${escapeHtml(member.expiryDate || '—')}</span></div>` : ''}
          ${notes ? `<div class="info-row"><span class="label">备注</span><span class="value">${notes}</span></div>` : ''}
        </div>

        ${hasTraining ? `
        <div class="detail-card">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <h3>私教课包</h3>
            <span class="link-accent" id="btn-view-training">查看 ${courses.length} 个课包 ›</span>
          </div>
          ${courses.slice(0, 2).map(c => `
            <div class="info-row">
              <span class="label">${escapeHtml(c.packageName)} · ${escapeHtml(c.coachName || '')}</span>
              <span class="value">${c.remainingLessons}/${c.totalLessons} 节</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="detail-card">
          <h3>签到记录</h3>
          <div class="history-list">${historyHTML}</div>
        </div>
      </div>

      <div class="detail-actions">
        ${member.cardType && member.membershipEnabled !== false ? `
        <button class="btn btn-primary btn-block" id="btn-checkin">确认签到</button>
        ` : ''}
        ${checkins.length > 0 ? `<button class="btn btn-secondary btn-block" id="btn-undo">撤销最近签到</button>` : ''}
        <div class="btn-group">
          <button class="btn btn-secondary" id="btn-renew">续卡</button>
          <button class="btn btn-danger" id="btn-delete">删除</button>
        </div>
      </div>
    </div>
  `;
}

async function handleCheckin(member) {
  if (_checkinLock) return;
  _checkinLock = true;
  const btn = document.getElementById('btn-checkin');
  if (btn) btn.disabled = true;

  try {
    let forced = false;

    if (member.cardType === 'count' && member.remainingCount <= 0) {
      const ok = await showConfirm('该会员次数已用完，仍然记录本次签到？');
      if (!ok) { if (btn) btn.disabled = false; _checkinLock = false; return; }
      forced = true;
    } else if (member.cardType === 'month' || member.cardType === 'year') {
      const daysLeft = calcDaysRemaining(member.expiryDate);
      if (daysLeft !== null && daysLeft < 0) {
        const ok = await showConfirm('该会员当前已过期，仍然记录本次签到？');
        if (!ok) { if (btn) btn.disabled = false; _checkinLock = false; return; }
        forced = true;
      }
    }

    const now = new Date().toISOString();
    const checkin = {
      id: generateCheckinId(),
      memberId: member.id,
      timestamp: now,
      forced,
    };

    await addCheckin(checkin);

    if (member.cardType === 'count' && member.remainingCount > 0) {
      member.remainingCount -= 1;
      member.updatedAt = now;
      await updateMember(member);
    }

    showToast('签到成功');
    renderMemberDetail(member.id);
  } finally {
    _checkinLock = false;
  }
}

async function handleUndo(member) {
  const latest = await getLatestCheckin(member.id);
  if (!latest) {
    showToast('没有可撤销的签到');
    return;
  }

  const ok = await showConfirm('撤销最近一次签到？');
  if (!ok) return;

  await deleteCheckin(latest.id);

  if (member.cardType === 'count') {
    member.remainingCount = Math.min(member.remainingCount + 1, member.totalCount);
    member.updatedAt = new Date().toISOString();
    await updateMember(member);
  }

  await addAdjustment({
    id: generateAdjId(),
    memberId: member.id,
    type: 'undo',
    description: '撤销签到',
    timestamp: new Date().toISOString(),
  });

  showToast('已撤销');
  renderMemberDetail(member.id);
}

async function showRenewDialog(member) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-dialog">
      <h4>续卡 / 充值</h4>
      <div class="form-group">
        <label>卡类型</label>
        <div class="card-type-selector">
          <button class="type-btn selected" data-type="count">次卡</button>
          <button class="type-btn" data-type="month">月卡</button>
          <button class="type-btn" data-type="year">年卡</button>
        </div>
      </div>
      <div class="form-group" id="renew-count-group">
        <label>增加次数</label>
        <input type="number" class="input" id="renew-count" value="10" min="1" />
      </div>
      <div class="form-group" id="renew-date-group" style="display:none">
        <label>有效期开始</label>
        <input type="date" class="input" id="renew-start" value="${getLocalDateString()}" />
      </div>
      <div class="modal-buttons">
        <button class="btn btn-secondary" id="renew-cancel">取消</button>
        <button class="btn btn-primary" id="renew-confirm">确认</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));

  let selectedType = 'count';
  const countGroup = overlay.querySelector('#renew-count-group');
  const dateGroup = overlay.querySelector('#renew-date-group');

  overlay.querySelectorAll('.type-btn').forEach(btn => {
    btn.onclick = () => {
      overlay.querySelectorAll('.type-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedType = btn.dataset.type;
      countGroup.style.display = selectedType === 'count' ? '' : 'none';
      dateGroup.style.display = selectedType === 'count' ? 'none' : '';
    };
  });

  overlay.querySelector('#renew-cancel').onclick = () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
  };

  overlay.querySelector('#renew-confirm').onclick = async () => {
    const cardType = selectedType;

    if (cardType === 'count') {
      const addCount = parseInt(overlay.querySelector('#renew-count').value) || 10;
      member.cardType = 'count';
      member.totalCount = (member.totalCount || 0) + addCount;
      member.remainingCount = (member.remainingCount || 0) + addCount;
      member.startDate = null;
      member.expiryDate = null;
    } else {
      const startDate = overlay.querySelector('#renew-start').value;
      if (!startDate) { showToast('请选择开始日期'); return; }
      member.cardType = cardType;
      member.totalCount = null;
      member.remainingCount = null;
      member.startDate = startDate;
      if (cardType === 'month') {
        const end = new Date(startDate + 'T00:00:00');
        end.setMonth(end.getMonth() + 1);
        end.setDate(end.getDate() - 1);
        member.expiryDate = getLocalDateString(end);
      } else {
        const end = new Date(startDate + 'T00:00:00');
        end.setFullYear(end.getFullYear() + 1);
        end.setDate(end.getDate() - 1);
        member.expiryDate = getLocalDateString(end);
      }
    }

    member.membershipEnabled = true;
    member.updatedAt = new Date().toISOString();
    await updateMember(member);

    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 200);
    showToast('续卡成功');
    renderMemberDetail(member.id);
  };
}

async function handleDelete(member) {
  const ok = await showConfirm(
    `确认删除 ${escapeHtml(member.name)}？该会员的签到记录也会被删除。`
  );
  if (!ok) return;

  const checkins = await getCheckinsByMember(member.id);
  for (const c of checkins) {
    await deleteCheckin(c.id);
  }
  await deleteMember(member.id);
  showToast('已删除');
  navigate('/members');
}
