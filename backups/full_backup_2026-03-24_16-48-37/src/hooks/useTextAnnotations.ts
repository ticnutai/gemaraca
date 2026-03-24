import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface TextAnnotation {
  id: string;
  start_offset: number;
  end_offset: number;
  original_text: string;
  styles: {
    fontSize?: number;
    fontFamily?: string;
    color?: string;
    backgroundColor?: string;
    isBold?: boolean;
    isItalic?: boolean;
  };
}

export const useTextAnnotations = (sourceType: string, sourceId: string) => {
  const [annotations, setAnnotations] = useState<TextAnnotation[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAnnotations = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('text_annotations')
        .select('*')
        .eq('source_type', sourceType)
        .eq('source_id', sourceId);

      if (error) throw error;
      
      setAnnotations((data || []).map(a => ({
        id: a.id,
        start_offset: a.start_offset,
        end_offset: a.end_offset,
        original_text: a.original_text,
        styles: a.styles as TextAnnotation['styles']
      })));
    } catch (err) {
      console.error("Error loading annotations:", err);
    } finally {
      setLoading(false);
    }
  }, [sourceType, sourceId]);

  useEffect(() => {
    loadAnnotations();
  }, [loadAnnotations]);

  const saveAnnotation = async (
    startOffset: number,
    endOffset: number,
    originalText: string,
    styles: TextAnnotation['styles']
  ) => {
    try {
      const { data, error } = await supabase
        .from('text_annotations')
        .upsert({
          source_type: sourceType,
          source_id: sourceId,
          start_offset: startOffset,
          end_offset: endOffset,
          original_text: originalText,
          styles
        }, { onConflict: 'source_type,source_id,start_offset,end_offset' })
        .select()
        .single();

      if (error) throw error;

      setAnnotations(prev => {
        const existing = prev.findIndex(
          a => a.start_offset === startOffset && a.end_offset === endOffset
        );
        if (existing >= 0) {
          const updated = [...prev];
          updated[existing] = {
            ...updated[existing],
            styles
          };
          return updated;
        }
        return [...prev, {
          id: data.id,
          start_offset: startOffset,
          end_offset: endOffset,
          original_text: originalText,
          styles
        }];
      });

      return data;
    } catch (err) {
      console.error("Error saving annotation:", err);
      throw err;
    }
  };

  const deleteAnnotation = async (startOffset: number, endOffset: number) => {
    try {
      const { error } = await supabase
        .from('text_annotations')
        .delete()
        .eq('source_type', sourceType)
        .eq('source_id', sourceId)
        .eq('start_offset', startOffset)
        .eq('end_offset', endOffset);

      if (error) throw error;

      setAnnotations(prev => prev.filter(
        a => !(a.start_offset === startOffset && a.end_offset === endOffset)
      ));
    } catch (err) {
      console.error("Error deleting annotation:", err);
      throw err;
    }
  };

  return {
    annotations,
    loading,
    saveAnnotation,
    deleteAnnotation,
    refresh: loadAnnotations
  };
};