import { initDatabase, getDB } from './localDB';

const SURAH_API = 'https://api.alquran.cloud/v1/surah';
const MUSHAF_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf';

let indopakVerseCache: Record<string, number> | null = null;
let indopakReverseMap: Record<string, string[]> | null = null;
let indopakPageVersesMap: Record<string, any[]> | null = null;
let allVersesCache: any[] | null = null;

const isIndopakStyle = (mushaf?: string) => {
  const indopakFonts = ['saleem', 'indopak', 'mequran', 'alqalam', 'lateef', 'noto', 'harmattan'];
  return mushaf && indopakFonts.includes(mushaf);
};

export const importIndopakPages = async () => {
  const db = getDB();
  const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages_indopak`);
  if (check && check.length > 0 && check[0].rows.item(0).c > 0) return true;
  try {
    const allPages = require('../assets/data/indopak_pages.json');
    if (!allPages?.pages) return false;
    const entries = Object.values(allPages.pages) as any[];
    await db.transaction((tx: any) => {
      for (const p of entries) {
        tx.executeSql(`INSERT OR REPLACE INTO mushaf_pages_indopak (pageNumber, data) VALUES (?, ?)`,
          [p.page, JSON.stringify(p)]);
      }
    });
    return true;
  } catch (e) { console.warn('importIndopakPages failed', e); return false; }
};

const getIndopakVersePage = (surahId: number, verseNum: number): number => {
  if (!indopakVerseCache) {
    try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
    catch { indopakVerseCache = {}; }
  }
  const key = `${surahId}:${verseNum}`;
  return indopakVerseCache[key] || 1;
};

export const getMushafPageData = async (pageNum: number, mushaf?: string) => {
  const table = isIndopakStyle(mushaf) ? 'mushaf_pages_indopak' : 'mushaf_pages';
  const res = await getDB().executeSql(`SELECT data FROM ${table} WHERE pageNumber=?`, [pageNum]);
  if (res && res.length > 0 && res[0].rows.length > 0) return JSON.parse(res[0].rows.item(0).data);
  return { lines: [] };
};

export const downloadAndCacheQuran = async () => {
  await initDatabase();
  const db = getDB();
  const [verseCheck] = await Promise.all([db.executeSql(`SELECT COUNT(*) as c FROM verses`)]);
  if (verseCheck && verseCheck.length > 0 && verseCheck[0].rows.item(0).c > 0) return true;

  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    await db.transaction((tx: any) => {
      metaData.data.forEach((s: any) => tx.executeSql(`INSERT OR REPLACE INTO surahs (id, name, englishName, verses) VALUES (?, ?, ?, ?)`, [s.number, s.name, s.englishName, s.numberOfAyahs]));
    });

    const firstTenPromises = [];
    for (let i = 1; i <= 10; i++) {
      firstTenPromises.push(fetch(`${SURAH_API}/${i}/editions/quran-uthmani,en.sahih,indo.pak`).then(r => r.json()));
    }
    const firstTenResults = await Promise.all(firstTenPromises);

    await db.transaction((tx: any) => {
      firstTenResults.forEach((res) => {
        const arRes = res.data[0], enRes = res.data[1], indopakRes = res.data[2];
        for (let i = 0; i < arRes.ayahs.length; i++) {
          const ayah = arRes.ayahs[i];
          tx.executeSql(`INSERT INTO verses (surahId, verseNumber, textArabic, textIndopak, textTranslation, page) VALUES (?, ?, ?, ?, ?, ?)`, 
            [arRes.number, ayah.numberInSurah, ayah.text, indopakRes.ayahs[i]?.text || ayah.text, enRes.ayahs[i]?.text || '', ayah.page]);
        }
      });
    });

    fetchRemainingQuran(metaData.data.slice(10));
    fetchMushafPages();

    return true;
  } catch (e) {
    console.error('Quran download failed:', e);
    throw e;
  }
};

const fetchRemainingQuran = async (surahs: any[]) => {
  const db = getDB();
  const chunkSize = 10;
  for (let i = 0; i < surahs.length; i += chunkSize) {
    const chunk = surahs.slice(i, i + chunkSize);
    try {
      const promises = chunk.map(s => fetch(`${SURAH_API}/${s.number}/editions/quran-uthmani,en.sahih,indo.pak`).then(r => r.json()));
      const results = await Promise.all(promises);
      
      await db.transaction((tx: any) => {
        results.forEach((res) => {
          const arRes = res.data[0], enRes = res.data[1], indopakRes = res.data[2];
          for (let i = 0; i < arRes.ayahs.length; i++) {
            const ayah = arRes.ayahs[i];
            tx.executeSql(`INSERT INTO verses (surahId, verseNumber, textArabic, textIndopak, textTranslation, page) VALUES (?, ?, ?, ?, ?, ?)`, 
              [arRes.number, ayah.numberInSurah, ayah.text, indopakRes.ayahs[i]?.text || ayah.text, enRes.ayahs[i]?.text || '', ayah.page]);
          }
        });
      });
    } catch (e) { console.error(`Failed chunk starting at surah ${chunk[0].number}`, e); }
  }
};

const fetchMushafPages = async () => {
  const db = getDB();
  const check = await db.executeSql(`SELECT COUNT(*) as c FROM mushaf_pages`);
  if (check && check.length > 0 && check[0].rows.item(0).c > 0) return;

  const chunkSize = 20;
  for (let i = 1; i <= 604; i += chunkSize) {
    const promises = [];
    for (let j = i; j < Math.min(i + chunkSize, 605); j++) {
      const pageStr = String(j).padStart(3, '0');
      promises.push(fetch(`${MUSHAF_BASE}/page-${pageStr}.json`).then(r => r.ok ? r.json() : null));
    }
    try {
      const results = await Promise.all(promises);
      await db.transaction((tx: any) => {
        results.forEach((pageData) => {
          if (pageData) {
            tx.executeSql(`INSERT OR REPLACE INTO mushaf_pages (pageNumber, data) VALUES (?, ?)`, [pageData.page, JSON.stringify(pageData)]);
          }
        });
      });
    } catch (e) { console.error(`Failed mushaf chunk starting at page ${i}`, e); }
  }
};

export const getSurahs = async () => {
  const res = await getDB().executeSql(`SELECT * FROM surahs ORDER BY id`);
  const s = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) s.push(res[0].rows.item(i)); return s; 
};

export const getVersesBySurahPaginated = async (surahId: number, page: number = 1, limit: number = 20) => {
  const db = getDB(); const offset = (page - 1) * limit;
  const countRes = await db.executeSql(`SELECT COUNT(*) as total FROM verses WHERE surahId=?`, [surahId]);
  let total = countRes && countRes.length > 0 ? countRes[0].rows.item(0).total : 0;
  const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber LIMIT ? OFFSET ?`, [surahId, limit, offset]);
  const verses = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) verses.push(res[0].rows.item(i));
  return { verses, total };
};

export const getVersePage = async (surahId: number, verseNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) return getIndopakVersePage(surahId, verseNum);
  const res = await getDB().executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surahId, verseNum]);
  return res && res.length > 0 && res[0].rows.length > 0 ? res[0].rows.item(0).page : 1;
};

export const getVersesByPage = async (pageNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) {
    if (!allVersesCache) {
      const db = getDB();
      const res = await db.executeSql(`SELECT * FROM verses ORDER BY surahId, verseNumber`);
      allVersesCache = [];
      if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) allVersesCache.push(res[0].rows.item(i));
    }
    if (!indopakVerseCache) {
      try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
      catch { indopakVerseCache = {}; }
    }
    if (!indopakReverseMap) {
      indopakReverseMap = {};
      for (const key of Object.keys(indopakVerseCache)) {
        const pg = indopakVerseCache[key];
        if (!indopakReverseMap[pg]) indopakReverseMap[pg] = [];
        indopakReverseMap[pg].push(key);
      }
    }
    if (!indopakPageVersesMap) {
      indopakPageVersesMap = {};
      for (const v of allVersesCache) {
        const key = `${v.surahId}:${v.verseNumber}`;
        const pg = indopakVerseCache[key];
        if (pg) {
          if (!indopakPageVersesMap[pg]) indopakPageVersesMap[pg] = [];
          indopakPageVersesMap[pg].push(v);
        }
      }
    }
    return indopakPageVersesMap[pageNum] || [];
  }
  const res = await getDB().executeSql(`SELECT * FROM verses WHERE page=? ORDER BY surahId, verseNumber`, [pageNum]);
  const out: any[] = [];
  if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
  return out;
};
