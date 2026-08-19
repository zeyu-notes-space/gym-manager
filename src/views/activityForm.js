import {
  getActivity,
  addActivity,
  updateActivity,
  generateActivityId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, showToast, getCategoryLabel, getDefaultExpiry } from '../utils.js';

export async function renderActivityForm(activityId) {
  const isEdit = !!activityId;
  const activity = isEdit ? await getActivity(activityId) : null;

  const app = document.getElementById('app');

  let defaults = {
    title: '',
    category: '儿童',
    startDate: '',
    startTime: '',
    endTime: '',
    capacity: '',
    notes: '',
  };

  if (activity) {
    defaults = {
      title: activity.title || '',
      category: activity.category || '儿童',
      startDate: activity.startDate || '',
      startTime: activity.startTime || '',
      endTime: activity.endTime || '',
      capacity: activity.capacity || '',
      notes: activity.notes || '',
    };
  }

  const today = new Date().toISOString().split('T')[0];

  const categories = ['儿童', '体验', '社区', '临时'];

  app.innerHTML = `
    <div class="form-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>${isEdit ? '编辑活动' : '创建活动'}</h1>
        <div style="width:36px"></div>
      </div>

      <div class="form-body">
        <div class="form-group">
          <label>活动名称 *</label>
          <input type="text" class="input" id="field-title" value="${escapeHtml(defaults.title)}" placeholder="如：少儿体适能体验" />
        </div>

        <div class="form-group">
          <label>类型</label>
          <select class="input" id="field-category">
            ${categories.map(c => `
              <option value="${c}" ${c === defaults.category ? 'selected' : ''}>${getCategoryLabel(c)}</option>
            `).join('')}
          </select>
        </div>

        <div class="form-group">
          <label>日期</label>
          <input type="date" class="input" id="field-startDate" value="${defaults.startDate || today}" />
        </div>

        <div class="form-group">
          <label>开始时间</label>
          <input type="time" class="input" id="field-startTime" value="${defaults.startTime || '10:00'}" />
        </div>

        <div class="form-group">
          <label>结束时间</label>
          <input type="time" class="input" id="field-endTime" value="${defaults.endTime || ''}" />
        </div>

        <div class="form-group">
          <label>人数限制（选填）</label>
          <input type="number" class="input" id="field-capacity" value="${defaults.capacity}" min="1" placeholder="不限" />
        </div>

        <div class="form-group">
          <label>备注（选填）</label>
          <textarea class="input" id="field-notes" placeholder="如：自备运动鞋">${escapeHtml(defaults.notes)}</textarea>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-save">${isEdit ? '保存修改' : '创建活动'}</button>
      </div>
    </div>
  `;

  document.getElementById('btn-save').onclick = async () => {
    const title = app.querySelector('#field-title').value.trim();
    if (!title) {
      showToast('请输入活动名称');
      return;
    }

    const category = app.querySelector('#field-category').value;
    const startDate = app.querySelector('#field-startDate').value;
    const startTime = app.querySelector('#field-startTime').value;
    const endTime = app.querySelector('#field-endTime').value;
    const capacityVal = app.querySelector('#field-capacity').value.trim();
    const capacity = capacityVal ? parseInt(capacityVal) : null;
    const notes = app.querySelector('#field-notes').value.trim();

    const data = {
      title: title,
      category: category,
      startDate: startDate,
      startTime: startTime || null,
      endTime: endTime || null,
      capacity: capacity,
      notes: notes,
      updatedAt: new Date().toISOString(),
    };

    if (isEdit) {
      data.id = activity.id;
      data.createdAt = activity.createdAt;
      await updateActivity(data);
      showToast('保存成功');
      navigate('/activities/' + encodeURIComponent(activity.id));
    } else {
      data.id = generateActivityId();
      data.createdAt = new Date().toISOString();
      await addActivity(data);
      showToast('创建成功');
      navigate('/activities/' + encodeURIComponent(data.id));
    }
  };
}
