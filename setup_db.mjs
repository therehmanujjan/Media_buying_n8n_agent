import pg from 'pg';
const { Client } = pg;

const DB = 'postgresql://neondb_owner:YOUR_DB_PASSWORD@ep-lucky-flower-anrv8atn-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const client = new Client({ connectionString: DB });

const steps = [
  {
    label: 'uuid-ossp extension',
    sql: `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";`
  },
  {
    label: 'normalised_ad_data table',
    sql: `CREATE TABLE IF NOT EXISTS normalised_ad_data (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      platform        VARCHAR(10) NOT NULL CHECK (platform IN ('meta', 'google', 'tiktok')),
      entity_type     VARCHAR(10) NOT NULL CHECK (entity_type IN ('campaign', 'adset', 'ad')),
      entity_id       VARCHAR(100) NOT NULL,
      entity_name     VARCHAR(500),
      parent_entity_id VARCHAR(100),
      date            DATE NOT NULL,
      spend           DECIMAL(12,2) DEFAULT 0,
      impressions     BIGINT DEFAULT 0,
      clicks          BIGINT DEFAULT 0,
      conversions     DECIMAL(10,2) DEFAULT 0,
      cpa             DECIMAL(12,2) DEFAULT 0,
      roas            DECIMAL(8,4) DEFAULT 0,
      ctr             DECIMAL(8,4) DEFAULT 0,
      cpm             DECIMAL(12,4) DEFAULT 0,
      raw_data        JSONB,
      created_at      TIMESTAMPTZ DEFAULT NOW(),
      updated_at      TIMESTAMPTZ DEFAULT NOW()
    );`
  },
  {
    label: 'unique index on normalised_ad_data',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_ad_data_unique
      ON normalised_ad_data(platform, entity_type, entity_id, date);`
  },
  {
    label: 'platform_date index on normalised_ad_data',
    sql: `CREATE INDEX IF NOT EXISTS idx_ad_data_platform_date
      ON normalised_ad_data(platform, date);`
  },
  {
    label: 'recommendations table',
    sql: `CREATE TABLE IF NOT EXISTS recommendations (
      id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      run_date         DATE NOT NULL,
      platform         VARCHAR(10) NOT NULL,
      entity_type      VARCHAR(10) NOT NULL,
      entity_id        VARCHAR(100) NOT NULL,
      entity_name      VARCHAR(500),
      action           VARCHAR(20) NOT NULL CHECK (action IN ('pause','increase_budget','decrease_budget','reallocate','monitor')),
      priority         VARCHAR(10) NOT NULL CHECK (priority IN ('high','medium','low')),
      rationale        TEXT NOT NULL,
      metrics_snapshot JSONB,
      estimated_impact TEXT,
      confidence       DECIMAL(3,2) CHECK (confidence >= 0 AND confidence <= 1),
      status           VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
      slack_message_ts VARCHAR(50),
      slack_channel_id VARCHAR(20),
      created_at       TIMESTAMPTZ DEFAULT NOW()
    );`
  },
  {
    label: 'recommendations status index',
    sql: `CREATE INDEX IF NOT EXISTS idx_recommendations_status
      ON recommendations(status) WHERE status = 'pending';`
  },
  {
    label: 'recommendations run_date index',
    sql: `CREATE INDEX IF NOT EXISTS idx_recommendations_run_date
      ON recommendations(run_date DESC);`
  },
  {
    label: 'decision_log table',
    sql: `CREATE TABLE IF NOT EXISTS decision_log (
      id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      recommendation_id   UUID NOT NULL REFERENCES recommendations(id),
      decision            VARCHAR(10) NOT NULL CHECK (decision IN ('approved','rejected')),
      decided_by_slack_id VARCHAR(20) NOT NULL,
      decided_by_name     VARCHAR(100),
      decided_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      rejection_reason    TEXT,
      alternative_action  VARCHAR(50)
    );`
  },
  {
    label: 'decision_log index',
    sql: `CREATE INDEX IF NOT EXISTS idx_decision_log_rec_id
      ON decision_log(recommendation_id);`
  },
  {
    label: 'seed normalised_ad_data',
    sql: `INSERT INTO normalised_ad_data (platform,entity_type,entity_id,entity_name,date,spend,impressions,clicks,conversions,cpa,roas,ctr,cpm) VALUES
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-20',850,125000,2100,68,12.50,5.20,1.68,6.80),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-21',920,131000,2250,72,12.78,5.10,1.72,7.02),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-22',880,128000,2180,70,12.57,5.15,1.70,6.88),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-23',910,130000,2200,74,12.30,5.30,1.69,7.00),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-24',950,135000,2320,76,12.50,5.25,1.72,7.04),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-25',940,133000,2280,75,12.53,5.18,1.71,7.07),
('meta','campaign','meta_c1','Meta - Summer Sale Retargeting','2026-03-26',960,136000,2350,78,12.31,5.35,1.73,7.06),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-20',1200,180000,1800,42,28.57,1.80,1.00,6.67),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-21',1250,175000,1700,38,32.89,1.55,0.97,7.14),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-22',1300,170000,1620,35,37.14,1.30,0.95,7.65),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-23',1280,165000,1550,30,42.67,1.10,0.94,7.76),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-24',1350,160000,1480,28,48.21,0.95,0.93,8.44),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-25',1400,155000,1400,25,56.00,0.80,0.90,9.03),
('meta','campaign','meta_c2','Meta - Brand Awareness Cold','2026-03-26',1420,150000,1350,22,64.55,0.65,0.90,9.47),
('google','campaign','goog_c1','Google - Branded Search','2026-03-20',600,45000,3200,95,6.32,8.50,7.11,13.33),
('google','campaign','goog_c1','Google - Branded Search','2026-03-21',620,46000,3300,98,6.33,8.40,7.17,13.48),
('google','campaign','goog_c1','Google - Branded Search','2026-03-22',610,45500,3250,96,6.35,8.45,7.14,13.41),
('google','campaign','goog_c1','Google - Branded Search','2026-03-23',630,47000,3350,100,6.30,8.55,7.13,13.40),
('google','campaign','goog_c1','Google - Branded Search','2026-03-24',640,47500,3400,102,6.27,8.60,7.16,13.47),
('google','campaign','goog_c1','Google - Branded Search','2026-03-25',635,47200,3380,101,6.29,8.58,7.16,13.45),
('google','campaign','goog_c1','Google - Branded Search','2026-03-26',645,47800,3420,103,6.26,8.65,7.15,13.49),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-20',1800,520000,2600,15,120.00,0.45,0.50,3.46),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-21',1850,510000,2500,14,132.14,0.40,0.49,3.63),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-22',1900,505000,2450,12,158.33,0.35,0.49,3.76),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-23',1880,500000,2400,11,170.91,0.30,0.48,3.76),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-24',1920,495000,2350,10,192.00,0.28,0.47,3.88),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-25',1950,490000,2300,9,216.67,0.25,0.47,3.98),
('google','campaign','goog_c2','Google - Display Prospecting','2026-03-26',1980,485000,2250,8,247.50,0.22,0.46,4.08),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-20',500,420000,4200,52,9.62,3.20,1.00,1.19),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-21',520,430000,4350,55,9.45,3.30,1.01,1.21),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-22',510,425000,4280,53,9.62,3.25,1.01,1.20),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-23',530,435000,4400,56,9.46,3.35,1.01,1.22),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-24',540,440000,4500,58,9.31,3.40,1.02,1.23),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-25',535,438000,4450,57,9.39,3.38,1.02,1.22),
('tiktok','campaign','tt_c1','TikTok - UGC Product Launch','2026-03-26',545,442000,4520,59,9.24,3.42,1.02,1.23)
ON CONFLICT (platform, entity_type, entity_id, date) DO NOTHING;`
  },
  {
    label: 'verify row counts',
    sql: `SELECT platform, entity_name, COUNT(*) as days, ROUND(AVG(cpa)::numeric,2) as avg_cpa, ROUND(AVG(roas)::numeric,2) as avg_roas
      FROM normalised_ad_data GROUP BY platform, entity_name ORDER BY platform, entity_name;`
  }
];

async function run() {
  await client.connect();
  console.log('✅ Connected to Neon DB');

  for (const step of steps) {
    try {
      const result = await client.query(step.sql);
      if (result.rows && result.rows.length > 0) {
        console.log(`\n✅ ${step.label}:`);
        console.table(result.rows);
      } else {
        console.log(`✅ ${step.label}: OK`);
      }
    } catch (err) {
      console.error(`❌ ${step.label}: ${err.message}`);
      process.exit(1);
    }
  }

  await client.end();
  console.log('\n🎉 Schema and seed data setup complete!');
}

run();
