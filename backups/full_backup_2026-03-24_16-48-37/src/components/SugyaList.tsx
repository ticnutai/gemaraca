import { useState } from "react";
import SugyaCard from "./SugyaCard";
import SearchBar from "./SearchBar";

const sugyot = [
  {
    id: "shnayim-ochazin",
    title: "שנים אוחזין בטלית",
    dafYomi: "בבא מציעא ב ע\"א",
    summary: "שני אנשים תופסים בטלית וכל אחד טוען שהיא שלו - כיצד בית הדין מכריע במחלוקת הבעלות",
    casesCount: 15,
    tags: ["קניין", "מחלוקת", "בעלות"]
  },
  {
    id: "eilu-metziot",
    title: "אלו מציאות שלו",
    dafYomi: "בבא מציעא כא ע\"א",
    summary: "מתי אדם זוכה במציאה לעצמו ומתי חייב להשיבה - דיני יאוש והכרזה",
    casesCount: 22,
    tags: ["אבידה", "מציאה", "יאוש"]
  },
  {
    id: "hashavat-aveida",
    title: "מצוות השבת אבידה",
    dafYomi: "בבא מציעא כז ע\"ב",
    summary: "חובת השבת אבידה - סימנים, הכרזה ואחריות המוצא",
    casesCount: 18,
    tags: ["אבידה", "השבה", "סימנים"]
  },
  {
    id: "geneiva-aveida",
    title: "גניבה ואבידה מההקדש",
    dafYomi: "בבא מציעא כח ע\"א",
    summary: "דיני ממון הקדש - מה הדין במציאת או גניבת רכוש של הקדש",
    casesCount: 8,
    tags: ["הקדש", "גניבה", "קדשים"]
  },
  {
    id: "hamotzei-shtarot",
    title: "המוצא שטרות",
    dafYomi: "בבא מציעא יח ע\"א",
    summary: "מציאת מסמכים ושטרות - מתי מחזירים ומתי חוששים למרמה",
    casesCount: 12,
    tags: ["שטרות", "מסמכים", "החזרה"]
  },
  {
    id: "hamaafil",
    title: "המפקיד אצל חברו",
    dafYomi: "בבא מציעא כט ע\"ב",
    summary: "דיני פיקדון - אחריות השומר וחובת השמירה על ממון שהופקד אצלו",
    casesCount: 16,
    tags: ["פיקדון", "שמירה", "אחריות"]
  }
];

const SugyaList = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSugyot = sugyot.filter((sugya) => {
    const query = searchQuery.toLowerCase();
    return (
      sugya.title.includes(query) ||
      sugya.summary.includes(query) ||
      sugya.tags.some((tag) => tag.includes(query)) ||
      sugya.dafYomi.includes(query)
    );
  });

  return (
    <section id="sugyot" className="py-20 px-4">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 space-y-6">
          <h2 className="text-4xl font-bold text-foreground">סוגיות בדפים א-ל</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            עיין בסוגיות המרכזיות בתחילת המסכת והתחבר למקרים מודרניים המדגימים את העקרונות ההלכתיים
          </p>
          <SearchBar onSearch={setSearchQuery} />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSugyot.length > 0 ? (
            filteredSugyot.map((sugya, index) => (
              <SugyaCard key={index} {...sugya} />
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <p className="text-xl text-muted-foreground">לא נמצאו סוגיות התואמות לחיפוש</p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

export default SugyaList;
