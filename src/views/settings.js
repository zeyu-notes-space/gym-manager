import { getMemberCount, getCourseCount, getActivityCount } from '../db.js';
import { navigate } from '../router.js';
import { showToast, showConfirm } from '../utils.js';
import { APP_NAME, APP_VERSION, BUILD_ID } from '../config.js';
import { getBackupStatus, manualBackup, restoreFromBackup } from '../backup.js';

export async function renderSettings() {
  const app = document.getElementById('app');
  const [memberCount, courseCount, activityCount] = await Promise.all([
    getMemberCount(),
    getCourseCount(),
    getActivityCount(),
  ]);
  const backupStatus = getBackupStatus();

  const lastBackupDisplay = backupStatus.lastBackupAt
    ? formatBackupTime(backupStatus.lastBackupAt)
    : '从未备份';

  app.innerHTML = `
    <div class="settings-view">
      <div class="top-bar">
        <button class="btn-icon" id="btn-back">‹</button>
        <h1>设置</h1>
        <div style="width:44px"></div>
      </div>

      <div class="detail-body">
        <div class="detail-card" style="margin-bottom:16px">
          <h3>${APP_NAME}</h3>
          <div class="info-row"><span class="label">版本</span><span class="value">v${APP_VERSION}</span></div>
          <div class="info-row"><span class="label">Build</span><span class="value">${BUILD_ID}</span></div>
          <div class="info-row" style="padding:10px 0 0;color:var(--text-muted);font-size:12px;border:none">
            数据只保存在当前入口中。建议将主屏幕版作为正式入口，不要与 Safari 混用。业务操作会直接保存；如手机遗失、损坏或清除浏览器数据，本工具无法恢复没有导出的数据。
          </div>
        </div>

        <div class="detail-card">
          <h3>数据概览</h3>
          <div class="info-row"><span class="label">会员</span><span class="value">${memberCount} 人</span></div>
          <div class="info-row"><span class="label">私教课包</span><span class="value">${courseCount} 个</span></div>
          <div class="info-row"><span class="label">活动</span><span class="value">${activityCount} 个</span></div>
        </div>

        <div class="detail-card">
          <h3>数据备份</h3>
          <div class="info-row">
            <span class="label">备份状态</span>
            <span class="value">${backupStatus.hasUnbackedChanges ? '有未备份的数据' : '当前无待备份变化'}</span>
          </div>
          <div class="info-row">
            <span class="label">上次备份</span>
            <span class="value">${lastBackupDisplay}</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;padding-top:12px">
            <button class="btn btn-primary btn-block" id="btn-manual-backup">📤 立即备份</button>
            <button class="btn btn-secondary btn-block" id="btn-restore">📥 恢复备份</button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById('btn-back').onclick = () => navigate('/');
  document.getElementById('btn-manual-backup').onclick = async () => {
    try {
      await manualBackup();
      renderSettings();
    } catch (e) {
      showToast('备份失败: ' + e.message);
    }
  };

  document.getElementById('btn-restore').onclick = async () => {
    const ok = await showConfirm('恢复备份会用备份文件覆盖当前所有数据。确认继续？');
    if (!ok) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;

      try {
        await restoreFromBackup(file);
        showToast('恢复成功');
        navigate('/');
      } catch (e) {
        showToast('恢复失败: ' + e.message);
      }
    };

    input.click();
  };
}

function formatBackupTime(isoString) {
  if (!isoString) return '从未备份';
  try {
    const d = new Date(isoString);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + month + '-' + day + ' ' + h + ':' + m;
  } catch {
    return isoString;
  }
}
