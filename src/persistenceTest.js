/**
 * Persistence Verification Test
 * Run from browser DevTools console:
 *   import { runPersistenceTest } from './src/persistenceTest.js';
 *   await runPersistenceTest();
 *
 * Or paste this code as a script tag.
 */

import { getDB, addMember, getMember, getAllMembers, updateMember, getMemberCount, clearAllData, generateId } from './db.js';

export async function runPersistenceTest() {
  const results = [];

  function log(step, pass, detail) {
    const icon = pass ? '✅' : '❌';
    results.push({ step, pass, detail });
    console.log(`${icon} ${step}: ${detail}`);
  }

  console.log('═══════ Persistence Test ═══════');

  // 1. DB connection
  try {
    const db = await getDB();
    log('DB连接', true, `db=${db.name}, version=${db.version}`);
  } catch (e) {
    log('DB连接', false, e.message);
    return results;
  }

  // 2. Write a test member
  const testId = 'test-' + generateId();
  const testMember = {
    id: testId,
    name: '测试用户',
    phone: '13800138000',
    cardType: 'count',
    totalCount: 10,
    remainingCount: 8,
    startDate: null,
    expiryDate: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await addMember(testMember);
    log('写入会员', true, `${testMember.name}, id=${testId}`);
  } catch (e) {
    log('写入会员', false, e.message);
  }

  // 3. Read back
  try {
    const read = await getMember(testId);
    if (read && read.name === '测试用户' && read.remainingCount === 8) {
      log('读取会员', true, `name=${read.name}, remaining=${read.remainingCount}`);
    } else {
      log('读取会员', false, `返回不正确: ${JSON.stringify(read)}`);
    }
  } catch (e) {
    log('读取会员', false, e.message);
  }

  // 4. Update
  try {
    const mem = await getMember(testId);
    mem.remainingCount = 7;
    mem.updatedAt = new Date().toISOString();
    await updateMember(mem);
    log('更新会员', true, 'remainingCount 8→7');
  } catch (e) {
    log('更新会员', false, e.message);
  }

  // 5. Verify update persisted
  try {
    const mem = await getMember(testId);
    if (mem && mem.remainingCount === 7) {
      log('验证更新持久化', true, `remainingCount=${mem.remainingCount}`);
    } else {
      log('验证更新持久化', false, `预期7，实际=${mem?.remainingCount}`);
    }
  } catch (e) {
    log('验证更新持久化', false, e.message);
  }

  // 6. Count members
  try {
    const count = await getMemberCount();
    log('会员计数', true, `${count} 条记录`);
  } catch (e) {
    log('会员计数', false, e.message);
  }

  // 7. Test demo data isolation
  try {
    await clearAllData();
    const countAfter = await getMemberCount();
    log('清空数据', countAfter === 0, `清空后计数=${countAfter}`);
  } catch (e) {
    log('清空数据', false, e.message);
  }

  // 8. Verify data is actually gone
  try {
    const mem = await getMember(testId);
    log('确认清空', !mem, `删除后查询=${mem ? '仍存在' : '已删除'}`);
  } catch (e) {
    log('确认清空', false, e.message);
  }

  console.log('═══════ 测试完成 ═══════');
  console.table(results);

  return results;
}
