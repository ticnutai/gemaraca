"""
הורדת שלוש מסכתות בבא (קמא, מציעא, בתרא) מ-HebrewBooks.org pagefeed
ושמירה כקובצי PDF נפרדים לכל עמוד בתיקיית שס_נקי/סדר נזיקין/{מסכת}/

Usage:
    python scripts/download_clean_bavot.py           # כל שלוש המסכתות
    python scripts/download_clean_bavot.py bk        # בבא קמא בלבד
    python scripts/download_clean_bavot.py bm        # בבא מציעא בלבד
    python scripts/download_clean_bavot.py bb        # בבא בתרא בלבד
"""
from __future__ import annotations

import json
import os
import sys
import time
from pathlib import Path

try:
    import cloudscraper
except ImportError:
    os.system(f"{sys.executable} -m pip install cloudscraper")
    import cloudscraper

ROOT = Path(__file__).resolve().parents[1]
SHAS_MAP_PATH = ROOT / "shas_mapping.json"
SEDER_DIR = "סדר נזיקין"

BAVOT = {
    "bk": 21,
    "bm": 22,
    "bb": 23,
}


def load_mapping():
    with open(SHAS_MAP_PATH, encoding="utf-8") as f:
        return json.load(f)


def pagefeed_url(book_id: str, page_num: int) -> str:
    return f"https://hebrewbooks.org/pagefeed/hebrewbooks_org_{book_id}_{page_num}.pdf"


def download_page(scraper, url: str, dest: Path, max_retries: int = 5) -> bool:
    for attempt in range(max_retries):
        try:
            r = scraper.get(url, timeout=60)
            if r.status_code == 200 and r.content[:4] == b"%PDF":
                dest.write_bytes(r.content)
                return True
            elif r.status_code == 429:
                wait = 30 * (2 ** attempt)
                print(f"    [429] rate-limited, waiting {wait}s...", flush=True)
                time.sleep(wait)
            elif r.status_code == 404:
                print(f"    [404] not found: {url}")
                return False
            else:
                print(f"    [HTTP {r.status_code}] {url[:60]}")
                if attempt < max_retries - 1:
                    time.sleep(10)
        except Exception as e:
            print(f"    [ERR] {e}")
            if attempt < max_retries - 1:
                time.sleep(15)
    return False


def process_masechet(masechet_id: int, shas_mapping: dict) -> bool:
    info = shas_mapping[str(masechet_id)]
    name = info["name"]
    book_id = info["book_id"]
    dafim = info["dafim"]

    print(f"\n{'='*60}")
    print(f"Masechet {name}  (book_id={book_id}, {len(dafim)} amudim)")
    print(f"{'='*60}")

    out_dir = ROOT / "שס_נקי" / SEDER_DIR / name
    out_dir.mkdir(parents=True, exist_ok=True)

    scraper = cloudscraper.create_scraper()
    mapping = []
    failed = []
    downloaded = 0
    skipped = 0

    for i, daf_code in enumerate(dafim):
        page_num = i + 1

        if daf_code.endswith("b"):
            daf_num = int(daf_code[:-1])
            amud = "b"
        else:
            daf_num = int(daf_code)
            amud = "a"

        filename = f"{daf_num}{amud}.pdf"
        dest = out_dir / filename

        # Skip if already downloaded and valid
        if dest.exists() and dest.stat().st_size > 1000:
            skipped += 1
        else:
            url = pagefeed_url(book_id, page_num)
            ok = download_page(scraper, url, dest)
            if ok:
                downloaded += 1
                time.sleep(0.3)
            else:
                failed.append(filename)
                print(f"  FAIL: page {page_num} ({filename})")

        mapping.append({
            "page": page_num,
            "daf": daf_num,
            "amud": amud,
            "file_sefaria": filename,
        })

        if (i + 1) % 25 == 0 or (i + 1) == len(dafim):
            pct = (i + 1) / len(dafim) * 100
            print(
                f"  [{i+1}/{len(dafim)}] {pct:.0f}%"
                f"  UP={downloaded} SKIP={skipped} FAIL={len(failed)}",
                flush=True,
            )

    # Save page_mapping.json
    map_path = out_dir / "page_mapping.json"
    with open(map_path, "w", encoding="utf-8") as fh:
        json.dump(mapping, fh, ensure_ascii=False, indent=2)
    print(f"\n  page_mapping.json saved ({len(mapping)} entries)")

    if failed:
        print(f"  FAILED pages ({len(failed)}): {failed[:10]}{'...' if len(failed)>10 else ''}")
    else:
        print(f"  All {len(dafim)} pages OK")

    return len(failed) == 0


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    shas_mapping = load_mapping()

    if args:
        targets = []
        for a in args:
            if a.lower() in BAVOT:
                targets.append(BAVOT[a.lower()])
            else:
                print(f"Unknown: {a}. Use bk, bm, bb")
                sys.exit(1)
    else:
        targets = list(BAVOT.values())

    success = 0
    for mid in targets:
        ok = process_masechet(mid, shas_mapping)
        if ok:
            success += 1

    print(f"\n{'='*60}")
    print(f"Done: {success}/{len(targets)} masachtot completed")
    if success == len(targets):
        print("Next step: python scripts/upload_bavot_shas.py")
    print(f"{'='*60}")
    return 0 if success == len(targets) else 1


if __name__ == "__main__":
    raise SystemExit(main())