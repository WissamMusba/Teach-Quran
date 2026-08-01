import { initDatabase, getDB } from './localDB';

const SURAH_API = 'https://api.alquran.cloud/v1/surah';
const MUSHAF_BASE = 'https://raw.githubusercontent.com/zonetecde/mushaf-layout/main/mushaf';
const TOTAL_VERSES = 6236;
const MIN_USABLE_VERSES = 6000;

let indopakVerseCache: Record<string, number> | null = null;
let indopakReverseMap: Record<string, string[]> | null = null;
const indopakPageVerseCache: Record<number, any[]> = {};
const versesPageCache = new Map<string, { verses: any[]; total: number }>();
const surahTotalCache = new Map<number, number>();

const isIndopakStyle = (mushaf?: string) => {
  const indopakFonts = ['saleem', 'indopak', 'alqalam', 'lateef', 'harmattan'];
  return mushaf && indopakFonts.includes(mushaf);
};

let indopakPagesPromise: Promise<boolean> | null = null;

export const importIndopakPages = async () => {
  if (!indopakPagesPromise) {
    indopakPagesPromise = (async () => {
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
      } catch (e) { console.warn('importIndopakPages failed', e); indopakPagesPromise = null; return false; }
    })();
  }
  return indopakPagesPromise;
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

const fetchMissing = async () => {
  const db = getDB();
  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    const missing: any[] = [];
    for (const s of metaData.data) {
      const r = await db.executeSql(`SELECT COUNT(*) as c FROM verses WHERE surahId=?`, [s.number]);
      const c = r && r.length > 0 ? r[0].rows.item(0).c : 0;
      if (c < s.numberOfAyahs) missing.push(s);
    }
    if (missing.length === 0) return;
    await db.transaction((tx: any) => {
      missing.forEach(s => tx.executeSql(`DELETE FROM verses WHERE surahId=?`, [s.number]));
    });
    const chunkSize = 10;
    for (let i = 0; i < missing.length; i += chunkSize) {
      const chunk = missing.slice(i, i + chunkSize);
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
  } catch (e) { console.error('Quran background fill failed:', e); }
};

export const downloadAndCacheQuran = async () => {
  await initDatabase();
  const db = getDB();
  const [verseCheck] = await Promise.all([db.executeSql(`SELECT COUNT(*) as c FROM verses`)]);
  const count = verseCheck && verseCheck.length > 0 ? verseCheck[0].rows.item(0).c : 0;
  if (count >= TOTAL_VERSES) return true;
  if (count >= MIN_USABLE_VERSES) { fetchMissing(); fetchMushafPages(); return true; }

  try {
    const metaData = await (await fetch(`${SURAH_API}`)).json();
    await db.transaction((tx: any) => {
      metaData.data.forEach((s: any) => tx.executeSql(`INSERT OR REPLACE INTO surahs (id, name, englishName, verses) VALUES (?, ?, ?, ?)`, [s.number, s.name, s.englishName, s.numberOfAyahs]));
    });

    const missing: any[] = [];
    for (const s of metaData.data) {
      const r = await db.executeSql(`SELECT COUNT(*) as c FROM verses WHERE surahId=?`, [s.number]);
      const c = r && r.length > 0 ? r[0].rows.item(0).c : 0;
      if (c < s.numberOfAyahs) missing.push(s);
    }
    for (const s of missing) {
      await db.executeSql(`DELETE FROM verses WHERE surahId=?`, [s.number]);
    }

    const firstTenPromises = [];
    for (const s of missing.slice(0, 10)) {
      firstTenPromises.push(fetch(`${SURAH_API}/${s.number}/editions/quran-uthmani,en.sahih,indo.pak`).then(r => r.json()));
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

    fetchMissing();
    fetchMushafPages();

    return true;
  } catch (e) {
    console.error('Quran download failed:', e);
    throw e;
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
  const offset = (page - 1) * limit;
  const key = `${surahId}:${offset}:${limit}`;
  const cached = versesPageCache.get(key);
  if (cached) return cached;
  const db = getDB();
  let total = surahTotalCache.get(surahId);
  if (total === undefined) {
    const countRes = await db.executeSql(`SELECT COUNT(*) as total FROM verses WHERE surahId=?`, [surahId]);
    total = countRes && countRes.length > 0 ? countRes[0].rows.item(0).total : 0;
    surahTotalCache.set(surahId, total);
  }
  const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? ORDER BY verseNumber LIMIT ? OFFSET ?`, [surahId, limit, offset]);
  const verses = []; if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) verses.push(res[0].rows.item(i));
  const result = { verses, total };
  versesPageCache.set(key, result);
  return result;
};

export const getVersePage = async (surahId: number, verseNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) return getIndopakVersePage(surahId, verseNum);
  const res = await getDB().executeSql(`SELECT page FROM verses WHERE surahId=? AND verseNumber=? LIMIT 1`, [surahId, verseNum]);
  return res && res.length > 0 && res[0].rows.length > 0 ? res[0].rows.item(0).page : 1;
};

export const getVersesByPage = async (pageNum: number, mushaf?: string) => {
  if (isIndopakStyle(mushaf)) {
    if (indopakPageVerseCache[pageNum]) return indopakPageVerseCache[pageNum];
    if (!indopakReverseMap) {
      try { indopakVerseCache = require('../assets/data/indopak_verse_pages.json'); }
      catch { indopakVerseCache = {}; }
      indopakReverseMap = {};
      for (const key of Object.keys(indopakVerseCache)) {
        const pg = indopakVerseCache[key];
        if (!indopakReverseMap[pg]) indopakReverseMap[pg] = [];
        indopakReverseMap[pg].push(key);
      }
    }
    const keys = indopakReverseMap[pageNum] || [];
    const out: any[] = [];
    if (keys.length > 0) {
      const bySurah: Record<number, number[]> = {};
      keys.forEach(k => { const parts = k.split(':'); const s = parseInt(parts[0], 10); const v = parseInt(parts[1], 10); if (!bySurah[s]) bySurah[s] = []; bySurah[s].push(v); });
      const db = getDB();
      for (const surahId of Object.keys(bySurah)) {
        const vs = bySurah[parseInt(surahId, 10)];
        const placeholders = vs.map(() => '?').join(',');
        const res = await db.executeSql(`SELECT * FROM verses WHERE surahId=? AND verseNumber IN (${placeholders}) ORDER BY verseNumber`, [parseInt(surahId, 10), ...vs]);
        if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
      }
      out.sort((a, b) => (a.surahId - b.surahId) || (a.verseNumber - b.verseNumber));
    }
    indopakPageVerseCache[pageNum] = out;
    return out;
  }
  const res = await getDB().executeSql(`SELECT * FROM verses WHERE page=? ORDER BY surahId, verseNumber`, [pageNum]);
  const out: any[] = [];
  if (res && res.length > 0) for (let i = 0; i < res[0].rows.length; i++) out.push(res[0].rows.item(i));
  return out;
};
