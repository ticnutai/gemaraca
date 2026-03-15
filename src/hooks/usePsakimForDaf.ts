import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DafPsak {
  id: string;
  title: string;
  court: string;
  year: number;
  summary: string;
  full_text?: string;
  source_url?: string;
  case_number?: string;
  tags?: string[];
  references: {
    id: string;
    normalized: string;
    corrected_normalized: string | null;
    raw_reference: string;
    source: string;
    confidence: string;
    confidence_score: number | null;
    context_snippet: string | null;
    validation_status: string;
  }[];
}

/**
 * Fetches all psakei din that reference a specific tractate+daf
 * via the talmud_references advanced index.
 */
export function usePsakimForDaf(tractate: string, daf: string) {
  return useQuery({
    queryKey: ['psakim-for-daf', tractate, daf],
    queryFn: async () => {
      // Get all talmud_references for this tractate+daf, join with psakei_din
      const { data, error } = await supabase
        .from('talmud_references')
        .select(`
          id, normalized, corrected_normalized, raw_reference,
          source, confidence, confidence_score, context_snippet, validation_status,
          psakei_din(id, title, court, year, summary, full_text, source_url, case_number, tags)
        `)
        .eq('tractate', tractate)
        .eq('daf', daf)
        .not('validation_status', 'eq', 'incorrect')
        .order('confidence_score', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Group references by psak_din_id
      const psakMap = new Map<string, DafPsak>();

      for (const row of data || []) {
        const psak = row.psakei_din as any;
        if (!psak?.id) continue;

        if (!psakMap.has(psak.id)) {
          psakMap.set(psak.id, {
            id: psak.id,
            title: psak.title,
            court: psak.court,
            year: psak.year,
            summary: psak.summary,
            full_text: psak.full_text,
            source_url: psak.source_url,
            case_number: psak.case_number,
            tags: psak.tags,
            references: [],
          });
        }

        psakMap.get(psak.id)!.references.push({
          id: row.id,
          normalized: row.normalized,
          corrected_normalized: row.corrected_normalized,
          raw_reference: row.raw_reference,
          source: row.source,
          confidence: row.confidence,
          confidence_score: row.confidence_score,
          context_snippet: row.context_snippet,
          validation_status: row.validation_status,
        });
      }

      return Array.from(psakMap.values());
    },
    enabled: !!tractate && !!daf,
    staleTime: 5 * 60 * 1000,
  });
}
