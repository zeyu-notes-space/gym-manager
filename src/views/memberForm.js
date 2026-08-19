import {
  getMember,
  addMember,
  updateMember,
  generateId,
} from '../db.js';
import { navigate } from '../router.js';
import { escapeHtml, getDefaultExpiry } from '../utils.js';

export async function renderMemberForm(memberId) {
  const isEditing = !!memberId;
  let member = null;

  if (isEditing) {
    member = await getMember(memberId);
    if (!member) {
      navigate('/');
      return;
    }
  }

  const app = document.getElementById('app');

  const initialType = isEditing ? member.cardType : 'count';
  const showCount = !isEditing || member.cardType === 'count';
  const showDates = isEditing && (member.cardType === 'month' || member.cardType === 'year');

  app.innerHTML = `
    <div class="form-view">
      <div class="top-bar glass">
        <button class="btn-icon" id="form-back">×</button>
        <h1>${isEditing ? '编辑会员' : '新增会员'}</h1>
        <div style="width:36px"></div>
      </div>

      <form id="member-form" class="form-content">
        <div class="form-group">
          <label for="form-name">姓名 <span style="color:var(--danger)">*</span></label>
          <input type="text" id="form-name" required
            value="${isEditing ? escapeHtml(member.name) : ''}"
            placeholder="输入姓名">
        </div>

        <div class="form-group">
          <label for="form-phone">手机号</label>
          <input type="tel" id="form-phone"
            value="${isEditing ? escapeHtml(member.phone || '') : ''}"
            placeholder="输入手机号（可选）">
        </div>

        <div class="form-group">
          <label>会员卡类型</label>
          <div class="card-type-selector" id="card-type-selector">
            <label class="type-option ${initialType === 'count' ? 'active' : ''}">
              <input type="radio" name="cardType" value="count" ${initialType === 'count' ? 'checked' : ''}>
              <span>次卡</span>
            </label>
            <label class="type-option ${initialType === 'month' ? 'active' : ''}">
              <input type="radio" name="cardType" value="month" ${initialType === 'month' ? 'checked' : ''}>
              <span>月卡</span>
            </label>
            <label class="type-option ${initialType === 'year' ? 'active' : ''}">
              <input type="radio" name="cardType" value="year" ${initialType === 'year' ? 'checked' : ''}>
              <span>年卡</span>
            </label>
          </div>
        </div>

        <!-- Count fields -->
        <div id="count-fields" class="dynamic-fields ${showCount ? '' : 'hidden'}">
          <div class="form-group">
            <label for="form-total-count">总次数</label>
            <input type="number" id="form-total-count" min="1"
              value="${isEditing && member.totalCount ? member.totalCount : 10}">
          </div>
          ${isEditing && member.cardType === 'count' ? `
            <div class="form-group">
              <label for="form-remaining-count">剩余次数</label>
              <input type="number" id="form-remaining-count" min="0"
                value="${member.remainingCount}">
            </div>
          ` : ''}
        </div>

        <!-- Date fields -->
        <div id="date-fields" class="dynamic-fields ${showDates ? '' : 'hidden'}">
          <div class="form-group">
            <label for="form-start-date">开始日期</label>
            <input type="date" id="form-start-date"
              value="${isEditing && member.startDate ? member.startDate : ''}">
          </div>
          <div class="form-group">
            <label for="form-expiry-date">到期日期</label>
            <input type="date" id="form-expiry-date"
              value="${isEditing && member.expiryDate ? member.expiryDate : ''}">
          </div>
        </div>

        <button type="submit" class="btn-primary form-submit">
          ${isEditing ? '保存修改' : '保存'}
        </button>
      </form>
    </div>
  `;

  // Card type switching
  document.querySelectorAll('input[name="cardType"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.type-option').forEach((opt) => {
        const input = opt.querySelector('input');
        opt.classList.toggle('active', input && input.checked);
      });

      const type = radio.value;
      document.getElementById('count-fields').classList.toggle('hidden', type !== 'count');
      document.getElementById('date-fields').classList.toggle('hidden', type === 'count');

      if (!isEditing && type !== 'count') {
        const startInput = document.getElementById('form-start-date');
        const expiryInput = document.getElementById('form-expiry-date');
        if (!startInput.value) {
          const today = new Date().toISOString().split('T')[0];
          startInput.value = today;
          expiryInput.value = getDefaultExpiry(today, type);
        }
      }
    });
  });

  // Back button
  document.getElementById('form-back').onclick = () => {
    if (isEditing) {
      navigate('/member/' + encodeURIComponent(memberId));
    } else {
      navigate('/');
    }
  };

  // Submit
  document.getElementById('member-form').onsubmit = async (e) => {
    e.preventDefault();

    const name = document.getElementById('form-name').value.trim();
    if (!name) {
      showToast('请输入姓名');
      return;
    }

    const phone = document.getElementById('form-phone').value.trim();
    const cardType = document.querySelector('input[name="cardType"]:checked').value;

    let totalCount = null;
    let remainingCount = null;
    let startDate = null;
    let expiryDate = null;

    if (cardType === 'count') {
      totalCount = parseInt(document.getElementById('form-total-count').value) || 0;
      if (totalCount <= 0) {
        showToast('请输入有效的总次数');
        return;
      }
      if (isEditing && member.cardType === 'count') {
        const remainingInput = document.getElementById('form-remaining-count');
        if (remainingInput) {
          remainingCount = parseInt(remainingInput.value) || 0;
          if (remainingCount > totalCount) {
            showToast('剩余次数不能大于总次数');
            return;
          }
        } else {
          remainingCount = totalCount;
        }
      } else {
        remainingCount = totalCount;
      }
    } else {
      startDate = document.getElementById('form-start-date').value;
      expiryDate = document.getElementById('form-expiry-date').value;

      if (!startDate || !expiryDate) {
        showToast('请填写开始日期和到期日期');
        return;
      }
      if (new Date(expiryDate) < new Date(startDate)) {
        showToast('到期日期不能早于开始日期');
        return;
      }
    }

    const now = new Date().toISOString();

    if (isEditing) {
      const updated = {
        ...member,
        name,
        phone,
        cardType,
        totalCount,
        remainingCount,
        startDate,
        expiryDate,
        updatedAt: now,
      };
      await updateMember(updated);
      showToast('✓ 已保存');
      navigate('/member/' + encodeURIComponent(memberId));
    } else {
      const newMember = {
        id: generateId(),
        name,
        phone,
        cardType,
        totalCount,
        remainingCount,
        startDate,
        expiryDate,
        createdAt: now,
        updatedAt: now,
      };
      await addMember(newMember);
      showToast('✓ 已添加');
      navigate('/member/' + encodeURIComponent(newMember.id));
    }
  };
}

function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  if (window._formToastTimer) clearTimeout(window._formToastTimer);
  el.textContent = msg;
  el.classList.add('show');
  window._formToastTimer = setTimeout(() => {
    el.classList.remove('show');
    window._formToastTimer = null;
  }, 2000);
}
