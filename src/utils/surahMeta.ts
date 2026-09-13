/**
 * FILE: src/utils/surahMeta.ts
 * ROLE: Bundled STATIC metadata for all 114 surahs — {id, en, ar, verses, pages, juzs}.
 *       This is revelation metadata (names, ayah counts, indopak page ranges, juz spans),
 *       not user data, so it ships inside the APK and the Select Surah modal can render
 *       and search it SYNCHRONOUSLY — zero SQLite reads, zero hydration dependency, so the
 *       list appears in the same frame the modal opens and "Kahf" matches instantly.
 * DEPENDS ON: JUZ_MAP (utils/theme.ts) for juz spans; SURAH_VERSE_COUNTS
 *             (utils/audioPlayback.ts) for per-surah ayah counts.
 * USED BY: src/components/quran/SurahList.tsx (list + search + page/juz jump rows).
 * NOTES: The indopak 610-page pagination range is the same table SurahList previously
 *        hardcoded as SURAH_PAGE_RANGE — moved here so it can never drift from the list.
 */
import { JUZ_MAP } from './theme';
import { SURAH_VERSE_COUNTS } from './audioPlayback';

export interface SurahMeta {
  id: number;
  en: string;       // English name (quran.com style)
  ar: string;       // Arabic name
  verses: number;   // ayah count
  pages: [number, number]; // indopak 610-page pagination [start page, end page]
  juzs: number[];   // every juz this surah spans (from JUZ_MAP)
  startJuz: number; // the juz the surah begins in
}

// [English, Arabic] for all 114 surahs, in order.
const NAMES: [string, string][] = [
  ['Al-Fatihah', 'الفاتحة'],
  ['Al-Baqarah', 'البقرة'],
  ['Aal-Imran', 'آل عمران'],
  ['An-Nisa', 'النساء'],
  ["Al-Ma'idah", 'المائدة'],
  ["Al-An'am", 'الأنعام'],
  ["Al-A'raf", 'الأعراف'],
  ['Al-Anfal', 'الأنفال'],
  ['At-Tawbah', 'التوبة'],
  ['Yunus', 'يونس'],
  ['Hud', 'هود'],
  ['Yusuf', 'يوسف'],
  ["Ar-Ra'd", 'الرعد'],
  ['Ibrahim', 'إبراهيم'],
  ['Al-Hijr', 'الحجر'],
  ['An-Nahl', 'النحل'],
  ['Al-Isra', 'الإسراء'],
  ['Al-Kahf', 'الكهف'],
  ['Maryam', 'مريم'],
  ['Ta-Ha', 'طه'],
  ['Al-Anbiya', 'الأنبياء'],
  ['Al-Hajj', 'الحج'],
  ['Al-Mu\'minun', 'المؤمنون'],
  ['An-Nur', 'النور'],
  ['Al-Furqan', 'الفرقان'],
  ["Ash-Shu'ara", 'الشعراء'],
  ['An-Naml', 'النمل'],
  ['Al-Qasas', 'القصص'],
  ['Al-Ankabut', 'العنكبوت'],
  ['Ar-Rum', 'الروم'],
  ['Luqman', 'لقمان'],
  ['As-Sajdah', 'السجدة'],
  ['Al-Ahzab', 'الأحزاب'],
  ['Saba', 'سبأ'],
  ['Fatir', 'فاطر'],
  ['Ya-Sin', 'يس'],
  ['As-Saffat', 'الصافات'],
  ['Sad', 'ص'],
  ['Az-Zumar', 'الزمر'],
  ['Ghafir', 'غافر'],
  ['Fussilat', 'فصلت'],
  ['Ash-Shura', 'الشورى'],
  ['Az-Zukhruf', 'الزخرف'],
  ['Ad-Dukhan', 'الدخان'],
  ['Al-Jathiyah', 'الجاثية'],
  ['Al-Ahqaf', 'الأحقاف'],
  ['Muhammad', 'محمد'],
  ['Al-Fath', 'الفتح'],
  ['Al-Hujurat', 'الحجرات'],
  ['Qaf', 'ق'],
  ['Adh-Dhariyat', 'الذاريات'],
  ['At-Tur', 'الطور'],
  ['An-Najm', 'النجم'],
  ['Al-Qamar', 'القمر'],
  ['Ar-Rahman', 'الرحمن'],
  ["Al-Waqi'ah", 'الواقعة'],
  ['Al-Hadid', 'الحديد'],
  ['Al-Mujadila', 'المجادلة'],
  ['Al-Hashr', 'الحشر'],
  ['Al-Mumtahanah', 'الممتحنة'],
  ['As-Saff', 'الصف'],
  ["Al-Jumu'ah", 'الجمعة'],
  ['Al-Munafiqun', 'المنافقون'],
  ['At-Taghabun', 'التغابن'],
  ['At-Talaq', 'الطلاق'],
  ['At-Tahrim', 'التحريم'],
  ['Al-Mulk', 'الملك'],
  ['Al-Qalam', 'القلم'],
  ['Al-Haqqah', 'الحاقة'],
  ["Al-Ma'arij", 'المعارج'],
  ['Nuh', 'نوح'],
  ['Al-Jinn', 'الجن'],
  ['Al-Muzzammil', 'المزمل'],
  ['Al-Muddaththir', 'المدثر'],
  ['Al-Qiyamah', 'القيامة'],
  ['Al-Insan', 'الإنسان'],
  ['Al-Mursalat', 'المرسلات'],
  ['An-Naba', 'النبأ'],
  ["An-Nazi'at", 'النازعات'],
  ['Abasa', 'عبس'],
  ['At-Takwir', 'التكوير'],
  ['Al-Infitar', 'الانفطار'],
  ['Al-Mutaffifin', 'المطففين'],
  ['Al-Inshiqaq', 'الانشقاق'],
  ['Al-Buruj', 'البروج'],
  ['At-Tariq', 'الطارق'],
  ["Al-A'la", 'الأعلى'],
  ['Al-Ghashiyah', 'الغاشية'],
  ['Al-Fajr', 'الفجر'],
  ['Al-Balad', 'البلد'],
  ['Ash-Shams', 'الشمس'],
  ['Al-Layl', 'الليل'],
  ['Ad-Duha', 'الضحى'],
  ['Ash-Sharh', 'الشرح'],
  ['At-Tin', 'التين'],
  ['Al-Alaq', 'العلق'],
  ['Al-Qadr', 'القدر'],
  ['Al-Bayyinah', 'البينة'],
  ['Az-Zalzalah', 'الزلزلة'],
  ['Al-Adiyat', 'العاديات'],
  ["Al-Qari'ah", 'القارعة'],
  ['At-Takathur', 'التكاثر'],
  ['Al-Asr', 'العصر'],
  ['Al-Humazah', 'الهمزة'],
  ['Al-Fil', 'الفيل'],
  ['Quraysh', 'قريش'],
  ["Al-Ma'un", 'الماعون'],
  ['Al-Kawthar', 'الكوثر'],
  ['Al-Kafirun', 'الكافرون'],
  ['An-Nasr', 'النصر'],
  ['Al-Masad', 'المسد'],
  ['Al-Ikhlas', 'الإخلاص'],
  ['Al-Falaq', 'الفلق'],
  ['An-Nas', 'الناس'],
];

// Indopak 611-page pagination [start, end] per surah (1..114) — natural 1-to-1 page numbers.
const PAGE_RANGE: [number, number][] = [
  [2, 2], [3, 50], [51, 77], [78, 107], [107, 128], [129, 151], [152, 177], [178, 187], [188, 208], [209, 222],
  [222, 236], [236, 249], [250, 256], [256, 262], [262, 268], [268, 282], [283, 293], [294, 306], [306, 313], [313, 322],
  [323, 332], [332, 342], [343, 350], [351, 360], [360, 367], [367, 377], [377, 386], [386, 397], [397, 405], [405, 412],
  [412, 415], [416, 418], [419, 428], [429, 435], [435, 441], [441, 446], [446, 453], [453, 459], [459, 468], [468, 477],
  [478, 483], [484, 490], [490, 496], [496, 499], [499, 502], [503, 507], [507, 511], [512, 516], [516, 518], [519, 521],
  [521, 524], [524, 526], [527, 529], [529, 532], [532, 535], [535, 538], [538, 542], [543, 546], [546, 549], [550, 552],
  [552, 554], [554, 555], [555, 556], [557, 558], [559, 560], [561, 562], [563, 565], [565, 568], [568, 570], [570, 572],
  [572, 574], [574, 577], [577, 578], [579, 581], [581, 582], [583, 585], [585, 586], [587, 588], [588, 590], [590, 591],
  [591, 592], [592, 593], [593, 595], [595, 596], [596, 597], [597, 597], [598, 598], [598, 599], [599, 600], [601, 601],
  [601, 602], [602, 603], [603, 603], [603, 603], [604, 604], [604, 605], [605, 605], [605, 606], [606, 606], [606, 607],
  [607, 607], [607, 607], [608, 608], [608, 608], [608, 608], [609, 609], [609, 609], [609, 609], [609, 610], [610, 610],
  [610, 610], [610, 610], [611, 611], [611, 611],
];

// All juz numbers a surah spans, by scanning the 30 {j,s,v} JUZ_MAP boundaries.
const juzsOfSurah = (s: number): number[] => {
  const out: number[] = [];
  for (let i = 0; i < JUZ_MAP.length; i++) {
    if (JUZ_MAP[i].s <= s && (i === JUZ_MAP.length - 1 || s <= JUZ_MAP[i + 1].s)) out.push(i + 1);
  }
  return out;
};

export const SURAH_META: SurahMeta[] = NAMES.map(([en, ar], i) => {
  const id = i + 1;
  const juzs = juzsOfSurah(id);
  return {
    id,
    en,
    ar,
    verses: SURAH_VERSE_COUNTS[i],
    pages: PAGE_RANGE[i],
    juzs,
    startJuz: juzs[0] || 1,
  };
});

// Kept exported so any future consumer (SurahIndex, page-mode subtitles) shares ONE source.
export const SURAH_PAGE_RANGE: [number, number][] = PAGE_RANGE;
