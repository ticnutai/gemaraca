import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, BookOpen, Scale, ExternalLink } from "lucide-react";
import DafSelector from "@/components/DafSelector";
import DafQuickNav from "@/components/DafQuickNav";
import FAQSection from "@/components/FAQSection";
import PsakDinSearchButton from "@/components/PsakDinSearchButton";
import GemaraTextPanel from "@/components/GemaraTextPanel";
import CommentariesPanel from "@/components/CommentariesPanel";
import LexiconSearch from "@/components/LexiconSearch";
import RelatedPsakimSidebar from "@/components/RelatedPsakimSidebar";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MASECHTOT } from "@/lib/masechtotData";

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
  
  const sugya = sugyotData[id || ""] || loadedPage;

  useEffect(() => {
    if (id) {
      loadPageFromDB();
      fetchRealCases();
    }
  }, [id]);

  const loadPageFromDB = async () => {
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
        setLoadedPage({
          title: data.title,
          dafYomi: data.daf_yomi,
          summary: `דף ${data.daf_yomi}`,
          tags: ["גמרא", hebrewMasechetName],
          masechet: masechetName,
          gemaraText: "",
          fullText: "",
          cases: []
        });
      }
    } catch (error) {
      console.error('Error loading page from DB:', error);
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
      <div className="container mx-auto max-w-7xl px-4 py-12">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/")}
            className="gap-2"
          >
            חזרה לרשימת הסוגיות
            <ArrowRight className="w-4 h-4 rotate-180" />
          </Button>
          <div className="flex gap-3 flex-wrap">
            <DafQuickNav />
            <DafSelector />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-secondary">
                <BookOpen className="w-6 h-6 text-primary-foreground" />
              </div>
              <span className="text-lg font-medium text-muted-foreground">{sugya.dafYomi}</span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold text-foreground">{sugya.title}</h1>
            
            <p className="text-xl text-muted-foreground">{sugya.summary}</p>
            
            <div className="flex flex-wrap gap-2">
              {sugya.tags.map((tag: string, index: number) => (
                <Badge key={index} variant="secondary" className="text-sm">
                  {tag}
                </Badge>
              ))}
            </div>
          </div>

          {/* Gemara Text */}
          {sugya.gemaraText && (
            <Card className="p-8 bg-gradient-to-br from-primary/5 to-secondary/5 border-2 border-primary/20">
              <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-primary" />
                לשון הגמרא
              </h2>
              <div className="prose prose-lg max-w-none text-foreground leading-loose whitespace-pre-line font-serif text-[1.1rem]">
                {sugya.gemaraText}
              </div>
            </Card>
          )}

          {/* Full Text */}
          <Card className="p-8 bg-gradient-to-br from-card to-card/80">
            <h2 className="text-2xl font-bold text-foreground mb-4">הסבר וניתוח</h2>
            <div className="prose prose-lg max-w-none text-foreground leading-relaxed whitespace-pre-line">
              {sugya.fullText}
            </div>
          </Card>

          {/* Sefaria Integration */}
          <div className="space-y-6">
            <h2 className="text-3xl font-bold text-foreground">מקורות וכלים ללימוד</h2>
            <Tabs defaultValue="gemara" className="w-full" dir="rtl">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="gemara">טקסט הגמרא</TabsTrigger>
                <TabsTrigger value="commentaries">מפרשים</TabsTrigger>
                <TabsTrigger value="lexicon">מילון</TabsTrigger>
              </TabsList>
              <TabsContent value="gemara" className="mt-6">
                <GemaraTextPanel sugyaId={id || ""} dafYomi={sugya.dafYomi} masechet={sugya.masechet} />
              </TabsContent>
              <TabsContent value="commentaries" className="mt-6">
                <CommentariesPanel dafYomi={sugya.dafYomi} />
              </TabsContent>
              <TabsContent value="lexicon" className="mt-6">
                <LexiconSearch dafYomi={sugya.dafYomi} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Search for Psak Din */}
          <PsakDinSearchButton
            sugyaId={id || ""}
            sugyaTitle={sugya.title}
            sugyaDescription={sugya.summary}
            onSearchComplete={fetchRealCases}
          />

          {/* Real Cases from Database */}
          {realCases.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <Scale className="w-6 h-6 text-accent" />
                <h2 className="text-3xl font-bold text-foreground">
                  פסקי דין אמיתיים ({realCases.length})
                </h2>
              </div>
              
              <div className="space-y-4">
                {realCases.map((link: any) => {
                  const caseData = link.psakei_din;
                  const caseFaqItems = faqItems.filter(
                    (faq) => faq.psak_din_id === caseData.id
                  );
                  
                  return (
                    <Card key={link.id} className="p-6 space-y-4 hover:shadow-lg transition-all border-2 border-primary/20">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <Badge variant="default" className="bg-gradient-to-r from-primary to-secondary">
                              רלוונטיות: {link.relevance_score}/10
                            </Badge>
                          </div>
                          <h3 className="text-xl font-bold text-foreground">{caseData.title}</h3>
                          <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
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
                      </div>
                      
                      {caseData.source_url && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full gap-2"
                          asChild
                        >
                          <a 
                            href={caseData.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="w-4 h-4" />
                            צפייה בפסק הדין המלא במקור
                          </a>
                        </Button>
                      )}
                      
                      <p className="text-foreground leading-relaxed">{caseData.summary}</p>
                      
                      <div className="pt-4 border-t border-border">
                        <p className="text-sm font-medium text-primary">
                          <span className="text-muted-foreground">קשר לגמרא: </span>
                          {link.connection_explanation}
                        </p>
                      </div>

                      {/* FAQ Section for this case */}
                      {caseFaqItems.length > 0 && (
                        <div className="pt-4 border-t border-border">
                          <FAQSection 
                            items={caseFaqItems} 
                            title="שאלות ותשובות על פסק דין זה"
                          />
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Sample Cases */}
          {sugya.cases && sugya.cases.length > 0 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <Scale className="w-6 h-6 text-muted-foreground" />
                  <h2 className="text-2xl font-bold text-muted-foreground">
                    דוגמאות להמחשה ({sugya.cases.length})
                  </h2>
                </div>
                <div className="bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    💡 <strong>שימו לב:</strong> אלו דוגמאות להמחשה בלבד. הקישורים אינם אמיתיים. 
                    להשגת פסקי דין אמיתיים, השתמשו בכפתור "חפש פסקי דין אמיתיים" למעלה.
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {sugya.cases.map((case_: any, index: number) => (
                <Card key={index} className="p-6 space-y-4 hover:shadow-lg transition-all">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <h3 className="text-xl font-bold text-foreground">{case_.title}</h3>
                      <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                        <span className="font-medium">{case_.court}</span>
                        <span>•</span>
                        <span>{case_.year}</span>
                        {case_.link && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{case_.link}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      (קישור המחשה)
                    </div>
                  </div>
                  
                  <p className="text-foreground leading-relaxed">{case_.summary}</p>
                  
                  <div className="pt-4 border-t border-border">
                    <p className="text-sm font-medium text-primary">
                      <span className="text-muted-foreground">קשר לגמרא: </span>
                      {case_.connection}
                    </p>
                  </div>
                </Card>
                ))}
              </div>
            </div>
          )}

          {isLoading && (
            <div className="text-center py-8">
              <p className="text-muted-foreground">טוען פסקי דין...</p>
            </div>
          )}
          </div>

          {/* Sidebar - Related Psakim */}
          <div className="lg:col-span-1">
            <div className="sticky top-4">
              <RelatedPsakimSidebar sugyaId={id || ""} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SugyaDetail;
