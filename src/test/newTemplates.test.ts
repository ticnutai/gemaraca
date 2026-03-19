import { describe, it, expect } from "vitest";
import { TEMPLATES, generateFromTemplate } from "@/lib/psakDinTemplates";
import type { ParsedPsakDin } from "@/lib/psakDinParser";

const SAMPLE_DATA: ParsedPsakDin = {
  title: "זכות מעבר וצינעת הפרט במעבר העובר דרך בית",
  court: "ארץ חמדה גזית ירושלים",
  date: 'כ"ב אב תש"ע',
  year: 2010,
  caseNumber: "תיק 70026",
  sourceUrl: "https://www.psakim.org/Psakim/File/1357",
  sourceId: "1357",
  judges: ["הרב כרמל יוסף", "הרב כץ אריה", "הרב לוי סיני"],
  summary: "התובעים הם בעלי בית מדרש ובית כנסת, שהדרך אליו עוברת דרך חלקה של אדם אחר.",
  topics: "זכות מעבר, נזקי שכנים, ביוש",
  sections: [
    {
      type: "facts",
      title: "תיאור המקרה",
      content:
        "התובעים הם שני מוסדות של תורה, בית מדרש ובית כנסת.\nלתובעים זכות מעבר מחלקתם לרחוב.\n\nא. הזכות רשומה בטאבו.\nב. אין עליה כל מחלוקת.",
    },
    {
      type: "plaintiff-claims",
      title: "טענות התובעים",
      content:
        "1. הקירוי החדש נמוך מהקירוי הישן.\n2. אטימות הקירוי גורמת לבעיית איוורור.\n3. פגיעה בצניעות.\n4. הנמכת המעבר פגעה ביכולת להעביר חפצים.",
    },
    {
      type: "defendant-claims",
      title: "טענות הנתבע",
      content: "הנתבע טוען שהסיבה ליציקה הייתה חשש בטיחותי.",
    },
    {
      type: "discussion",
      title: "דיון הלכתי",
      content:
        'בשולחן ערוך חו"מ סימן קנד סעיף כז:\n"שני אחים שחלקו חצר מדעתן ושמו הבנין"',
    },
    {
      type: "decision",
      title: "החלטה",
      content:
        "1. תביעת התובעים להסרת הקירוי נדחית.\n2. התביעות הנגדיות נדחות.\n3. הנתבע לא יבנה על היציקה ללא היתר בניה.",
    },
  ],
  rawText: "",
};

const NEW_TEMPLATE_IDS = [
  "psakim-formal",
  "court-decree",
  "scholarly-halachic",
  "executive-brief",
];

describe("4 תבניות חדשות — רישום ב-TEMPLATES", () => {
  for (const id of NEW_TEMPLATE_IDS) {
    it(`"${id}" רשומה במערך TEMPLATES`, () => {
      const tmpl = TEMPLATES.find((t) => t.id === id);
      expect(tmpl).toBeDefined();
      expect(tmpl!.requiresAi).toBe(false);
      expect(tmpl!.hasIndex).toBe(true);
      expect(tmpl!.name).toBeTruthy();
      expect(tmpl!.description).toBeTruthy();
      expect(tmpl!.icon).toBeTruthy();
    });
  }
});

describe.each(NEW_TEMPLATE_IDS)("תבנית %s — יצירת HTML", (templateId) => {
  let html: string;

  beforeAll(() => {
    html = generateFromTemplate(templateId, SAMPLE_DATA);
  });

  it("מחזירה HTML תקין עם DOCTYPE ותגי html/head/body", () => {
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain('<html lang="he-IL" dir="rtl">');
    expect(html).toContain("<head>");
    expect(html).toContain("<body>");
    expect(html).toContain("</html>");
  });

  it("כולל בס\"ד", () => {
    expect(html).toContain('בס"ד');
  });

  it("כולל את כותרת פסק הדין", () => {
    expect(html).toContain("זכות מעבר וצינעת הפרט");
  });

  it("כולל את שם בית הדין", () => {
    expect(html).toContain("ארץ חמדה גזית ירושלים");
  });

  it("כולל שמות הדיינים", () => {
    for (const judge of SAMPLE_DATA.judges) {
      expect(html).toContain(judge);
    }
  });

  it("כולל את מספר התיק", () => {
    expect(html).toContain("תיק");
  });

  it("כולל תוכן עניינים עם קישורים", () => {
    expect(html).toContain("תוכן עניינים");
    expect(html).toContain('class="toc-link"');
  });

  it("כולל ווידג'ט חיפוש אינטראקטיבי", () => {
    expect(html).toContain("psak-search-input");
    expect(html).toContain("psak-search-count");
  });

  it("כולל סעיפים עם data-search-scope", () => {
    expect(html).toContain('data-search-scope="sec-0"');
    expect(html).toContain('data-search-scope="sec-details"');
  });

  it("כולל כותרות סעיפים מהמידע", () => {
    expect(html).toContain("תיאור המקרה");
    expect(html).toContain("טענות התובעים");
    expect(html).toContain("החלטה");
  });

  it("כולל תקציר", () => {
    expect(html).toContain("בעלי בית מדרש");
  });

  it("כולל CSS מותאם (navy + gold)", () => {
    expect(html).toContain("#0B1F5B");
    expect(html).toContain("#D4AF37");
  });

  it("כולל print CSS", () => {
    expect(html).toContain("@media print");
  });
});

describe("תבנית psakim-formal — מאפיינים ייחודיים", () => {
  const html = generateFromTemplate("psakim-formal", SAMPLE_DATA);

  it("כוללת חתימה עם פסוק סיום", () => {
    expect(html).toContain("וְהָאֱמֶת וְהַשָּׁלוֹם אֱהָבוּ");
  });

  it("כוללת קו חתימה לכל דיין", () => {
    expect(html).toContain("pf-sig-line");
    expect(html).toContain("pf-sig-name");
  });

  it("כוללת סגנון פסקים.אורג בכותרת ראשית", () => {
    expect(html).toContain("pf-main-title");
  });
});

describe("תבנית court-decree — מאפיינים ייחודיים", () => {
  const html = generateFromTemplate("court-decree", SAMPLE_DATA);

  it("כוללת header כהה עם gradient", () => {
    expect(html).toContain("cd-header");
    expect(html).toContain("linear-gradient");
  });

  it("מסמנת סעיף החלטה כ-decision-section", () => {
    expect(html).toContain("cd-decision-section");
  });

  it("כוללת סמל מאזניים", () => {
    expect(html).toContain("⚖");
  });
});

describe("תבנית scholarly-halachic — מאפיינים ייחודיים", () => {
  const html = generateFromTemplate("scholarly-halachic", SAMPLE_DATA);

  it("כוללת רקע קלף", () => {
    expect(html).toContain("parchment");
  });

  it("מדגישה מקורות הלכתיים (source-ref)", () => {
    expect(html).toContain("sh-source-ref");
  });

  it("כוללת אייקון סעיף לפי סוג", () => {
    expect(html).toContain("sh-sec-icon");
  });
});

describe("תבנית executive-brief — מאפיינים ייחודיים", () => {
  const html = generateFromTemplate("executive-brief", SAMPLE_DATA);

  it("כוללת hero card בראש", () => {
    expect(html).toContain("eb-hero");
  });

  it("כוללת כרטיס תקציר", () => {
    expect(html).toContain("eb-card");
    expect(html).toContain("📋 תקציר");
  });

  it("כוללת כרטיס עיקר ההחלטה", () => {
    expect(html).toContain("eb-decision-card");
    expect(html).toContain("עיקר ההחלטה");
  });

  it("כוללת קו זמן ויזואלי (section-marker)", () => {
    expect(html).toContain("eb-section-marker");
  });

  it("כוללת badges לדיינים", () => {
    expect(html).toContain("eb-sig-badge");
  });
});

describe("יצירת HTML ללא נתונים — graceful fallback", () => {
  const emptyData: ParsedPsakDin = {
    title: "",
    court: "",
    date: "",
    year: 0,
    caseNumber: "",
    sourceUrl: "",
    sourceId: "",
    judges: [],
    summary: "",
    topics: "",
    sections: [],
    rawText: "שורה ראשונה\nשורה שניה",
  };

  for (const id of NEW_TEMPLATE_IDS) {
    it(`"${id}" מייצרת HTML גם ללא סעיפים`, () => {
      const html = generateFromTemplate(id, emptyData);
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("</html>");
    });
  }
});
