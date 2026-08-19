import {
  getMemberCount,
  getCourseCount,
  getActivityCount,
  exportAllData,
  importAllData,
  clearAllData,
  seedDemoData,
} from '../db.js';
import { navigate } from '../router.js';
import { showToast, showConfirm, formatDateTime, getLocalDateString } from '../utils.js';
import { APP_NAME, APP_VERSION, BUILD_ID } from '../config.js';

export async function renderSettings() {
  const app = document.getElementById('app');
  const memberCount = await getMemberCount();
  const courseCount = await getCourseCount();
  const activityCount = await getActivityCount();

  app.innerHTML = `
    <div class="settings-view">
      <div class="top-bar">
        <button class="btn-icon" onclick="window.__back()">‹</button>
        <h1>设置</h1>
        <div style="width:36px"></div>
      </div>

      <div style="padding:20px 16px 8px">
        <div style="font-size:22px;font-weight:700">${APP_NAME}</div>
        <div style="font-size:13px;color:var(--text-muted);margin-top:2px">v${APP_VERSION} · build ${BUILD_ID}</div>
      </div>

      <div class="settings-section">
        <h3>数据概览</h3>
        <div class="settings-item" style="cursor:default">
          <div class="settings-left">
            <span class="settings-icon">👥</span>
            <span class="settings-label">会员</span>
          </div>
          <span class="settings-value">${memberCount} 人</span>
        </div>
        <div class="settings-item" style="cursor:default">
          <div class="settings-left">
            <span class="settings-icon">🏋️</span>
            <span class="settings-label">私教课包</span>
          </div>
          <span class="settings-value">${courseCount} 个</span>
        </div>
        <div class="settings-item" style="cursor:default">
          <div class="settings-left">
            <span class="settings-icon">📋</span>
            <span class="settings-label">活动</span>
          </div>
          <span class="settings-value">${activityCount} 个</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>数据管理</h3>
        <div class="settings-item" id="btn-export">
          <div class="settings-left">
            <span class="settings-icon">📤</span>
            <span class="settings-label">导出备份</span>
          </div>
          <span class="settings-value">JSON</span>
        </div>
        <div class="settings-item" id="btn-import">
          <div class="settings-left">
            <span class="settings-icon">📥</span>
            <span class="settings-label">导入备份</span>
          </div>
          <span class="settings-value">覆盖现有数据</span>
        </div>
      </div>

      <div class="settings-section">
        <h3>演示</h3>
        <div class="settings-item" id="btn-demo">
          <div class="settings-left">
            <span class="settings-icon">🧪</span>
            <span class="settings-label">加载演示数据</span>
          </div>
          <span class="settings-value">${memberCount > 0 ? '已有数据' : ''}</span>
        </div>
      </div>

      <div class="settings-section">
        <h3 style="color:var(--danger)">危险操作</h3>
        <div class="settings-item danger" id="btn-clear">
          <div class="settings-left">
            <span class="settings-icon">⚠️</span>
            <span class="settings-label">清空所有数据</span>
          </div>
          <span class="settings-value">不可恢复</span>
        </div>
      </div>

      <div class="settings-footer">
        ⚠️ 所有数据保存在当前设备本地 (IndexedDB)
      </div>
      <div class="settings-footer" style="padding-top:0">
        清除浏览器数据会丢失 · 请定期导出备份
      </div>
    </div>
  `;

  document.getElementById('btn-export').onclick = handleExport;
  document.getElementById('btn-import').onclick = handleImport;
  document.getElementById('btn-demo').onclick = handleLoadDemo;
  document.getElementById('btn-clear').onclick = handleClear;
}

async function handleExport() {
  try {
    const backup = await exportAllData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oxy-fitness-backup-${getLocalDateString()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('导出成功');
  } catch (e) {
    showToast('导出失败: ' + e.message);
  }
}

async function handleImport() {
  const ok = await showConfirm('导入备份会覆盖当前所有数据，确认继续？');
  if (!ok) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';

  input.onchange = async () => {
    const file = input.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);
      await importAllData(backup);
      showToast('导入成功');
      navigate('/');
    } catch (e) {
      showToast('导入失败: ' + e.message);
    }
  };

  input.click();
}

async function handleLoadDemo() {
  const ok = await showConfirm('加载演示数据？已有数据会被清空。');
  if (!ok) return;

  await clearAllData();
  await seedDemoData();
  showToast('演示数据已加载');
  navigate('/');
}

async function handleClear() {
  const ok1 = await showConfirm('确定清空所有数据？此操作不可恢复。');
  if (!ok1) return;

  const ok2 = await showConfirm('再次确认：所有会员、签到、私教、活动数据都会被删除。');
  if (!ok2) return;

  await clearAllData();
  showToast('已清空');
  navigate('/');
}
