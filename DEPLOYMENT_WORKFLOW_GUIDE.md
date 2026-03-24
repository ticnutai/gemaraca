<div dir="rtl">

# 🏗️ מדריך סדר עבודה: מיגרציות, Edge Functions ודפלוי

## תוכן עניינים

- [עקרון הבסיס](#עקרון-הבסיס)
- [דיאגרמת זרימה ראשית](#דיאגרמת-זרימה-ראשית)
- [שלב 1: מיגרציות DB](#שלב-1-מיגרציות-db)
- [שלב 2: Edge Functions](#שלב-2-edge-functions)
- [שלב 3: Frontend](#שלב-3-frontend)
- [מתי כן אפשר ביחד?](#מתי-כן-אפשר-ביחד)
- [Workflow עם Lovable](#workflow-עם-lovable)
- [טבלת החלטות מהירה](#טבלת-החלטות-מהירה)
- [דוגמאות מהפרויקט](#דוגמאות-מהפרויקט)
- [שגיאות נפוצות](#שגיאות-נפוצות)

---

## עקרון הבסיס

> **אל תבנה קיר לפני היסודות.**
>
> Database קודם → Edge Functions אח"כ → Frontend בסוף

### למה לא ביחד?

| בעיה | הסבר |
|---:|---:|
| **Function ללא טבלה = שגיאה** | אם `extract-references` רץ לפני שטבלת `talmud_references` קיימת — שגיאת 500 |
| **Types לא מעודכנים** | ה-Frontend צריך `types.ts` שמתאר את הטבלה. בלי טבלה — אין Types |
| **דיבאג קשה** | אם שניהם נכשלים, לא ברור אם הבעיה ב-DB או ב-Function |
| **Rollback מסובך** | יותר קל לבטל מיגרציה בנפרד מאשר מיגרציה + Function ביחד |

---

## דיאגרמת זרימה ראשית

```mermaid
flowchart TD
    A["📝 כתיבת SQL מיגרציה<br/>(VS Code)"] --> B["🗄️ הרצת מיגרציה על DB<br/>(Lovable Chat / Supabase Dashboard)"]
    B --> C{"✅ טבלה נוצרה<br/>בהצלחה?"}
    C -->|לא| A
    C -->|כן| D["⚙️ כתיבת Edge Function<br/>(VS Code)"]
    D --> E["☁️ דפלוי Function<br/>(Lovable Chat / supabase deploy)"]
    E --> F{"✅ Function<br/>עובד?"}
    F -->|לא| D
    F -->|כן| G["🎨 עדכון Frontend<br/>(types.ts + UI)"]
    G --> H["🚀 Push + Build"]

    style A fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style B fill:#7B68EE,stroke:#5B48CE,color:#fff
    style C fill:#FFD700,stroke:#DAA520,color:#333
    style D fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style E fill:#7B68EE,stroke:#5B48CE,color:#fff
    style F fill:#FFD700,stroke:#DAA520,color:#333
    style G fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style H fill:#50C878,stroke:#3AA85E,color:#fff
```

---

## שלב 1: מיגרציות DB

### מה כולל?

```mermaid
flowchart LR
    subgraph מיגרציה["🗄️ מיגרציית Database"]
        T["CREATE TABLE"] --> I["CREATE INDEX"]
        I --> R["ENABLE RLS"]
        R --> P["CREATE POLICY"]
        P --> TR["CREATE TRIGGER"]
    end

    style מיגרציה fill:#f0f4ff,stroke:#4A90D9
```

### כללים:

- ✅ **כל המיגרציות הקשורות ביחד** — בסדר הנכון (טבלה → אינדקס → RLS)
- ✅ **שימוש ב-`IF NOT EXISTS`** — למניעת כפילויות
- ✅ **בדיקה אחרי הרצה** — וידוא שהטבלה נוצרה דרך REST API

### דוגמה:

```sql
-- מיגרציה: יצירת טבלת psak_sections
CREATE TABLE IF NOT EXISTS public.psak_sections (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    psak_din_id UUID REFERENCES public.psakei_din(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL,
    section_content TEXT,
    section_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- אינדקס
CREATE INDEX IF NOT EXISTS idx_sections_psak
    ON public.psak_sections(psak_din_id);

-- RLS
ALTER TABLE public.psak_sections ENABLE ROW LEVEL SECURITY;

-- מדיניות גישה
CREATE POLICY "Allow read access"
    ON public.psak_sections FOR SELECT
    USING (true);
```

---

## שלב 2: Edge Functions

### תלות ב-DB

```mermaid
flowchart TD
    subgraph DB["🗄️ Database (חייב להיות קודם)"]
        T1["talmud_references"]
        T2["psak_sections"]
        T3["psakei_din"]
    end

    subgraph Functions["⚙️ Edge Functions (אחרי ה-DB)"]
        F1["extract-references"]
        F2["analyze-sections"]
        F3["search-psak-din"]
    end

    T1 -.->|"קורא/כותב"| F1
    T2 -.->|"כותב"| F2
    T3 -.->|"קורא"| F3
    T3 -.->|"קורא"| F2

    style DB fill:#e8f0fe,stroke:#4A90D9
    style Functions fill:#f0e8fe,stroke:#7B68EE
```

### סוגי Edge Functions:

```mermaid
flowchart LR
    subgraph תלוי["🔗 תלוי ב-DB"]
        A1["extract-references<br/>→ talmud_references"]
        A2["upload-psak-din<br/>→ psakei_din + storage"]
        A3["get-gemara-text<br/>→ gemara_pages"]
    end

    subgraph עצמאי["🆓 עצמאי (לא תלוי ב-DB)"]
        B1["beautify-psak-din<br/>→ Gemini API בלבד"]
        B2["summarize-sugya<br/>→ GPT-4o בלבד"]
        B3["search-lexicon<br/>→ Sefaria API בלבד"]
    end

    style תלוי fill:#fff0f0,stroke:#D94A4A
    style עצמאי fill:#f0fff0,stroke:#4AD94A
```

> **Functions עצמאיים** (ללא DB) — אפשר לדפלוי בכל זמן, בלי מיגרציה קודמת.

---

## שלב 3: Frontend

### זרימת העדכון:

```mermaid
flowchart TD
    A["עדכון types.ts<br/>(הוספת הטבלה החדשה)"]
    B["עדכון/יצירת Hook<br/>(useNewFeature.ts)"]
    C["עדכון UI Component<br/>(NewFeatureTab.tsx)"]
    D["הוספה ל-AppSidebar + Index"]
    E["בדיקת TypeScript<br/>(tsc --noEmit)"]
    F["Build + Push"]

    A --> B --> C --> D --> E --> F

    style A fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style E fill:#FFD700,stroke:#DAA520,color:#333
    style F fill:#50C878,stroke:#3AA85E,color:#fff
```

---

## מתי כן אפשר ביחד?

```mermaid
flowchart TD
    Q{"מה אתה בונה?"}
    Q -->|"Function חדש + טבלה חדשה"| S1["❌ DB קודם<br/>Function אח\"כ"]
    Q -->|"Function חדש ללא DB"| S2["✅ Function בלבד"]
    Q -->|"עמודה חדשה + Function צריך אותה"| S3["❌ DB קודם<br/>עדכון Function אח\"כ"]
    Q -->|"שינוי UI בלבד"| S4["✅ Frontend בלבד"]
    Q -->|"כמה מיגרציות קשורות"| S5["✅ כל המיגרציות ביחד"]

    style S1 fill:#ffcccc,stroke:#cc0000
    style S2 fill:#ccffcc,stroke:#00cc00
    style S3 fill:#ffcccc,stroke:#cc0000
    style S4 fill:#ccffcc,stroke:#00cc00
    style S5 fill:#ccffcc,stroke:#00cc00
```

---

## Workflow עם Lovable

### תהליך מלא:

```mermaid
sequenceDiagram
    participant VC as 💻 VS Code
    participant GH as 🐙 GitHub
    participant LV as 💜 Lovable Chat
    participant DB as 🗄️ Supabase DB
    participant CF as ☁️ Edge Functions

    Note over VC: שלב 1: מיגרציות
    VC->>VC: כתיבת SQL מיגרציה
    VC->>LV: "הרץ את ה-SQL הזה על Supabase"
    LV->>DB: הרצת SQL
    DB-->>LV: ✅ טבלה נוצרה
    LV-->>VC: אישור

    Note over VC: שלב 2: Edge Functions
    VC->>VC: כתיבת/עדכון Function
    VC->>LV: "דפלוי את ה-Function הזה"
    LV->>CF: Deploy
    CF-->>LV: ✅ Function פעיל

    Note over VC: שלב 3: Frontend + Push
    VC->>VC: עדכון types.ts + UI
    VC->>GH: git push
    VC->>GH: git push lovable --force
    GH-->>LV: Build אוטומטי
    LV-->>LV: ✅ Preview מעודכן
```

### ⚠️ זכירה חשובה — Lovable Sync חד-כיווני:

```mermaid
flowchart LR
    LV["💜 Lovable Sandbox"]
    GH["🐙 GitHub"]
    VC["💻 VS Code"]

    LV -->|"Push (מוחק קבצים!)"| GH
    GH -.->|"❌ לא מסנכרן חזרה"| LV
    VC -->|"Push"| GH
    VC -->|"Force Push (מגן!)"| GH

    style LV fill:#7B68EE,stroke:#5B48CE,color:#fff
    style GH fill:#333,stroke:#666,color:#fff
    style VC fill:#4A90D9,stroke:#2C5F8A,color:#fff
```

> **אחרי כל פעולה של Lovable:**
> ```powershell
> git fetch lovable
> git push lovable dev:main --force
> git push lovable dev:master --force
> ```

---

## טבלת החלטות מהירה

| מצב | DB? | Function? | Frontend? | סדר |
|---:|:---:|:---:|:---:|---:|
| פיצ'ר חדש עם טבלה | ✅ | ✅ | ✅ | DB → Function → Frontend |
| API wrapper (ללא DB) | ❌ | ✅ | ✅ | Function → Frontend |
| שינוי עיצוב בלבד | ❌ | ❌ | ✅ | Frontend בלבד |
| הוספת אינדקס | ✅ | ❌ | ❌ | DB בלבד |
| עמודה חדשה + API | ✅ | ✅ | ✅ | DB → Function → Frontend |
| תיקון באג ב-Function | ❌ | ✅ | ❌ | Function בלבד |

---

## דוגמאות מהפרויקט

### דוגמה 1: הוספת מערכת הפניות תלמודיות

```mermaid
flowchart TD
    subgraph שלב1["🗄️ שלב 1: מיגרציות DB"]
        M1["CREATE TABLE talmud_references"]
        M2["ADD COLUMN confidence_score"]
        M3["CREATE INDEX idx_refs_source"]
        M1 --> M2 --> M3
    end

    subgraph שלב2["⚙️ שלב 2: Edge Function"]
        F1["extract-references<br/>12 regex patterns<br/>כותב ל-talmud_references"]
    end

    subgraph שלב3["🎨 שלב 3: Frontend"]
        U1["עדכון types.ts"]
        U2["SmartIndexTab.tsx"]
        U1 --> U2
    end

    שלב1 --> שלב2 --> שלב3

    style שלב1 fill:#e8f0fe,stroke:#4A90D9
    style שלב2 fill:#f0e8fe,stroke:#7B68EE
    style שלב3 fill:#e8fee8,stroke:#4AD94A
```

### דוגמה 2: שמירה אוטומטית לגמרא

```mermaid
flowchart TD
    subgraph שלב1["🗄️ מיגרציית DB"]
        M1["CREATE TABLE gemara_edit_snapshots<br/>(user_id, sugya_id, view_mode,<br/>edited_html, text_settings)"]
    end

    subgraph שלב2["🎨 Frontend (ללא Function)"]
        U1["useGemaraAutoSave.ts<br/>(Hook שכותב ישירות ל-DB)"]
        U2["GemaraPage.tsx<br/>(משתמש ב-Hook)"]
        U1 --> U2
    end

    שלב1 --> שלב2

    style שלב1 fill:#e8f0fe,stroke:#4A90D9
    style שלב2 fill:#e8fee8,stroke:#4AD94A
```

> 💡 **שים לב:** לפעמים לא צריך Edge Function! אם הקליינט כותב ישירות לDB דרך Supabase SDK — מספיק מיגרציה + Frontend.

### דוגמה 3: יפוי פסקי דין (ללא DB)

```mermaid
flowchart TD
    subgraph שלב1["⚙️ Edge Function בלבד"]
        F1["beautify-psak-din<br/>שולח טקסט ל-Gemini API<br/>מחזיר HTML מעוצב"]
    end

    subgraph שלב2["🎨 Frontend"]
        U1["כפתור 'ייפה פסק דין'<br/>קורא ל-Function"]
    end

    שלב1 --> שלב2

    style שלב1 fill:#f0e8fe,stroke:#7B68EE
    style שלב2 fill:#e8fee8,stroke:#4AD94A
```

> 💡 **Function שלא כותב ל-DB** — אפשר לדפלוי בלי מיגרציה.

---

## שגיאות נפוצות

### ❌ שגיאה 1: Function לפני DB

```
ERROR: relation "talmud_references" does not exist
```

**פתרון:** הריצו את המיגרציה קודם.

### ❌ שגיאה 2: Types לא מעודכנים

```typescript
// אם types.ts לא כולל את הטבלה החדשה:
Property 'psak_sections' does not exist on type 'Database["public"]["Tables"]'
```

**פתרון:** עדכנו `types.ts` אחרי יצירת הטבלה.

### ❌ שגיאה 3: Lovable מוחק קבצים

```
2321 files deleted by Lovable push
```

**פתרון:** תמיד `force push` חזרה אחרי Lovable.

---

## סיכום ויזואלי

```mermaid
flowchart TD
    START(("🚀 התחלה"))
    START --> Q1{"צריך טבלה<br/>חדשה?"}

    Q1 -->|כן| DB["🗄️ שלב 1<br/>מיגרציית DB"]
    Q1 -->|לא| Q2

    DB --> Q2{"צריך Edge<br/>Function?"}

    Q2 -->|כן| Q3{"Function צריך<br/>את הטבלה?"}
    Q2 -->|לא| FE["🎨 שלב 3<br/>Frontend"]

    Q3 -->|כן, DB קודם| EF["⚙️ שלב 2<br/>Edge Function"]
    Q3 -->|לא, עצמאי| EF

    EF --> FE
    FE --> PUSH["📤 Push + Build"]
    PUSH --> DONE(("✅ סיום"))

    style START fill:#FFD700,stroke:#DAA520
    style DB fill:#4A90D9,stroke:#2C5F8A,color:#fff
    style EF fill:#7B68EE,stroke:#5B48CE,color:#fff
    style FE fill:#50C878,stroke:#3AA85E,color:#fff
    style PUSH fill:#FF6B6B,stroke:#CC4444,color:#fff
    style DONE fill:#50C878,stroke:#3AA85E,color:#fff
```

---

> **📌 כלל הזהב:** `DB → Edge Functions → Frontend` — תמיד בסדר הזה, אלא אם אין תלות.

</div>
