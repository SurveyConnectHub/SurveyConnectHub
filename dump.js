const https = require('https');
const fs = require('fs');

const TOKEN = process.env.SUPABASE_SRC_TOKEN;
const REF = process.env.SUPABASE_SRC_REF;
const DEST_TOKEN = process.env.SUPABASE_DEST_TOKEN;
const DEST_REF = process.env.SUPABASE_DEST_REF;

if (!TOKEN || !REF || !DEST_TOKEN || !DEST_REF) {
  console.error('Missing required env vars: SUPABASE_SRC_TOKEN, SUPABASE_SRC_REF, SUPABASE_DEST_TOKEN, SUPABASE_DEST_REF');
  process.exit(1);
}
const output = [];
const startTime = Date.now();

function write(...args) { 
  for (const a of args) output.push(a);
}

function quoteVal(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) {
    if (v.length === 0) return "'{}'";
    const items = v.map(item => {
      if (typeof item === 'string') return item.replace(/'/g, "''");
      return String(item);
    });
    return `'{${items.join(',')}}'`;
  }
  if (typeof v === 'object') return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function sqlQuery(query, retries = 3) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const opts = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 60000,
    };
    const doReq = (attempt) => {
      const req = https.request(opts, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 201) {
            try { resolve(JSON.parse(data)); }
            catch { resolve([]); }
          } else {
            if (attempt < retries && (res.statusCode === 429 || res.statusCode >= 500)) {
              setTimeout(() => doReq(attempt + 1), 2000 * attempt);
            } else {
              reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
            }
          }
        });
      });
      req.on('error', (err) => {
        if (attempt < retries) setTimeout(() => doReq(attempt + 1), 2000 * attempt);
        else reject(err);
      });
      req.on('timeout', () => { req.destroy(); if (attempt < retries) setTimeout(() => doReq(attempt + 1), 2000 * attempt); else reject(new Error('Timeout')); });
      req.write(body);
      req.end();
    };
    doReq(0);
  });
}

function destQuery(query) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ query });
    const opts = {
      hostname: 'api.supabase.com',
      path: `/v1/projects/${DEST_REF}/database/query`,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEST_TOKEN}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout: 30000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) {
          try { resolve(JSON.parse(data)); }
          catch { resolve([]); }
        } else {
          reject(new Error(`API ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

function mapArrayType(udtName) {
  if (!udtName) return 'text[]';
  const map = {
    '_text': 'text[]', '_int4': 'integer[]', '_int8': 'bigint[]',
    '_float4': 'real[]', '_float8': 'double precision[]',
    '_bool': 'boolean[]', '_numeric': 'numeric[]',
    '_varchar': 'character varying[]', '_uuid': 'uuid[]',
    '_json': 'json[]', '_jsonb': 'jsonb[]', '_bytea': 'bytea[]',
  };
  return map[udtName] || udtName.replace(/^_/, '') + '[]';
}

const STMT = '--=STMT=';

async function dump() {
  write('-- Full dump via Management API -- Date: ' + new Date().toISOString());

  // 1. Extensions
  console.log('Extensions...');
  const exts = await sqlQuery(`SELECT e.extname, e.extversion, n.nspname AS schema_name FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE n.nspname IN ('public','extensions') ORDER BY e.extname`);
  for (const e of exts) {
    write(STMT);
    write(`CREATE EXTENSION IF NOT EXISTS "${e.extname}" WITH SCHEMA "${e.schema_name}" VERSION '${e.extversion}';`);
  }

  // 2. Enums
  console.log('Enums...');
  const enums = await sqlQuery(`SELECT t.typname, string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace WHERE n.nspname = 'public' GROUP BY t.typname`);
  for (const en of enums) {
    write(STMT);
    write(`CREATE TYPE "${en.typname}" AS ENUM (${en.labels.split(',').map(l => `'${l}'`).join(', ')});`);
  }

  // 3. Tables
  console.log('Tables...');
  const tables = await sqlQuery(`SELECT table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema='public' ORDER BY table_name`);
  for (const t of tables) {
    const cols = await sqlQuery(`SELECT column_name,data_type,character_maximum_length,column_default,is_nullable,udt_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t.table_name}' ORDER BY ordinal_position`);
    const colNamesSet = new Set(cols.map(c => c.column_name));
    const pks = await sqlQuery(`SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name WHERE tc.table_schema='public' AND tc.table_name='${t.table_name}' AND tc.constraint_type='PRIMARY KEY'`);
    // Only include PK columns that exist, and deduplicate
    const seen = new Set();
    const validPks = pks.filter(p => {
      if (!colNamesSet.has(p.column_name) || seen.has(p.column_name)) return false;
      seen.add(p.column_name);
      return true;
    });
    const pkSet = new Set(validPks.map(p => p.column_name));
    
    write(STMT);
    write(`CREATE TABLE IF NOT EXISTS "public"."${t.table_name}" (`);
    const defs = cols.map(c => {
      let t = c.data_type === 'USER-DEFINED' ? c.udt_name : c.data_type === 'ARRAY' ? mapArrayType(c.udt_name) : c.data_type;
      if (c.character_maximum_length && t.toLowerCase().includes('char')) t += `(${c.character_maximum_length})`;
      let d = `"${c.column_name}" ${t}`;
      if (c.column_default && !c.column_default.includes('identity')) d += ` DEFAULT ${c.column_default}`;
      if (c.is_nullable === 'NO' || pkSet.has(c.column_name)) d += ' NOT NULL';
      return d;
    });
    if (validPks.length > 0) defs.push(`PRIMARY KEY (${validPks.map(p => `"${p.column_name}"`).join(', ')})`);
    write('  ' + defs.join(',\n  '));
    write(');');
  }

  // 4. Indexes
  console.log('Indexes...');
  const idxs = await sqlQuery(`SELECT schemaname,tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname NOT LIKE '%_pkey' ORDER BY tablename`);
  for (const i of idxs) {
    write(STMT);
    write(i.indexdef.replace('CREATE INDEX','CREATE INDEX IF NOT EXISTS').replace('CREATE UNIQUE INDEX','CREATE UNIQUE INDEX IF NOT EXISTS') + ';');
  }

  // 5. Foreign Keys
  console.log('FKs...');
  const fks = await sqlQuery(`SELECT tc.constraint_name,tc.table_name,kcu.column_name,ccu.table_name AS ft_name,ccu.column_name AS ft_column,rc.update_rule,rc.delete_rule FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name AND tc.table_schema=kcu.table_schema JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_schema='public'`);
  const fkMap = {};
  for (const f of fks) {
    const key = f.constraint_name;
    if (!fkMap[key]) fkMap[key] = {...f, cols:[], refCols:[]};
    fkMap[key].cols.push(f.column_name);
    fkMap[key].refCols.push(f.ft_column);
  }
  for (const key in fkMap) {
    const f = fkMap[key];
    write(STMT);
    write(`ALTER TABLE ONLY "public"."${f.table_name}" ADD CONSTRAINT "${f.constraint_name}" FOREIGN KEY (${f.cols.map(c=>`"${c}"`).join(',')}) REFERENCES "public"."${f.ft_name}"(${f.refCols.map(c=>`"${c}"`).join(',')}) ON UPDATE ${f.update_rule} ON DELETE ${f.delete_rule};`);
  }

  // 6. Functions (each individual statement)
  console.log('Functions...');
  const funcs = await sqlQuery(`SELECT pg_get_functiondef(p.oid) AS func_def FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.prokind='f' ORDER BY p.proname`);
  for (const f of funcs) {
    // Extract just the CREATE OR REPLACE FUNCTION ... AS ... body
    const def = f.func_def.replace(/\n{3,}/g, '\n\n');
    write(STMT);
    write(def);
  }

  // 7. Triggers
  console.log('Triggers...');
  const trigs = await sqlQuery(`SELECT event_object_table,trigger_name,action_timing,event_manipulation,action_statement,action_orientation FROM information_schema.triggers WHERE trigger_schema='public'`);
  for (const tr of trigs) {
    write(STMT);
    const rowOrStmt = tr.action_orientation === 'STATEMENT' ? 'STATEMENT' : 'ROW';
    const stmt = tr.action_statement.replace(/^EXECUTE\s+/i, '');
    write(`CREATE TRIGGER "${tr.trigger_name}" ${tr.action_timing} ${tr.event_manipulation} ON "public"."${tr.event_object_table}" FOR EACH ${rowOrStmt} EXECUTE ${stmt};`);
  }

  // 8. RLS Policies
  console.log('RLS...');
  const pols = await sqlQuery(`SELECT schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename`);
  for (const p of pols) {
    const rolesVal = p.roles.replace(/[{}]/g, '').trim();
    const roles = !rolesVal ? 'public' : rolesVal.split(',').map(r => `"${r.replace(/"/g, '').trim()}"`).join(', ');
    write(STMT);
    const cmd = (p.cmd || 'ALL').toUpperCase();
    if (cmd === 'INSERT') {
      write(`CREATE POLICY "${p.policyname}" ON "public"."${p.tablename}" AS ${p.permissive==='P'?'PERMISSIVE':'RESTRICTIVE'} FOR INSERT TO ${roles} WITH CHECK (${p.with_check || p.qual || 'true'});`);
    } else {
      write(`CREATE POLICY "${p.policyname}" ON "public"."${p.tablename}" AS ${p.permissive==='P'?'PERMISSIVE':'RESTRICTIVE'} FOR ${cmd} TO ${roles} USING (${p.qual || 'true'})${p.with_check ? ` WITH CHECK (${p.with_check})` : ''};`);
    }
  }

  // 9. Enable RLS
  const rlsTables = await sqlQuery(`SELECT c.relname AS tablename FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relrowsecurity=true AND n.nspname='public' AND c.relkind='r'`);
  for (const r of rlsTables) {
    write(STMT);
    write(`ALTER TABLE "public"."${r.tablename}" ENABLE ROW LEVEL SECURITY;`);
  }

  // 10. Data
  console.log('Data...');
  const dataTables = await sqlQuery(`SELECT table_name FROM information_schema.tables WHERE table_type='BASE TABLE' AND table_schema='public' ORDER BY table_name`);
  for (const t of dataTables) {
    const fullName = `"public"."${t.table_name}"`;
    const cols = await sqlQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${t.table_name}' ORDER BY ordinal_position`);
    const colNames = cols.map(c=>`"${c.column_name}"`).join(',');
    const rows = await sqlQuery(`SELECT * FROM ${fullName} ORDER BY 1`);
    if (rows.length === 0) continue;
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      write(STMT);
      write(`INSERT INTO ${fullName} (${colNames}) VALUES`);
      write('  ' + batch.map(row => `(${cols.map(c=>quoteVal(row[c.column_name])).join(',')})`).join(',\n  ') + ';');
    }
  }

  // 11. Storage buckets
  console.log('Storage...');
  try {
    const buckets = await sqlQuery(`SELECT * FROM storage.buckets ORDER BY id`);
    if (buckets.length > 0) {
      const bCols = Object.keys(buckets[0]).map(c=>`"${c}"`).join(',');
      for (const b of buckets) {
        write(STMT);
        write(`INSERT INTO storage.buckets (${bCols}) VALUES (${Object.values(b).map(v=>quoteVal(v)).join(',')}) ON CONFLICT (id) DO NOTHING;`);
      }
    }
  } catch {}

  // 12. Auth data
  console.log('Auth...');
  // Query destination for generated columns to exclude
  const destGenCols = {};
  for (const table of ['users', 'identities', 'sessions']) {
    try {
      const res = await destQuery(`SELECT column_name FROM information_schema.columns WHERE table_schema='auth' AND table_name='${table}' AND is_generated!='NEVER'`);
      destGenCols[table] = new Set(res.map(r => r.column_name));
    } catch { destGenCols[table] = new Set(); }
  }
  for (const table of ['users', 'identities', 'sessions']) {
    try {
      const rows = await sqlQuery(`SELECT * FROM auth."${table}" ORDER BY 1`);
      if (rows.length === 0) continue;
      const allCols = Object.keys(rows[0]);
      const excluded = destGenCols[table] || new Set();
      const cols = allCols.filter(c => !excluded.has(c));
      if (cols.length === 0) continue;
      const colNames = cols.map(c=>`"${c}"`).join(',');
      for (const row of rows) {
        write(STMT);
        write(`INSERT INTO auth."${table}" (${colNames}) VALUES (${cols.map(c=>quoteVal(row[c])).join(',')}) ON CONFLICT (id) DO NOTHING;`);
      }
    } catch {}
  }

  fs.writeFileSync('full_dump.sql', output.join('\n'), 'utf8');
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
  console.log(`\nDone in ${elapsed}s: ${output.length} lines (${(fs.statSync('full_dump.sql').size/1024/1024).toFixed(2)} MB)`);
}

dump().catch(err => { console.error('Failed:', err.message); process.exit(1); });
