import { initDatabase, getDB } from './localDB';

const ARABIC_API = 'https://api.alquran.cloud/v1/quran/quran-uthmani';
const ENGLISH_API = 'https://api.alquran.cloud/v1/quran/en.sahih';
const MUSHAF_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf';

export const getMushafPageData = async (pageNum: number) => {
  const db = getDB();
  const res = await db.executeSql(`SELECT data FROM mushaf_pages WHERE pageNumber=?`, [pageNum]);
  if (res && res.length > 0 && res[0].rows.length > 0) {
    return JSON.parse(res[0].rows.item(0).data);
  }
  return { lines: [] };
};

const safeFetchJson = async (url: string) => {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Network error: ${res.status}`);
  return res.json();
};

export const downloadAndCacheQuran = async () => {
  await initDatabase();
  const db = getDB();

  const [verseCheck, mushafCheck] = await Promise.all([
    db.executeSql(`SELECT COUNT(*) as c FROM verses`),
    db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages`)
  ]);

  const versesCached = verseCheck && verseCheck.length > 0 && verseCheck[0].rows.item(0).c > 0;
  const mushafCached = mushafCheck && mushafCheck.length > 0 && mushafCheck[0].rows.item(0).c > 0;

  if (versesCached && mushafCached) return true;

  try {
    // Fetch Quran text if not cached
    const [arRes, enRes] = versesCached
      ? [null, null]
      : await Promise.all([
          safeFetchJson(ARABIC_API),
          safeFetchJson(ENGLISH_API)
        ]);

    // Fetch Mushaf pages if not cached
    const mushafPages: any[] = [];
    if (!mushafCached) {
      const pagePromises = [];
      for (let i = 1; i <= 604; i++) {
        const pageStr = String(i).padStart(3, '0');
        const url = `${MUSHAF_BASE}/page-${pageStr}.json`;
        pagePromises.push(
          fetch(url).then(r => r.ok ? r.json() : null)
        );
      }
      const results = await Promise.all(pagePromises);
      for (const r of results) { if (r) mushafPages.push(r); }
    }

    // Save everything in one transaction
    await db.transaction((tx: any) => {
      if (!versesCached && arRes && enRes) {
        if (!arRes?.data?.surahs || !enRes?.data?.surahs) {
          throw new Error('API returned invalid data structure');
        }
        for (const surah of arRes.data.surahs) {
          tx.executeSql(
            `INSERT OR REPLACE INTO surahs (id, name, englishName, verses) VALUES (?, ?, ?, ?)`,
            [surah.number, surah.name, surah.englishName, surah.ayahs.length]
          );
          const enSurah = enRes.data.surahs.find((s: any) => s.number === surah.number);
          for (let i = 0; i < surah.ayahs.length; i++) {
            const ayah = surah.ayahs[i];
            tx.executeSql(
              `INSERT INTO verses (surahId, verseNumber, textArabic, textTranslation, page) VALUES (?, ?, ?, ?, ?)`,
              [surah.number, ayah.numberInSurah, ayah.text, enSurah?.ayahs[i]?.text || '', ayah.page]
            );
          }
        }
      }

      for (const page of mushafPages) {
        tx.executeSql(
          `INSERT OR REPLACE INTO mushaf_pages (pageNumber, data) VALUES (?, ?)`,
          [page.page, JSON.stringify(page)]
        );
      }
    });

    return true;
  } catch (e) {
    console.error('Quran download failed:', e);
    throw e;
  }
};

export const getSurahs = async () => {
  const db = getDB(); 
  const res = await db.executeSql(`SELECT * FROM surahs ORDER BY id`);
  const s = []; 
  if (res && res.length > 0) {
    for (let i = 0; i < res[0].rows.length; i++) s.push(res[0].rows.item(i)); 
  }
  return s; 
};

export const getVersesBySurahPaginated = async (surahId: number, page: number = 1, limit: number = 20): Promise<{ verses: any[], total: number }> => {
  const db = getDB();
  const offset = (page - 1) * limit;
  
  const countRes = await db.executeSql(`SELECT COUNT(*) as total FROM verses WHERE surahId=?`, [surahId]);
  let total = 0;
  if (countRes && countRes.length > 0) total = countRes[0].rows.item(0).total;
  
  const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber LIMIT ? OFFSET ?`, [surahId, limit, offset]);
  const verses = [];
  if (res && res.length > 0) {
    for (let i = 0; i < res[0].rows.length; i++) verses.push(res[0].rows.item(i));
  }
  
  return { verses, total };
};

export const getSurahStartPage = async (surahId: number) => {
  const db = getDB();
  for (let i = 1; i <= 604; i++) {
    const res = await db.executeSql(`SELECT data FROM mushaf_pages WHERE pageNumber=?`, [i]);
    if (res && res.length > 0 && res[0].rows.length > 0) {
      const pageData = JSON.parse(res[0].rows.item(0).data);
      const hasSurah = pageData.lines?.some((line: any) =>
        line.words?.some((word: any) => {
          const parts = word.location ? word.location.split(':') : [];
          return parseInt(parts[0], 10) === surahId;
        })
      );
      if (hasSurah) return i;
    }
  }
  return 1;
};

export const getVersePage = async (surahId: number, verseNum: number) => {
  const db = getDB();
  const res = await db.executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surahId, verseNum]);
  if (res && res.length > 0 && res[0].rows.length > 0) return res[0].rows.item(0).page;
  return 1;
};

export const getVersesBySurah = async (surahId: number) => {
  const db = getDB();
  const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber`, [surahId]);
  const v = [];
  if (res && res.length > 0) { for (let i = 0; i < res[0].rows.length; i++) v.push(res[0].rows.item(i)); }
  return v;
};

export const getVersesByPage = async (page: number) => {
  const db = getDB();
  const res = await db.executeSql(`SELECT * FROM verses WHERE page=? ORDER BY verseNumber`, [page]);
  const v = [];
  if (res && res.length > 0) {
    for (let i = 0; i < res[0].rows.length; i++) v.push(res[0].rows.item(i));
  }
  return v;
};