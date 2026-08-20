import {
  getCourse,
  addCourse,
  updateCourse,
  getMember,
  generateCourseId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, showToast } from '../utils.js';
import { markDataChanged } from '../backup.js';

export async function renderPrivateForm(courseId) {
  const isEdit = !!courseId;
  const course = isEdit ? await getCourse(courseId) : null;
  if (isEdit && !course) {
    navigate('/training');
    return;
  }
  const linkedMember = course?.memberId ? await getMember(course.memberId) : null;

  const app = document.getElementById('app');

  let defaults = {
    clientName: course ? (course.clientName || linkedMember?.name || '') : '',
    clientPhone: course ? (course.clientPhone || linkedMember?.phone || '') : '',
    packageName: course ? (course.packageName || '') : '',
    coachName: course ? (course.coachName || '') : '',
    totalLessons: course ? (course.totalLessons || 20) : 20,
    remainingLessons: course ? (course.remainingLessons || course.totalLessons || 20) : 20,
    startDate: course ? (course.startDate || '') : '',
    notes: course ? (course.notes || '') : '',
  };

  app.innerHTML = `
    <div class="form-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>${isEdit ? '编辑课包' : '创建课包'}</h1>
        <div style="width:44px"></div>
      </div>
      <div class="form-body">
        <div class="form-group">
          <label>客户姓名 *</label>
          <input type="text" class="input" id="field-clientName" value="${escapeHtml(defaults.clientName)}" placeholder="如：张三" />
        </div>
        <div class="form-group">
          <label>电话（选填）</label>
          <input type="tel" class="input" id="field-clientPhone" value="${escapeHtml(defaults.clientPhone)}" placeholder="选填" inputmode="tel" />
        </div>
        <div class="form-group">
          <label>总课时 *</label>
          <input type="number" class="input" id="field-totalLessons" value="${defaults.totalLessons}" min="1" inputmode="numeric" />
        </div>
        <div class="form-group">
          <label>课程名称（选填）</label>
          <input type="text" class="input" id="field-packageName" value="${escapeHtml(defaults.packageName)}" placeholder="如：增肌私教" />
        </div>
        <div class="form-group">
          <label>教练姓名（选填）</label>
          <input type="text" class="input" id="field-coachName" value="${escapeHtml(defaults.coachName)}" placeholder="选填" />
        </div>
        <div class="form-group">
          <label>开始日期（选填）</label>
          <input type="date" class="input" id="field-startDate" value="${defaults.startDate || ''}" />
        </div>
        <div class="form-group">
          <label>备注（选填）</label>
          <textarea class="input" id="field-notes" placeholder="选填">${escapeHtml(defaults.notes)}</textarea>
        </div>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-save">${isEdit ? '保存修改' : '创建课包'}</button>
      </div>
    </div>
  `;

  app.querySelector('#btn-back').onclick = () => navigate(
    isEdit ? '/training/' + encodeURIComponent(course.id) : '/training'
  );

  app.querySelector('#btn-save').onclick = async () => {
    const clientName = app.querySelector('#field-clientName').value.trim();
    if (!clientName) {
      showToast('请输入客户姓名');
      return;
    }

    const totalLessons = parseInt(app.querySelector('#field-totalLessons').value, 10);
    if (!Number.isInteger(totalLessons) || totalLessons < 1) {
      showToast('请输入有效总课时');
      return;
    }

    const data = {
      memberId: course?.memberId || null,
      clientName,
      clientPhone: app.querySelector('#field-clientPhone').value.trim(),
      packageName: app.querySelector('#field-packageName').value.trim() || '',
      coachName: app.querySelector('#field-coachName').value.trim(),
      totalLessons,
      startDate: app.querySelector('#field-startDate').value || '',
      notes: app.querySelector('#field-notes').value.trim(),
      updatedAt: new Date().toISOString(),
    };

    if (isEdit) {
      data.id = course.id;
      const usedLessons = Math.max(0, (course.totalLessons || 0) - (course.remainingLessons || 0));
      data.remainingLessons = Math.max(0, totalLessons - usedLessons);
      data.createdAt = course.createdAt;
      await updateCourse(data);
      markDataChanged();
      showToast('保存成功');
      navigate('/training/' + encodeURIComponent(course.id), { replace: true });
    } else {
      data.remainingLessons = data.totalLessons;
      data.id = generateCourseId();
      data.createdAt = new Date().toISOString();
      await addCourse(data);
      markDataChanged();
      showToast('创建成功');
      navigate('/training/' + encodeURIComponent(data.id), { replace: true });
    }
  };
}
