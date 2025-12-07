import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Scale, ExternalLink, Lightbulb, FileText, HelpCircle } from "lucide-react";
import DafAmudNavigator from "@/components/DafAmudNavigator";
import FAQSection from "@/components/FAQSection";
import PsakDinSearchButton from "@/components/PsakDinSearchButton";
import GemaraTextPanel from "@/components/GemaraTextPanel";
import CommentariesPanel from "@/components/CommentariesPanel";
import LexiconSearch from "@/components/LexiconSearch";
import RelatedPsakimSidebar from "@/components/RelatedPsakimSidebar";
import LinkedPsakimSection from "@/components/LinkedPsakimSection";
import { ModernExamplesPanel } from "@/components/ModernExamplesPanel";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MASECHTOT } from "@/lib/masechtotData";
import { getCachedPage, setCachedPage } from "@/lib/pageCache";

// Helper function to get Hebrew name from Sefaria name
const getMasechetHebrewName = (sefariaName: string): string => {
  const masechet = MASECHTOT.find(m => m.sefariaName === sefariaName);
  return masechet?.hebrewName || sefariaName;
};

const sugyotData: Record<string, any> = {
  "shnayim-ochazin": {
    title: "שנים אוחזין בטלית",
    dafYomi: "בבא מציעא ב ע\"א",
    summary: "שני אנשים תופסים בטלית וכל אחד טוען שהיא שלו - כיצד בית הדין מכריע במחלוקת הבעלות",
    tags: ["קניין", "מחלוקת", "בעלות"],
    gemaraText: `שנים אוחזין בטלית, זה אומר אני מצאתיה וזה אומר אני מצאתיה, זה אומר כולה שלי וזה אומר כולה שלי - זה ישבע שאין לו בה פחות מחציה, וזה ישבע שאין לו בה פחות מחציה, ויחלוקו.

זה אומר כולה שלי וזה אומר חציה שלי - האומר כולה שלי ישבע שאין לו בה פחות משלשה חלקים, והאומר חציה שלי ישבע שאין לו בה פחות מרביע. זה נוטל שלשה חלקים וזה נוטל רביע.`,
    fullText: `הסוגיה פותחת את המסכת בשאלה בסיסית: שני אנשים אוחזים בטלית, זה אומר כולה שלי וזה אומר כולה שלי. הגמרא קובעת שכל אחד נשבע שאין לו פחות מחצי, ויחלוקו.

העיקרון המרכזי: כאשר יש מחלוקת על בעלות ואין ראיות מוכחות, חולקים את הנכס. השבועה נדרשת כדי למנוע טענות שווא.

הסוגיה דנה גם במקרים שונים:
• שניהם אוחזים בכל הטלית - חולקים שווה בשווה
• אחד אוחז ברוב והשני במיעוט - חולקים לפי האחיזה
• אחד אוחז והשני אינו אוחז - המחזיק זוכה`,
    cases: [
      {
        title: "סכסוך על בעלות דירה - תמ״א 38",
        court: "בית המשפט העליון",
        year: "2019",
        summary: "שני יורשים טענו לבעלות על דירה שעברה תמ״א. בית המשפט החליט על חלוקה שווה בהעדר ראיות ברורות.",
        link: "ע״א 1234/19",
        connection: "העיקרון הגמראי של חלוקת הנכס במחלוקת יושם במקרה מודרני של נדל״ן"
      },
      {
        title: "מחלוקת על בעלות רכב משפחתי",
        court: "בית משפט לתביעות קטנות - תל אביב",
        year: "2021",
        summary: "בני זוג לשעבר התדיינו על בעלות רכב שנרכש במהלך הנישואין. בית המשפט חילק את שווי הרכב.",
        link: "ת״ק 45678/21",
        connection: "חלוקה שווה כאשר שני הצדדים תופסים ברכוש ואין הוכחת בעלות בלעדית"
      },
      {
        title: "סכסוך שותפים בעסק משפחתי",
        court: "בית משפט השלום - ירושלים",
        year: "2020",
        summary: "שני אחים טענו לבעלות בלעדית בעסק שנוסד על ידי אביהם. בית הדין חילק את העסק לפי מידת המעורבות.",
        link: "ת״א 89012/20",
        connection: "יישום עיקרון החלוקה לפי 'אחיזה' - מי שהשקיע יותר זוכה ביותר"
      },
      {
        title: "זכויות במקרקעין - שטח משותף",
        court: "בית המשפט המחוזי - חיפה",
        year: "2018",
        summary: "מחלוקת בין שכנים על שטח שהיה בשימוש משותף. בית המשפט חילק את השטח.",
        link: "ת״א 34567/18",
        connection: "העיקרון הגמראי של שנים אוחזין יושם על מקרקעין"
      }
    ]
  },
  "eilu-metziot": {
    title: "אלו מציאות שלו",
    dafYomi: "בבא מציעא כא ע\"א",
    summary: "מתי אדם זוכה במציאה לעצמו ומתי חייב להשיבה - דיני יאוש והכרזה",
    tags: ["אבידה", "מציאה", "יאוש"],
    gemaraText: `אלו מציאות שלו ואלו חייב להכריז: אלו מציאות שלו - מצא פירות מפוזרין, מעות מפוזרות, כריכות ברשות הרבים, ועיגולי דבילה, ככרות של נחתום, מחרוזות של דגים, וחתיכות של בשר, וגיזי צמר הלקוחות ממדינתן, ואניצי פשתן, ולשונות של ארגמן - הרי אלו שלו, דברי רבי מאיר.

רבי יהודה אומר: כל שיש בו שינוי - חייב להכריז. כיצד? מצא עיגול ובתוכו חרס, ככר ובתוכו מעות.

רבי שמעון בן אלעזר אומר: כל כלי אנפוריא אינו חייב להכריז.`,
    fullText: `הגמרא מגדירה אלו מציאות שייכות למוצא ואלו צריך להחזיר. העיקרון המרכזי: מציאה שיש בה סימן - חייב להכריז. מציאה שאין בה סימן - שלו.

מושגי יסוד:
• יאוש - ויתור הבעלים על האבידה
• סימן - דבר המזהה את האבידה לבעלים
• שינוי רשות - מעבר האבידה למקום חדש

דוגמאות מהגמרא והיישום המודרני:
• מצא פירות מפוזרים - שלו (היום: מטבעות מפוזרים ברחוב)
• מצא ארנק עם סימנים - חייב להחזיר (היום: ארנק עם תעודה מזהה)
• מצא חפץ במקום ציבורי - תלוי אם יש סימן`,
    cases: [
      {
        title: "מציאת כסף במכונת כביסה ציבורית",
        court: "בית דין צדק - בני ברק",
        year: "2022",
        summary: "שאלה הלכתית: האם מותר לשמור כסף שנמצא במכונת כביסה. נפסק שאם אין דרך לזהות הבעלים - מותר.",
        link: "פס״ד 156/תשפ״ב",
        connection: "יישום עיקרון 'אין בה סימן' - כשאי אפשר לזהות הבעלים"
      },
      {
        title: "החזרת ארנק עם תעודת זהות",
        court: "משטרת ישראל - תחנת רמת גן",
        year: "2021",
        summary: "אזרח מצא ארנק עם תעודת זהות והחזירו למשטרה. הבעלים אותר תוך שעות.",
        link: "תיק 7890/21",
        connection: "המחשת חובת ההשבה כשיש 'סימן' - תעודה מזהה"
      },
      {
        title: "פסיקה על מציאת טלפון סלולרי",
        court: "בית משפט השלום - תל אביב",
        year: "2020",
        summary: "נפסק שמוצא טלפון חייב להשקיע מאמץ סביר למצוא בעלים (להפעיל ולבדוק אנשי קשר).",
        link: "ת״פ 2345/20",
        connection: "חובת השבה מודרנית - חיפוש פעיל אחר הבעלים"
      },
      {
        title: "מציאת תכשיטים בחוף הים",
        court: "בית המשפט המחוזי - תל אביב",
        year: "2019",
        summary: "מצא טבעת זהב בחוף. בית המשפט קבע שמאחר שלא פורסם על אובדן, ואין דרך לזהות - המוצא זוכה.",
        link: "ת״א 6789/19",
        connection: "יאוש שלא מדעת - הבעלים התייאש כי לא יודע איפה איבד"
      }
    ]
  },
  "hashavat-aveida": {
    title: "מצוות השבת אבידה",
    dafYomi: "בבא מציעא כז ע\"ב",
    summary: "חובת השבת אבידה - סימנים, הכרזה ואחריות המוצא",
    tags: ["אבידה", "השבה", "סימנים"],
    gemaraText: `כיצד מכריז? אמר רבי יהודה: יכריז בשלש רגלים, ולאחר הרגל האחרון שבעת ימים, כדי שילך לביתו שלשה ויחזור שלשה, ויכריז יום אחד.

אמרו לו: מנין לאבידה מן התורה? שנאמר: "והתעלמת" - פעמים שאתה מתעלם, פעמים שאתה מגלה. איזהו? זקן ואינו לפי כבודו - מתעלם. הלך לבית הכנסת ולבית המדרש ומצא אבידה - חייב להחזיר.

סימנים דאורייתא או דרבנן? רבי יוחנן אמר: מן התורה, שנאמר "ואבדת אחיך" - דבר האבוד לאחיך ומצוי לך.`,
    fullText: `הגמרא מפרטת את חובת השבת אבידה על פי התורה: "השב תשיבם לאחיך". המוצא אבידה חייב לטפל בה ולהכריז עליה.

דיני סימנים:
• סימן מובהק - מזהה באופן ברור (מספר, תבנית)
• סימן שאינו מובהק - לא מספיק לזיהוי
• צירוף סימנים - מספר סימנים יחד

חובות המוצא:
1. לקחת את האבידה לרשותו
2. לשמור עליה היטב
3. להכריז במקומות מתאימים
4. להחזיר לבעלים עם זיהוי נכון`,
    cases: [
      {
        title: "החזרת תיק עם מסמכים רגישים",
        court: "משרד הפנים - ירושלים",
        year: "2023",
        summary: "תיק שהכיל מסמכים ממשלתיים סווגים הוחזר באמצעות זיהוי פרטי הבעלים על גבי המסמכים.",
        link: "תיק 1111/23",
        connection: "חשיבות הסימנים הפנימיים כאמצעי זיהוי"
      },
      {
        title: "פסיקה על אחריות השומר על אבידה",
        court: "בית משפט השלום - ראשון לציון",
        year: "2022",
        summary: "מוצא אבידה התרשל בשמירתה וזו ניזוקה. בית המשפט חייבו בפיצוי כ'שומר שכר'.",
        link: "ת״א 4444/22",
        connection: "יישום דיני שמירה על המוצא אבידה"
      },
      {
        title: "הכרזה ברשתות חברתיות",
        court: "בית דין צדק - ירושלים",
        year: "2021",
        summary: "נפסק שפרסום ברשתות חברתיות מהווה 'הכרזה' מספקת בימינו.",
        link: "פס״ד 333/תשפ״א",
        connection: "התאמת דיני ההכרזה לעידן המודרני"
      }
    ]
  },
  "geneiva-aveida": {
    title: "גניבה ואבידה מההקדש",
    dafYomi: "בבא מציעא כח ע״א",
    summary: "דיני ממון הקדש - מה הדין במציאת או גניבת רכוש של הקדש",
    tags: ["הקדש", "גניבה", "קדשים"],
    fullText: `הגמרא דנה במעמד מיוחד של ממון הקדש. רכוש השייך להקדש טעון דינים מחמירים יותר.

עקרונות יסוד:
• הקדש לא מתייאש - ממון ציבורי לא מתייאש
• חובת השבה מוגברת
• איסור מעילה - שימוש בממון הקדש

יישום מודרני:
• רכוש ציבורי
• ממון של עמותות
• תרומות למוסדות`,
    cases: [
      {
        title: "מציאת ספרי תורה שנגנבו",
        court: "בית דין רבני - ירושלים",
        year: "2020",
        summary: "ספרי תורה שנגנבו מבית כנסת נמצאו. בית הדין הורה על החזרה מיידית ללא תלות ביאוש.",
        link: "פס״ד 777/תש״פ",
        connection: "הקדש לא מתייאש - חובת החזרה תמיד קיימת"
      },
      {
        title: "גניבה מקופת צדקה",
        court: "בית משפט השלום - בני ברק",
        year: "2021",
        summary: "תיק פלילי נגד גנב שלקח כסף מקופת צדקה. העונש הוחמר בשל היותו 'ממון הקדש'.",
        link: "ת״פ 8888/21",
        connection: "החמרה בממון הקדש אף במשפט המודרני"
      }
    ]
  },
  "hamotzei-shtarot": {
    title: "המוצא שטרות",
    dafYomi: "בבא מציעא יח ע\"א",
    summary: "מציאת מסמכים ושטרות - מתי מחזירים ומתי חוששים למרמה",
    tags: ["שטרות", "מסמכים", "החזרה"],
    gemaraText: `המוצא שטרות - אם יש בהן אחריות נכסים, לא יחזיר. שמא פרעם ומפני שאין בהן אחריות נכסים, הניחן בין שטרותיו. אין בהן אחריות נכסים - יחזיר.

מצא שטר בין שטרותיו ואינו יודע מה טיבו - יהא מונח עד שיבא אליהו. אמר ליה רב פפא לאביי: השתא דאמרת שטר הבא ממדינת הים יוציא בו, אין פרעתי - עלי להביא ראיה!

מצא גט פטורין של אשה, שטר חליצה, שטר מיאונין - לא יחזיר לזה ולא יחזיר לזה. שמא כתב לגרש, וחזר בו. שמא כתב לחלוץ, וחזר בו.`,
    fullText: `הגמרא דנה במציאת שטרות חוב ומסמכים משפטיים. השאלה: האם להחזיר שמא כבר נפרע החוב?

עקרונות:
• חשש לתרמית - שמא שטר פרוע הוא
• סימנים במסמכים
• זמן המציאה לעומת זמן השטר

דוגמאות:
• מצא שטר חוב - לא מחזיר אלא אם כן בטוח שלא נפרע
• מצא קבלה - יכול להחזיר
• מצא המחאה - תלוי אם נפרעה`,
    cases: [
      {
        title: "מציאת המחאה בנקאית",
        court: "בית משפט השלום - חיפה",
        year: "2022",
        summary: "המחאה שנמצאה ברחוב. בית המשפט קבע לא להחזירה למשלם חשש שכבר נפרעה.",
        link: "ת״א 9999/22",
        connection: "חשש לתרמית במסמכים כספיים"
      },
      {
        title: "מציאת חוזה נדל״ן",
        court: "בית משפט השלום - תל אביב",
        year: "2021",
        summary: "חוזה רכישת דירה שאבד. בית המשפט אישר החזרה לאחר בדיקה שהעסקה בתוקף.",
        link: "ת״א 5555/21",
        connection: "החזרת מסמכים רק לאחר ברור מדוקדק"
      }
    ]
  },
  "hamaafil": {
    title: "המפקיד אצל חברו",
    dafYomi: "בבא מציעא כט ע\"ב",
    summary: "דיני פיקדון - אחריות השומר וחובת השמירה על ממון שהופקד אצלו",
    tags: ["פיקדון", "שמירה", "אחריות"],
    gemaraText: `המפקיד אצל חברו בין בחנם בין בשכר - הרי זה לא יגע בהן. במה דברים אמורים? בזמן שעשה בהן מלאכה לצורך עצמו. אבל אם עשה בהן מלאכה לצורך בעלים - הרי זה ישלם.

אמר רבי יצחק: נעשה לו כשואל. שומר חנם נשבע על הכל, ושומר שכר משלם את האבידה ואת הגניבה, ונשבע על האונסין.

תנו רבנן: ארבעה שומרין הן - שומר חנם, והשואל, נושא שכר, והשוכר. שומר חנם נשבע על הכל, והשואל משלם את הכל, נושא שכר והשוכר משלמין את האבידה ואת הגניבה, ונשבעין על המיתה ועל השבר ועל השבויה.`,
    fullText: `הגמרא דנה באחריות מי שקיבל פיקדון לשמירה. רמות אחריות שונות לסוגי שומרים.

סוגי שומרים:
• שומר חינם - חינם שמר, פטור באונס
• שומר שכר - קיבל תשלום, חייב יותר
• שואל - השתמש, אחראי גם באונסים
• שוכר - משלם שכר, אחריות בינונית

חובות השומר:
1. שמירה ראויה
2. לא להשתמש בפיקדון
3. להחזיר במצב טוב`,
    cases: [
      {
        title: "חברת שמירה שאיבדה פיקדון",
        court: "בית המשפט המחוזי - תל אביב",
        year: "2023",
        summary: "חברת שמירה (שומר שכר) חויבה בפיצוי מלא על אובדן פיקדון גם כשטענה לגניבה.",
        link: "ת״א 1234/23",
        connection: "אחריות מוגברת של שומר שכר"
      },
      {
        title: "פיקדון אצל שכן שנגנב",
        court: "בית משפט השלום - פתח תקווה",
        year: "2022",
        summary: "שכן ששמר חינם פוטר מאחריות כשהפיקדון נגנב בפריצה, הוכיח שמירה ראויה.",
        link: "ת״א 6666/22",
        connection: "שומר חינם פטור באונס אם שמר כראוי"
      },
      {
        title: "משכנתא על פיקדון",
        court: "בית משפט השלום - ירושלים",
        year: "2021",
        summary: "שומר שהשתמש בפיקדון חויב כשואל - אחריות מוחלטת גם באונס.",
        link: "ת״א 3333/21",
        connection: "שימוש לא מורשה הופך לשואל"
      }
    ]
  }
};

const SugyaDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [realCases, setRealCases] = useState<any[]>([]);
  const [faqItems, setFaqItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadedPage, setLoadedPage] = useState<any>(null);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [mainTab, setMainTab] = useState("gemara");
  
  const sugya = sugyotData[id || ""] || loadedPage;

  useEffect(() => {
    if (id) {
      loadPageFromDB();
      fetchRealCases();
    }
  }, [id]);

  const loadPageFromDB = async () => {
    if (!id) return;
    
    // Check cache first
    const cached = getCachedPage(id);
    if (cached) {
      console.log('Using cached page for:', id);
      setLoadedPage(cached);
      setIsPageLoading(false);
      return;
    }

    setIsPageLoading(true);
    try {
      const { data, error } = await supabase
        .from('gemara_pages')
        .select('*')
        .eq('sugya_id', id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        // Extract masechet name from the data
        const masechetName = data.masechet || 'Bava_Batra';
        const hebrewMasechetName = getMasechetHebrewName(masechetName);
        
        // Convert DB format to component format
        const pageData = {
          title: data.title,
          dafYomi: data.daf_yomi,
          summary: `דף ${data.daf_yomi}`,
          tags: ["גמרא", hebrewMasechetName],
          masechet: masechetName,
          gemaraText: "",
          fullText: "",
          cases: []
        };
        
        // Save to cache
        setCachedPage(id, pageData);
        setLoadedPage(pageData);
      }
    } catch (error) {
      console.error('Error loading page from DB:', error);
    } finally {
      setIsPageLoading(false);
    }
  };

  const fetchRealCases = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('sugya_psak_links')
        .select(`
          *,
          psakei_din:psak_din_id (*)
        `)
        .eq('sugya_id', id)
        .order('relevance_score', { ascending: false });

      if (error) {
        console.error('Error fetching real cases:', error);
      } else {
        setRealCases(data || []);
        // Fetch FAQ items for all the psakei din
        if (data && data.length > 0) {
          const psakDinIds = data.map((link: any) => link.psak_din_id);
          fetchFAQItems(psakDinIds);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFAQItems = async (psakDinIds: string[]) => {
    try {
      const { data, error } = await (supabase as any)
        .from('faq_items')
        .select('*')
        .in('psak_din_id', psakDinIds)
        .order('order_index', { ascending: true });

      if (error) {
        console.error('Error fetching FAQ items:', error);
      } else {
        setFaqItems(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  // Extract masechet info for LinkedPsakimSection
  const getMasechetInfo = () => {
    if (!id) return null;
    const parts = id.split('_');
    const masechetObj = MASECHTOT.find(m => m.sefariaName.toLowerCase() === parts[0]);
    const dafNumMatch = parts[1]?.match(/(\d+)/);
    const dafNum = dafNumMatch ? parseInt(dafNumMatch[1]) : 0;
    
    if (masechetObj && dafNum > 0) {
      return { masechet: masechetObj.hebrewName, dafNumber: dafNum };
    }
    return null;
  };

  const masechetInfo = getMasechetInfo();

  // Show loading state while page is being fetched
  if (isPageLoading && !sugyotData[id || ""]) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">טוען דף...</p>
        </div>
      </div>
    );
  }

  if (!sugya) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">סוגיה לא נמצאה</h1>
          <Button onClick={() => navigate("/")}>חזרה לדף הבית</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto max-w-7xl px-2 sm:px-4 py-4 sm:py-8">
        {/* Header - Compact navigation */}
        <div className="flex items-center gap-2 mb-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate("/")}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            חזרה
          </Button>
        </div>

        {/* Daf/Amud Navigator - Single source of truth for masechet name */}
        <DafAmudNavigator className="mb-6" />

        {/* Page Title - Simple, no duplications */}
        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-2">{sugya.title}</h1>
          <p className="text-sm sm:text-base text-muted-foreground">{sugya.summary}</p>
        </div>

        {/* Main Tabs - 4 Primary Tabs */}
        <Tabs value={mainTab} onValueChange={setMainTab} className="w-full" dir="rtl">
          <TabsList className="grid w-full grid-cols-4 mb-6 h-auto">
            <TabsTrigger value="gemara" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <BookOpen className="w-4 h-4 hidden sm:block" />
              גמרא
            </TabsTrigger>
            <TabsTrigger value="illustration" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <Lightbulb className="w-4 h-4 hidden sm:block" />
              המחשה
            </TabsTrigger>
            <TabsTrigger value="psakim" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <Scale className="w-4 h-4 hidden sm:block" />
              פסקי דין
            </TabsTrigger>
            <TabsTrigger value="analysis" className="flex items-center gap-1.5 py-2.5 text-xs sm:text-sm">
              <HelpCircle className="w-4 h-4 hidden sm:block" />
              הסבר
            </TabsTrigger>
          </TabsList>

          {/* Tab 1: גמרא - Gemara Text with nested tabs */}
          <TabsContent value="gemara" className="mt-0 space-y-6">
            {/* Original Gemara Text */}
            {sugya.gemaraText && (
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20">
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  לשון הגמרא
                </h2>
                <div className="prose prose-sm sm:prose-lg max-w-none text-foreground leading-loose whitespace-pre-line font-serif">
                  {sugya.gemaraText}
                </div>
              </Card>
            )}

            {/* Nested tabs for Gemara tools */}
            <Tabs defaultValue="text" className="w-full" dir="rtl">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="text">טקסט מקורי</TabsTrigger>
                <TabsTrigger value="commentaries">מפרשים</TabsTrigger>
                <TabsTrigger value="lexicon">מילון</TabsTrigger>
              </TabsList>
              <TabsContent value="text" className="mt-4">
                <GemaraTextPanel sugyaId={id || ""} dafYomi={sugya.dafYomi} masechet={sugya.masechet} />
              </TabsContent>
              <TabsContent value="commentaries" className="mt-4">
                <CommentariesPanel dafYomi={sugya.dafYomi} />
              </TabsContent>
              <TabsContent value="lexicon" className="mt-4">
                <LexiconSearch dafYomi={sugya.dafYomi} />
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* Tab 2: המחשה - Modern Examples */}
          <TabsContent value="illustration" className="mt-0 space-y-6">
            <ModernExamplesPanel
              gemaraText={sugya.gemaraText || sugya.fullText}
              sugyaTitle={sugya.title}
              dafYomi={sugya.dafYomi}
              masechet={sugya.masechet || "בבא בתרא"}
            />

            {/* Sample Cases for illustration */}
            {sugya.cases && sugya.cases.length > 0 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Scale className="w-5 h-5 text-muted-foreground" />
                    <h3 className="text-lg font-bold text-muted-foreground">
                      דוגמאות להמחשה ({sugya.cases.length})
                    </h3>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                    <p className="text-xs sm:text-sm text-yellow-800 dark:text-yellow-200">
                      💡 אלו דוגמאות להמחשה בלבד. להשגת פסקי דין אמיתיים, עבור לטאב "פסקי דין".
                    </p>
                  </div>
                </div>
                
                <div className="space-y-3">
                  {sugya.cases.map((case_: any, index: number) => (
                    <Card key={index} className="p-4 space-y-3 hover:shadow-lg transition-all">
                      <div className="space-y-1">
                        <h4 className="text-base font-bold text-foreground">{case_.title}</h4>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span className="font-medium">{case_.court}</span>
                          <span>•</span>
                          <span>{case_.year}</span>
                        </div>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed">{case_.summary}</p>
                      <div className="pt-2 border-t border-border">
                        <p className="text-xs font-medium text-primary">
                          <span className="text-muted-foreground">קשר לגמרא: </span>
                          {case_.connection}
                        </p>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Tab 3: פסקי דין - Legal Rulings */}
          <TabsContent value="psakim" className="mt-0 space-y-6">
            {/* Search Button */}
            <PsakDinSearchButton
              sugyaId={id || ""}
              sugyaTitle={sugya.title}
              sugyaDescription={sugya.summary}
              onSearchComplete={fetchRealCases}
            />

            {/* Linked Psakim from Smart Index */}
            {masechetInfo && (
              <LinkedPsakimSection 
                sugyaId={id || ""} 
                masechet={masechetInfo.masechet}
                dafNumber={masechetInfo.dafNumber}
              />
            )}

            {/* Real Cases from Database */}
            {realCases.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Scale className="w-5 h-5 text-accent" />
                  <h3 className="text-lg font-bold text-foreground">
                    פסקי דין אמיתיים ({realCases.length})
                  </h3>
                </div>
                
                <div className="space-y-3">
                  {realCases.map((link: any) => {
                    const caseData = link.psakei_din;
                    const caseFaqItems = faqItems.filter(
                      (faq) => faq.psak_din_id === caseData.id
                    );
                    
                    return (
                      <Card key={link.id} className="p-4 space-y-3 hover:shadow-lg transition-all border-2 border-primary/20">
                        <div className="space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-gradient-to-r from-primary to-secondary text-xs">
                              רלוונטיות: {link.relevance_score}/10
                            </Badge>
                          </div>
                          <h4 className="text-base font-bold text-foreground">{caseData.title}</h4>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span className="font-medium">{caseData.court}</span>
                            <span>•</span>
                            <span>{caseData.year}</span>
                            {caseData.case_number && (
                              <>
                                <span>•</span>
                                <span className="font-mono">{caseData.case_number}</span>
                              </>
                            )}
                          </div>
                          {caseData.tags && caseData.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {(caseData.tags as string[]).map((tag: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        {caseData.source_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full gap-2 text-xs"
                            asChild
                          >
                            <a 
                              href={caseData.source_url} 
                              target="_blank" 
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              צפייה בפסק הדין המלא
                            </a>
                          </Button>
                        )}
                        
                        <p className="text-sm text-foreground leading-relaxed">{caseData.summary}</p>
                        
                        <div className="pt-2 border-t border-border">
                          <p className="text-xs font-medium text-primary">
                            <span className="text-muted-foreground">קשר לגמרא: </span>
                            {link.connection_explanation}
                          </p>
                        </div>

                        {caseFaqItems.length > 0 && (
                          <div className="pt-2 border-t border-border">
                            <FAQSection 
                              items={caseFaqItems} 
                              title="שאלות ותשובות"
                            />
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">טוען פסקי דין...</p>
              </div>
            )}

            {/* Related Psakim Sidebar content */}
            <RelatedPsakimSidebar sugyaId={id || ""} />
          </TabsContent>

          {/* Tab 4: הסבר וניתוח - Explanation and Analysis */}
          <TabsContent value="analysis" className="mt-0 space-y-6">
            {/* Full Text Explanation */}
            {sugya.fullText && (
              <Card className="p-4 sm:p-6 bg-gradient-to-br from-card to-card/80">
                <h2 className="text-lg sm:text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  הסבר וניתוח הסוגיה
                </h2>
                <div className="prose prose-sm sm:prose-lg max-w-none text-foreground leading-relaxed whitespace-pre-line">
                  {sugya.fullText}
                </div>
              </Card>
            )}

            {/* Tags */}
            {sugya.tags && sugya.tags.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground">נושאים קשורים:</h3>
                <div className="flex flex-wrap gap-2">
                  {sugya.tags.map((tag: string, index: number) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* FAQ items if available */}
            {faqItems.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-primary" />
                  שאלות נפוצות
                </h3>
                <FAQSection items={faqItems} />
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SugyaDetail;
