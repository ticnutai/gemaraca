<div dir="rtl">

# 🚨 הבעיה עם Lovable: מחיקת קבצים אוטומטית — וכיצד להתמודד

## תוכן עניינים

- [תיאור הבעיה](#תיאור-הבעיה)
- [למה זה קורה — ההסבר הטכני](#למה-זה-קורה--ההסבר-הטכני)
- [דוגמאות אמיתיות מהפרויקט](#דוגמאות-אמיתיות-מהפרויקט)
- [הפתרון המלא: 5 שכבות הגנה](#הפתרון-המלא-5-שכבות-הגנה)
- [תהליך עבודה בטוח: צעד אחר צעד](#תהליך-עבודה-בטוח-צעד-אחר-צעד)
- [פקודות חירום: שחזור קבצים שנמחקו](#פקודות-חירום-שחזור-קבצים-שנמחקו)
- [מבנה ה-Remotes](#מבנה-ה-remotes)
- [טבלת סיכום: מה מותר ומה אסור](#טבלת-סיכום-מה-מותר-ומה-אסור)
- [בדיקת תקינות: סקריפט ביקורת](#בדיקת-תקינות-סקריפט-ביקורת)

---

## תיאור הבעיה

### מה קורה?

**Lovable מוחק קבצים מ-GitHub בכל פעם שהוא מבצע commit.**

כשאתה עובד על הפרויקט מחוץ ל-Lovable (ב-VS Code, או ב-GitHub ישירות) ומוסיף קבצים חדשים — Lovable לא יודע עליהם. בפעולה הבאה של Lovable, הוא דוחף את ה-sandbox הפנימי שלו ל-GitHub, וכל מה שלא קיים ב-sandbox — נמחק.

### מה בדיוק נפגע?

- **סקריפטים** שנוספו ב-VS Code (כמו `scripts/import-psakim-to-db.mjs`)
- **קבצי HTML סטטיים** (כמו 2,166 קבצים בתיקיית `all-psakim/`)
- **שינויים ב-src/** שנעשו ידנית (כמו הוספת badges ב-`PsakDinTab.tsx`)
- **מיגרציות SQL** שנוצרו ידנית
- **קבצי קונפיגורציה** שעודכנו (`.gitignore`, `vercel.json`)

### מה לא נפגע?

- קבצים שנוצרו **דרך הצ'אט של Lovable** — אלה נשמרים ב-sandbox שלו
- **Supabase Database** — הדאטא עצמו לא קשור ל-git, הוא בענן

---

## למה זה קורה — ההסבר הטכני

### ארכיטקטורת Lovable

```
┌─────────────────────────────────────────────────────┐
│                   Lovable Cloud                       │
│  ┌──────────────┐                                     │
│  │   Sandbox    │  ← כאן Lovable שומר את כל הקוד     │
│  │  (פנימי)     │     שהוא מכיר                       │
│  └──────┬───────┘                                     │
│         │  push (one-way)                             │
│         ▼                                             │
│  ┌──────────────┐                                     │
│  │  GitHub Repo │  ← Lovable דוחף את ה-SANDBOX השלם   │
│  │  (lovable/)  │     = git push --force בעצם         │
│  └──────────────┘                                     │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│                   VS Code / Local                     │
│  ┌──────────────┐                                     │
│  │  Working Dir │  ← כאן אנחנו עובדים                 │
│  └──────┬───────┘                                     │
│         │  push                                       │
│         ▼                                             │
│  ┌──────────────┐                                     │
│  │  GitHub Repo │  ← ה-origin שלנו                    │
│  │  (origin/)   │                                     │
│  └──────────────┘                                     │
└─────────────────────────────────────────────────────┘
```

### הנקודה הקריטית

> **הסנכרון של Lovable הוא חד-כיווני: Lovable → GitHub בלבד.**
>
> שינויים שנדחפו ל-GitHub מ-VS Code **לא חוזרים לתוך ה-sandbox של Lovable**.

### מה קורה בפועל:

1. **אתה** מוסיף `scripts/my-script.mjs` ודוחף ל-GitHub ✅
2. **Lovable** לא יודע על הקובץ הזה (הוא לא ב-sandbox שלו) ❌
3. **Lovable** עושה שינוי כלשהו (למשל, מעדכן כפתור)
4. **Lovable** דוחף את ה-sandbox המלא שלו ל-GitHub
5. **התוצאה**: `scripts/my-script.mjs` נמחק מ-GitHub כי הוא לא היה ב-sandbox 💀

### זה לא באג — זו הארכיטקטורה

Lovable מתנהג כמו `git push --force` של ה-snapshot השלם שלו. כל מה שלא בתמונה שלו — נעלם.

---

## דוגמאות אמיתיות מהפרויקט

### מקרה 1: מחיקת 2,177 קבצי HTML
- **מה נוסף**: תיקיית `all-psakim/` עם 2,166 קבצי HTML של פסקי דין
- **מתי נמחק**: בכל commit של Lovable שאחרי ההוספה
- **הפתרון**: הקבצים נשמרים ב-`.gitignore` + גיבוי מקומי + ייבוא ל-Supabase DB

### מקרה 2: מחיקת סקריפטים
- **מה נוסף**: `scripts/download-all-psakim.mjs`, `scripts/import-psakim-to-db.mjs`
- **הסיכון**: Lovable לא מכיר את תיקיית `scripts/` שנוצרה מקומית
- **הפתרון**: backup לפני כל sync + force push מ-dev חזרה ל-lovable

### מקרה 3: מחיקת שינויים ב-components
- **מה שונה**: הוספת badge של `psakim.org` ב-`PsakDinTab.tsx`
- **הסיכון**: Lovable יחזיר את הגרסה הישנה בלי ה-badge
- **הפתרון**: תמיד לבדוק `git diff` אחרי sync עם Lovable

---

## הפתרון המלא: 5 שכבות הגנה

### שכבה 1: תגית גיבוי לפני כל אינטראקציה עם Lovable

```bash
# לפני כל פעולה של Lovable - תיוג!
git tag backup-before-lovable-v8
git push origin --tags
```

**למה?** אם Lovable מוחק קבצים, אפשר לשחזר מהתגית.

### שכבה 2: גיבוי מלא של תיקיית העבודה

```bash
# יצירת גיבוי מלא (נמצא ב-backups/)
$timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$dest = "backups/full_backup_$timestamp"
robocopy src "$dest/src" /E /XD node_modules
robocopy scripts "$dest/scripts" /E
robocopy supabase "$dest/supabase" /E
```

**הפרויקט שלנו כבר מכיל:**
- `backups/full_backup_2026-03-24_16-48-37/` — 316 קבצים
- `backups/gemaraca-backup-2026-03-18.bundle` — bundle מלא
- `backups/gemaraca-backup-2026-03-22.bundle` — bundle מלא

### שכבה 3: `.gitignore` לקבצים שלא צריכים להיות ב-git

```gitignore
# קבצים מקומיים בלבד — לא מועלים ל-git
# כך Lovable לא יכול למחוק אותם כי הם אף פעם לא היו ב-git

# Temp debug files
tmp-*

# Test output/debug files
*_results.txt
test_*.py

# Static HTML collections (imported to DB separately)
# all-psakim/ — 2,166 files, data is in Supabase DB

# Sample/test psakim
psakim-*/
sample-psakim/
downloaded-psakim/
```

**חשוב**: קבצים ב-`.gitignore` חיים רק מקומית. הם בטוחים מ-Lovable אבל לא מגובים ב-GitHub.

### שכבה 4: Force Push מ-dev חזרה ל-Lovable אחרי כל sync

```bash
# אחרי שלקחנו שינויים מ-Lovable ומיזגנו:
git push lovable dev:main --force
git push lovable dev:master --force
```

**למה `--force`?** כי Lovable's master/main צריכים להיות זהים ל-dev שלנו. אנחנו ה-source of truth.

### שכבה 5: בדיקת מחיקות לפני ואחרי

```bash
# לפני merge מ-Lovable — בדוק מה הוא מוחק:
git fetch lovable
git diff --name-status HEAD lovable/main | Select-String "^D"

# אם יש שורות שמתחילות ב-D — אלה קבצים ש-Lovable רוצה למחוק!
```

---

## תהליך עבודה בטוח: צעד אחר צעד

### 🔄 כשעובדים ב-VS Code (בלי Lovable):

```
1. כתוב קוד ← git add ← git commit ← git push origin dev
2. הכל בסדר, dev מעודכן ב-GitHub ✅
```

### 🔄 כש-Lovable עשה שינויים ורוצים לקחת אותם:

```
שלב 1: גיבוי
─────────────
git tag backup-before-lovable-vN

שלב 2: Fetch
─────────────
git fetch lovable

שלב 3: בדיקת מחיקות
───────────────────
git diff --name-status HEAD lovable/main | Select-String "^D"
# אם יש מחיקות — אל תמזג ישר! →

שלב 4: Merge בזהירות
────────────────────
git merge lovable/main --no-commit
# בדוק git status — האם נמחקו קבצים?
# אם כן:
git checkout HEAD -- path/to/deleted/file
# רק אז:
git commit

שלב 5: Push בחזרה
─────────────────
git push origin dev
git push lovable dev:main --force
git push lovable dev:master --force
```

### 🔄 כשרוצים ש-Lovable יכיר קבצים חדשים:

```
אין דרך ישירה! הפתרון:
─────────────────────
1. פתח את הצ'אט של Lovable
2. בקש ממנו ליצור את הקובץ (העתק-הדבק את התוכן)
3. רק כך הקובץ נכנס ל-sandbox שלו
4. מהרגע הזה — Lovable יכיר את הקובץ ולא ימחק אותו
```

---

## פקודות חירום: שחזור קבצים שנמחקו

### שחזור מתגית גיבוי:

```bash
# ראה את כל התגיות:
git tag -l "backup-*"

# שחזר קובץ ספציפי:
git checkout backup-before-lovable-v7 -- scripts/import-psakim-to-db.mjs

# שחזר תיקייה שלמה:
git checkout backup-before-lovable-v7 -- scripts/
```

### שחזור מ-commit ספציפי:

```bash
# מצא את ה-commit שבו הקובץ היה קיים:
git log --all --oneline -- scripts/import-psakim-to-db.mjs

# שחזר ממנו:
git checkout ea45192 -- scripts/import-psakim-to-db.mjs
```

### שחזור מגיבוי מקומי (bundle):

```bash
# שחזר bundle לתוך repo זמני:
git clone backups/gemaraca-backup-2026-03-22.bundle temp-restore
# העתק משם את מה שצריך
```

### שחזור מלא (nuclear option – מחזיר הכול):

```bash
# ⚠️ זהירות — מחזיר את HEAD לתגית הגיבוי
git reset --hard backup-before-lovable-v7
git push origin dev --force
```

---

## מבנה ה-Remotes

```
Remote          Repository                              תפקיד
──────          ──────────                              ──────
origin          ticnutai/gemaraca-f1e59e63.git          ה-repo הראשי שלנו
lovable         ticnutai/gemaraca-463c22f4.git          ה-repo של Lovable

Branch          מיקום                                   תפקיד
──────          ──────                                  ──────
dev             origin                                  הענף הראשי שבו אנחנו עובדים
main            lovable                                 הענף שממנו Lovable קורא
master          lovable                                 גם הענף הזה (Lovable משתמש בשניהם)
```

### מה זה ה-Sandbox?

ה-Sandbox של Lovable הוא **שרת ענן פנימי** שמריץ את הפרויקט. כשאתה מדבר עם Lovable בצ'אט:
- הוא עורך קבצים ב-sandbox
- מקמפל ומראה preview
- ובסוף — דוחף את כל ה-sandbox ל-GitHub

ה-sandbox **לא מתעדכן מ-GitHub**. שינויים שדחפת ישירות ל-GitHub לא ייקלטו ב-sandbox.

---

## טבלת סיכום: מה מותר ומה אסור

| פעולה | האם בטוח? | הסבר |
|---:|:---:|---:|
| הוספת קבצים ב-VS Code + push ל-origin | ✅ בטוח | לא משפיע על Lovable |
| עריכת קבצים ב-VS Code + push ל-origin | ✅ בטוח | אבל Lovable יכול לדרוס |
| Lovable עושה commit אחרי שהוספת קבצים ב-VS Code | ⚠️ מסוכן | Lovable ימחק את הקבצים שלך |
| Merge מ-lovable/main בלי בדיקה | ❌ מסוכן | עלול למחוק קבצים |
| Merge מ-lovable/main עם `--no-commit` + בדיקה | ✅ בטוח | אפשר לשחזר מחיקות לפני commit |
| Force push ל-lovable אחרי merge | ✅ חובה | מסנכרן את Lovable עם dev שלנו |
| יצירת קבצים דרך צ'אט Lovable | ✅ בטוח | הקובץ נכנס ל-sandbox ולא יימחק |
| ישירות git pull ב-Lovable | ❌ לא קיים | Lovable לא תומך ב-pull |

---

## בדיקת תקינות: סקריפט ביקורת

הרצה מהירה לבדוק שהכל תקין:

```powershell
# === בדיקת תקינות מלאה ===

Write-Host "=== Git Status ===" -ForegroundColor Cyan
git status --short
if (-not $?) { Write-Host "ERROR: git status failed" -ForegroundColor Red }

Write-Host "`n=== Tracked Files Count ===" -ForegroundColor Cyan
$tracked = (git ls-files | Measure-Object -Line).Lines
Write-Host "$tracked tracked files"

Write-Host "`n=== Deleted Files (tracked but missing) ===" -ForegroundColor Cyan
$deleted = git ls-files --deleted
if ($deleted) {
    Write-Host "WARNING: Missing files:" -ForegroundColor Red
    $deleted
} else {
    Write-Host "All tracked files exist on disk" -ForegroundColor Green
}

Write-Host "`n=== Key Directories ===" -ForegroundColor Cyan
@("src","scripts","supabase","public","e2e","all-psakim","backups") | ForEach-Object {
    if (Test-Path $_) {
        $count = (Get-ChildItem $_ -Recurse -File -ErrorAction SilentlyContinue | Measure-Object).Count
        Write-Host "  $_ : $count files" -ForegroundColor Green
    } else {
        Write-Host "  $_ : MISSING!" -ForegroundColor Red
    }
}

Write-Host "`n=== Latest Commits ===" -ForegroundColor Cyan
git log --oneline -5

Write-Host "`n=== Backup Tags ===" -ForegroundColor Cyan
git tag -l "backup-*"
```

### מספרים שצריכים להיות נכונים (נכון ל-25 מרץ 2026):

| מה | כמות צפויה |
|---:|:---|
| Tracked files | ~2,891 |
| `src/` files | ~216 |
| `all-psakim/` files | ~2,166 |
| `scripts/` files | ~18 |
| `supabase/migrations/` | ~44 |
| `supabase/functions/` | ~22 |
| Backup tags | 7+ (backup-before-lovable-v1 עד v7+) |
| DB records (psakei_din) | ~5,155 |

---

## כלל הזהב

> **🔑 רק הוסף, אל תמחק.**
>
> כשדוחפים ל-Lovable — רק מוסיפים functions וקבצים חדשים.
> לעולם לא מוחקים ולא משנים שמות של קבצים קיימים.
> ואחרי כל אינטראקציה עם Lovable — **בדוק מחיקות!**

---

*מסמך זה נוצר ב-25 מרץ 2026 על סמך ניסיון מצטבר עם הפרויקט gemaraca (גמרא להלכה).*

</div>
