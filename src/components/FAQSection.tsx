import { useState } from "react";
import { Card } from "@/components/ui/card";
import { ChevronDown, ChevronUp, HelpCircle } from "lucide-react";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
  order_index: number;
}

interface FAQSectionProps {
  items: FAQItem[];
  title?: string;
}

const FAQSection = ({ items, title = "שאלות ותשובות נפוצות" }: FAQSectionProps) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!items || items.length === 0) {
    return null;
  }

  const sortedItems = [...items].sort((a, b) => a.order_index - b.order_index);

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent/10 text-accent">
          <HelpCircle className="w-6 h-6" />
        </div>
        <h2 className="text-3xl font-bold text-foreground">{title}</h2>
      </div>

      <div className="space-y-4">
        {sortedItems.map((item) => {
          const isExpanded = expandedId === item.id;
          
          return (
            <Card
              key={item.id}
              className="overflow-hidden transition-all duration-300 border-border hover:shadow-md"
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : item.id)}
                className="w-full p-6 text-right flex items-center justify-between gap-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-foreground">
                    {item.question}
                  </h3>
                </div>
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <div className="px-6 pb-6 animate-in slide-in-from-top-2 duration-300">
                  <div className="pt-4 border-t border-border">
                    <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {item.answer}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
};

export default FAQSection;