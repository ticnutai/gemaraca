import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Pool } from "https://deno.land/x/postgres@v0.19.3/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Direct Postgres pool for executing SQL (bypasses RPC limitations)
let _pool: Pool | null = null;
function getPool(): Pool {
  if (!_pool) {
    const dbUrl = Deno.env.get('SUPABASE_DB_URL');
    if (!dbUrl) throw new Error('SUPABASE_DB_URL not set');
    _pool = new Pool(dbUrl, 1, true);
  }
  return _pool;
}

async function execSqlDirect(sql: string): Promise<{ rows_affected: number; data?: any }> {
  const pool = getPool();
  const conn = await pool.connect();
  try {
    const result = await conn.queryObject(sql);
    return { rows_affected: result.rowCount ?? 0, data: result.rows };
  } finally {
    conn.release();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

  // Verify admin
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'לא מחובר' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const authClient = createClient(supabaseUrl, anonKey);
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'אימות נכשל' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Check admin role
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const { data: roleData } = await adminClient
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleData) {
    return new Response(JSON.stringify({ error: 'אין הרשאת מנהל' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'execute': {
        return await executeMigration(adminClient, body, user.id);
      }
      case 'fetch_url': {
        return await fetchFromUrl(body.url);
      }
      case 'list': {
        return await listMigrations(adminClient);
      }
      case 'rollback': {
        return await rollbackMigration(adminClient, body.migrationId, user.id);
      }
      case 'analyze': {
        return await analyzeSql(body.sql);
      }
      case 'tables': {
        return await listTables(adminClient);
      }
      default:
        return new Response(JSON.stringify({ error: 'פעולה לא ידועה' }), {
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('Migration error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function executeMigration(client: any, body: any, userId: string) {
  const { sql, name, description, source, sourceUrl } = body;

  if (!sql || !name) {
    return new Response(JSON.stringify({ error: 'SQL ושם נדרשים' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Validate SQL - block dangerous operations
  const upperSql = sql.toUpperCase().trim();
  const blocked = ['DROP DATABASE', 'DROP SCHEMA', 'ALTER DATABASE'];
  for (const b of blocked) {
    if (upperSql.includes(b)) {
      return new Response(JSON.stringify({ error: `פקודה חסומה: ${b}` }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  }

  // Record migration
  const { data: migration, error: insertError } = await client
    .from('migration_history')
    .insert({
      name,
      description: description || null,
      sql_content: sql,
      source: source || 'manual',
      source_url: sourceUrl || null,
      status: 'running',
      executed_by: userId,
    })
    .select()
    .single();

  if (insertError) {
    return new Response(JSON.stringify({ error: insertError.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const startTime = Date.now();

  try {
    // Execute SQL using direct Postgres connection (bypasses exec_sql RPC)
    const { rows_affected, data } = await execSqlDirect(sql);
    
    let rowsAffected = rows_affected;
    let resultData = data;

    const executionTime = Date.now() - startTime;

    // Update migration status
    await client
      .from('migration_history')
      .update({
        status: 'success',
        rows_affected: rowsAffected,
        execution_time_ms: executionTime,
        executed_at: new Date().toISOString(),
      })
      .eq('id', migration.id);

    return new Response(JSON.stringify({
      success: true,
      migrationId: migration.id,
      rowsAffected,
      executionTime,
      result: resultData,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (execError) {
    const executionTime = Date.now() - startTime;

    await client
      .from('migration_history')
      .update({
        status: 'failed',
        error_message: (execError as Error).message,
        execution_time_ms: executionTime,
        executed_at: new Date().toISOString(),
      })
      .eq('id', migration.id);

    return new Response(JSON.stringify({
      success: false,
      migrationId: migration.id,
      error: (execError as Error).message,
      executionTime,
    }), {
      status: 200, // still 200 so client can read the error
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function fetchFromUrl(url: string) {
  if (!url) {
    return new Response(JSON.stringify({ error: 'URL נדרש' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  try {
    const response = await fetch(url, {
      headers: { 'Accept': 'text/plain, application/sql, text/html, */*' }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let content = await response.text();

    // If HTML, try to extract SQL from <pre> or <code> tags
    if (contentType.includes('text/html')) {
      const preMatch = content.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
      const codeMatch = content.match(/<code[^>]*>([\s\S]*?)<\/code>/i);
      if (preMatch) {
        content = preMatch[1].replace(/<[^>]+>/g, '');
      } else if (codeMatch) {
        content = codeMatch[1].replace(/<[^>]+>/g, '');
      }
      // Decode HTML entities
      content = content
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }

    // Try to detect if it's a JSON migration file
    try {
      const json = JSON.parse(content);
      if (json.sql) {
        return new Response(JSON.stringify({
          sql: json.sql,
          name: json.name || 'Imported Migration',
          description: json.description || '',
          format: 'json',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (Array.isArray(json)) {
        // Array of SQL statements
        return new Response(JSON.stringify({
          sql: json.join(';\n'),
          name: 'Imported Migration Bundle',
          description: `${json.length} statements`,
          format: 'json_array',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    } catch {
      // Not JSON, treat as raw SQL
    }

    return new Response(JSON.stringify({
      sql: content.trim(),
      name: url.split('/').pop()?.replace(/\.[^.]+$/, '') || 'URL Migration',
      description: `Fetched from: ${url}`,
      format: contentType.includes('html') ? 'html_extracted' : 'raw',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: `שגיאה בשליפת URL: ${(error as Error).message}` }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function listMigrations(client: any) {
  const { data, error } = await client
    .from('migration_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  return new Response(JSON.stringify({ migrations: data }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function rollbackMigration(client: any, migrationId: string, userId: string) {
  if (!migrationId) {
    return new Response(JSON.stringify({ error: 'מזהה מיגרציה נדרש' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Get the migration
  const { data: migration } = await client
    .from('migration_history')
    .select('*')
    .eq('id', migrationId)
    .single();

  if (!migration) {
    return new Response(JSON.stringify({ error: 'מיגרציה לא נמצאה' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  // Mark as rolled back
  await client
    .from('migration_history')
    .update({ status: 'rolled_back' })
    .eq('id', migrationId);

  return new Response(JSON.stringify({
    success: true,
    message: 'המיגרציה סומנה כמבוטלת. שים לב: ביטול אוטומטי לא בוצע - יש לבצע ידנית.',
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function analyzeSql(sql: string) {
  if (!sql) {
    return new Response(JSON.stringify({ error: 'SQL נדרש' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  const upper = sql.toUpperCase();
  const analysis = {
    statements: sql.split(';').filter(s => s.trim()).length,
    operations: [] as string[],
    tables: [] as string[],
    risks: [] as string[],
    isDestructive: false,
  };

  // Detect operations
  if (upper.includes('CREATE TABLE')) analysis.operations.push('CREATE TABLE');
  if (upper.includes('ALTER TABLE')) analysis.operations.push('ALTER TABLE');
  if (upper.includes('DROP TABLE')) { analysis.operations.push('DROP TABLE'); analysis.isDestructive = true; analysis.risks.push('מחיקת טבלה!'); }
  if (upper.includes('INSERT')) analysis.operations.push('INSERT');
  if (upper.includes('UPDATE')) analysis.operations.push('UPDATE');
  if (upper.includes('DELETE')) { analysis.operations.push('DELETE'); analysis.risks.push('מחיקת נתונים'); }
  if (upper.includes('TRUNCATE')) { analysis.operations.push('TRUNCATE'); analysis.isDestructive = true; analysis.risks.push('ריקון טבלה!'); }
  if (upper.includes('CREATE INDEX')) analysis.operations.push('CREATE INDEX');
  if (upper.includes('CREATE FUNCTION')) analysis.operations.push('CREATE FUNCTION');
  if (upper.includes('CREATE TRIGGER')) analysis.operations.push('CREATE TRIGGER');
  if (upper.includes('CREATE POLICY')) analysis.operations.push('CREATE POLICY');
  if (upper.includes('GRANT')) analysis.operations.push('GRANT');
  if (upper.includes('REVOKE')) { analysis.operations.push('REVOKE'); analysis.risks.push('הסרת הרשאות'); }

  // Extract table names
  const tablePattern = /(?:FROM|INTO|TABLE|UPDATE|JOIN)\s+(?:public\.)?(\w+)/gi;
  let match;
  while ((match = tablePattern.exec(sql)) !== null) {
    const t = match[1].toLowerCase();
    if (!analysis.tables.includes(t) && !['if', 'not', 'exists', 'set', 'as', 'or', 'replace'].includes(t)) {
      analysis.tables.push(t);
    }
  }

  return new Response(JSON.stringify(analysis), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function listTables(_client: any) {
  try {
    const { data } = await execSqlDirect(
      `SELECT table_name, pg_size_pretty(pg_total_relation_size(quote_ident(table_name))) as size
       FROM information_schema.tables 
       WHERE table_schema = 'public' 
       ORDER BY table_name`
    );

    return new Response(JSON.stringify({ tables: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch {
    // Fallback: just list known tables
    return new Response(JSON.stringify({
      tables: [
        'psakei_din', 'faq_items', 'gemara_pages', 'migration_history',
        'modern_examples', 'pattern_sugya_links', 'smart_index_results',
        'sugya_psak_links', 'text_annotations', 'upload_sessions', 'user_roles'
      ]
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
