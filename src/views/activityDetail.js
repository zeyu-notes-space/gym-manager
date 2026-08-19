import {
  getActivity,
  getParticipantsByActivity,
  addParticipant,
  updateParticipant,
  deleteParticipant,
  deleteParticipantsByActivity,
  deleteActivity,
  getAllMembers,
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
  promptInput,
  picker,
} from '../utils.js';

export async function renderActivityDetail(activityId) {
  const activity = await getActivity(activityId);
  if (!activity) {
    navigate('/activities');
    return;
  }

  const participants = await getParticipantsByActivity(activityId);
  const allMembers = await getAllMembers();
  const memberMap = {};
  allMembers.forEach(m => { memberMap[m.id] = m; });

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
              : registered.map(p => {
                  const linkedMember = p.linkedMemberId ? memberMap[p.linkedMemberId] : null;
                  return `
                    <div class="list-item" style="padding:10px 0">
                      <div class="list-item-avatar">${(p.name || '?').charAt(0)}</div>
                      <div class="list-item-info">
                        <div class="item-title">${escapeHtml(p.name)}${linkedMember ? ` <span class="tag tag-accent">会员</span>` : ''}</div>
                        ${p.phone ? `<div class="item-subtitle">${escapeHtml(p.phone)}</div>` : ''}
                        ${p.guardianName ? `<div class="item-subtitle" style="font-size:12px;color:var(--text-muted)">家长: ${escapeHtml(p.guardianName)}${p.guardianPhone ? ' · ' + escapeHtml(p.guardianPhone) : ''}</div>` : ''}
                      </div>
                      <button class="btn btn-xs btn-danger" data-participant-id="${escapeHtml(p.id)}">删除</button>
                    </div>
                  `;
                }).join('')
            }
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-add-participant">+ 添加参与人</button>
        <div class="btn-group">
          <button class="btn btn-secondary" onclick="navigate('/activities/' + encodeURIComponent('${escapeHtml(activityId)}') + '/edit')">编辑活动</button>
          <button class="btn btn-danger" id="btn-delete-activity">删除活动</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back').onclick = () => navigate('/activities');
  document.getElementById('btn-edit').onclick = () => navigate('/activities/' + encodeURIComponent(activityId) + '/edit');
  document.getElementById('btn-add-participant').onclick = () => handleAddParticipant(activity);
  document.getElementById('btn-delete-activity').onclick = () => handleDeleteActivity(activity);

  document.querySelectorAll('[data-participant-id]').forEach(el => {
    el.onclick = async () => {
      const ok = await showConfirm('移除此参与人？');
      if (ok) {
        await deleteParticipant(el.dataset.participantId);
        showToast('已移除');
        renderActivityDetail(activityId);
      }
    };
  });
}

async function handleAddParticipant(activity) {
  const useMember = await showConfirm('从已有会员中选择？');

  if (useMember) {
    const allMembers = await getAllMembers();
    const memberItems = allMembers.map(m => ({
      id: m.id,
      label: `${m.name}${m.phone ? ' · ' + m.phone : ''}`,
    }));
    const selectedId = await picker(memberItems, '选择会员');
    if (!selectedId) return;

    const member = allMembers.find(m => m.id === selectedId);
    if (!member) return;

    await addParticipant({
      id: generateParticipantId(),
      activityId: activity.id,
      linkedMemberId: member.id,
      name: member.name,
      phone: member.phone || '',
      guardianName: '',
      guardianPhone: '',
      notes: '',
      status: 'registered',
      createdAt: new Date().toISOString(),
    });
  } else {
    const name = await promptInput('姓名 *', '输入姓名');
    if (!name) return;
    const phone = await promptInput('电话（选填）', '输入电话');
    const guardianName = await promptInput('家长姓名（选填）', '输入家长姓名');
    const guardianPhone = await promptInput('家长电话（选填）', '输入家长电话');

    await addParticipant({
      id: generateParticipantId(),
      activityId: activity.id,
      linkedMemberId: null,
      name: name,
      phone: phone || '',
      guardianName: guardianName || '',
      guardianPhone: guardianPhone || '',
      notes: '',
      status: 'registered',
      createdAt: new Date().toISOString(),
    });
  }

  showToast('添加成功');
  renderActivityDetail(activity.id);
}

async function handleDeleteActivity(activity) {
  const ok = await showConfirm(`确认删除活动「${escapeHtml(activity.title)}」？参与记录也会删除。`);
  if (!ok) return;

  await deleteParticipantsByActivity(activity.id);
  await deleteActivity(activity.id);
  showToast('已删除');
  navigate('/activities');
}
