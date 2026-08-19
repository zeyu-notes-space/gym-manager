import {
  getCourse,
  addCourse,
  updateCourse,
  getAllMembers,
  generateCourseId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, showToast } from '../utils.js';

export async function renderPrivateForm(courseId) {
  const isEdit = !!courseId;
  const course = isEdit ? await getCourse(courseId) : null;
  const members = await getAllMembers();

  const app = document.getElementById('app');

  let defaults = {
    memberId: course ? course.memberId : '',
    packageName: course ? (course.packageName || '') : '',
    coachName: course ? (course.coachName || '') : '',
    totalLessons: course ? (course.totalLessons || 20) : 20,
    remainingLessons: course ? (course.remainingLessons || course.totalLessons || 20) : 20,
    startDate: course ? (course.startDate || '') : new Date().toISOString().split('T')[0],
    notes: course ? (course.notes || '') : '',
  };

  app.innerHTML = `
    <div class="form-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>${isEdit ? '编辑课包' : '创建课包'}</h1>
        <div style="width:36px"></div>
      </div>
      <div class="form-body">
        <div class="form-group">
          <label>客户 *</label>
          <select class="input" id="field-memberId">
            <option value="">选择客户</option>
            ${members.map(m => `
              <option value="${escapeHtml(m.id)}" ${m.id === defaults.memberId ? 'selected' : ''}>
                ${escapeHtml(m.name)}${m.phone ? ` · ${escapeHtml(m.phone)}` : ''}
              </option>
            `).join('')}
          </select>
        </div>
        <div class="form-group">
          <label>教练姓名</label>
          <input type="text" class="input" id="field-coachName" value="${escapeHtml(defaults.coachName)}" placeholder="如：张教练" />
        </div>
        <div class="form-group">
          <label>课程名称</label>
          <input type="text" class="input" id="field-packageName" value="${escapeHtml(defaults.packageName || '私教课')}" placeholder="如：增肌私教" />
        </div>
        <div class="form-group">
          <label>总课时</label>
          <input type="number" class="input" id="field-totalLessons" value="${defaults.totalLessons}" min="1" />
        </div>
        <div class="form-group">
          <label>开始日期</label>
          <input type="date" class="input" id="field-startDate" value="${defaults.startDate}" />
        </div>
        <div class="form-group">
          <label>备注</label>
          <textarea class="input" id="field-notes" placeholder="选填">${escapeHtml(defaults.notes)}</textarea>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-save">${isEdit ? '保存修改' : '创建课包'}</button>
      </div>
    </div>
  `;

  app.querySelector('#btn-save').onclick = async () => {
    const memberId = app.querySelector('#field-memberId').value;
    if (!memberId) {
      showToast('请选择客户');
      return;
    }

    const data = {
      memberId,
      packageName: app.querySelector('#field-packageName').value.trim() || '私教课',
      coachName: app.querySelector('#field-coachName').value.trim(),
      totalLessons: parseInt(app.querySelector('#field-totalLessons').value) || 20,
      startDate: app.querySelector('#field-startDate').value || new Date().toISOString().split('T')[0],
      notes: app.querySelector('#field-notes').value.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (isEdit) {
      data.id = course.id;
      data.remainingLessons = course.remainingLessons;
      data.createdAt = course.createdAt;
      await updateCourse(data);
      showToast('保存成功');
      navigate('/training/' + encodeURIComponent(course.id));
    } else {
      data.remainingLessons = data.totalLessons;
      data.id = generateCourseId();
      data.createdAt = new Date().toISOString();
      await addCourse(data);
      showToast('创建成功');
      navigate('/training/' + encodeURIComponent(data.id));
    }
  };
}
