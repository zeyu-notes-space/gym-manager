/**
 * Auto-backup manager.
 * Views call attemptAutoBackup() after every successful business mutation.
 * Backup status is stored in localStorage (survives IndexedDB clears).
 */
import { exportAllData, importAllData, clearAllData } from './db.js';
import { showToast } from './utils.js';
import { APP_NAME, APP_VERSION, BUILD_ID } from './config.js';

const STATUS_KEY = 'oxy-backup-status';
const PENDING_KEY = 'oxy-backup-pending';

function pad2(n) { return String(n).padStart(2, '0'); }

function formatNow() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function getBackupStatus() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    return raw ? JSON.parse(raw) : { lastBackupTime: null, lastBackupFileName: null, lastBackupSize: null };
  } catch {
    return { lastBackupTime: null, lastBackupFileName: null, lastBackupSize: null };
  }
}

export function hasPendingBackup() {
  return localStorage.getItem(PENDING_KEY) === 'true';
}

function recordBackupSuccess(fileName, size) {
  const status = getBackupStatus();
  status.lastBackupTime = new Date().toISOString();
  status.lastBackupFileName = fileName;
  status.lastBackupSize = size;
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  localStorage.removeItem(PENDING_KEY);
}

function recordBackupFailed() {
  localStorage.setItem(PENDING_KEY, 'true');
}

/**
 * Attempt auto-backup after successful business mutation.
 * Does NOT block the UI. Returns { saved, fileSaved }.
 */
export async function attemptAutoBackup({ silent = false } = {}) {
  let backup, json;
  try {
    backup = await exportAllData();
    json = JSON.stringify(backup, null, 2);
  } catch (e) {
    console.error('AutoBackup export failed:', e);
    return { saved: false, fileSaved: false };
  }

  const blob = new Blob([json], { type: 'application/json' });
  const fileName = `OXY_AutoBackup_${formatNow()}.json`;
  const url = URL.createObjectURL(blob);

  let fileSaved = false;
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.style.display = 'none';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    fileSaved = true;
    recordBackupSuccess(fileName, blob.size);
  } catch (e) {
    recordBackupFailed();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  if (!silent && !fileSaved) {
    showToast('数据已保存，但本机备份未生成');
  }

  return { saved: true, fileSaved, fileName, size: blob.size };
}

/**
 * Manual backup (triggered by user gesture in settings).
 * Always attempts download.
 */
export async function manualBackup() {
  const backup = await exportAllData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const fileName = `OXY_ManualBackup_${formatNow()}.json`;
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.style.display = 'none';
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  recordBackupSuccess(fileName, blob.size);
  showToast('备份成功');
  return fileName;
}

/**
 * Validate a backup file JSON string.
 * Returns { valid: boolean, backup?: object, reason?: string }.
 */
export function validateBackupFile(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') {
      return { valid: false, reason: '不是有效的 JSON 文件' };
    }
    // Accept both current and legacy app identifiers
    if (obj.app !== 'OXY FITNESS' && obj.app !== 'oxy-fitness-local') {
      return { valid: false, reason: '这不是 OXY FITNESS 备份文件' };
    }
    if (!obj.data || typeof obj.data !== 'object') {
      return { valid: false, reason: '备份文件缺少数据内容' };
    }

    const required = ['members', 'checkins', 'privateCourses', 'privateSessions', 'activities', 'activityParticipants'];
    for (const name of required) {
      if (!Array.isArray(obj.data[name])) {
        return { valid: false, reason: `备份文件缺少「${name}」数据` };
      }
    }

    return { valid: true, backup: obj };
  } catch (e) {
    return { valid: false, reason: '备份文件解析失败：' + e.message };
  }
}

/**
 * Restore from backup: validate → clear → write → verify.
 */
export async function restoreFromBackup(file) {
  const text = await file.text();
  const validation = validateBackupFile(text);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const backup = validation.backup;
  await importAllData(backup);

  recordBackupSuccess(file.name || 'restored.json', text.length);
  showToast('恢复成功');

  return {
    memberCount: (backup.data.members || []).length,
    courseCount: (backup.data.privateCourses || []).length,
    activityCount: (backup.data.activities || []).length,
  };
}
