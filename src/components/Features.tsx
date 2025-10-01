import { BookOpen, Scale, Search, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: BookOpen,
    title: "סוגיות מפורטות",
    description: "כל סוגיה בגמרא מוצגת בצורה ברורה עם הסבר וניתוח מעמיק"
  },
  {
    icon: Scale,
    title: "פסקי דין מודרניים",
    description: "קישור לפסקי דין אמיתיים מבתי המשפט שממחישים את הדינים הגמראיים"
  },
  {
    icon: Link2,
    title: "חיבור למציאות",
    description: "המחשת הדוגמאות הגמראיות (חמור, פרה) למקרים מהחיים המודרניים"
  },
  {
    icon: Search,
    title: "חיפוש מתקדם",
    description: "מצא במהירות סוגיות לפי נושא, פרק, או מקרה מעשי ספציפי"
  }
];

const Features = () => {
  return (
    <section className="py-20 px-4 bg-muted/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-12 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">למה המערכת שלנו?</h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            גישה חדשנית ללימוד גמרא המחברת בין העולם ההלכתי למציאות המודרנית
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index} className="p-6 space-y-4 bg-card border-border hover:shadow-lg transition-all duration-300">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary to-secondary w-fit">
                  <Icon className="w-6 h-6 text-primary-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-bold text-foreground">{feature.title}</h3>
                  <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;
