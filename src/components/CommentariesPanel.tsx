import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BookMarked, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

interface CommentariesPanelProps {
  dafYomi: string;
  masechet?: string;
}

interface Commentary {
  ref: string;
  heRef: string;
  sourceRef: string;
  sourceHeRef: string;
  category: string;
  type: string;
  text: string | string[];
  he: string | string[];
  book: string;
  index_title: string;
  collectiveTitle: any;
}

export default function CommentariesPanel({ dafYomi, masechet: masechetProp }: CommentariesPanelProps) {
  const { toast } = useToast();

  const convertDafYomiToSefariaRef = (dafYomi: string): string => {
    const parts = dafYomi.trim().split(' ');
    const masechet = masechetProp || "Bava_Batra";
    
    if (parts.length >= 3) {
      const dafNum = parts[parts.length - 2];
      const amud = parts[parts.length - 1];
      const amudLetter = amud === 'א' ? 'a' : 'b';
      
      const hebrewToNumber: Record<string, string> = {
        'א': '1', 'ב': '2', 'ג': '3', 'ד': '4', 'ה': '5',
        'ו': '6', 'ז': '7', 'ח': '8', 'ט': '9', 'י': '10',
        'יא': '11', 'יב': '12', 'יג': '13', 'יד': '14', 'טו': '15',
        'טז': '16', 'יז': '17', 'יח': '18', 'יט': '19', 'כ': '20'
      };
      
      const dafNumber = hebrewToNumber[dafNum] || dafNum;
      return `${masechet}.${dafNumber}${amudLetter}`;
    }
    
    return "Bava_Batra.2a";
  };

  const sefariaRef = convertDafYomiToSefariaRef(dafYomi);

  const { data: commentaries = [], isLoading } = useQuery({
    queryKey: ['commentaries', sefariaRef],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('get-commentaries', {
        body: { ref: sefariaRef }
      });
      if (error) throw error;
      if (data?.success) return data.data as Commentary[];
      throw new Error(data?.error || 'Failed to load commentaries');
    },
    staleTime: Infinity,
    retry: 1,
    meta: {
      onError: () => {
        toast({
          title: "שגיאה בטעינת מפרשים",
          description: "לא הצלחנו לטעון את המפרשים. נסה שוב מאוחר יותר.",
          variant: "destructive",
        });
      }
    }
  });

  const renderCommentaryText = (text: string | string[]) => {
    if (Array.isArray(text)) {
      return text.map((line: string, index: number) => (
        <p key={index} className="mb-2 leading-relaxed" dir="rtl">
          {line}
        </p>
      ));
    }
    return <p className="leading-relaxed" dir="rtl">{text}</p>;
  };

  const getCommentaryTitle = (commentary: Commentary) => {
    if (commentary.collectiveTitle?.he) {
      return commentary.collectiveTitle.he;
    }
    return commentary.index_title || commentary.book || 'מפרש';
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <BookMarked className="h-5 w-5 text-primary" />
          <CardTitle className="text-xl">מפרשים</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3 py-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2 border rounded-lg p-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : commentaries.length > 0 ? (
          <Accordion type="single" collapsible className="w-full">
            {commentaries.map((commentary, index) => (
              <AccordionItem key={index} value={`commentary-${index}`}>
                <AccordionTrigger className="text-right" dir="rtl">
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-semibold">{getCommentaryTitle(commentary)}</span>
                    <span className="text-sm text-muted-foreground">{commentary.heRef}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="prose prose-slate max-w-none dark:prose-invert pt-2">
                    {renderCommentaryText(commentary.he || commentary.text)}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            אין מפרשים זמינים עבור דף זה
          </div>
        )}
      </CardContent>
    </Card>
  );
}
