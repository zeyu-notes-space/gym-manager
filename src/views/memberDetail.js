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
} from '../db.js';
import { navigate } from '../router.js';
import {
  formatDateTime,
  getDaysRemaining as calcDaysRemaining,
  getCardTypeLabel,
  escapeHtml,
} from '../utils.js';

let _checkinLock = false;

export async function renderMemberDetail(memberId) {
  const member = await getMember(memberId);
  if (!member) {
    navigate('/');
    return;
  }

  const checkins = await getCheckinsByMember(memberId);
  checkins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const app = document.getElementById('app');
  app.innerHTML = buildHTML(member, checkins);

  // Bind events
  document.getElementById('btn-back').onclick = () => navigate('/');
  document.getElementById('btn-checkin').onclick = () => handleCheckin(member);

  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.onclick = () => handleUndo(member);

  document.getElementById('btn-renew').onclick = () => showRenewDialog(member);
  document.getElementById('btn-edit').onclick = () =>
    navigate('/member/' + encodeURIComponent(memberId) + '/edit');
  document.getElementById('btn-delete').onclick = () => handleDelete(member);
}

function buildHTML(member, checkins) {
  const name = escapeHtml(member.name);
  const typeLabel = getCardTypeLabel(member.cardType);

  let mainHTML = '';
  let needsConfirm = false;

  if (member.cardType === 'count') {
    const rem = member.remainingCount;
    const total = member.totalCount;
    const used = total - rem;
    const pct = total > 0 ? (used / total) * 100 : 0;
    const isZero = rem <= 0;
    if (isZero) needsConfirm = true;

    mainHTML = `
      <div class="detail-main">
        <div class="card-badge ${isZero ? 'expired-badge' : ''}">次卡</div>
        <div class="big-number ${isZero ? 'zero' : ''}">
          ${isZero ? '0' : rem}
          <span class="big-number-label">${isZero ? '次数已用完' : '剩余次数'}</span>
        </div>
        <div class="progress-section">
          <div class="progress-bar">
            <div class="progress-fill" style="width:${pct}%"></div>
          </div>
          <span class="progress-text">已使用 ${used} / 总计 ${total}</span>
        </div>
      </div>
    `;
  } else {
    const daysLeft = calcDaysRemaining(member.expiryDate);
    const expired = daysLeft < 0;
    if (expired) needsConfirm = true;

    mainHTML = `
      <div class="detail-main">
        <div class="card-badge ${expired ? 'expired-badge' : ''}">${typeLabel}</div>
        <div class="big-number ${expired ? 'zero' : ''}">
          ${expired ? '已过期' : `${daysLeft}<span class="big-number-unit">天</span>`}
          <span class="big-number-label">${expired ? '' : '剩余'}</span>
        </div>
        <div class="date-range">
          ${member.startDate || '—'} ～ ${member.expiryDate || '—'}
        </div>
      </div>
    `;
  }

  const historyHTML = checkins.length > 0
    ? checkins.map(c => `
      <div class="checkin-item">
        <span>${formatDateTime(c.timestamp)}</span>
        ${c.forced ? '<span class="forced-tag">已过期签到</span>' : ''}
      </div>`).join('')
    : '<div class="empty-state-sm">暂无签到记录</div>';

  return `
    <div class="detail-view">
      <div class="top-bar glass">
        <button class="btn-icon" id="btn-back">←</button>
        <h1>${name}</h1>
        <div style="width:36px"></div>
      </div>

      ${mainHTML}

      <div class="detail-actions">
        <button class="btn-checkin" id="btn-checkin" ${needsConfirm ? 'data-warn="true"' : ''}>
          确认签到
        </button>
        ${checkins.length > 0 ? '<button class="btn-undo" id="btn-undo">撤销最近一次签到</button>' : ''}
      </div>

      <div class="detail-section">
        <h3 class="section-title">最近签到</h3>
        <div class="checkin-list">${historyHTML}</div>
      </div>

      <div class="detail-footer">
        <button class="btn-secondary" id="btn-renew">续卡 / 充值</button>
        <button class="btn-secondary" id="btn-edit">编辑</button>
        <button class="btn-danger" id="btn-delete">删除</button>
      </div>
    </div>
  `;
}

async function handleCheckin(member) {
  if (_checkinLock) return;
  _checkinLock = true;

  const btn = document.getElementById('btn-checkin');
  btn.disabled = true;

  try {
    let forced = false;

    if (member.cardType === 'count' && member.remainingCount <= 0) {
      const ok = await showConfirm('该会员次数已用完，仍然记录本次签到？');
      if (!ok) { btn.disabled = false; _checkinLock = false; return; }
      forced = true;
    } else if (member.cardType !== 'count') {
      const daysLeft = calcDaysRemaining(member.expiryDate);
      if (daysLeft < 0) {
        const ok = await showConfirm('该会员当前已过期，仍然记录本次签到？');
        if (!ok) { btn.disabled = false; _checkinLock = false; return; }
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

    showToast('✓ 签到成功');
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

  showToast('✓ 已撤销');
  renderMemberDetail(member.id);
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
  navigate('/');
}

// ─── Renew Dialog ───

function showRenewDialog(member) {
  const overlay = document.createElement('div');
  overlay.className = 'confirm-overlay';

  let bodyHTML = '';

  if (member.cardType === 'count') {
    bodyHTML = `
      <div class="renew-body">
        <p>当前剩余：<strong>${member.remainingCount}</strong> 次</p>
        <div class="form-group">
          <label>增加次数</label>
          <input type="number" id="renew-count-input" min="1" value="10">
        </div>
        <div class="renew-result" id="renew-result">完成后剩余：${member.remainingCount + 10} 次</div>
      </div>
    `;
  } else {
    bodyHTML = `
      <div class="renew-body">
        <p>当前到期：<strong>${member.expiryDate || '—'}</strong></p>
        <div class="form-group">
          <label>新的到期日期</label>
          <input type="date" id="renew-date-input" value="${member.expiryDate || ''}">
        </div>
      </div>
    `;
  }

  overlay.innerHTML = `
    <div class="confirm-dialog">
      <h2 style="margin-bottom:16px;font-size:18px;">${member.cardType === 'count' ? '充值' : '续期'}</h2>
      ${bodyHTML}
      <div class="confirm-actions" style="margin-top:20px;">
        <button class="btn-secondary" id="renew-cancel">取消</button>
        <button class="btn-primary" id="renew-confirm">${member.cardType === 'count' ? '确认充值' : '确认续期'}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Live preview for count
  if (member.cardType === 'count') {
    document.getElementById('renew-count-input').oninput = () => {
      const val = parseInt(document.getElementById('renew-count-input').value) || 0;
      document.getElementById('renew-result').textContent =
        '完成后剩余：' + (member.remainingCount + val) + ' 次';
    };
  }

  document.getElementById('renew-cancel').onclick = () => overlay.remove();
  document.getElementById('renew-confirm').onclick = async () => {
    const now = new Date().toISOString();

    if (member.cardType === 'count') {
      const addVal = parseInt(document.getElementById('renew-count-input').value) || 0;
      if (addVal <= 0) {
        showToast('请输入有效的次数');
        return;
      }
      member.totalCount += addVal;
      member.remainingCount += addVal;
      member.updatedAt = now;
      await updateMember(member);
      await addAdjustment({
        id: generateAdjId(),
        memberId: member.id,
        type: 'recharge',
        description: '充值 ' + addVal + ' 次',
        timestamp: now,
      });
    } else {
      const newExpiry = document.getElementById('renew-date-input').value;
      if (!newExpiry) {
        showToast('请选择新的到期日期');
        return;
      }
      member.expiryDate = newExpiry;
      member.updatedAt = now;
      await updateMember(member);
      await addAdjustment({
        id: generateAdjId(),
        memberId: member.id,
        type: 'extend',
        description: '续期至 ' + newExpiry,
        timestamp: now,
      });
    }

    overlay.remove();
    showToast('✓ 已更新');
    renderMemberDetail(member.id);
  };
}

// ─── Confirm Dialog ───

function showConfirm(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-dialog">
        <p>${escapeHtml(message)}</p>
        <div class="confirm-actions">
          <button class="btn-secondary" id="confirm-cancel">取消</button>
          <button class="btn-primary" id="confirm-ok">确认</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById('confirm-cancel').onclick = () => {
      overlay.remove();
      resolve(false);
    };
    document.getElementById('confirm-ok').onclick = () => {
      overlay.remove();
      resolve(true);
    };
  });
}

// ─── Toast ───

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  if (window._detailToastTimer) clearTimeout(window._detailToastTimer);
  el.textContent = msg;
  el.classList.add('show');
  window._detailToastTimer = setTimeout(() => {
    el.classList.remove('show');
    window._detailToastTimer = null;
  }, 2000);
}
