#!/usr/bin/env python3
"""
הורדת ש"ס שלם מ-HebrewBooks.org - עמוד אחרי עמוד
מבנה: שס/{סדר}/{מסכת}/דף_X_עמוד_א.pdf

Usage:
    python download_shas_pages.py                    # הורדה מלאה
    python download_shas_pages.py --dry-run           # רק הדפסה בלי הורדה
    python download_shas_pages.py --masechet 1        # רק מסכת ברכות
    python download_shas_pages.py --masechet 1-5      # מסכתות 1 עד 5
    python download_shas_pages.py --verify-only       # בדיקת קבצים קיימים
    python download_shas_pages.py --delay 0.5         # השהייה בין הורדות (שניות)
    python download_shas_pages.py --output-dir שס     # תיקיית יעד
"""

import cloudscraper
import json
import os
import sys
import time
import argparse
from pathlib import Path

# =====================================================================
# מיפוי הסדרים
# =====================================================================
SEDARIM = {
    'סדר זרעים': [1],
    'סדר מועד': [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
    'סדר נשים': [14, 15, 16, 17, 18, 19, 20],
    'סדר נזיקין': [21, 22, 23, 24, 25, 26, 27, 28],
    'סדר קדשים': [29, 30, 31, 32, 33, 34, 35, 36],
    'סדר טהרות': [37],
}

# מיפוי מספר מסכת -> שם הסדר
MASECHET_TO_SEDER = {}
for seder_name, masechet_ids in SEDARIM.items():
    for mid in masechet_ids:
        MASECHET_TO_SEDER[mid] = seder_name

# =====================================================================
# המרת מספר לאותיות עבריות (גימטריה)
# =====================================================================
def num_to_hebrew(n):
    """המרת מספר (2-200) לאותיות עבריות"""
    ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט']
    tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ']
    hundreds = ['', 'ק', 'ר']
    
    if n == 15:
        return 'טו'
    if n == 16:
        return 'טז'
    
    result = ''
    if n >= 100:
        result += hundreds[n // 100]
        n %= 100
    if n >= 10:
        result += tens[n // 10]
        n %= 10
    if n > 0:
        result += ones[n]
    
    return result

def daf_code_to_name(daf_code):
    """
    המרת קוד דף לשם קובץ עברי
    "2" -> "דף_ב_עמוד_א"
    "2b" -> "דף_ב_עמוד_ב"
    "64" -> "דף_סד_עמוד_א"
    """
    if daf_code.endswith('b'):
        daf_num = int(daf_code[:-1])
        amud = 'ב'
    else:
        daf_num = int(daf_code)
        amud = 'א'
    
    hebrew_daf = num_to_hebrew(daf_num)
    return f'דף_{hebrew_daf}_עמוד_{amud}'


# =====================================================================
# מחלקת ההורדה
# =====================================================================
class ShasDownloader:
    def __init__(self, output_dir='שס', delay=0.3, dry_run=False):
        self.output_dir = Path(output_dir)
        self.delay = delay
        self.dry_run = dry_run
        self.scraper = cloudscraper.create_scraper()
        self.stats = {
            'downloaded': 0,
            'skipped': 0,
            'errors': 0,
            'total_bytes': 0,
        }
        
        # טעינת מיפוי
        mapping_path = Path(__file__).parent / 'shas_mapping.json'
        with open(mapping_path, 'r', encoding='utf-8') as f:
            self.mapping = json.load(f)
    
    def get_pdf_url(self, book_id, page_num):
        """URL להורדת עמוד בודד"""
        return f'https://hebrewbooks.org/pagefeed/hebrewbooks_org_{book_id}_{page_num}.pdf'
    
    def download_page(self, url, filepath):
        """הורדת עמוד בודד עם retry על 429"""
        if filepath.exists() and filepath.stat().st_size > 1000:
            self.stats['skipped'] += 1
            return True
        
        if self.dry_run:
            print(f'  [DRY-RUN] {filepath.name}')
            return True
        
        max_retries = 8
        for attempt in range(max_retries):
            try:
                r = self.scraper.get(url, timeout=30)
                if r.status_code == 200 and len(r.content) > 500:
                    filepath.parent.mkdir(parents=True, exist_ok=True)
                    filepath.write_bytes(r.content)
                    self.stats['downloaded'] += 1
                    self.stats['total_bytes'] += len(r.content)
                    return True
                elif r.status_code == 429:
                    wait = min(30 * (2 ** attempt), 300)  # 30, 60, 120, 240, 300, 300...
                    print(f'  [429] Rate limited (attempt {attempt+1}/{max_retries}), waiting {wait}s...', flush=True)
                    time.sleep(wait)
                    # Recreate scraper after long waits to get fresh session
                    if attempt >= 2:
                        self.scraper = cloudscraper.create_scraper()
                    continue
                else:
                    print(f'  [ERROR] {filepath.name}: status={r.status_code}, size={len(r.content)}', flush=True)
                    self.stats['errors'] += 1
                    return False
            except Exception as e:
                if attempt < max_retries - 1:
                    wait = min(30 * (2 ** attempt), 300)
                    print(f'  [RETRY] {filepath.name}: {e}, waiting {wait}s...', flush=True)
                    time.sleep(wait)
                    continue
                print(f'  [ERROR] {filepath.name}: {e}', flush=True)
                self.stats['errors'] += 1
                return False
        
        print(f'  [ERROR] {filepath.name}: max retries exceeded (429)', flush=True)
        self.stats['errors'] += 1
        return False
    
    def download_masechet(self, masechet_id):
        """הורדת מסכת שלמה"""
        info = self.mapping[str(masechet_id)]
        name = info['name']
        book_id = info['book_id']
        dafim = info['dafim']
        seder = MASECHET_TO_SEDER[masechet_id]
        
        masechet_dir = self.output_dir / seder / name
        
        print(f'\n{"="*60}')
        print(f'מסכת {name} (book_id={book_id})')
        print(f'סדר: {seder}')
        print(f'עמודים: {len(dafim)}')
        print(f'תיקייה: {masechet_dir}')
        print(f'{"="*60}')
        
        if not self.dry_run:
            masechet_dir.mkdir(parents=True, exist_ok=True)
        
        for page_idx, daf_code in enumerate(dafim):
            page_num = page_idx + 1
            filename = daf_code_to_name(daf_code) + '.pdf'
            filepath = masechet_dir / filename
            url = self.get_pdf_url(book_id, page_num)
            
            if filepath.exists() and filepath.stat().st_size > 1000:
                self.stats['skipped'] += 1
                continue
            
            success = self.download_page(url, filepath)
            
            if success and not self.dry_run:
                # Progress every 10 pages
                if page_num % 10 == 0 or page_num == len(dafim):
                    pct = page_num / len(dafim) * 100
                    print(f'  [{page_num}/{len(dafim)}] {pct:.0f}% - {filename}', flush=True)
            
            if not self.dry_run and self.delay > 0:
                time.sleep(self.delay)
        
        print(f'  ✓ {name} הושלם')
    
    def verify_masechet(self, masechet_id):
        """בדיקת מסכת - ספירת קבצים קיימים"""
        info = self.mapping[str(masechet_id)]
        name = info['name']
        dafim = info['dafim']
        seder = MASECHET_TO_SEDER[masechet_id]
        masechet_dir = self.output_dir / seder / name
        
        existing = 0
        missing = []
        for daf_code in dafim:
            filename = daf_code_to_name(daf_code) + '.pdf'
            filepath = masechet_dir / filename
            if filepath.exists() and filepath.stat().st_size > 1000:
                existing += 1
            else:
                missing.append(filename)
        
        total = len(dafim)
        status = '✓' if existing == total else '✗'
        print(f'  {status} {name:<15} {existing}/{total} עמודים')
        if missing and len(missing) <= 5:
            for m in missing:
                print(f'      חסר: {m}')
        elif missing:
            print(f'      חסרים: {len(missing)} עמודים')
        
        return existing, total
    
    def run(self, masechet_range=None):
        """הרצת הורדה"""
        if masechet_range:
            masechet_ids = masechet_range
        else:
            masechet_ids = list(range(1, 38))
        
        # Summary
        total_pages = sum(len(self.mapping[str(mid)]['dafim']) for mid in masechet_ids)
        print(f'הורדת ש"ס - {len(masechet_ids)} מסכתות, {total_pages} עמודים')
        print(f'תיקיית יעד: {self.output_dir.absolute()}')
        if self.dry_run:
            print('[DRY-RUN MODE]')
        print()
        
        for mid in masechet_ids:
            self.download_masechet(mid)
        
        # Final stats
        print(f'\n{"="*60}')
        print(f'סיכום:')
        print(f'  הורדו:  {self.stats["downloaded"]} עמודים')
        print(f'  דולגו:  {self.stats["skipped"]} (כבר קיימים)')
        print(f'  שגיאות: {self.stats["errors"]}')
        if self.stats['total_bytes'] > 0:
            mb = self.stats['total_bytes'] / (1024*1024)
            print(f'  גודל:   {mb:.1f} MB')
        print(f'{"="*60}')
    
    def verify(self, masechet_range=None):
        """בדיקת כל המסכתות"""
        if masechet_range:
            masechet_ids = masechet_range
        else:
            masechet_ids = list(range(1, 38))
        
        total_existing = 0
        total_expected = 0
        
        current_seder = ''
        for mid in masechet_ids:
            seder = MASECHET_TO_SEDER[mid]
            if seder != current_seder:
                print(f'\n{seder}:')
                current_seder = seder
            
            existing, total = self.verify_masechet(mid)
            total_existing += existing
            total_expected += total
        
        print(f'\nסה"כ: {total_existing}/{total_expected} עמודים')
        pct = total_existing / total_expected * 100 if total_expected > 0 else 0
        print(f'השלמה: {pct:.1f}%')


def parse_masechet_range(s):
    """פענוח טווח מסכתות: "1", "1-5", "1,3,5" """
    result = []
    for part in s.split(','):
        if '-' in part:
            start, end = part.split('-')
            result.extend(range(int(start), int(end) + 1))
        else:
            result.append(int(part))
    return result


def main():
    parser = argparse.ArgumentParser(description='הורדת ש"ס מ-HebrewBooks.org')
    parser.add_argument('--output-dir', default='שס', help='תיקיית יעד')
    parser.add_argument('--delay', type=float, default=1.5, help='השהייה בין הורדות (שניות)')
    parser.add_argument('--dry-run', action='store_true', help='רק הדפסה בלי הורדה')
    parser.add_argument('--masechet', type=str, help='מספר מסכת (1-37) או טווח (1-5)')
    parser.add_argument('--verify-only', action='store_true', help='בדיקת קבצים קיימים')
    parser.add_argument('--list', action='store_true', help='רשימת מסכתות')
    
    args = parser.parse_args()
    
    downloader = ShasDownloader(
        output_dir=args.output_dir,
        delay=args.delay,
        dry_run=args.dry_run,
    )
    
    # רשימת מסכתות
    if args.list:
        for seder_name, masechet_ids in SEDARIM.items():
            print(f'\n{seder_name}:')
            for mid in masechet_ids:
                info = downloader.mapping[str(mid)]
                print(f'  {mid:2d}. {info["name"]:<15} ({info["total_amudim"]} עמודים)')
        total = sum(int(v['total_amudim']) for v in downloader.mapping.values())
        print(f'\nסה"כ: {total} עמודים ב-37 מסכתות')
        return
    
    masechet_range = None
    if args.masechet:
        masechet_range = parse_masechet_range(args.masechet)
    
    if args.verify_only:
        downloader.verify(masechet_range)
    else:
        downloader.run(masechet_range)


if __name__ == '__main__':
    main()
