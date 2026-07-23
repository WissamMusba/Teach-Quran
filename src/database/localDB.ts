import SQLite from 'react-native-sqlite-storage';
SQLite.enablePromise(true);
let dbInstance: any = null;

export const initDatabase = async () => {
  if (dbInstance) return;
  dbInstance = await SQLite.openDatabase({ name: 'quran.db', location: 'default' });
  
  await dbInstance.executeSql(`PRAGMA journal_mode=WAL;`);
  await dbInstance.executeSql(`PRAGMA synchronous=NORMAL;`);
  
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS surahs (id INTEGER PRIMARY KEY, name TEXT, englishName TEXT, verses INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS verses (id INTEGER PRIMARY KEY AUTOINCREMENT, surahId INTEGER, verseNumber INTEGER, textArabic TEXT, textIndopak TEXT, textTranslation TEXT, page INTEGER)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS student_data_cache (studentId TEXT PRIMARY KEY, data TEXT)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId TEXT, data TEXT, synced BOOLEAN DEFAULT 0)`);
  await dbInstance.executeSql(`CREATE TABLE IF NOT EXISTS mushaf_pages (pageNumber INTEGER PRIMARY KEY, data TEXT)`);

  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_surah ON verses(surahId)`);
  await dbInstance.executeSql(`CREATE INDEX IF NOT EXISTS idx_verses_page ON verses(page)`);
};

export const getDB = () => dbInstance;

export const getStudentData = async (studentId: string) => {
  const res = await getDB().executeSql(`SELECT data FROM student_data_cache WHERE studentId=?`, [studentId]);
  if (res && res.length > 0 && res[0].rows.length > 0) return JSON.parse(res[0].rows.item(0).data);
  return null;
};

export const saveStudentData = async (studentId: string, data: any) => {
  await getDB().executeSql(`INSERT OR REPLACE INTO student_data_cache (studentId, data) VALUES (?, ?)`, [studentId, JSON.stringify(data)]);
};

export const addToSyncQueue = async (studentId: string, data: any) => {
  await getDB().executeSql(`INSERT INTO sync_queue (studentId, data, synced) VALUES (?, ?, 0)`, [studentId, JSON.stringify(data)]);
};

export const getPendingSyncQueue = async () => {
  const res = await getDB().executeSql(`SELECT * FROM sync_queue WHERE synced=0`);
  const q = []; for (let i = 0; i < res[0].rows.length; i++) q.push(res[0].rows.item(i)); return q;
};

export const markQueueItemsSynced = async (ids: number[]) => {
  if (ids.length === 0) return; 
  await getDB().executeSql(`UPDATE sync_queue SET synced=1 WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
};

export const purgeLocalStudent = async (studentId: string) => {
  const db = getDB();
  await db.executeSql(`DELETE FROM student_data_cache WHERE studentId=?`, [studentId]);
  await db.executeSql(`DELETE FROM sync_queue WHERE studentId=?`, [studentId]);
};
