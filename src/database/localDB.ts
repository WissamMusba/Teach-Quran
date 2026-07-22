import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);
let dbInstance: any = null;
export const initDatabase = async () => {
  if (dbInstance) return;
  dbInstance = await SQLite.openDatabase({ name: 'quran.db', location: 'default' });
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS surahs (id INTEGER PRIMARY KEY, name TEXT, englishName TEXT, verses INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, surahId INTEGER, verseNumber INTEGER, textArabic TEXT, textTranslation TEXT, page INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_data_cache (studentId TEXT PRIMARY KEY, data TEXT)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId TEXT, data TEXT, synced BOOLEAN DEFAULT 0)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);
};
export const getDB = () => dbInstance;
export const getStudentData = async (studentId: string) => {
  const db = getDB(); 
  const res = await db.executeSql(`SELECT data FROM student_data_cache WHERE studentId=?`, [studentId]);
  // ⚠️ CRITICAL FIX: Defensive check on native bridge response
  if (res && res.length > 0 && res[0].rows.length > 0) {
    return JSON.parse(res[0].rows.item(0).data);
  }
  return null;
};
export const saveStudentData = async (studentId: string, data: any) => {
  const db = getDB(); await db.executeSql(`INSERT OR REPLACE INTO student_data_cache (studentId, data) VALUES (?, ?)`, [studentId, JSON.stringify(data)]);
};
export const addToSyncQueue = async (studentId: string, data: any) => {
  const db = getDB(); await db.executeSql(`INSERT INTO sync_queue (studentId, data, synced) VALUES (?, ?, 0)`, [studentId, JSON.stringify(data)]);
};
export const getPendingSyncQueue = async () => {
  const db = getDB(); const res = await db.executeSql(`SELECT * FROM sync_queue WHERE synced=0`);
  const q = []; for (let i = 0; i < res[0].rows.length; i++) q.push(res[0].rows.item(i)); return q;
};
export const markQueueItemsSynced = async (ids: number[]) => {
  if (ids.length === 0) return; const db = getDB();
  await db.executeSql(`UPDATE sync_queue SET synced=1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
};

// ⚠️ V10 FIX: Prevent Zombie Student Resurrection
export const purgeLocalStudent = async (studentId: string) => {
  const db = getDB();
  await db.executeSql(`DELETE FROM student_data_cache WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM sync_queue WHERE studentId=?`, [studentId]);
};