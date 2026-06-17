const https = require('https');
const fs = require('fs');

const TOKEN = process.env.SUPABASE_DEST_TOKEN;
const REF = process.env.SUPABASE_DEST_REF;

if (!TOKEN || !REF) {
  console.error('Missing required env vars: SUPABASE_DEST_TOKEN, SUPABASE_DEST_REF');
  process.exit(1);
}

function runSQL(query) {
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
      timeout: 120000,
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200 || res.statusCode === 201) resolve(data);
        else reject(new Error(data.slice(0, 300)));
      });
    });
    req.on('error', () => setTimeout(() => runSQL(query).then(resolve).catch(reject), 3000));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function restore() {
  const content = fs.readFileSync('full_dump.sql', 'utf8');
  const statements = content.split('--=STMT=').filter(s => s.trim()).map(s => s.trim());

  console.log(`Found ${statements.length} statements\n`);

  let ok = 0, skip = 0, err = 0;

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const firstLine = sql.split('\n')[0].trim().slice(0, 80);
    const firstWord = sql.split(/\s+/)[0]?.toUpperCase() || '';

    try {
      await runSQL(sql);
      ok++;
    } catch (e) {
      const msg = e.message.toLowerCase();
      const isCreate = firstWord === 'CREATE';
      const isInsert = firstWord === 'INSERT';
      const isAlter = firstWord === 'ALTER';

      if ((isCreate || isAlter) && (msg.includes('already exists') || msg.includes('permission denied') ||
          msg.includes('must be owner') || msg.includes('does not exist') ||
          (msg.includes('column') && msg.includes('named in key does not exist')))) {
        skip++;
      } else if (isInsert && (msg.includes('duplicate key') || msg.includes('violates') ||
          msg.includes('permission denied') || msg.includes('must be owner') ||
          msg.includes('does not exist') || msg.includes('column'))) {
        skip++;
      } else {
        // Retry 502 errors once
        if (e.message.includes('502') || e.message.includes('503') || e.message.includes('504')) {
          try {
            await new Promise(r => setTimeout(r, 5000));
            await runSQL(sql);
            ok++;
            continue;
          } catch (e2) {}
        }
        err++;
        console.log(`\n[${i + 1}] ERR: ${firstLine}`);
        console.log(`  ${e.message.slice(0, 150)}`);
      }
    }

    if ((i + 1) % 30 === 0 || i === statements.length - 1) {
      process.stdout.write(`\rProgress: ${i + 1}/${statements.length} (${ok} OK, ${skip} skipped, ${err} errors)`);
    }
  }

  console.log(`\n\nDone: ${ok} ok, ${skip} skip, ${err} err`);
}

restore().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
