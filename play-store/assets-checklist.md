# Assets Checklist — required graphics

Everything below must be uploaded in the Play Console (Main store listing).

## 1. App icon (required)
- **Size:** 512 × 512 px
- **Format:** PNG (no alpha on the outer edge; the app icon is masked into a rounded square)
- **Source:** the app's existing launcher icon
  (`android/app/src/main/res/mipmap-*/ic_launcher*` — export/redraw at 512×512)
- Avoid text in the icon (it gets scaled down and unreadable).

## 2. Feature graphic (required)
- **Size:** 1024 × 500 px
- **Format:** PNG or JPG (no alpha — JPG is fine)
- **Safe area:** keep important content within the center 66% (the 500px height is cropped
  by ~35px top and bottom on some surfaces; corners are rounded on the phone)
- Suggested: teal/gold mushaf-style background (#00d4aa / #0a8f73) with the app name
  "Teach Quran" centered, in a clean font.

## 3. Screenshots (required — phone, minimum 2; up to 8)
- **Phone:** 16:9 or 9:16 aspect. Recommended list:
  1. Mushaf page view (page mode)
  2. Student hub / student list dashboard
  3. Continuous reading mode
  4. Verse long-press menu
  5. Drawings/annotations on a page
  6. Bookmarks/notes list
- **Tablet (7" and 10")** — 2 each are recommended:
  - Mushaf page on tablet
  - Split-page (spread) view on tablet

## 4. Optional
- Video preview: 30 s – 2 min screen recording, landscape or portrait, up to 60 FPS.
- Store logo / horizontal branding images (only if you want branding in search results).

## How to capture screenshots on your device
1. Build & install the release APK (`TeachQuran-v62.apk` in the repo root).
2. Open the app, sign in, create a student.
3. Android screenshot: press **Power + Volume-down** together (or swipe-up → Screenshot
   button).
4. Pull them off the device (`adb pull /sdcard/Pictures/Screenshots .`) or use a USB file
   transfer, then upload to the Play Console.
