const DB_NAME = 'gym-manager';
const DB_VERSION = 1;

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
    };
    request.onsuccess = (e) => {
      _db = e.target.result;
      resolve(_db);
    };
    request.onerror = (e) => reject(e.target.error);
  });
}

function reqPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
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

// ─── Members ───

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

export async function searchMembers(query) {
  const all = await getAllMembers();
  const q = query.toLowerCase().trim();
  if (!q) return all;
  return all.filter(
    (m) =>
      m.name.toLowerCase().includes(q) ||
      (m.phone && m.phone.includes(q))
  );
}

// ─── Checkins ───

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
  return all.filter((c) => c.timestamp.startsWith(today)).length;
}

// ─── Adjustments ───

export async function addAdjustment(adj) {
  return operate('adjustments', 'readwrite', (store, resolve, reject) => {
    const req = store.add(adj);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAdjustmentsByMember(memberId) {
  return operate('adjustments', 'readonly', (store, resolve, reject) => {
    const idx = store.index('memberId');
    const req = idx.getAll(memberId);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ─── Demo Data ───

export async function seedDemoData() {
  const now = new Date().toISOString().split('T')[0];
  const demoMembers = [
    {
      id: 'demo-wcl',
      name: '王成亮',
      phone: '13201627036',
      cardType: 'count',
      totalCount: 10,
      remainingCount: 8,
      startDate: null,
      expiryDate: null,
      createdAt: '2026-04-11T10:00:00.000Z',
      updatedAt: '2026-08-19T20:15:00.000Z',
    },
    {
      id: 'demo-zs',
      name: '张三',
      phone: '13800138001',
      cardType: 'month',
      totalCount: null,
      remainingCount: null,
      startDate: '2026-08-01',
      expiryDate: '2026-08-31',
      createdAt: '2026-08-01T09:00:00.000Z',
      updatedAt: '2026-08-01T09:00:00.000Z',
    },
    {
      id: 'demo-ls',
      name: '李四',
      phone: '13900139002',
      cardType: 'year',
      totalCount: null,
      remainingCount: null,
      startDate: '2026-01-01',
      expiryDate: '2026-12-31',
      createdAt: '2026-01-01T09:00:00.000Z',
      updatedAt: '2026-01-01T09:00:00.000Z',
    },
    {
      id: 'demo-zl',
      name: '赵六',
      phone: '13700137003',
      cardType: 'month',
      totalCount: null,
      remainingCount: null,
      startDate: '2026-05-01',
      expiryDate: '2026-05-31',
      createdAt: '2026-05-01T09:00:00.000Z',
      updatedAt: '2026-05-01T09:00:00.000Z',
    },
  ];

  const demoCheckins = [
    { id: 'ci-d1', memberId: 'demo-wcl', timestamp: '2026-04-11T17:13:00.000Z', forced: false },
    { id: 'ci-d2', memberId: 'demo-wcl', timestamp: '2026-08-19T20:15:00.000Z', forced: false },
    { id: 'ci-d3', memberId: 'demo-zs', timestamp: '2026-08-19T18:30:00.000Z', forced: false },
    { id: 'ci-d4', memberId: 'demo-ls', timestamp: '2026-08-18T19:00:00.000Z', forced: false },
    { id: 'ci-d5', memberId: 'demo-zl', timestamp: '2026-05-15T16:00:00.000Z', forced: false },
  ];

  for (const m of demoMembers) {
    await addMember(m);
  }
  for (const c of demoCheckins) {
    await addCheckin(c);
  }
}

export async function clearAllData() {
  const members = await getAllMembers();
  for (const m of members) {
    await deleteMember(m.id);
  }
  const checkins = await getAllCheckins();
  for (const c of checkins) {
    await deleteCheckin(c.id);
  }
}

// ─── Id Generation ───

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateCheckinId() {
  return 'ci_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function generateAdjId() {
  return 'adj_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
