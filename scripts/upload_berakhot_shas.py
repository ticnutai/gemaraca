"""Upload organized Berakhot scans to Supabase shas-pdf-pages bucket.

Source:  שס_נקי/סדר זרעים/ברכות/{daf}{amud}.pdf  (e.g. 2a.pdf .. 64a.pdf)
Target:  bucket=shas-pdf-pages  path=Berakhot/{daf}{amud}.pdf
         + row in shas_pdf_pages table (masechet=Berakhot, hebrew_name=ברכות, seder=זרעים)

Behavior: skip files already present in the bucket (HEAD 200).
Run:      python scripts/upload_berakhot_shas.py
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv  # type: ignore

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ["VITE_SUPABASE_URL"].rstrip("/")
ANON_KEY = os.environ["VITE_SUPABASE_PUBLISHABLE_KEY"]
SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ANON_KEY

BUCKET = "shas-pdf-pages"
MASECHET = "Berakhot"
HEBREW_NAME = "ברכות"
SEDER = "זרעים"
SOURCE_DIR = ROOT / "שס_נקי" / "סדר זרעים" / "ברכות"

NAME_RE = re.compile(r"^(\d+)([ab])\.pdf$", re.IGNORECASE)


def list_source_pages() -> list[tuple[Path, int, str]]:
    pages: list[tuple[Path, int, str]] = []
    for f in sorted(SOURCE_DIR.iterdir()):
        m = NAME_RE.match(f.name)
        if not m:
            continue
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
    with file.open("rb") as fh:
        r = requests.post(url, headers=headers, data=fh.read(), timeout=60)
    if r.status_code in (200, 201):
        return True
    print(f"  ! upload failed {storage_path}: {r.status_code} {r.text[:200]}")
    return False


def upsert_row(daf: int, amud: str, storage_path: str, file_size: int) -> bool:
    url = f"{SUPABASE_URL}/rest/v1/shas_pdf_pages"
    headers = {
        "Authorization": f"Bearer {SERVICE_KEY}",
        "apikey": SERVICE_KEY,
        "Content-Type": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal",
    }
    payload = {
        "masechet": MASECHET,
        "hebrew_name": HEBREW_NAME,
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


def main() -> int:
    if not SOURCE_DIR.exists():
        print(f"Source folder not found: {SOURCE_DIR}", file=sys.stderr)
        return 2

    pages = list_source_pages()
    if not pages:
        print("No matching {daf}{amud}.pdf files found.", file=sys.stderr)
        return 2

    print(f"Found {len(pages)} files. Uploading to bucket '{BUCKET}'...")
    uploaded = skipped = failed = rows_ok = rows_fail = 0

    for f, daf, amud in pages:
        storage_path = f"{MASECHET}/{daf}{amud}.pdf"
        size = f.stat().st_size
        if already_uploaded(storage_path):
            skipped += 1
            tag = "SKIP"
        else:
            ok = upload_pdf(f, storage_path)
            if ok:
                uploaded += 1
                tag = "UP  "
            else:
                failed += 1
                tag = "FAIL"
                continue

        if upsert_row(daf, amud, storage_path, size):
            rows_ok += 1
        else:
            rows_fail += 1
        print(f"  [{tag}] {storage_path}  ({size/1024:.0f} KB)")

    print("\n=== Summary ===")
    print(f"  uploaded:  {uploaded}")
    print(f"  skipped:   {skipped}")
    print(f"  failed:    {failed}")
    print(f"  rows ok:   {rows_ok}")
    print(f"  rows fail: {rows_fail}")
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
