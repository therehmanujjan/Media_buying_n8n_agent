// Create n8n credentials via REST API
// N8N_API_URL and N8N_API_KEY must be set as env vars

const N8N_BASE = process.env.N8N_API_URL?.replace(/\/$/, '') || 'https://n8n.afrazkhan.dev';
const N8N_KEY  = process.env.N8N_API_KEY;

if (!N8N_KEY) {
  console.error('❌ N8N_API_KEY env var not set. Please run with: N8N_API_KEY=your_key node create_credentials.mjs');
  console.error('   Find your API key in n8n UI → Settings → API → Personal API Keys');
  process.exit(1);
}

console.log(`🔗 Connecting to n8n at: ${N8N_BASE}`);

async function createCredential(payload) {
  const res = await fetch(`${N8N_BASE}/api/v1/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_KEY
    },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function listCredentials() {
  const res = await fetch(`${N8N_BASE}/api/v1/credentials`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  return res.json();
}

async function run() {
  // Test connection first
  const testRes = await fetch(`${N8N_BASE}/api/v1/workflows?limit=1`, {
    headers: { 'X-N8N-API-KEY': N8N_KEY }
  });
  if (!testRes.ok) {
    throw new Error(`Cannot reach n8n API. Status: ${testRes.status}`);
  }
  console.log('✅ n8n API connection OK\n');

  // Credential 1 — PostgreSQL (Neon)
  console.log('📦 Creating Credential 1: Neon PostgreSQL...');
  const pg = await createCredential({
    name: 'Neon - Media Buying DB',
    type: 'postgres',
    data: {
      host: 'ep-lucky-flower-anrv8atn-pooler.c-6.us-east-1.aws.neon.tech',
      port: 5432,
      database: 'neondb',
      user: 'neondb_owner',
      password: 'YOUR_DB_PASSWORD',
      ssl: 'require',
      allowUnauthorizedCerts: true
    }
  });
  console.log(`✅ Neon DB — ID: ${pg.id}`);

  // Credential 2 — Gemini API Key
  console.log('📦 Creating Credential 2: Gemini API Key...');
  const gemini = await createCredential({
    name: 'Gemini API Key',
    type: 'httpHeaderAuth',
    data: {
      name: 'x-goog-api-key',
      value: 'YOUR_GEMINI_KEY'
    }
  });
  console.log(`✅ Gemini API Key — ID: ${gemini.id}`);

  // Credential 3 — Slack Bot Token
  console.log('📦 Creating Credential 3: Slack Bot Token...');
  const slack = await createCredential({
    name: 'Slack Bot Token',
    type: 'httpHeaderAuth',
    data: {
      name: 'Authorization',
      value: 'Bearer YOUR_SLACK_TOKEN'
    }
  });
  console.log(`✅ Slack Bot Token — ID: ${slack.id}`);

  console.log('\n🎉 All 3 credentials created successfully!');
  console.log(JSON.stringify({
    neon_pg_id: pg.id,
    gemini_id: gemini.id,
    slack_id: slack.id
  }, null, 2));
}

run().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
