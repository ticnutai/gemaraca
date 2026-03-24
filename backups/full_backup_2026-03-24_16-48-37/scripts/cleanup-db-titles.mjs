// Cleanup script: fix titles and summaries with folder paths and extensions
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jaotdqumpcfhcbkgtfib.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RkcXVtcGNmaGNia2d0ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDE0MTAsImV4cCI6MjA3NDgxNzQxMH0.t7kmGMKJvcjudbKxUPgQkqmycrCUPTvv5x4Q7byQcK0';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function cleanTitle(title) {
  // Only strip KNOWN folder prefixes (not case numbers like 585321/5)
  const folderPrefixes = [
    /^sample[ _-]?psakim\//i,
    /^psakim[ _-]?downloads?[ _-]?py\//i,
    /^downloaded[ _-]?psakim\//i,
    /^all[ _-]?psakim\//i,
    /^uploads?\//i,
  ];
  
  let clean = title;
  for (const prefix of folderPrefixes) {
    clean = clean.replace(prefix, '');
  }
  
  // Remove file extension at end (.html, .pdf, .docx, etc.)
  clean = clean.replace(/\.(html?|pdf|docx?|txt|rtf)$/i, '');
  
  return clean.trim() || title;
}

function cleanSummary(summary) {
  // Fix "פסק דין שהועלה מהקובץ: sample-psakim/filename.html"
  const match = summary.match(/פסק דין שהועלה מהקובץ:\s*(.+)/);
  if (match) {
    const fileName = match[1].trim();
    const cleanName = cleanTitle(fileName);
    if (cleanName !== fileName) {
      return `פסק דין שהועלה מהקובץ: ${cleanName}`;
    }
  }
  return summary;
}

async function main() {
  console.log('🔍 מחפש פסקי דין עם נתיבי תיקייה או סיומות בשם...');
  
  // First, fix the two titles that were wrongly truncated by previous run
  const wrongFixes = [
    { broken: '5, בית הדין חיפה', original: 'דמי שימוש בדירה - תיק 585321/5, בית הדין חיפה' },
    { broken: '1   תביעה כספית בגין נזקים לדירה', original: 'פסק דין בתיק 1082531/1 - תביעה כספית בגין נזקים לדירה' },
  ];
  
  for (const fix of wrongFixes) {
    const { data } = await supabase
      .from('psakei_din')
      .select('id')
      .eq('title', fix.broken)
      .limit(1);
    
    if (data && data.length > 0) {
      await supabase.from('psakei_din').update({ title: fix.original }).eq('id', data[0].id);
      console.log(`🔧 תוקנה כותרת שבורה: "${fix.broken}" → "${fix.original}"`);
    }
  }
  
  // Get all psakim
  const { data: psakim, error } = await supabase
    .from('psakei_din')
    .select('id, title, summary')
    .order('id', { ascending: true });
  
  if (error) {
    console.error('❌ שגיאה:', error.message);
    return;
  }
  
  console.log(`📊 נמצאו ${psakim.length} פסקי דין`);
  
  let titleFixes = 0;
  let summaryFixes = 0;
  
  for (const psak of psakim) {
    const updates = {};
    
    // Check title: has known folder prefix or file extension?
    const newTitle = cleanTitle(psak.title);
    if (newTitle !== psak.title) {
      updates.title = newTitle;
      console.log(`📝 כותרת: "${psak.title}" → "${newTitle}"`);
      titleFixes++;
    }
    
    // Check summary: has folder path or raw filename?
    if (psak.summary && psak.summary.includes('שהועלה מהקובץ') && (psak.summary.includes('/') || /\.\w{2,5}/.test(psak.summary))) {
      const newSummary = cleanSummary(psak.summary);
      if (newSummary !== psak.summary) {
        updates.summary = newSummary;
        summaryFixes++;
      }
    }
    
    if (Object.keys(updates).length > 0) {
      const { error: updateErr } = await supabase
        .from('psakei_din')
        .update(updates)
        .eq('id', psak.id);
      
      if (updateErr) {
        console.error(`⚠️ שגיאה בעדכון ${psak.id}: ${updateErr.message}`);
      }
    }
  }
  
  console.log(`\n✅ סיום!`);
  console.log(`   📝 כותרות תוקנו: ${titleFixes}`);
  console.log(`   📋 תקצירים תוקנו: ${summaryFixes}`);
}

main();
