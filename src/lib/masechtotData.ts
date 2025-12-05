// רשימת כל המסכתות עם המידע הנדרש
export interface Masechet {
  hebrewName: string;
  englishName: string;
  sefariaName: string;
  maxDaf: number;
  seder: string;
}

export const MASECHTOT: Masechet[] = [
  // סדר זרעים
  { hebrewName: "ברכות", englishName: "Berakhot", sefariaName: "Berakhot", maxDaf: 64, seder: "זרעים" },
  
  // סדר מועד
  { hebrewName: "שבת", englishName: "Shabbat", sefariaName: "Shabbat", maxDaf: 157, seder: "מועד" },
  { hebrewName: "עירובין", englishName: "Eruvin", sefariaName: "Eruvin", maxDaf: 105, seder: "מועד" },
  { hebrewName: "פסחים", englishName: "Pesachim", sefariaName: "Pesachim", maxDaf: 121, seder: "מועד" },
  { hebrewName: "שקלים", englishName: "Shekalim", sefariaName: "Shekalim", maxDaf: 22, seder: "מועד" },
  { hebrewName: "יומא", englishName: "Yoma", sefariaName: "Yoma", maxDaf: 88, seder: "מועד" },
  { hebrewName: "סוכה", englishName: "Sukkah", sefariaName: "Sukkah", maxDaf: 56, seder: "מועד" },
  { hebrewName: "ביצה", englishName: "Beitzah", sefariaName: "Beitzah", maxDaf: 40, seder: "מועד" },
  { hebrewName: "ראש השנה", englishName: "Rosh Hashanah", sefariaName: "Rosh_Hashanah", maxDaf: 35, seder: "מועד" },
  { hebrewName: "תענית", englishName: "Taanit", sefariaName: "Taanit", maxDaf: 31, seder: "מועד" },
  { hebrewName: "מגילה", englishName: "Megillah", sefariaName: "Megillah", maxDaf: 32, seder: "מועד" },
  { hebrewName: "מועד קטן", englishName: "Moed Katan", sefariaName: "Moed_Katan", maxDaf: 29, seder: "מועד" },
  { hebrewName: "חגיגה", englishName: "Chagigah", sefariaName: "Chagigah", maxDaf: 27, seder: "מועד" },
  
  // סדר נשים
  { hebrewName: "יבמות", englishName: "Yevamot", sefariaName: "Yevamot", maxDaf: 122, seder: "נשים" },
  { hebrewName: "כתובות", englishName: "Ketubot", sefariaName: "Ketubot", maxDaf: 112, seder: "נשים" },
  { hebrewName: "נדרים", englishName: "Nedarim", sefariaName: "Nedarim", maxDaf: 91, seder: "נשים" },
  { hebrewName: "נזיר", englishName: "Nazir", sefariaName: "Nazir", maxDaf: 66, seder: "נשים" },
  { hebrewName: "סוטה", englishName: "Sotah", sefariaName: "Sotah", maxDaf: 49, seder: "נשים" },
  { hebrewName: "גיטין", englishName: "Gittin", sefariaName: "Gittin", maxDaf: 90, seder: "נשים" },
  { hebrewName: "קידושין", englishName: "Kiddushin", sefariaName: "Kiddushin", maxDaf: 82, seder: "נשים" },
  
  // סדר נזיקין
  { hebrewName: "בבא קמא", englishName: "Bava Kamma", sefariaName: "Bava_Kamma", maxDaf: 119, seder: "נזיקין" },
  { hebrewName: "בבא מציעא", englishName: "Bava Metzia", sefariaName: "Bava_Metzia", maxDaf: 119, seder: "נזיקין" },
  { hebrewName: "בבא בתרא", englishName: "Bava Batra", sefariaName: "Bava_Batra", maxDaf: 176, seder: "נזיקין" },
  { hebrewName: "סנהדרין", englishName: "Sanhedrin", sefariaName: "Sanhedrin", maxDaf: 113, seder: "נזיקין" },
  { hebrewName: "מכות", englishName: "Makkot", sefariaName: "Makkot", maxDaf: 24, seder: "נזיקין" },
  { hebrewName: "שבועות", englishName: "Shevuot", sefariaName: "Shevuot", maxDaf: 49, seder: "נזיקין" },
  { hebrewName: "עבודה זרה", englishName: "Avodah Zarah", sefariaName: "Avodah_Zarah", maxDaf: 76, seder: "נזיקין" },
  { hebrewName: "הוריות", englishName: "Horayot", sefariaName: "Horayot", maxDaf: 14, seder: "נזיקין" },
  
  // סדר קדשים
  { hebrewName: "זבחים", englishName: "Zevachim", sefariaName: "Zevachim", maxDaf: 120, seder: "קדשים" },
  { hebrewName: "מנחות", englishName: "Menachot", sefariaName: "Menachot", maxDaf: 110, seder: "קדשים" },
  { hebrewName: "חולין", englishName: "Chullin", sefariaName: "Chullin", maxDaf: 142, seder: "קדשים" },
  { hebrewName: "בכורות", englishName: "Bekhorot", sefariaName: "Bekhorot", maxDaf: 61, seder: "קדשים" },
  { hebrewName: "ערכין", englishName: "Arakhin", sefariaName: "Arakhin", maxDaf: 34, seder: "קדשים" },
  { hebrewName: "תמורה", englishName: "Temurah", sefariaName: "Temurah", maxDaf: 34, seder: "קדשים" },
  { hebrewName: "כריתות", englishName: "Keritot", sefariaName: "Keritot", maxDaf: 28, seder: "קדשים" },
  { hebrewName: "מעילה", englishName: "Meilah", sefariaName: "Meilah", maxDaf: 22, seder: "קדשים" },
  
  // סדר טהרות
  { hebrewName: "נידה", englishName: "Niddah", sefariaName: "Niddah", maxDaf: 73, seder: "טהרות" },
];

// יצירת sugya_id ייחודי למסכת ודף
export const generateSugyaId = (masechet: Masechet, dafNumber: number, amud: 'a' | 'b' = 'a'): string => {
  return `${masechet.sefariaName.toLowerCase()}_${dafNumber}${amud}`;
};

// יצירת sefaria_ref
export const generateSefariaRef = (masechet: Masechet, dafNumber: number, amud: 'a' | 'b' = 'a'): string => {
  return `${masechet.sefariaName}.${dafNumber}${amud}`;
};

// מציאת מסכת לפי שם עברי
export const getMasechetByHebrewName = (hebrewName: string): Masechet | undefined => {
  return MASECHTOT.find(m => m.hebrewName === hebrewName);
};

// מציאת מסכת לפי שם אנגלי
export const getMasechetByEnglishName = (englishName: string): Masechet | undefined => {
  return MASECHTOT.find(m => m.englishName.toLowerCase() === englishName.toLowerCase());
};

// קבלת מסכתות לפי סדר
export const getMasechtotBySeder = (seder: string): Masechet[] => {
  return MASECHTOT.filter(m => m.seder === seder);
};

// רשימת הסדרים
export const SEDARIM = ["זרעים", "מועד", "נשים", "נזיקין", "קדשים", "טהרות"];
