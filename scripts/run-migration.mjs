#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://jaotdqumpcfhcbkgtfib.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RkcXVtcGNmaGNia2d0ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDE0MTAsImV4cCI6MjA3NDgxNzQxMH0.t7kmGMKJvcjudbKxUPgQkqmycrCUPTvv5x4Q7byQcK0';

const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const migrations = [
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS text_he JSONB DEFAULT NULL',
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS text_en JSONB DEFAULT NULL',
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS he_ref TEXT DEFAULT NULL',
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS book TEXT DEFAULT NULL',
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS categories JSONB DEFAULT NULL',
  'ALTER TABLE public.gemara_pages ADD COLUMN IF NOT EXISTS section_ref TEXT DEFAULT NULL',
  'CREATE INDEX IF NOT EXISTS idx_gemara_pages_sefaria_ref ON public.gemara_pages (sefaria_ref)',
  'CREATE INDEX IF NOT EXISTS idx_gemara_pages_sugya_id ON public.gemara_pages (sugya_id)',
  'ALTER TABLE public.gemara_pages DROP CONSTRAINT IF EXISTS gemara_pages_masechet_daf_unique',
  'ALTER TABLE public.gemara_pages ADD CONSTRAINT gemara_pages_sugya_id_unique UNIQUE (sugya_id)',
];

async function main() {
  const { data: auth, error: authErr } = await sb.auth.signInWithPassword({
    email: 'jj1212t@gmail.com', password: '543211',
  });
  if (authErr) { console.error('Auth failed:', authErr.message); process.exit(1); }
  console.log('Logged in');

  for (const sql of migrations) {
    console.log(`Running: ${sql.substring(0, 60)}...`);
    const { data, error } = await sb.functions.invoke('run-migration', {
      body: { sql },
    });
    if (error) {
      console.error(`  ❌ Error:`, error.message);
      // Try to read the response body
      if (error.context) {
        try {
          const body = await error.context.text();
          console.error(`  Body:`, body);
        } catch {}
      }
    } else {
      console.log(`  ✅ Success:`, JSON.stringify(data));
    }
  }
}

main();
