const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jaotdqumpcfhcbkgtfib.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imphb3RkcXVtcGNmaGNia2d0ZmliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyNDE0MTAsImV4cCI6MjA3NDgxNzQxMH0.t7kmGMKJvcjudbKxUPgQkqmycrCUPTvv5x4Q7byQcK0');
(async () => {
  const { data, error } = await supabase
    .from('gemara_pages')
    .select('sugya_id,title,daf_yomi,masechet')
    .ilike('title','%בבא בתרא%')
    .limit(30);
  if (error) { console.log(JSON.stringify(error, null, 2)); return; }
  console.log(JSON.stringify(data, null, 2));
})();
