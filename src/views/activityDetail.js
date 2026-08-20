import {
  getActivity,
  getParticipantsByActivity,
  addParticipant,
  deleteParticipant,
  deleteParticipantsByActivity,
  deleteActivity,
  generateParticipantId,
} from '../db.js';
import { navigate } from '../router.js';
import {
  escapeHtml,
  formatDate,
  formatTime,
  getCategoryLabel,
  showToast,
  showConfirm,
} from '../utils.js';
import { markDataChanged } from '../backup.js';

export async function renderActivityDetail(activityId) {
  const activity = await getActivity(activityId);
  if (!activity) {
    navigate('/activities');
    return;
  }

  const participants = await getParticipantsByActivity(activityId);
  participants.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const app = document.getElementById('app');
  const registered = participants.filter(p => p.status !== 'cancelled');
  const capDisplay = activity.capacity ? `${registered.length}/${activity.capacity}` : `${registered.length} 人`;

  app.innerHTML = `
    <div class="detail-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>活动详情</h1>
        <button class="btn-icon" id="btn-edit">✎</button>
      </div>

      <div class="detail-body">
        <div class="detail-card">
          <h3>${escapeHtml(activity.title)}</h3>
          <div class="info-row"><span class="label">日期</span><span class="value">${escapeHtml(activity.startDate || '')} ${activity.startTime ? escapeHtml(activity.startTime) : ''}${activity.endTime ? ' - ' + escapeHtml(activity.endTime) : ''}</span></div>
          <div class="info-row"><span class="label">类型</span><span class="value">${escapeHtml(getCategoryLabel(activity.category))}</span></div>
          <div class="info-row"><span class="label">参与人数</span><span class="value">${capDisplay}</span></div>
          ${activity.notes ? `<div class="info-row"><span class="label">备注</span><span class="value">${escapeHtml(activity.notes)}</span></div>` : ''}
        </div>

        <div class="detail-card">
          <h3>参与人员 (${registered.length})</h3>
          <div id="participant-list">
            ${registered.length === 0
              ? '<div style="padding:8px 0;color:var(--text-muted);font-size:14px">暂无参与人员</div>'
              : registered.map(p => `
                    <div class="list-item" style="padding:10px 0">
                      <div class="list-item-avatar">${escapeHtml((p.name || '?').charAt(0))}</div>
                      <div class="list-item-info">
                        <div class="item-title">${escapeHtml(p.name)}</div>
                        ${p.phone ? `<div class="item-subtitle">${escapeHtml(p.phone)}</div>` : ''}
                        ${p.guardianName || p.guardianPhone ? `<div class="item-subtitle" style="font-size:12px;color:var(--text-muted)">家长: ${escapeHtml(p.guardianName || '—')}${p.guardianPhone ? ' · ' + escapeHtml(p.guardianPhone) : ''}</div>` : ''}
                        ${p.notes ? `<div class="item-subtitle" style="font-size:12px;color:var(--text-muted)">${escapeHtml(p.notes)}</div>` : ''}
                      </div>
                      <button class="btn btn-xs btn-danger" data-participant-id="${escapeHtml(p.id)}">删除</button>
                    </div>
                  `).join('')
            }
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-add-participant">+ 添加参与人</button>
        <div class="btn-group">
          <button class="btn btn-secondary" id="btn-edit-bottom">编辑活动</button>
          <button class="btn btn-danger" id="btn-delete-activity">删除活动</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back').onclick = () => navigate('/activities');
  document.getElementById('btn-edit').onclick = () => navigate('/activities/' + encodeURIComponent(activityId) + '/edit');
  document.getElementById('btn-edit-bottom').onclick = () => navigate('/activities/' + encodeURIComponent(activityId) + '/edit');
  document.getElementById('btn-add-participant').onclick = () => handleAddParticipant(activity);
  document.getElementById('btn-delete-activity').onclick = () => handleDeleteActivity(activity);

  document.querySelectorAll('[data-participant-id]').forEach(el => {
    el.onclick = async () => {
      const ok = await showConfirm('移除此参与人？');
      if (ok) {
        await deleteParticipant(el.dataset.participantId);
        markDataChanged();
        showToast('已移除');
        renderActivityDetail(activityId);
      }
    };
  });
}

async function handleAddParticipant(activity) {
  const participant = await promptParticipant();
  if (!participant) return;

  await addParticipant({
    id: generateParticipantId(),
    activityId: activity.id,
    linkedMemberId: null,
    ...participant,
    status: 'registered',
    createdAt: new Date().toISOString(),
  });

  markDataChanged();
  showToast('添加成功');
  renderActivityDetail(activity.id);
}

function promptParticipant() {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-dialog">
        <h4>添加参与人</h4>
        <div class="form-group">
          <label>姓名 *</label>
          <input type="text" class="input" id="participant-name" placeholder="必填" />
        </div>
        <div class="form-group">
          <label>电话（选填）</label>
          <input type="tel" class="input" id="participant-phone" inputmode="tel" />
        </div>
        <div class="form-group">
          <label>家长姓名（选填）</label>
          <input type="text" class="input" id="participant-guardian-name" />
        </div>
        <div class="form-group">
          <label>家长电话（选填）</label>
          <input type="tel" class="input" id="participant-guardian-phone" inputmode="tel" />
        </div>
        <div class="form-group">
          <label>备注（选填）</label>
          <textarea class="input" id="participant-notes"></textarea>
        </div>
        <div class="modal-buttons">
          <button class="btn btn-secondary" id="participant-cancel">取消</button>
          <button class="btn btn-primary" id="participant-save">添加</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));

    const close = (value) => {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 200);
      resolve(value);
    };

    overlay.querySelector('#participant-cancel').onclick = () => close(null);
    overlay.querySelector('#participant-save').onclick = () => {
      const name = overlay.querySelector('#participant-name').value.trim();
      if (!name) {
        showToast('请输入姓名');
        return;
      }
      close({
        name,
        phone: overlay.querySelector('#participant-phone').value.trim(),
        guardianName: overlay.querySelector('#participant-guardian-name').value.trim(),
        guardianPhone: overlay.querySelector('#participant-guardian-phone').value.trim(),
        notes: overlay.querySelector('#participant-notes').value.trim(),
      });
    };
    overlay.querySelector('#participant-name').focus();
  });
}

async function handleDeleteActivity(activity) {
  const ok = await showConfirm(`确认删除活动「${escapeHtml(activity.title)}」？参与记录也会删除。`);
  if (!ok) return;

  await deleteParticipantsByActivity(activity.id);
  await deleteActivity(activity.id);
  markDataChanged();
  showToast('已删除');
  navigate('/activities');
}
