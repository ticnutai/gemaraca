/**
 * Backfill script: populate full_text for psakei din that have source_url
 * but empty full_text. Supports HTML, TXT and DOCX files from Supabase Storage.
 *
 * Usage:
 *   node scripts/backfill-full-text.mjs                # dry-run (report only)
 *   node scripts/backfill-full-text.mjs --run           # actually update DB
 *   node scripts/backfill-full-text.mjs --run --limit 50 # process only 50
 */
import { createClient } from '@supabase/supabase-js';
import mammoth from 'mammoth';
import { readFileSync } from 'fs';

// ── Config ──
const env = readFileSync('.env', 'utf8');
const SUPABASE_URL = env.match(/VITE_SUPABASE_URL=["']?([^"'\r\n]+)/)?.[1]?.trim();
const SUPABASE_KEY = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY=["']?([^"'\r\n]+)/)?.[1]?.trim();
const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--run');
const LIMIT = args.includes('--limit') ? parseInt(args[args.indexOf('--limit') + 1]) : 0;
const MAX_TEXT_LENGTH = 100_000;
const BATCH_SIZE = 20; // fetch this many records at a time
const CONCURRENCY = 5; // parallel file downloads

// ── Helpers ──
function getFileExt(url) {
  return url.match(/\.(html|txt|pdf|docx?|rtf)(?:\?|$)/i)?.[1]?.toLowerCase() || '';
}

function stripHtml(html) {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text) {
  if (text.length > MAX_TEXT_LENGTH) {
    return text.substring(0, MAX_TEXT_LENGTH) + '... [קוצר]';
  }
  return text;
}

async function extractText(url, ext) {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

  if (ext === 'txt') {
    return await resp.text();
  }

  if (ext === 'html' || ext === 'htm') {
    const html = await resp.text();
    return stripHtml(html);
  }

  if (ext === 'docx' || ext === 'doc') {
    const buffer = Buffer.from(await resp.arrayBuffer());
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported extension: ${ext}`);
}

// ── Main ──
async function main() {
  console.log(DRY_RUN ? '🔍 DRY RUN (add --run to update DB)' : '🚀 LIVE RUN — will update DB');
  
  const stats = { total: 0, success: 0, skipped: 0, failed: 0, byExt: {} };
  let from = 0;
  let hasMore = true;

  // Filter: only Supabase Storage URLs (external ones like gov.il return 403/404)
  const STORAGE_FILTER = args.includes('--all') ? null : '%supabase.co/storage%';
  if (STORAGE_FILTER) {
    console.log('📂 Processing only Supabase Storage URLs (add --all for external too)\n');
  }

  while (hasMore) {
    let query = sb.from('psakei_din')
      .select('id, title, source_url')
      .is('full_text', null)
      .not('source_url', 'is', null)
      .range(from, from + BATCH_SIZE - 1)
      .order('created_at', { ascending: true });

    if (STORAGE_FILTER) {
      query = query.like('source_url', STORAGE_FILTER);
    }

    const { data: batch, error } = await query;
    if (error) { console.error('DB error:', error.message); break; }
    if (!batch || batch.length === 0) { hasMore = false; break; }

    // Process in parallel with concurrency limit
    const chunks = [];
    for (let i = 0; i < batch.length; i += CONCURRENCY) {
      chunks.push(batch.slice(i, i + CONCURRENCY));
    }

    for (const chunk of chunks) {
      await Promise.all(chunk.map(async (psak) => {
        stats.total++;
        if (LIMIT && stats.total > LIMIT) return;

        const url = psak.source_url;
        const ext = getFileExt(url);
        stats.byExt[ext || 'no-ext'] = (stats.byExt[ext || 'no-ext'] || 0) + 1;

        // Only process files we can extract text from
        if (!['txt', 'html', 'htm', 'docx', 'doc'].includes(ext)) {
          // Check if it's an HTML page (external URL without extension)
          if (url.includes('supabase.co/storage')) {
            stats.skipped++;
            return;
          }
          // External URLs - try fetching as HTML
          try {
            const text = await extractText(url, 'html');
            if (text.length < 50) { stats.skipped++; return; }
            const finalText = truncate(text);
            if (!DRY_RUN) {
              const { error: updateErr } = await sb.from('psakei_din')
                .update({ full_text: finalText })
                .eq('id', psak.id);
              if (updateErr) throw updateErr;
            }
            stats.success++;
            console.log(`✓ [ext-html] ${psak.title?.substring(0, 50)} (${finalText.length} chars)`);
          } catch (e) {
            stats.failed++;
            if (stats.failed <= 10) console.log(`✗ ${psak.title?.substring(0, 40)} — ${e.message}`);
          }
          return;
        }

        try {
          const text = await extractText(url, ext);
          if (!text || text.length < 10) { stats.skipped++; return; }
          const finalText = truncate(text);

          if (!DRY_RUN) {
            const { error: updateErr } = await sb.from('psakei_din')
              .update({ full_text: finalText })
              .eq('id', psak.id);
            if (updateErr) throw updateErr;
          }

          stats.success++;
          if (stats.success <= 20 || stats.success % 50 === 0) {
            console.log(`✓ [${ext}] ${psak.title?.substring(0, 50)} (${finalText.length} chars)`);
          }
        } catch (e) {
          stats.failed++;
          if (stats.failed <= 10) {
            console.log(`✗ [${ext}] ${psak.title?.substring(0, 40)} — ${e.message}`);
          }
        }
      }));

      if (LIMIT && stats.total >= LIMIT) break;
    }

    from += BATCH_SIZE;
    if (LIMIT && stats.total >= LIMIT) break;

    // Progress
    if (from % 100 === 0) {
      console.log(`... processed ${stats.total} (${stats.success} OK, ${stats.failed} fail, ${stats.skipped} skip)`);
    }
  }

  console.log('\n═══ Summary ═══');
  console.log(`Total processed: ${stats.total}`);
  console.log(`Success:  ${stats.success}`);
  console.log(`Failed:   ${stats.failed}`);
  console.log(`Skipped:  ${stats.skipped}`);
  console.log('By extension:', stats.byExt);
  if (DRY_RUN) console.log('\n⚠️  Dry run — no changes made. Add --run to update DB.');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
