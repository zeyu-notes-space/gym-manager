import {
  getMemberCount,
  getMemberCountByMembership,
  getTodayCheckinCount,
  getCourseCount,
  getActivityCount,
} from '../db.js';
import { navigate } from '../router.js';
import { APP_NAME } from '../config.js';
import { shouldRemind, dismissReminder, manualBackup } from '../backup.js';
import { showConfirm, showToast } from '../utils.js';

const PWA_NOTICE_KEY = 'oxy-pwa-entry-notice-seen';

export async function renderHome() {
  const app = document.getElementById('app');
  const totalMemberCount = await getMemberCount();
  const memberCount = await getMemberCountByMembership();
  const todayCheckins = await getTodayCheckinCount();
  const courseCount = await getCourseCount();
  const activityCount = await getActivityCount();
  const showPwaNotice = totalMemberCount === 0 && courseCount === 0 && activityCount === 0
    && localStorage.getItem(PWA_NOTICE_KEY) !== 'true';

  app.innerHTML = `
    <div class="home-dashboard">
      <div class="home-header">
        <div>
          <h1>${APP_NAME}</h1>
          <div class="subtitle">本地运营台账</div>
        </div>
        <button class="btn-icon" id="btn-settings" title="设置">⚙</button>
      </div>

      <div class="module-list">
        ${showPwaNotice ? `
          <div class="entry-notice" id="pwa-entry-notice">
            <div>
              <strong>请固定使用同一个入口</strong>
              <p>建议固定使用主屏幕版，请不要混用 Safari 和桌面版。</p>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-dismiss-pwa-notice">知道了</button>
          </div>
        ` : ''}
        <div class="module-entry" id="module-members">
          <div class="module-entry-header">
            <div class="module-icon members">👥</div>
            <div class="module-info">
              <h3>会员管理</h3>
              <div class="module-stats">${memberCount} 会员 · ${todayCheckins > 0 ? `今日 ${todayCheckins} 签到` : '暂无今日签到'}</div>
            </div>
            <span class="module-arrow">›</span>
          </div>
          <div class="module-status">
            <span>次卡 · 月卡 · 年卡</span>
            <span class="stat-number">${memberCount} 人</span>
          </div>
        </div>

        <div class="module-entry" id="module-training">
          <div class="module-entry-header">
            <div class="module-icon training">🏋️</div>
            <div class="module-info">
              <h3>私教管理</h3>
              <div class="module-stats">${courseCount} 课包 · 消课记录</div>
            </div>
            <span class="module-arrow">›</span>
          </div>
          <div class="module-status">
            <span>剩余课时 · 消课</span>
            <span class="stat-number">${courseCount} 个课包</span>
          </div>
        </div>

        <div class="module-entry" id="module-activities">
          <div class="module-entry-header">
            <div class="module-icon activities">📋</div>
            <div class="module-info">
              <h3>活动管理</h3>
              <div class="module-stats">${activityCount} 活动 · 报名参与</div>
            </div>
            <span class="module-arrow">›</span>
          </div>
          <div class="module-status">
            <span>活动报名 · 参与人数</span>
            <span class="stat-number">${activityCount} 个活动</span>
          </div>
        </div>
      </div>
    </div>
  `;

  document.getElementById('btn-settings').onclick = () => navigate('/settings');
  document.getElementById('module-members').onclick = () => navigate('/members');
  document.getElementById('module-training').onclick = () => navigate('/training');
  document.getElementById('module-activities').onclick = () => navigate('/activities');

  const dismissNotice = document.getElementById('btn-dismiss-pwa-notice');
  if (dismissNotice) {
    dismissNotice.onclick = (event) => {
      event.stopPropagation();
      localStorage.setItem(PWA_NOTICE_KEY, 'true');
      document.getElementById('pwa-entry-notice')?.remove();
    };
  }

  // Check 48h evening reminder
  checkReminder();
}

async function checkReminder() {
  if (!shouldRemind()) return;

  const choice = await showConfirm(
    '有未备份的数据。最近有新的会员、私教或活动记录，建议现在备份一次。',
    '稍后再说',
    '现在备份'
  );

  if (choice) {
    // User chose "现在备份"
    try {
      await manualBackup();
      showToast('已备份');
    } catch (e) {
      showToast('备份失败: ' + e.message);
    }
  } else {
    // User chose "稍后再说"
    dismissReminder();
  }
}
