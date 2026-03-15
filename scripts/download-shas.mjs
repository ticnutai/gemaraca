#!/usr/bin/env node
/**
 * Download entire Shas (Talmud Bavli) to Supabase DB via get-gemara-text edge function.
 * 
 * This script:
 * 1. Iterates over all 37 masechtot × all dafim × amud a+b
 * 2. Calls the get-gemara-text edge function which:
 *    - Checks DB first (skips if already has text)
 *    - Falls back to Sefaria API
 *    - Saves text to DB for future fast access
 * 3. Runs in parallel batches with rate limiting
 *
 * Usage:
 *   node scripts/download-shas.mjs              # Download everything
 *   node scripts/download-shas.mjs Berakhot     # Single masechet
 *   node scripts/download-shas.mjs --status      # Check progress
 */

import { createClient } from '@supabase/supabase-js';

// ─── Config ──────────────────────────────────────────────────
const SUPABASE_URL = 'https://jaotdqumpcfhcbkgtfib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RkcXVtcGNmaGNia2d0ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDE0MTAsImV4cCI6MjA3NDgxNzQxMH0.t7kmGMKJvcjudbKxUPgQkqmycrCUPTvv5x4Q7byQcK0';
const ADMIN_EMAIL = 'jj1212t@gmail.com';
const ADMIN_PASSWORD = '543211';

const BATCH_SIZE = 15;          // parallel requests per batch (Sefaria handles ~20/s)
const DELAY_BETWEEN_BATCHES = 350; // ms between batches
const RETRY_DELAYS = [1000, 3000, 6000]; // progressive retry delays

// ─── Masechtot Data ──────────────────────────────────────────
const MASECHTOT = [
  { hebrewName: "ברכות", sefariaName: "Berakhot", maxDaf: 64, seder: "זרעים" },
  { hebrewName: "שבת", sefariaName: "Shabbat", maxDaf: 157, seder: "מועד" },
  { hebrewName: "עירובין", sefariaName: "Eruvin", maxDaf: 105, seder: "מועד" },
  { hebrewName: "פסחים", sefariaName: "Pesachim", maxDaf: 121, seder: "מועד" },
  { hebrewName: "שקלים", sefariaName: "Shekalim", maxDaf: 22, seder: "מועד" },
  { hebrewName: "יומא", sefariaName: "Yoma", maxDaf: 88, seder: "מועד" },
  { hebrewName: "סוכה", sefariaName: "Sukkah", maxDaf: 56, seder: "מועד" },
  { hebrewName: "ביצה", sefariaName: "Beitzah", maxDaf: 40, seder: "מועד" },
  { hebrewName: "ראש השנה", sefariaName: "Rosh_Hashanah", maxDaf: 35, seder: "מועד" },
  { hebrewName: "תענית", sefariaName: "Taanit", maxDaf: 31, seder: "מועד" },
  { hebrewName: "מגילה", sefariaName: "Megillah", maxDaf: 32, seder: "מועד" },
  { hebrewName: "מועד קטן", sefariaName: "Moed_Katan", maxDaf: 29, seder: "מועד" },
  { hebrewName: "חגיגה", sefariaName: "Chagigah", maxDaf: 27, seder: "מועד" },
  { hebrewName: "יבמות", sefariaName: "Yevamot", maxDaf: 122, seder: "נשים" },
  { hebrewName: "כתובות", sefariaName: "Ketubot", maxDaf: 112, seder: "נשים" },
  { hebrewName: "נדרים", sefariaName: "Nedarim", maxDaf: 91, seder: "נשים" },
  { hebrewName: "נזיר", sefariaName: "Nazir", maxDaf: 66, seder: "נשים" },
  { hebrewName: "סוטה", sefariaName: "Sotah", maxDaf: 49, seder: "נשים" },
  { hebrewName: "גיטין", sefariaName: "Gittin", maxDaf: 90, seder: "נשים" },
  { hebrewName: "קידושין", sefariaName: "Kiddushin", maxDaf: 82, seder: "נשים" },
  { hebrewName: "בבא קמא", sefariaName: "Bava_Kamma", maxDaf: 119, seder: "נזיקין" },
  { hebrewName: "בבא מציעא", sefariaName: "Bava_Metzia", maxDaf: 119, seder: "נזיקין" },
  { hebrewName: "בבא בתרא", sefariaName: "Bava_Batra", maxDaf: 176, seder: "נזיקין" },
  { hebrewName: "סנהדרין", sefariaName: "Sanhedrin", maxDaf: 113, seder: "נזיקין" },
  { hebrewName: "מכות", sefariaName: "Makkot", maxDaf: 24, seder: "נזיקין" },
  { hebrewName: "שבועות", sefariaName: "Shevuot", maxDaf: 49, seder: "נזיקין" },
  { hebrewName: "עבודה זרה", sefariaName: "Avodah_Zarah", maxDaf: 76, seder: "נזיקין" },
  { hebrewName: "הוריות", sefariaName: "Horayot", maxDaf: 14, seder: "נזיקין" },
  { hebrewName: "זבחים", sefariaName: "Zevachim", maxDaf: 120, seder: "קדשים" },
  { hebrewName: "מנחות", sefariaName: "Menachot", maxDaf: 110, seder: "קדשים" },
  { hebrewName: "חולין", sefariaName: "Chullin", maxDaf: 142, seder: "קדשים" },
  { hebrewName: "בכורות", sefariaName: "Bekhorot", maxDaf: 61, seder: "קדשים" },
  { hebrewName: "ערכין", sefariaName: "Arakhin", maxDaf: 34, seder: "קדשים" },
  { hebrewName: "תמורה", sefariaName: "Temurah", maxDaf: 34, seder: "קדשים" },
  { hebrewName: "כריתות", sefariaName: "Keritot", maxDaf: 28, seder: "קדשים" },
  { hebrewName: "מעילה", sefariaName: "Meilah", maxDaf: 22, seder: "קדשים" },
  { hebrewName: "נידה", sefariaName: "Niddah", maxDaf: 73, seder: "טהרות" },
];

// ─── Helpers ─────────────────────────────────────────────────
function toHebrewNumeral(num) {
  const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
  const tens = ['', 'י', 'כ', 'ל', 'מ', 'נ', 'ס', 'ע', 'פ', 'צ'];
  const hundreds = ['', 'ק', 'ר', 'ש', 'ת'];
  if (num === 15) return 'ט״ו';
  if (num === 16) return 'ט״ז';
  const h = Math.floor(num / 100);
  const t = Math.floor((num % 100) / 10);
  const o = num % 10;
  let result = hundreds[h] + tens[t] + ones[o];
  return result.length > 1 ? result.slice(0, -1) + '״' + result.slice(-1) : result + '׳';
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function generateAllDafim(masechtot) {
  const dafim = [];
  for (const m of masechtot) {
    for (let daf = 2; daf <= m.maxDaf; daf++) {
      for (const amud of ['a', 'b']) {
        dafim.push({
          masechet: m,
          daf,
          amud,
          ref: `${m.sefariaName}.${daf}${amud}`,
          sugyaId: `${m.sefariaName.toLowerCase()}_${daf}${amud}`,
        });
      }
    }
  }
  return dafim;
}

// ─── Main ────────────────────────────────────────────────────
async function main() {
  console.log('\n══════════════════════════════════════════════════');
  console.log('   📚 הורדת כל הש"ס לדאטאבייס');
  console.log('══════════════════════════════════════════════════\n');

  const args = process.argv.slice(2);

  // Create Supabase client and authenticate
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data: authData, error: authError } = await sb.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
  });
  if (authError) {
    console.error('❌ Login failed:', authError.message);
    process.exit(1);
  }
  console.log('🔐 Logged in as:', authData.user.email);

  // --status mode: just show progress
  if (args[0] === '--status') {
    await showStatus(sb);
    process.exit(0);
  }

  // Filter to specific masechet if provided
  let targetMasechtot = MASECHTOT;
  if (args[0] && args[0] !== '--status') {
    targetMasechtot = MASECHTOT.filter(m =>
      m.sefariaName.toLowerCase() === args[0].toLowerCase() ||
      m.hebrewName === args[0]
    );
    if (targetMasechtot.length === 0) {
      console.error(`❌ Masechet not found: ${args[0]}`);
      console.log('Available:', MASECHTOT.map(m => m.sefariaName).join(', '));
      process.exit(1);
    }
  }

  // Generate all dafim
  const allDafim = generateAllDafim(targetMasechtot);
  console.log(`📊 Total dafim to process: ${allDafim.length}`);
  console.log(`📖 Masechtot: ${targetMasechtot.map(m => m.hebrewName).join(', ')}\n`);

  // Check which dafim already have text in DB
  console.log('🔍 Checking existing data in DB...');
  const existingRefs = new Set();
  
  // Query in chunks of 500
  for (let i = 0; i < targetMasechtot.length; i++) {
    const m = targetMasechtot[i];
    const { data } = await sb
      .from('gemara_pages')
      .select('sefaria_ref')
      .eq('masechet', m.sefariaName)
      .not('text_he', 'is', null);
    if (data) {
      data.forEach(row => existingRefs.add(row.sefaria_ref));
    }
  }
  
  const pending = allDafim.filter(d => !existingRefs.has(d.ref));
  console.log(`✅ Already in DB with text: ${existingRefs.size}`);
  console.log(`⏳ Pending download: ${pending.length}\n`);

  if (pending.length === 0) {
    console.log('🎉 הכל כבר הורד! כל הש"ס בדאטאבייס.');
    process.exit(0);
  }

  // Download in batches
  let completed = 0;
  let errors = 0;
  let skipped = 0;
  const startTime = Date.now();
  let currentMasechet = '';

  for (let i = 0; i < pending.length; i += BATCH_SIZE) {
    const batch = pending.slice(i, i + BATCH_SIZE);
    
    // Print masechet header when entering new masechet
    const batchMasechet = batch[0].masechet.hebrewName;
    if (batchMasechet !== currentMasechet) {
      currentMasechet = batchMasechet;
      const masechetTotal = pending.filter(d => d.masechet.hebrewName === currentMasechet).length;
      console.log(`\n── 📖 ${currentMasechet} (${masechetTotal} דפים) ──`);
    }

    const results = await Promise.allSettled(
      batch.map(daf => downloadDaf(sb, daf))
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        if (r.value === 'skipped') skipped++;
        else completed++;
      } else {
        errors++;
      }
    }

    const pct = ((completed + skipped + errors) / pending.length * 100).toFixed(1);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
    const rate = ((completed + skipped) / (elapsed || 1)).toFixed(1);
    process.stdout.write(
      `\r  ✅ ${completed} | ⏭️ ${skipped} | ❌ ${errors} | ${pct}% | ${elapsed}s | ${rate}/s`
    );

    // Rate limit delay
    if (i + BATCH_SIZE < pending.length) {
      await sleep(DELAY_BETWEEN_BATCHES);
    }
  }

  const totalTime = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
  console.log(`\n\n══════════════════════════════════════════════════`);
  console.log(`   🏁 סיום!`);
  console.log(`   ✅ הורדו: ${completed}`);
  console.log(`   ⏭️  כבר קיימים: ${skipped}`);
  console.log(`   ❌ שגיאות: ${errors}`);
  console.log(`   ⏱️  זמן: ${totalTime} דקות`);
  console.log(`══════════════════════════════════════════════════\n`);
}

async function downloadDaf(sb, daf) {
  for (let attempt = 0; ; attempt++) {
    try {
      // Call load-daf edge function (uses service role — bypasses RLS)
      // It fetches from Sefaria + inserts/updates in DB
      const amudLabel = daf.amud === 'a' ? 'ע״א' : 'ע״ב';
      const hebrewDaf = toHebrewNumeral(daf.daf);
      const { data, error } = await sb.functions.invoke('load-daf', {
        body: {
          dafNumber: daf.daf,
          sugya_id: daf.sugyaId,
          title: `${daf.masechet.hebrewName} דף ${hebrewDaf} ${amudLabel}`,
          masechet: daf.masechet.hebrewName,
          amud: daf.amud,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Unknown error');

      return data.message?.includes('כבר קיים') ? 'skipped' : 'downloaded';
    } catch (err) {
      if (attempt >= RETRY_DELAYS.length) {
        console.error(`\n  ❌ Failed: ${daf.ref} — ${err.message || err}`);
        throw err;
      }
      const delay = (err.message || '').includes('429') || (err.message || '').includes('Rate')
        ? RETRY_DELAYS[attempt] * 2 
        : RETRY_DELAYS[attempt];
      await sleep(delay);
    }
  }
}

async function showStatus(sb) {
  console.log('📊 סטטוס הורדת הש"ס:\n');
  
  let totalPages = 0;
  let totalWithText = 0;
  
  for (const m of MASECHTOT) {
    const totalDafim = (m.maxDaf - 1) * 2; // daf 2..maxDaf, amud a+b
    totalPages += totalDafim;
    
    const { count } = await sb
      .from('gemara_pages')
      .select('*', { count: 'exact', head: true })
      .eq('masechet', m.sefariaName)
      .not('text_he', 'is', null);
    
    const withText = count || 0;
    totalWithText += withText;
    const pct = (withText / totalDafim * 100).toFixed(0);
    const bar = '█'.repeat(Math.floor(withText / totalDafim * 20)).padEnd(20, '░');
    
    console.log(`  ${m.hebrewName.padEnd(12)} ${bar} ${pct.padStart(3)}% (${withText}/${totalDafim})`);
  }
  
  const totalPct = (totalWithText / totalPages * 100).toFixed(1);
  console.log(`\n  ─────────────────────────────────────────`);
  console.log(`  סה"כ: ${totalWithText}/${totalPages} (${totalPct}%)\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
