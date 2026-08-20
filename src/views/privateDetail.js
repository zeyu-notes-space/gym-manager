import {
  getCourse,
  getSessionsByCourse,
  getLatestSession,
  getMember,
  updateCourse,
  deleteCourse,
  addSession,
  deleteSession,
  generateSessionId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, formatDateTime, showToast, showConfirm, promptInput } from '../utils.js';
import { markDataChanged } from '../backup.js';

let _sessionLock = false;

export async function renderPrivateDetail(courseId) {
  const course = await getCourse(courseId);
  if (!course) {
    navigate('/training');
    return;
  }

  const member = course.memberId ? await getMember(course.memberId) : null;
  const clientName = course.clientName || member?.name || '未命名客户';
  const clientPhone = course.clientPhone || member?.phone || '';
  const sessions = await getSessionsByCourse(courseId);
  sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

  const app = document.getElementById('app');
  const remaining = course.remainingLessons || 0;
  const total = course.totalLessons || 0;
  const used = total - remaining;
  const pct = total > 0 ? (used / total) * 100 : 0;

  app.innerHTML = `
    <div class="detail-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>${escapeHtml(course.packageName || '私教课')}</h1>
        <button class="btn-icon" id="btn-edit">✎</button>
      </div>

      <div class="detail-body">
        <div class="detail-card">
          <div class="big-value${remaining <= 0 ? ' zero' : ''}">${remaining}</div>
          <div class="big-value-label">${remaining > 0 ? '剩余课时' : '已用完'}</div>
          ${total > 0 ? `
          <div class="progress-section">
            <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
            <div class="progress-text">已消耗 ${used} / 总计 ${total} 节</div>
          </div>
          ` : ''}
        </div>

        <div class="detail-card">
          <h3>课包信息</h3>
          <div class="info-row"><span class="label">客户</span><span class="value">${escapeHtml(clientName)}</span></div>
          ${clientPhone ? `<div class="info-row"><span class="label">电话</span><span class="value">${escapeHtml(clientPhone)}</span></div>` : ''}
          <div class="info-row"><span class="label">教练</span><span class="value">${escapeHtml(course.coachName || '—')}</span></div>
          <div class="info-row"><span class="label">课程</span><span class="value">${escapeHtml(course.packageName || '—')}</span></div>
          <div class="info-row"><span class="label">开始</span><span class="value">${course.startDate || '—'}</span></div>
          ${course.notes ? `<div class="info-row"><span class="label">备注</span><span class="value">${escapeHtml(course.notes)}</span></div>` : ''}
        </div>

        <div class="detail-card">
          <h3>消课记录</h3>
          <div class="history-list">
            ${sessions.length > 0 
              ? sessions.map(s => `
                <div class="history-item">
                  <span class="history-time">${formatDateTime(s.timestamp)}</span>
                  <span class="history-tag">-${s.lessonsUsed || 1}节</span>
                </div>
              `).join('')
              : '<div class="section-empty">暂无消课记录</div>'
            }
          </div>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-consume" ${remaining <= 0 ? 'disabled' : ''}>
          ${remaining > 0 ? '消耗 1 课时' : '课时已用完'}
        </button>
        ${sessions.length > 0 ? `<button class="btn btn-secondary btn-block" id="btn-undo">撤销最近消课</button>` : ''}
        <div class="btn-group">
          <button class="btn btn-secondary" id="btn-add-lessons">增加课时</button>
          <button class="btn btn-danger" id="btn-delete">删除课包</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-back').onclick = () => navigate('/training');
  document.getElementById('btn-edit').onclick = () => navigate('/training/' + encodeURIComponent(courseId) + '/edit');
  document.getElementById('btn-consume').onclick = () => handleConsume(course);
  
  const undoBtn = document.getElementById('btn-undo');
  if (undoBtn) undoBtn.onclick = () => handleUndo(course);

  document.getElementById('btn-add-lessons').onclick = () => handleAddLessons(course);
  document.getElementById('btn-delete').onclick = () => handleDelete(course);
}

async function handleConsume(course) {
  if (_sessionLock) return;
  _sessionLock = true;
  const btn = document.getElementById('btn-consume');
  if (btn) btn.disabled = true;

  try {
    if ((course.remainingLessons || 0) <= 0) {
      showToast('课时已用完');
      return;
    }

    course.remainingLessons -= 1;
    course.updatedAt = new Date().toISOString();
    await updateCourse(course);

    await addSession({
      id: generateSessionId(),
      courseId: course.id,
      memberId: course.memberId || null,
      timestamp: new Date().toISOString(),
      lessonsUsed: 1,
      notes: '',
    });

    markDataChanged();
    showToast('消课成功');
    renderPrivateDetail(course.id);
  } finally {
    _sessionLock = false;
  }
}

async function handleUndo(course) {
  const latest = await getLatestSession(course.id);
  if (!latest) {
    showToast('没有可撤销的消课');
    return;
  }

  const ok = await showConfirm('撤销最近一次消课？');
  if (!ok) return;

  await deleteSession(latest.id);
  course.remainingLessons = Math.min((course.remainingLessons || 0) + 1, course.totalLessons || 999);
  course.updatedAt = new Date().toISOString();
  await updateCourse(course);

  markDataChanged();
  showToast('已撤销');
  renderPrivateDetail(course.id);
}

async function handleAddLessons(course) {
  const input = await promptInput('增加课时数', '输入数量', '5');
  if (!input) return;
  const add = parseInt(input);
  if (!add || add < 1) {
    showToast('请输入有效数量');
    return;
  }

  course.totalLessons = (course.totalLessons || 0) + add;
  course.remainingLessons = (course.remainingLessons || 0) + add;
  course.updatedAt = new Date().toISOString();
  await updateCourse(course);

  markDataChanged();
  showToast(`增加 ${add} 课时成功`);
  renderPrivateDetail(course.id);
}

async function handleDelete(course) {
  const clientName = course.clientName || '该客户';
  const ok = await showConfirm(`确认删除「${escapeHtml(clientName)}」的课包？`);
  if (!ok) return;

  const sessions = await getSessionsByCourse(course.id);
  for (const s of sessions) {
    await deleteSession(s.id);
  }
  await deleteCourse(course.id);

  markDataChanged();
  showToast('已删除');
  navigate('/training');
}
