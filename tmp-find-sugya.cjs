const { createClient } = require('@supabase/supabase-js');
const url = 'https://jaotdqumpcfhcbkgtfib.supabase.co';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RkcXVtcGNmaGNia2d0ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDE0MTAsImV4cCI6MjA3NDgxNzQxMH0.t7kmGMKJvcjudbKxUPgQkqmycrCUPTvv5x4Q7byQcK0';
const supabase = createClient(url, key);
(async () => {
  try {
    const { data, error } = await supabase
      .from('sugyot')
      .select('id,title,daf_yomi,masechet')
      .ilike('title','%בבא בתרא%')
      .limit(20);
    if (error) {
      console.log('SUPABASE_ERROR', JSON.stringify(error, null, 2));
      return;
    }
    console.log(JSON.stringify(data, null, 2));
  } catch (e) {
    console.log('RUNTIME_ERROR', e?.message || e);
    console.log(e);
  }
})();
