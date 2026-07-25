import { useState, useCallback, useRef, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { setSurah, setFlashingVerse } from '../store/quranSlice';
import { setStudentData } from '../store/studentSlice';
import { addPendingChange } from '../store/syncSlice';
import { getVersesBySurahPaginated, getVersesByPage } from '../database/quranData';
import { getStudentData, saveStudentData, addToSyncQueue } from '../database/localDB';
import type { Verse, StudentData } from '../utils/types';
const EMPTY_DATA: StudentData = { bookmarks: {}, highlights: {}, drawings: {}, notes: {}, lastRead: null };
export function useQuranData(currentSurahId: number) {
  const dispatch = useDispatch();
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [pageVersesCache, setPageVersesCache] = useState<Record<number, Verse[]>>({});
  const pagePromiseRef = useRef<Record<number, boolean>>({});
  const surahIdRef = useRef(currentSurahId);
  const versesRef = useRef<Verse[]>([]);
  const pageRef = useRef(1);
  const verses = useSelector((s: any) => s.quran.verses) as Verse[];
  const currentStudent = useSelector((s: any) => s.student.currentStudent);
  const studentData = useSelector((s: any) => s.student.studentData) as StudentData | null;
  useEffect(() => { surahIdRef.current = currentSurahId; }, [currentSurahId]);
  useEffect(() => { versesRef.current = verses; }, [verses]);
  useEffect(() => { pageRef.current = page; }, [page]);
  const ensurePageLoaded = useCallback((pageNum: number) => {
    if (pageNum < 1 || pageNum > 604) return;
    if (pageVersesCache[pageNum] || pagePromiseRef.current[pageNum]) return;
    pagePromiseRef.current[pageNum] = true;
    getVersesByPage(pageNum)
      .then(vers => setPageVersesCache(prev => ({ ...prev, [pageNum]: vers })))
      .catch(() => {})
      .finally(() => { delete pagePromiseRef.current[pageNum]; });
  }, [pageVersesCache]);
  const loadSurah = useCallback(async (surahId: number, reset = true) => {
    try {
      const cur = reset ? 1 : pageRef.current;
      const { verses: nv, total } = await getVersesBySurahPaginated(surahId, cur, 20);
      if (surahId !== surahIdRef.current) return;
      const acc = reset ? nv.length : versesRef.current.length + nv.length;
      dispatch(setSurah({ surahId, verses: reset ? nv : [...versesRef.current, ...nv] }));
      setPage(reset ? 2 : cur + 1);
      setHasMore(acc < total);
    } catch (e) { console.warn('loadSurah failed', e); }
  }, [dispatch]);
  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || versesRef.current.length === 0) return;
    setLoadingMore(true); await loadSurah(currentSurahId, false); setLoadingMore(false);
  }, [loadingMore, hasMore, currentSurahId, loadSurah]);
  const updateData = useCallback(async (newData: StudentData) => {
    const data: StudentData = { ...newData, updatedAt: new Date().toISOString() };
    dispatch(setStudentData(data));
    if (currentStudent?.id) {
      try { await saveStudentData(currentStudent.id, data); await addToSyncQueue(currentStudent.id, data); dispatch(addPendingChange()); }
      catch (e) { console.warn('updateData persist failed', e); }
    }
  }, [currentStudent, dispatch]);
  const loadStudentData = useCallback(async () => {
    if (!currentStudent?.id) return;
    try { const d = await getStudentData(currentStudent.id); const data = d || EMPTY_DATA; dispatch(setStudentData(data)); if (!d) await saveStudentData(currentStudent.id, data); }
    catch (e) { console.warn('loadStudentData failed', e); }
  }, [currentStudent, dispatch]);
  const flashVerse = useCallback((v: number) => { dispatch(setFlashingVerse(v)); setTimeout(() => dispatch(setFlashingVerse(null)), 2000); }, [dispatch]);
  return { page, hasMore, loadingMore, pageVersesCache, verses, studentData, currentStudent, ensurePageLoaded, loadSurah, loadMore, updateData, loadStudentData, flashVerse };
}
