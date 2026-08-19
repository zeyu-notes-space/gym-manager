import {
  getMember,
  addMember,
  updateMember,
  generateId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, getDefaultExpiry, showToast } from '../utils.js';

export async function renderMemberForm(memberId) {
  const isEdit = !!memberId;
  const member = isEdit ? await getMember(memberId) : null;

  const app = document.getElementById('app');

  let defaults = {
    name: '',
    phone: '',
    cardNo: '',
    cardType: 'count',
    totalCount: 10,
    remainingCount: 10,
    startDate: '',
    expiryDate: '',
    notes: '',
    membershipEnabled: true,
  };

  if (member) {
    defaults = {
      name: member.name || '',
      phone: member.phone || '',
      cardNo: member.cardNo || '',
      cardType: member.cardType || 'count',
      totalCount: member.totalCount || 10,
      remainingCount: member.remainingCount || 10,
      startDate: member.startDate || '',
      expiryDate: member.expiryDate || '',
      notes: member.notes || '',
      membershipEnabled: member.membershipEnabled !== false,
    };
  }

  const today = new Date().toISOString().split('T')[0];

  app.innerHTML = `
    <div class="form-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>${isEdit ? '编辑会员' : '新增会员'}</h1>
        <div style="width:36px"></div>
      </div>

      <div class="form-body">
        <div class="form-group">
          <label>姓名 *</label>
          <input type="text" class="input" id="field-name" value="${escapeHtml(defaults.name)}" placeholder="输入姓名" />
        </div>

        <div class="form-group">
          <label>手机号</label>
          <input type="tel" class="input" id="field-phone" value="${escapeHtml(defaults.phone)}" placeholder="选填" />
        </div>

        <div class="form-group">
          <label>会员卡号</label>
          <input type="text" class="input" id="field-cardNo" value="${escapeHtml(defaults.cardNo)}" placeholder="选填" />
        </div>

        <div class="form-group">
          <label>卡类型</label>
          <div class="card-type-selector">
            ${['count', 'month', 'year'].map(t => `
              <button class="type-btn${defaults.cardType === t ? ' selected' : ''}" data-type="${t}">
                ${t === 'count' ? '次卡' : t === 'month' ? '月卡' : '年卡'}
              </button>
            `).join('')}
          </div>
        </div>

        <div class="form-group" id="form-count-section"${defaults.cardType === 'count' ? '' : ' style="display:none"'}>
          <label>总次数</label>
          <input type="number" class="input" id="field-totalCount" value="${defaults.totalCount || 10}" min="1" />
          <div class="form-hint">签到自动扣除</div>
        </div>

        <div class="form-group" id="form-date-section"${defaults.cardType !== 'count' ? '' : ' style="display:none"'}>
          <label>开始日期</label>
          <input type="date" class="input" id="field-startDate" value="${defaults.startDate || today}" />
        </div>

        <div class="form-group" id="form-expiry-section"${defaults.cardType !== 'count' ? '' : ' style="display:none"'}>
          <label>到期日期</label>
          <input type="date" class="input" id="field-expiryDate" value="${defaults.expiryDate || ''}" />
          <div class="form-hint">不填则自动计算</div>
        </div>

        <div class="form-group">
          <label>备注</label>
          <textarea class="input" id="field-notes" placeholder="老会员 / 特殊 / 家属…">${escapeHtml(defaults.notes)}</textarea>
        </div>

        <div class="form-group">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="field-membership" ${defaults.membershipEnabled ? 'checked' : ''} />
            开通普通会员（签到扣次）
          </label>
        </div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary btn-block" id="btn-save">${isEdit ? '保存修改' : '创建会员'}</button>
      </div>
    </div>
  `;

  // Card type selector
  const typeBtns = app.querySelectorAll('.type-btn');
  typeBtns.forEach(btn => {
    btn.onclick = () => {
      typeBtns.forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      const type = btn.dataset.type;
      app.querySelector('#form-count-section').style.display = type === 'count' ? '' : 'none';
      app.querySelector('#form-date-section').style.display = type !== 'count' ? '' : 'none';
      app.querySelector('#form-expiry-section').style.display = type !== 'count' ? '' : 'none';
      
      // Auto-calculate expiry
      if (type !== 'count') {
        const startInput = app.querySelector('#field-startDate');
        const expiryInput = app.querySelector('#field-expiryDate');
        if (startInput.value && !expiryInput.value) {
          expiryInput.value = getDefaultExpiry(startInput.value, type);
        }
      }
    };
  });

  // Auto expiry on start date change
  const startInput = app.querySelector('#field-startDate');
  if (startInput) {
    startInput.onchange = () => {
      const selected = app.querySelector('.type-btn.selected');
      if (selected && selected.dataset.type !== 'count') {
        const expiryInput = app.querySelector('#field-expiryDate');
        if (!expiryInput.value) {
          expiryInput.value = getDefaultExpiry(startInput.value, selected.dataset.type);
        }
      }
    };
  }

  // Save handler
  app.querySelector('#btn-save').onclick = async () => {
    const name = app.querySelector('#field-name').value.trim();
    if (!name) {
      showToast('请输入姓名');
      return;
    }

    const phone = app.querySelector('#field-phone').value.trim();
    const cardNo = app.querySelector('#field-cardNo').value.trim();
    const selectedType = app.querySelector('.type-btn.selected').dataset.type;
    const notes = app.querySelector('#field-notes').value.trim();
    const membershipEnabled = app.querySelector('#field-membership').checked;

    const data = {
      name,
      phone,
      cardNo,
      cardType: membershipEnabled ? selectedType : null,
      notes,
      membershipEnabled,
      updatedAt: new Date().toISOString(),
    };

    if (membershipEnabled && selectedType === 'count') {
      data.totalCount = parseInt(app.querySelector('#field-totalCount').value) || 10;
      data.remainingCount = data.totalCount;
      data.startDate = null;
      data.expiryDate = null;
    } else if (membershipEnabled) {
      data.totalCount = null;
      data.remainingCount = null;
      data.startDate = app.querySelector('#field-startDate').value || new Date().toISOString().split('T')[0];
      data.expiryDate = app.querySelector('#field-expiryDate').value || getDefaultExpiry(data.startDate, selectedType);
    } else {
      data.totalCount = null;
      data.remainingCount = null;
      data.startDate = null;
      data.expiryDate = null;
    }

    if (isEdit) {
      data.id = member.id;
      data.createdAt = member.createdAt;
      await updateMember(data);
      showToast('保存成功');
      navigate('/members/' + encodeURIComponent(member.id));
    } else {
      data.id = generateId();
      data.createdAt = new Date().toISOString();
      await addMember(data);
      showToast('创建成功');
      navigate('/members/' + encodeURIComponent(data.id));
    }
  };
}
