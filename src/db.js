const DB_NAME = 'gym-manager';
const DB_VERSION = 2;

let _db = null;

export async function getDB() {
  if (_db) return _db;
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('members')) {
        const s = db.createObjectStore('members', { keyPath: 'id' });
        s.createIndex('name', 'name', { unique: false });
        s.createIndex('phone', 'phone', { unique: false });
        s.createIndex('cardNo', 'cardNo', { unique: false });
      }
      if (!db.objectStoreNames.contains('checkins')) {
        const s = db.createObjectStore('checkins', { keyPath: 'id' });
        s.createIndex('memberId', 'memberId', { unique: false });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('adjustments')) {
        const s = db.createObjectStore('adjustments', { keyPath: 'id' });
        s.createIndex('memberId', 'memberId', { unique: false });
      }
      if (!db.objectStoreNames.contains('privateCourses')) {
        const s = db.createObjectStore('privateCourses', { keyPath: 'id' });
        s.createIndex('memberId', 'memberId', { unique: false });
      }
      if (!db.objectStoreNames.contains('privateSessions')) {
        const s = db.createObjectStore('privateSessions', { keyPath: 'id' });
        s.createIndex('courseId', 'courseId', { unique: false });
        s.createIndex('memberId', 'memberId', { unique: false });
        s.createIndex('timestamp', 'timestamp', { unique: false });
      }
      if (!db.objectStoreNames.contains('activities')) {
        const s = db.createObjectStore('activities', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('activityParticipants')) {
        const s = db.createObjectStore('activityParticipants', { keyPath: 'id' });
        s.createIndex('activityId', 'activityId', { unique: false });
      }
    };
    request.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

async function operate(storeName, mode, fn) {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    try {
      fn(store, resolve, reject);
    } catch (e) {
      reject(e);
    }
    tx.onerror = (e) => reject(e.target.error);
    tx.onabort = (e) => reject(e.target.error);
  });
}

// ═══ Members ═══

export async function getAllMembers() {
  return operate('members', 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMember(id) {
  return operate('members', 'readonly', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addMember(member) {
  return operate('members', 'readwrite', (store, resolve, reject) => {
    const req = store.add(member);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateMember(member) {
  return operate('members', 'readwrite', (store, resolve, reject) => {
    const req = store.put(member);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteMember(id) {
  return operate('members', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMemberCount() {
  return operate('members', 'readonly', (store, resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getMemberCountByMembership() {
  const all = await getAllMembers();
  return all.filter(m => m.membershipEnabled !== false).length;
}

export async function searchMembers(query) {
  const all = await getAllMembers();
  const q = query.toLowerCase().trim();
  if (!q) return all;
  return all.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.phone && m.phone.includes(q)) ||
      (m.cardNo && m.cardNo.toLowerCase().includes(q))
  );
}

export async function getAllMembersWithMembership() {
  const all = await getAllMembers();
  return all.filter(m => m.membershipEnabled !== false);
}

// ═══ Checkins ═══

export async function getAllCheckins() {
  return operate('checkins', 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCheckinsByMember(memberId) {
  return operate('checkins', 'readonly', (store, resolve, reject) => {
    const idx = store.index('memberId');
    const req = idx.getAll(memberId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addCheckin(checkin) {
  return operate('checkins', 'readwrite', (store, resolve, reject) => {
    const req = store.add(checkin);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCheckin(id) {
  return operate('checkins', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestCheckin(memberId) {
  const checkins = await getCheckinsByMember(memberId);
  if (checkins.length === 0) return null;
  checkins.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return checkins[0];
}

export async function getTodayCheckinCount() {
  const all = await getAllCheckins();
  const today = new Date().toISOString().split('T')[0];
  return all.filter((c) => c.timestamp && c.timestamp.startsWith(today)).length;
}

// ═══ Private Courses ═══

export async function getAllCourses() {
  return operate('privateCourses', 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCourse(id) {
  return operate('privateCourses', 'readonly', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCoursesByMember(memberId) {
  return operate('privateCourses', 'readonly', (store, resolve, reject) => {
    const idx = store.index('memberId');
    const req = idx.getAll(memberId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addCourse(course) {
  return operate('privateCourses', 'readwrite', (store, resolve, reject) => {
    const req = store.add(course);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateCourse(course) {
  return operate('privateCourses', 'readwrite', (store, resolve, reject) => {
    const req = store.put(course);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCourse(id) {
  return operate('privateCourses', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCourseCount() {
  return operate('privateCourses', 'readonly', (store, resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function searchCourses(query) {
  const all = await getAllCourses();
  const allMembers = await getAllMembers();
  const q = query.toLowerCase().trim();
  if (!q) return all;

  const matchedMemberIds = allMembers
    .filter(m => m.name.toLowerCase().includes(q) || (m.phone && m.phone.includes(q)))
    .map(m => m.id);

  if (matchedMemberIds.length > 0) {
    return all.filter(c => matchedMemberIds.includes(c.memberId));
  }

  return all.filter(c =>
    (c.packageName && c.packageName.toLowerCase().includes(q)) ||
    (c.coachName && c.coachName.toLowerCase().includes(q))
  );
}

// ═══ Private Sessions ═══

export async function getAllSessions() {
  return operate('privateSessions', 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSessionsByCourse(courseId) {
  return operate('privateSessions', 'readonly', (store, resolve, reject) => {
    const idx = store.index('courseId');
    const req = idx.getAll(courseId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getSessionsByMember(memberId) {
  return operate('privateSessions', 'readonly', (store, resolve, reject) => {
    const idx = store.index('memberId');
    const req = idx.getAll(memberId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addSession(session) {
  return operate('privateSessions', 'readwrite', (store, resolve, reject) => {
    const req = store.add(session);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(id) {
  return operate('privateSessions', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getLatestSession(courseId) {
  const sessions = await getSessionsByCourse(courseId);
  if (sessions.length === 0) return null;
  sessions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return sessions[0];
}

// ═══ Activities ═══

export async function getAllActivities() {
  return operate('activities', 'readonly', (store, resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getActivity(id) {
  return operate('activities', 'readonly', (store, resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addActivity(activity) {
  return operate('activities', 'readwrite', (store, resolve, reject) => {
    const req = store.add(activity);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateActivity(activity) {
  return operate('activities', 'readwrite', (store, resolve, reject) => {
    const req = store.put(activity);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteActivity(id) {
  return operate('activities', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getActivityCount() {
  return operate('activities', 'readonly', (store, resolve, reject) => {
    const req = store.count();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getUpcomingActivities() {
  const all = await getAllActivities();
  const today = new Date().toISOString().split('T')[0];
  return all
    .filter(a => a.startDate >= today)
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || (a.startTime || '').localeCompare(b.startTime || ''));
}

// ═══ Activity Participants ═══

export async function getParticipantsByActivity(activityId) {
  return operate('activityParticipants', 'readonly', (store, resolve, reject) => {
    const idx = store.index('activityId');
    const req = idx.getAll(activityId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function addParticipant(participant) {
  return operate('activityParticipants', 'readwrite', (store, resolve, reject) => {
    const req = store.add(participant);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function updateParticipant(participant) {
  return operate('activityParticipants', 'readwrite', (store, resolve, reject) => {
    const req = store.put(participant);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteParticipant(id) {
  return operate('activityParticipants', 'readwrite', (store, resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteParticipantsByActivity(activityId) {
  const participants = await getParticipantsByActivity(activityId);
  for (const p of participants) {
    await deleteParticipant(p.id);
  }
}

export async function getParticipantCount(activityId) {
  const participants = await getParticipantsByActivity(activityId);
  return participants.length;
}

// ═══ ID Generation ═══

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateCheckinId() {
  return 'ci_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateCourseId() {
  return 'pc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateSessionId() {
  return 'ps_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateActivityId() {
  return 'act_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateParticipantId() {
  return 'p_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateAdjId() {
  return 'adj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ═══ Adjustments ═══

export async function addAdjustment(adj) {
  return operate('adjustments', 'readwrite', (store, resolve, reject) => {
    const req = store.add(adj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ═══ Seed Demo ═══

export async function seedDemoData() {
  const demoMembers = [
    {
      id: 'demo-wcl', name: '王成亮', phone: '13201627036', cardNo: '00001',
      cardType: 'count', totalCount: 10, remainingCount: 8,
      startDate: null, expiryDate: null, notes: '老会员',
      membershipEnabled: true,
      createdAt: '2026-04-11T10:00:00.000Z', updatedAt: '2026-08-19T20:15:00.000Z',
    },
    {
      id: 'demo-zs', name: '张三', phone: '13800138001', cardNo: '00002',
      cardType: 'month', totalCount: null, remainingCount: null,
      startDate: '2026-08-01', expiryDate: '2026-08-31', notes: '',
      membershipEnabled: true,
      createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z',
    },
    {
      id: 'demo-ls', name: '李四', phone: '13900139002', cardNo: '00003',
      cardType: 'year', totalCount: null, remainingCount: null,
      startDate: '2026-01-01', expiryDate: '2026-12-31', notes: 'VIP',
      membershipEnabled: true,
      createdAt: '2026-01-01T09:00:00.000Z', updatedAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'demo-zl', name: '赵六', phone: '13700137003', cardNo: '',
      cardType: 'month', totalCount: null, remainingCount: null,
      startDate: '2026-05-01', expiryDate: '2026-05-31', notes: '已过期演示',
      membershipEnabled: true,
      createdAt: '2026-05-01T09:00:00.000Z', updatedAt: '2026-05-01T09:00:00.000Z',
    },
    {
      id: 'demo-cq', name: '陈强', phone: '13600136004', cardNo: '',
      cardType: null, totalCount: null, remainingCount: null,
      startDate: null, expiryDate: null, notes: '仅私教',
      membershipEnabled: false,
      createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z',
    },
  ];

  const demoCheckins = [
    { id: 'ci-d1', memberId: 'demo-wcl', timestamp: '2026-04-11T17:13:00.000Z', forced: false },
    { id: 'ci-d2', memberId: 'demo-wcl', timestamp: '2026-08-19T20:15:00.000Z', forced: false },
    { id: 'ci-d3', memberId: 'demo-zs', timestamp: '2026-08-19T18:30:00.000Z', forced: false },
    { id: 'ci-d4', memberId: 'demo-ls', timestamp: '2026-08-18T19:00:00.000Z', forced: false },
    { id: 'ci-d5', memberId: 'demo-zl', timestamp: '2026-05-15T16:00:00.000Z', forced: false },
  ];

  const demoCourses = [
    {
      id: 'pc-d1', memberId: 'demo-wcl',
      packageName: '增肌私教', coachName: '张教练',
      totalLessons: 20, remainingLessons: 13,
      startDate: '2026-06-01', expiryDate: null, notes: '',
      createdAt: '2026-06-01T09:00:00.000Z', updatedAt: '2026-06-01T09:00:00.000Z',
    },
    {
      id: 'pc-d2', memberId: 'demo-cq',
      packageName: '私教课', coachName: '李教练',
      totalLessons: 10, remainingLessons: 10,
      startDate: '2026-08-01', expiryDate: null, notes: '新客户',
      createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-01T09:00:00.000Z',
    },
  ];

  const demoSessions = [
    { id: 'ps-d1', courseId: 'pc-d1', memberId: 'demo-wcl', timestamp: '2026-08-19T19:30:00.000Z', lessonsUsed: 1, notes: '' },
    { id: 'ps-d2', courseId: 'pc-d1', memberId: 'demo-wcl', timestamp: '2026-08-16T18:10:00.000Z', lessonsUsed: 1, notes: '' },
    { id: 'ps-d3', courseId: 'pc-d1', memberId: 'demo-wcl', timestamp: '2026-08-12T20:05:00.000Z', lessonsUsed: 1, notes: '' },
  ];

  const demoActivities = [
    {
      id: 'act-d1', title: '少儿体适能体验', category: '儿童',
      startDate: '2026-08-24', startTime: '10:00', endTime: '11:30',
      capacity: 20, notes: '自备运动鞋',
      createdAt: '2026-08-10T09:00:00.000Z', updatedAt: '2026-08-10T09:00:00.000Z',
    },
    {
      id: 'act-d2', title: '周末训练体验', category: '体验',
      startDate: '2026-08-26', startTime: '15:00', endTime: '17:00',
      capacity: null, notes: '免费开放',
      createdAt: '2026-08-15T09:00:00.000Z', updatedAt: '2026-08-15T09:00:00.000Z',
    },
  ];

  const demoParticipants = [
    { id: 'p-d1', activityId: 'act-d1', linkedMemberId: null,  name: '王小明', phone: '', guardianName: '王成亮', guardianPhone: '13201627036', notes: '', status: 'registered', createdAt: '2026-08-15T10:00:00.000Z' },
    { id: 'p-d2', activityId: 'act-d1', linkedMemberId: null,  name: '张小雨', phone: '13900139002', guardianName: '', guardianPhone: '', notes: '', status: 'registered', createdAt: '2026-08-16T10:00:00.000Z' },
  ];

  for (const m of demoMembers) { await addMember(m); }
  for (const c of demoCheckins) { await addCheckin(c); }
  for (const c of demoCourses) { await addCourse(c); }
  for (const s of demoSessions) { await addSession(s); }
  for (const a of demoActivities) { await addActivity(a); }
  for (const p of demoParticipants) { await addParticipant(p); }
}

// ═══ Clear All ═══

export async function clearAllData() {
  const storeNames = ['members', 'checkins', 'adjustments', 'privateCourses', 'privateSessions', 'activities', 'activityParticipants'];
  for (const name of storeNames) {
    const items = await operate(name, 'readonly', (store, resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    for (const item of items) {
      await operate(name, 'readwrite', (store, resolve, reject) => {
        const req = store.delete(item.id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  }
}

// ═══ Export / Import ═══

export async function exportAllData() {
  const storeNames = ['members', 'checkins', 'adjustments', 'privateCourses', 'privateSessions', 'activities', 'activityParticipants'];
  const data = {};
  for (const name of storeNames) {
    data[name] = await operate(name, 'readonly', (store, resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return {
    app: 'oxy-fitness-local',
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    data,
  };
}

export async function importAllData(backup) {
  if (!backup || backup.app !== 'oxy-fitness-local' || !backup.data) {
    throw new Error('无效的备份文件');
  }

  await clearAllData();

  const storeNames = ['members', 'checkins', 'adjustments', 'privateCourses', 'privateSessions', 'activities', 'activityParticipants'];
  for (const name of storeNames) {
    const items = backup.data[name] || [];
    for (const item of items) {
      await operate(name, 'readwrite', (store, resolve, reject) => {
        const req = store.add(item);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
  }
}