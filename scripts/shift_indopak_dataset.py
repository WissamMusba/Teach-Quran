"""
shift_indopak_dataset.py

Standardizes the Indopak mushaf dataset so that all Indopak pages are natural
1-to-1 page numbers without artificial '+ 1' hacks across the app.

1. Shifts every page number in src/assets/data/indopak_verse_pages.json by +1.
2. Shifts pageNumber and JSON 'page' property in android/app/src/main/assets/www/indopak_pages.db by +1.
"""

import json
import os
import sqlite3
import sys

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VERSE_PAGES_JSON = os.path.join(BASE_DIR, 'src', 'assets', 'data', 'indopak_verse_pages.json')
INDOPAK_DB = os.path.join(BASE_DIR, 'android', 'app', 'src', 'main', 'assets', 'www', 'indopak_pages.db')

def shift_verse_pages_json():
    print(f"[1/2] Updating {VERSE_PAGES_JSON}...")
    with open(VERSE_PAGES_JSON, 'r', encoding='utf-8') as f:
        data = json.load(f)

    min_p_before = min(data.values())
    max_p_before = max(data.values())
    print(f"  Before shift: {len(data)} entries, min page = {min_p_before}, max page = {max_p_before}")

    shifted_data = {}
    for k, v in data.items():
        shifted_data[k] = v + 1

    min_p_after = min(shifted_data.values())
    max_p_after = max(shifted_data.values())
    print(f"  After shift:  {len(shifted_data)} entries, min page = {min_p_after}, max page = {max_p_after}")

    with open(VERSE_PAGES_JSON, 'w', encoding='utf-8') as f:
        json.dump(shifted_data, f)
    print(f"  Successfully wrote shifted JSON to {VERSE_PAGES_JSON}")

def shift_indopak_db():
    print(f"[2/2] Updating {INDOPAK_DB}...")
    if not os.path.exists(INDOPAK_DB):
        print(f"  Error: {INDOPAK_DB} not found!")
        sys.exit(1)

    conn = sqlite3.connect(INDOPAK_DB)
    cur = conn.cursor()

    cur.execute("SELECT MIN(pageNumber), MAX(pageNumber), COUNT(*) FROM indopak_pages")
    min_p, max_p, count = cur.fetchone()
    print(f"  Before shift: {count} rows, min pageNumber = {min_p}, max pageNumber = {max_p}")

    cur.execute("SELECT pageNumber, data FROM indopak_pages ORDER BY pageNumber DESC")
    rows = cur.fetchall()

    for old_page, data_str in rows:
        new_page = old_page + 1
        parsed = json.loads(data_str)
        if isinstance(parsed, dict) and 'page' in parsed:
            parsed['page'] = new_page
        new_data_str = json.dumps(parsed, ensure_ascii=False)
        cur.execute(
            "UPDATE indopak_pages SET pageNumber = ?, data = ? WHERE pageNumber = ?",
            (new_page, new_data_str, old_page)
        )

    conn.commit()

    cur.execute("SELECT MIN(pageNumber), MAX(pageNumber), COUNT(*) FROM indopak_pages")
    min_p_after, max_p_after, count_after = cur.fetchone()
    print(f"  After shift:  {count_after} rows, min pageNumber = {min_p_after}, max pageNumber = {max_p_after}")

    # Check sample row 2 (formerly row 1)
    cur.execute("SELECT pageNumber, data FROM indopak_pages WHERE pageNumber = 2")
    sample = cur.fetchone()
    if sample:
        sample_page = sample[0]
        sample_data = json.loads(sample[1])
        print(f"  Verification: Row pageNumber={sample_page}, JSON data['page']={sample_data.get('page')}")

    # Run vacuum and close
    conn.execute("VACUUM")
    conn.close()
    print(f"  Successfully updated and vacuumed SQLite DB {INDOPAK_DB}")

if __name__ == '__main__':
    shift_verse_pages_json()
    shift_indopak_db()
    print("Done standardizing Indopak dataset!")
