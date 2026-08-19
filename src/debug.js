/**
 * Diagnostic & Persistence Test
 * Run from browser DevTools:
 *   import { testPersistence } from './src/debug.js';
 *   await testPersistence();
 *
 * Or from the app's Settings page, press "运行诊断"
 */

import {
  getDB,
  getMember,
  getAllMembers,
  getMemberCount,
  getAllCheckins,
  getCheckinsByMember,
  addMember,
  updateMember,
  deleteMember,
  addCheckin,
  deleteCheckin,
  clearAllData,
  generateId,
  generateCheckinId,
} from './db.js';
import { formatDateTime, getDaysRemaining, getCardTypeLabel } from './utils.js';

export async function testPersistence() {
  const results = { pass: 0, fail: 0, tests: [] };

  function check(name, ok, detail) {
    results.tests.push({ name, ok, detail });
    if (ok) results.pass++; else results.fail++;
    console.log(`${ok ? '✓' : '✗'} ${name}: ${detail}`);
  }

  console.log('%c═════════ Persistence Test ═════════', 'font-weight:bold');

  // 1. DB conn
  try {
    const db = await getDB();
    check('DB连接', true, `name=${db.name}, version=${db.version}`);
  } catch (e) {
    check('DB连接', false, e.message);
    return results;
  }

  // 2. Current member count
  let countBefore;
  try {
    countBefore = await getMemberCount();
    check('当前会员数', true, `${countBefore} 条`);
  } catch (e) {
    check('当前会员数', false, e.message);
    return results;
  }

  // 3. Store info
  try {
    const members = await getAllMembers();
    check('读取全部会员', true, `${members.length} 条`);
    if (members.length > 0) {
      console.table(members.map(m => ({ id: m.id, name: m.name, cardType: m.cardType, remaining: m.remainingCount || m.expiryDate })));
    }
  } catch (e) {
    check('读取全部会员', false, e.message);
  }

  try {
    const checkins = await getAllCheckins();
    check('读取全部签到', true, `${checkins.length} 条`);
  } catch (e) {
    check('读取全部签到', false, e.message);
  }

  // 4. Write-read-verify cycle
  const testId = 'diag-' + generateId();
  try {
    await addMember({
      id: testId,
      name: '诊断测试',
      phone: '',
      cardType: 'count',
      totalCount: 5,
      remainingCount: 5,
      startDate: null,
      expiryDate: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    check('写入测试会员', true, testId);
  } catch (e) {
    check('写入测试会员', false, e.message);
  }

  const readBack = await getMember(testId);
  if (readBack) {
    check('读取写入的会员', true, `name=${readBack.name}`);
    
    // Update
    readBack.remainingCount = 3;
    readBack.updatedAt = new Date().toISOString();
    await updateMember(readBack);
    
    const verifyUpdate = await getMember(testId);
    if (verifyUpdate && verifyUpdate.remainingCount === 3) {
      check('更新会员持久化', true, '5→3');
    } else {
      check('更新会员持久化', false, `预期3，实际=${verifyUpdate?.remainingCount}`);
    }
    
    // Checkin
    const ciId = generateCheckinId();
    await addCheckin({
      id: ciId,
      memberId: testId,
      timestamp: new Date().toISOString(),
      forced: false,
    });
    
    const ciBack = await getCheckinsByMember(testId);
    const hasCheckin = ciBack && ciBack.some(c => c.id === ciId);
    check('签到写入持久化', !!hasCheckin, hasCheckin ? 'found' : 'not found');
    
    // Clean up
    await deleteCheckin(ciId);
    await deleteMember(testId);
    const verifyDelete = await getMember(testId);
    check('删除测试数据', !verifyDelete, verifyDelete ? 'still exists' : 'deleted');
  } else {
    check('读取写入的会员', false, '返回空');
  }

  // 5. Count after all operations
  const countAfter = await getMemberCount();
  check('操作后会员数', countAfter === countBefore, `${countBefore} → ${countAfter}`);

  console.log('%c═════════ 结果 ═════════', 'font-weight:bold');
  console.log(`通过: ${results.pass} / 失败: ${results.fail}`);

  return results;
}

export async function diagnoseReport() {
  try {
    const db = await getDB();
    const memberCount = await getMemberCount();
    const checkinCount = (await getAllCheckins()).length;
    
    let report = `
═══════ OXY FITNESS 诊断报告 ═══════

时间: ${formatDateTime(new Date().toISOString())}
DB: ${db.name} v${db.version}
会员数: ${memberCount}
签到记录: ${checkinCount}

`;

    const members = await getAllMembers();
    for (const m of members) {
      const checkins = await getCheckinsByMember(m.id);
      report += `[${getCardTypeLabel(m.cardType)}] ${m.name}`;
      if (m.cardType === 'count') {
        report += ` - 剩余 ${m.remainingCount}/${m.totalCount}`;
      } else {
        const days = getDaysRemaining(m.expiryDate);
        report += ` - 到期 ${m.expiryDate} (${days >= 0 ? `剩余${days}天` : '已过期'})`;
      }
      report += ` - 签到 ${checkins.length}次\n`;
    }

    console.log(report);
    return report;
  } catch (e) {
    return '诊断失败: ' + e.message;
  }
}
