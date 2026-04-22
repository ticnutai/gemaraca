"""Upload Bava Kama, Bava Metzia, Bava Batra clean scans to Supabase shas-pdf-pages bucket.

Source:  שס_נקי/סדר נזיקין/{masechet}/{daf}{amud}.pdf
Target:  bucket=shas-pdf-pages  path={Masechet_en}/{daf}{amud}.pdf
         + row in shas_pdf_pages table

Usage:
    python scripts/upload_bavot_shas.py           # כל שלוש המסכתות
    python scripts/upload_bavot_shas.py bk        # בבא קמא בלבד
    python scripts/upload_bavot_shas.py bm        # בבא מציעא בלבד
    python scripts/upload_bavot_shas.py bb        # בבא בתרא בלבד
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

# Write log to file alongside console output
_LOG_FILE = Path(__file__).resolve().parents[1] / "שס_נקי" / "upload_bavot_run.txt"
_log_fh = _LOG_FILE.open("w", encoding="utf-8", buffering=1)


class _TeeStream:
    """Writes to both the original stream and a log file."""
    def __init__(self, original, logfile):
        self._orig = original
        self._log = logfile
    def write(self, data):
        self._orig.write(data)
        self._orig.flush()
        self._log.write(data)
    def flush(self):
        self._orig.flush()
        self._log.flush()
    def __getattr__(self, name):
        return getattr(self._orig, name)


sys.stdout = _TeeStream(sys.__stdout__, _log_fh)
sys.stderr = _TeeStream(sys.__stderr__, _log_fh)

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON_KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ANON_KEY

BUCKET = "shas-pdf-pages"
SEDER = "נזיקין"
SEDER_HEB = "סדר נזיקין"

MASACHTOT = {
    "bk": {
        "name_he": "בבא קמא",
        "name_en": "Bava_Kamma",
        "source_dir": ROOT / "שס_נקי" / SEDER_HEB / "בבא קמא",
    },
    "bm": {
        "name_he": "בבא מציעא",
        "name_en": "Bava_Metzia",
        "source_dir": ROOT / "שס_נקי" / SEDER_HEB / "בבא מציעא",
    },
    "bb": {
        "name_he": "בבא בתרא",
        "name_en": "Bava_Batra",
        "source_dir": ROOT / "שס_נקי" / SEDER_HEB / "בבא בתרא",
    },
}

NAME_RE = re.compile(r"^(\d+)([ab])\.pdf$", re.IGNORECASE)


def list_pages(source_dir: Path) -> list[tuple[Path, int, str]]:
    pages = []
    files = [f for f in source_dir.iterdir() if NAME_RE.match(f.name)]
    for f in sorted(files, key=lambda x: (int(NAME_RE.match(x.name).group(1)), x.name)):
        m = NAME_RE.match(f.name)
        pages.append((f, int(m.group(1)), m.group(2).lower()))
    return pages


def public_url(storage_path: str) -> str:
    return f"{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{storage_path}"


def already_uploaded(storage_path: str) -> bool:
    try:
        r = requests.head(public_url(storage_path), timeout=10)
        return r.status_code == 200 and int(r.headers.get("content-length", "0")) > 0
    except requests.RequestException:
        return False


def upload_pdf(file: Path, storage_path: str) -> bool:
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{storage_path}"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/pdf",
        "x-upsert": "false",
    }
    data = file.read_bytes()
    for attempt in range(1, 4):
        try:
            r = requests.post(url, headers=headers, data=data, timeout=120)
            if r.status_code in (200, 201):
                return True
            print(f"  ! upload failed {storage_path}: {r.status_code} {r.text[:200]}")
            return False
        except requests.exceptions.Timeout:
            print(f"  ! timeout attempt {attempt}/3 for {storage_path}, retrying...")
    print(f"  ! gave up after 3 attempts: {storage_path}")
    return False


def upsert_row(masechet_en: str, masechet_he: str, daf: int, amud: str,
               storage_path: str, file_size: int) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/shas_pdf_pages"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = {
        "masechet": masechet_en,
        "hebrew_name": masechet_he,
        "seder": SEDER,
        "daf_number": daf,
        "amud": amud,
        "storage_path": storage_path,
        "file_size": file_size,
    }
    r = requests.post(
        url + "?on_conflict=masechet,daf_number,amud",
        headers=headers,
        json=payload,
        timeout=20,
    )
    if r.status_code in (200, 201, 204):
        return True
    print(f"  ! row insert failed {storage_path}: {r.status_code} {r.text[:200]}")
    return False


def upload_masechet(key: str) -> dict:
    info = MASACHTOT[key]
    name_he = info["name_he"]
    name_en = info["name_en"]
    source_dir = info["source_dir"]

    print(f"\n{'='*60}")
    print(f"מסכת {name_he}  ({name_en})")
    print(f"{'='*60}")

    if not source_dir.exists():
        print(f"  ✗ Source dir not found: {source_dir}")
        print(f"    הרץ קודם: python scripts/download_clean_bavot.py {key}")
        return {"uploaded": 0, "skipped": 0, "failed": 1, "rows_ok": 0, "rows_fail": 0}

    pages = list_pages(source_dir)
    if not pages:
        print(f"  ✗ No {'{daf}{amud}.pdf'} files found in {source_dir}")
        return {"uploaded": 0, "skipped": 0, "failed": 1, "rows_ok": 0, "rows_fail": 0}

    print(f"  Found {len(pages)} pages. Uploading to bucket '{BUCKET}'...")
    stats = {"uploaded": 0, "skipped": 0, "failed": 0, "rows_ok": 0, "rows_fail": 0}

    for f, daf, amud in pages:
        storage_path = f"{name_en}/{daf}{amud}.pdf"
        size = f.stat().st_size

        if already_uploaded(storage_path):
            stats["skipped"] += 1
            tag = "SKIP"
        else:
            ok = upload_pdf(f, storage_path)
            if ok:
                stats["uploaded"] += 1
                tag = "UP  "
            else:
                stats["failed"] += 1
                tag = "FAIL"
                continue

        if upsert_row(name_en, name_he, daf, amud, storage_path, size):
            stats["rows_ok"] += 1
        else:
            stats["rows_fail"] += 1

        print(f"  [{tag}] {storage_path}  ({size/1024:.0f} KB)")

    return stats


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]

    if args:
        targets = []
        for a in args:
            if a.lower() in MASACHTOT:
                targets.append(a.lower())
            else:
                print(f"Unknown: {a}. Use bk, bm, bb")
                sys.exit(1)
    else:
        targets = list(MASACHTOT.keys())

    total_stats = {"uploaded": 0, "skipped": 0, "failed": 0, "rows_ok": 0, "rows_fail": 0}

    for key in targets:
        s = upload_masechet(key)
        for k in total_stats:
            total_stats[k] += s[k]

    print(f"\n{'='*60}")
    print("=== סיכום כולל ===")
    for k, v in total_stats.items():
        print(f"  {k}: {v}")
    print(f"{'='*60}")

    return 0 if total_stats["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
