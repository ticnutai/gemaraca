import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cachePsakim, cacheDafPsakim, getCachedDafPsakim, getCachedPsak, type CachedPsak } from '@/lib/psakCache';

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
 * Uses IndexedDB cache for instant loading, refreshes from cloud in background.
 */
export function usePsakimForDaf(tractate: string, daf: string) {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: ['psakim-for-daf', tractate, daf],
    queryFn: async () => {
      // Step 1: Try IndexedDB cache for instant result
      const cachedIds = await getCachedDafPsakim(tractate, daf);
      let cachedResult: DafPsak[] | null = null;

      if (cachedIds && cachedIds.length > 0) {
        const cachedPsakim = await Promise.all(cachedIds.map(id => getCachedPsak(id)));
        const valid = cachedPsakim.filter((p): p is CachedPsak => !!p);
        if (valid.length > 0) {
          cachedResult = valid.map(p => ({
            id: p.id,
            title: p.title,
            court: p.court,
            year: p.year,
            summary: p.summary,
            full_text: p.full_text || undefined,
            source_url: p.source_url || undefined,
            case_number: p.case_number || undefined,
            tags: p.tags,
            references: [],
          }));
        }
      }

      // Step 2: Fetch from cloud
      const cloudFetch = async (): Promise<DafPsak[]> => {
        const { data, error } = await supabase
          .from('talmud_references')
          .select(`
            id, normalized, raw_reference,
            source, confidence, confidence_score, context_snippet, validation_status,
            psakei_din(id, title, court, year, summary, full_text, source_url, case_number, tags)
          `)
          .eq('tractate', tractate)
          .eq('daf', daf)
          .not('validation_status', 'eq', 'incorrect')
          .order('confidence_score', { ascending: false, nullsFirst: false });

        if (error) throw error;

        const psakMap = new Map<string, DafPsak>();

        for (const row of (data || []) as any[]) {
          const psak = row.psakei_din;
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
            corrected_normalized: row.corrected_normalized || null,
            raw_reference: row.raw_reference,
            source: row.source,
            confidence: row.confidence,
            confidence_score: row.confidence_score,
            context_snippet: row.context_snippet,
            validation_status: row.validation_status,
          });
        }

        const result = Array.from(psakMap.values());

        // Save to IndexedDB cache for next time
        const toCache: CachedPsak[] = result.map(p => ({
          id: p.id,
          title: p.title,
          court: p.court,
          year: p.year,
          summary: p.summary,
          full_text: p.full_text || null,
          source_url: p.source_url || null,
          case_number: p.case_number || null,
          tags: p.tags,
          _cachedAt: Date.now(),
        }));
        cachePsakim(toCache);
        cacheDafPsakim(tractate, daf, result.map(p => p.id));

        return result;
      };

      // If we have cached data, return it immediately and refresh in background
      if (cachedResult) {
        cloudFetch().then(freshData => {
          queryClient.setQueryData(['psakim-for-daf', tractate, daf], freshData);
        }).catch(() => { /* keep cached data on network error */ });
        return cachedResult;
      }

      // No cache — must wait for cloud
      return cloudFetch();
    },
    enabled: !!tractate && !!daf,
    staleTime: 5 * 60 * 1000,
  });
}
