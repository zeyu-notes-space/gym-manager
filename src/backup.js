/**
 * Backup manager.
 * Tracks dirty state for 48h evening reminder.
 * NEVER auto-downloads — user clicks "立即备份" to trigger export.
 */
import { exportAllData, importAllData } from './db.js';
import { showToast, getLocalDateString } from './utils.js';
import { APP_NAME, APP_VERSION, BUILD_ID } from './config.js';

const STATUS_KEY = 'oxy-backup-status';
const LEGACY_PENDING_KEY = 'oxy-backup-pending';

const EMPTY_STATUS = {
  lastDataChangeAt: null,
  lastBackupAt: null,
  lastBackupFileName: null,
  lastBackupSize: null,
  lastReminderAt: null,
  hasUnbackedChanges: false,
};

function pad2(n) { return String(n).padStart(2, '0'); }

function formatNow() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}_${pad2(d.getHours())}${pad2(d.getMinutes())}${pad2(d.getSeconds())}`;
}

export function getBackupStatus() {
  try {
    const raw = localStorage.getItem(STATUS_KEY);
    const stored = raw ? JSON.parse(raw) : {};
    const legacyPending = localStorage.getItem(LEGACY_PENDING_KEY) === 'true';
    return {
      ...EMPTY_STATUS,
      ...stored,
      lastBackupAt: stored.lastBackupAt || stored.lastBackupTime || null,
      hasUnbackedChanges: stored.hasUnbackedChanges === true || legacyPending,
    };
  } catch {
    return { ...EMPTY_STATUS };
  }
}

function saveBackupStatus(status) {
  localStorage.setItem(STATUS_KEY, JSON.stringify(status));
  localStorage.removeItem(LEGACY_PENDING_KEY);
}

/**
 * Call after every successful business mutation.
 * Only marks dirty — no download, no prompt.
 */
export function markDataChanged() {
  const status = getBackupStatus();
  status.lastDataChangeAt = new Date().toISOString();
  status.hasUnbackedChanges = true;
  saveBackupStatus(status);
}

/**
 * Manual backup (triggered by user gesture).
 */
export async function manualBackup() {
  const backup = await exportAllData();
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const fileName = `OXY_Backup_${formatNow()}.json`;
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

  // Record backup success
  const status = getBackupStatus();
  status.lastBackupAt = new Date().toISOString();
  status.lastBackupFileName = fileName;
  status.lastBackupSize = blob.size;
  status.hasUnbackedChanges = false;
  saveBackupStatus(status);

  showToast('备份成功');
  return fileName;
}

/**
 * Check if the 48h evening reminder should trigger.
 * Conditions:
 * - hasUnbackedChanges === true
 * - lastBackupAt === null OR lastBackupAt > 48h ago
 * - current time is 18:00–23:00 (evening window)
 * - lastReminderAt is not today (no repeat same day)
 * If lastDataChangeAt is null (never changed), don't remind.
 * If lastDataChangeAt is set but < 48h ago AND lastBackupAt is null, don't remind either (48h grace).
 */
export function shouldRemind() {
  const status = getBackupStatus();

  // No changes → no reminder
  if (!status.lastDataChangeAt) return false;
  if (!status.hasUnbackedChanges) return false;

  const now = new Date();
  const hour = now.getHours();

  // Evening window 18:00–22:59
  if (hour < 18 || hour >= 23) return false;

  // Already reminded today?
  if (status.lastReminderAt) {
    const reminderDate = getLocalDateString(new Date(status.lastReminderAt));
    const todayDate = getLocalDateString();
    if (reminderDate === todayDate) return false;
  }

  const nowMs = now.getTime();

  // If lastBackupAt exists, check 48h threshold
  if (status.lastBackupAt) {
    const backupMs = new Date(status.lastBackupAt).getTime();
    const hoursSinceBackup = (nowMs - backupMs) / (1000 * 60 * 60);
    if (hoursSinceBackup < 48) return false;
  } else {
    // Never backed up — check 48h since first data change
    if (status.lastDataChangeAt) {
      const changeMs = new Date(status.lastDataChangeAt).getTime();
      const hoursSinceChange = (nowMs - changeMs) / (1000 * 60 * 60);
      if (hoursSinceChange < 48) return false;
    }
  }

  return true;
}

/**
 * Call when user dismisses the reminder. Marks today as reminded.
 */
export function dismissReminder() {
  const status = getBackupStatus();
  status.lastReminderAt = new Date().toISOString();
  status.hasUnbackedChanges = true; // Keep dirty state
  saveBackupStatus(status);
}

// ═══ Restore ═══

export function validateBackupFile(text) {
  try {
    const obj = JSON.parse(text);
    if (!obj || typeof obj !== 'object') {
      return { valid: false, reason: '不是有效的 JSON 文件' };
    }
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

export async function restoreFromBackup(file) {
  const text = await file.text();
  const validation = validateBackupFile(text);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const backup = validation.backup;
  await importAllData(backup);

  // Clear dirty state after restore
  const status = getBackupStatus();
  status.lastBackupAt = new Date().toISOString();
  status.lastBackupFileName = file.name || 'restored.json';
  status.lastBackupSize = text.length;
  status.hasUnbackedChanges = false;
  saveBackupStatus(status);

  showToast('恢复成功');

  return {
    memberCount: (backup.data.members || []).length,
    courseCount: (backup.data.privateCourses || []).length,
    activityCount: (backup.data.activities || []).length,
  };
}
