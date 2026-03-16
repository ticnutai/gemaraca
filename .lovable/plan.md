

## תוכנית: שדרוג מערכת הורדת פסקי דין — מהירות, פורמטים, והמשכיות

### מצב נוכחי
- הורדה מקבילית של 3 פריטים בלבד, רק בפורמט HTML ב-ZIP
- אין בחירת פורמט (PDF/Word/HTML)
- המשכיות (resume) חלקית — שומר completedIds אבל לא את התוכן שכבר הורד
- אין הורדת קבצי PDF מקוריים מה-Storage

### שינויים מתוכננים

#### 1. הגדלת מקביליות ומהירות (`useDownloadController.ts`)
- הגדלת concurrency מ-3 ל-6
- הקטנת throttle מכל 50 פריטים ל-100
- הקטנת timeout per-item מ-30s ל-20s
- retry מהיר יותר: `[500, 1500, 3000]`

#### 2. בחירת פורמט הורדה (`DownloadManagerTab.tsx`)
- הוספת בורר פורמט: HTML / PDF / DOCX
- PDF: אם יש `source_url` בטבלה (קובץ מקורי ב-Storage) — מוריד אותו ישירות; אחרת יוצר HTML
- DOCX: ייצור HTML עם סיומת `.doc` (נפתח ב-Word) עם עיצוב RTL מתאים
- 3 כפתורי הורדה נפרדים או בורר Select לפורמט

#### 3. שמירת התקדמות מלאה לresume (`downloadStore.ts`)
- שמירת `completedIds` + `format` ב-persist כדי שאחרי רענון אפשר להמשיך
- כשמתחילים הורדה — בודקים אם יש session קודם עם אותם פריטים ואותו פורמט, ממשיכים מאותו מקום
- הוספת כפתור "המשך הורדה" ב-GlobalDownloadProgress כשיש session עצור

#### 4. הורדת PDF מקורי מ-Storage (`useDownloadController.ts`)
- פונקציה `fetchPsakPdf` שמושכת את `source_url` מהטבלה
- אם הקובץ קיים ב-bucket `psakei-din-files` — מוריד את ה-blob ישירות
- אם אין קובץ מקורי — fallback ל-HTML

#### 5. עדכון UI (`DownloadManagerTab.tsx`)
- בורר פורמט לפני כפתור ההורדה: `Select` עם אופציות HTML/PDF/Word
- הצגת אייקון פורמט ליד כפתור ההורדה
- הצגת מהירות הורדה (items/sec) בפס ההתקדמות

### קבצים שישתנו
- `src/hooks/useDownloadController.ts` — מקביליות, פורמטים, resume, fetch PDF
- `src/stores/downloadStore.ts` — הוספת `format` ל-persist, שמירת session לresume
- `src/components/DownloadManagerTab.tsx` — בורר פורמט, UI updates
- `src/components/GlobalDownloadProgress.tsx` — כפתור המשך, מהירות

