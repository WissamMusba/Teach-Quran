# Kimi K3 GOAL Prompt — QuranMasterApp Optimization

---

## GOAL

Transform my QuranMasterApp (React Native) to match quran.com's design and performance. Optimize all code for maximum speed, remove unnecessary code, and make the app responsive across all device sizes.

---

## PRIMARY OBJECTIVES

### 1. PERFORMANCE
- First launch: < 10 seconds (downloads data in background)
- Subsequent launches: < 1 second (cached in SQLite)
- Opening ANY surah: INSTANT (no loading spinner)
- Add SQLite indexes for fast queries
- Use React.memo() on all components
- Remove unnecessary Redux state

### 2. DESIGN (Match quran.com)
- Dark theme: #121212 background, #00d4aa teal accents
- Clean verse numbers in circle badges (32x32, white text, bold)
- Remove gray border lines between verses (use spacing instead)
- Remove "Page X (Verses X-X)" text from bottom
- SVG icons only (no emojis)
- Responsive font sizes that auto-adjust to screen

### 3. RESPONSIVE DESIGN
- Page swipe mode: Font size auto-scales (18px small phone → 34px tablet)
- All UI elements scale properly on phones and tablets
- Touch targets minimum 44x44px

### 4. AUDIO FEATURES (New)
- Add audio player bar at bottom of reading view
- Add qari selector modal with list of reciters
- Support gapped and gapless playback

### 5. SETTINGS PAGE
- Night mode toggle
- Text brightness slider (0-255)
- Background brightness slider (0-255)
- Translation text size slider
- Reading preferences (page info, marker popups)
- Download options (streaming, audio manager)
- Advanced options (import/export)

---

## CONSTRAINTS

- Keep React Native 0.72.0
- Keep Firebase backend
- Keep SQLite database
- Keep Redux Toolkit
- Must work on Android
- Support devices with 3GB+ RAM

---

## SUCCESS CRITERIA

The app is complete when:
1. First launch downloads data in background (< 10 seconds)
2. Subsequent launches are instant (< 1 second)
3. Opening ANY surah is instant (no loading spinner)
4. Verse numbers are clearly visible in circle badges
5. No "Page X" text at bottom of reading view
6. Font size auto-adjusts to device screen (responsive)
7. Audio player works with qari selection
8. Settings page matches quran.com style
9. Works on phones AND tablets
10. Code is clean with no unnecessary lines
