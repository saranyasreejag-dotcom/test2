/**
 * Automated Supabase Migration Runner
 * 
 * Runs the SQL migration file against your Supabase PostgreSQL database
 * to create the conversations and messages tables, indexes, and RLS policies.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

// Locate migration file
const migrationPaths = [
  path.join(__dirname, '..', '..', 'supabase', 'migrations', '20261014154500_create_chatbox_tables.sql'),
  path.join(__dirname, '..', '..', 'supabase_schema.sql')
];

let migrationSql = null;
let migrationFilePath = null;

for (const p of migrationPaths) {
  if (fs.existsSync(p)) {
    migrationSql = fs.readFileSync(p, 'utf8');
    migrationFilePath = p;
    break;
  }
}

if (!migrationSql) {
  console.error('\x1b[31m[ERROR]\x1b[0m Migration SQL file not found.');
  process.exit(1);
}

// Extract project ref from SUPABASE_URL
const supabaseUrl = process.env.SUPABASE_URL || '';
let projectRef = '';
try {
  const match = supabaseUrl.match(/https:\/\/([a-z0-9_-]+)\.supabase\.co/i);
  if (match) projectRef = match[1];
} catch {}

function promptPassword(promptText) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    rl.question(promptText, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

async function runMigration() {
  console.log(`
==============================================================
  ⚡ NEXUS LLM • SUPABASE MIGRATION RUNNER
==============================================================
  Project URL   : ${supabaseUrl || '(Not configured)'}
  Project Ref   : ${projectRef || '(Unknown)'}
  Migration File: ${path.basename(migrationFilePath)}
==============================================================
`);

  let dbUrl = process.env.DATABASE_URL || '';

  // If DATABASE_URL is not set, try constructing from SUPABASE_DB_PASSWORD or prompt
  if (!dbUrl) {
    let password = process.env.SUPABASE_DB_PASSWORD || '';

    if (!password) {
      if (process.argv[2]) {
        password = process.argv[2];
      } else if (process.stdin.isTTY) {
        console.log('To execute migrations directly via PostgreSQL, please enter your database password.');
        console.log('(Find or reset this in Supabase -> Project Settings -> Database -> Database Password)');
        password = await promptPassword('\nEnter Supabase Database Password: ');
      }
    }

    if (password && projectRef) {
      // Connect using pooler or direct host with SSL
      dbUrl = `postgresql://postgres.${projectRef}:${encodeURIComponent(password)}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres`;
    }
  }

  if (!dbUrl) {
    console.log(`
\x1b[33m[INFO] Direct database connection string not provided.\x1b[0m

You have TWO quick ways to apply this migration:

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 METHOD 1: 1-Click via Supabase Web Dashboard (Easiest & Instant)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Open your project's SQL editor:
   \x1b[36mhttps://supabase.com/dashboard/project/${projectRef || '_'}/sql/new\x1b[0m
2. Copy and paste the contents of:
   \x1b[32m${migrationFilePath}\x1b[0m
3. Click "Run". All tables will be created instantly!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👉 METHOD 2: Automated via Command Line
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Add your database password to \x1b[32mbackend/.env\x1b[0m:
   SUPABASE_DB_PASSWORD=your_database_password

Or pass your password directly:
   \x1b[36mnpm run migrate -- your_password\x1b[0m
`);
    return;
  }

  console.log('Connecting to Supabase PostgreSQL database...');
  
  // Try connecting with fallback options
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('\x1b[32m[CONNECTED]\x1b[0m Connected to Supabase PostgreSQL successfully.');

    console.log('Executing migration script...');
    await client.query(migrationSql);

    console.log('\x1b[32m[SUCCESS]\x1b[0m Migration executed successfully!');

    // Verify tables
    const checkRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('conversations', 'messages');
    `);

    console.log('\nVerified tables created:');
    checkRes.rows.forEach(r => console.log(`  ✓ public.${r.table_name}`));

    console.log(`
==============================================================
  🎉 ALL TABLES CREATED SUCCESSFULLY!
  You can now start chatting and messages will be stored.
==============================================================
`);

  } catch (err) {
    console.error('\x1b[31m[MIGRATION FAILED]\x1b[0m:', err.message);
    if (err.message.includes('password authentication failed')) {
      console.log('\x1b[33mHint:\x1b[0m Double check your database password or reset it in Supabase Project Settings -> Database.');
    }
  } finally {
    try { await client.end(); } catch {}
  }
}

runMigration();
