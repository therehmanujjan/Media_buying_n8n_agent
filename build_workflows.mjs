const N8N_BASE = process.env.N8N_API_URL?.replace(/\/$/, '') || 'https://n8n.afrazkhan.dev';
const N8N_KEY  = process.env.N8N_API_KEY;

if (!N8N_KEY) {
  console.error('N8N_API_KEY missing');
  process.exit(1);
}

const wf2 = {
  name: "MB Advisor — 2. AI Analysis & Slack Digest",
  nodes: [
    {
      parameters: {},
      id: "wf-trigger",
      name: "Receive Ad Data",
      type: "n8n-nodes-base.executeWorkflowTrigger",
      typeVersion: 1,
      position: [0, 0]
    },
    {
      parameters: {
        jsCode: [
"const data = $input.all()[0].json.data || $input.all().map(i => i.json);",
"const prompt = `SYSTEM:",
"You are an expert media buying analyst. You analyse paid advertising performance data and generate prioritised, actionable recommendations. You respond ONLY with valid JSON matching the schema provided. Never add explanations outside the JSON.",
"",
"USER:",
"Analyse the following 7-day ad performance data (with prior 7-day trend comparison) and generate recommendations.",
"",
"PERFORMANCE BENCHMARKS (targets):",
"- CPA target: $20 or below",
"- ROAS target: 3.0 or above",
"- CTR healthy: above 1.0%",
"- Pause threshold: CPA above $40 for 3+ consecutive days OR ROAS below 1.0",
"",
"DECISION RULES:",
"- PAUSE: CPA > 2x benchmark for 3+ days, or ROAS < 1.0",
"- DECREASE_BUDGET: CPA trending up >30%, ROAS trending down >20%",
"- INCREASE_BUDGET: ROAS > 1.5x target AND CPA < 70% of benchmark",
"- REALLOCATE: One platform significantly outperforming another by same budget",
"- MONITOR: Mixed signals, insufficient data, or minor variance within 15%",
"",
"AD PERFORMANCE DATA:",
"${JSON.stringify(data)}",
"",
"Respond with ONLY this JSON structure, no other text:",
"{",
"  \"recommendations\": [",
"    {",
"      \"entity_id\": \"string\",",
"      \"entity_name\": \"string\",",
"      \"platform\": \"meta|google|tiktok\",",
"      \"action\": \"pause|increase_budget|decrease_budget|reallocate|monitor\",",
"      \"priority\": \"high|medium|low\",",
"      \"rationale\": \"2-3 sentence plain English explanation of why\",",
"      \"estimated_impact\": \"Specific expected outcome e.g. Save $1,400/week by pausing\",",
"      \"confidence\": 0.0 to 1.0,",
"      \"key_metrics\": {",
"        \"current_cpa\": 0,",
"        \"prior_cpa\": 0,",
"        \"current_roas\": 0,",
"        \"prior_roas\": 0,",
"        \"cpa_change_pct\": 0,",
"        \"roas_change_pct\": 0",
"      }",
"    }",
"  ],",
"  \"summary\": \"One sentence overall account health assessment\"",
"}`;",
"",
"return { json: { prompt } };"
        ].join('\n')
      },
      id: "build-prompt",
      name: "Build Gemini Prompt",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [200, 0]
    },
    {
      parameters: {
        method: "POST",
        url: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: [
"={",
"  \"contents\": [",
"    {",
"      \"role\": \"user\",",
"      \"parts\": [{ \"text\": {{ JSON.stringify($json.prompt) }} }]",
"    }",
"  ],",
"  \"generationConfig\": {",
"    \"temperature\": 0.2,",
"    \"responseMimeType\": \"application/json\"",
"  }",
"}"
        ].join('\n')
      },
      id: "call-gemini",
      name: "Gemini 2.0 Flash Analysis",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.1,
      position: [400, 0],
      credentials: {
        httpHeaderAuth: { id: "", name: "Gemini API Key" }
      }
    },
    {
      parameters: {
        jsCode: [
"const rawText = $input.all()[0].json.candidates[0].content.parts[0].text;",
"let parsed;",
"try {",
"  parsed = JSON.parse(rawText);",
"} catch (e) {",
"  throw new Error(\"Failed to parse Gemini response: \" + e.message + \" | Text: \" + rawText);",
"}",
"return parsed.recommendations.map(r => ({ json: r }));"
        ].join('\n')
      },
      id: "parse-rec",
      name: "Parse Recommendations",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [600, 0]
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "INSERT INTO recommendations (run_date, platform, entity_type, entity_id, entity_name, action, priority, rationale, metrics_snapshot, estimated_impact, confidence, status) VALUES (CURRENT_DATE, $1, 'campaign', $2, $3, $4, $5, $6, $7::jsonb, $8, $9, 'pending') RETURNING id",
        additionalFields: {
          queryParams: "={{$json.platform}},{{$json.entity_id}},{{$json.entity_name}},{{$json.action}},{{$json.priority}},{{$json.rationale}},{{JSON.stringify($json.key_metrics)}},{{$json.estimated_impact}},{{$json.confidence}}"
        }
      },
      id: "save-rec",
      name: "Save to Neon",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.2,
      position: [800, 0],
      credentials: {
        postgres: { id: "", name: "Neon - Media Buying DB" }
      }
    },
    {
      parameters: {
        jsCode: [
"const item = $input.all()[0].json;",
"const originalData = $('Parse Recommendations').itemMatching(0).json;",
"const recId = item.id;",
"",
"const emoji = originalData.priority === 'high' ? '🔴' : originalData.priority === 'medium' ? '🟡' : '🟢';",
"",
"const blocks = [",
"  {",
"    type: \"header\",",
"    text: { type: \"plain_text\", text: `${emoji} Campaign Recommendation` }",
"  },",
"  {",
"    type: \"section\",",
"    text: { type: \"mrkdwn\", text: `*${originalData.entity_name}*\\n*${originalData.action.toUpperCase()}*` }",
"  },",
"  {",
"    type: \"section\",",
"    fields: [",
"      { type: \"mrkdwn\", text: `*Current CPA:* $${originalData.key_metrics.current_cpa}` },",
"      { type: \"mrkdwn\", text: `*Prior CPA:* $${originalData.key_metrics.prior_cpa}` },",
"      { type: \"mrkdwn\", text: `*Current ROAS:* ${originalData.key_metrics.current_roas}` },",
"      { type: \"mrkdwn\", text: `*Prior ROAS:* ${originalData.key_metrics.prior_roas}` },",
"      { type: \"mrkdwn\", text: `*CPA Change:* ${originalData.key_metrics.cpa_change_pct > 0 ? '⬆️' : '⬇️'} ${originalData.key_metrics.cpa_change_pct}%` },",
"      { type: \"mrkdwn\", text: `*ROAS Change:* ${originalData.key_metrics.roas_change_pct > 0 ? '⬆️' : '⬇️'} ${originalData.key_metrics.roas_change_pct}%` }",
"    ]",
"  },",
"  { type: \"divider\" },",
"  {",
"    type: \"context\",",
"    elements: [ { type: \"mrkdwn\", text: `*Impact:* ${originalData.estimated_impact}\\n*Rationale:* ${originalData.rationale}` } ]",
"  },",
"  {",
"    type: \"actions\",",
"    elements: [",
"      {",
"        type: \"button\",",
"        text: { type: \"plain_text\", text: \"Approve\" },",
"        style: \"primary\",",
"        action_id: \"approve_recommendation\",",
"        value: JSON.stringify({ recommendation_id: recId, entity_name: originalData.entity_name, action: originalData.action })",
"      },",
"      {",
"        type: \"button\",",
"        text: { type: \"plain_text\", text: \"Reject\" },",
"        style: \"danger\",",
"        action_id: \"reject_recommendation\",",
"        value: JSON.stringify({ recommendation_id: recId, entity_name: originalData.entity_name, action: originalData.action })",
"      }",
"    ]",
"  }",
"];",
"",
"return {",
"  json: {",
"    blocks: blocks,",
"    fallback_text: `${emoji} ${originalData.entity_name}: ${originalData.action.toUpperCase()}`,",
"    recommendation_id: recId",
"  }",
"};"
        ].join('\n')
      },
      id: "build-slack",
      name: "Build Slack Message",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [1000, 0]
    },
    {
      parameters: {
        method: "POST",
        url: "https://slack.com/api/chat.postMessage",
        sendHeaders: true,
        headerParameters: {
          parameters: [
            { name: "Content-Type", value: "application/json" }
          ]
        },
        sendBody: true,
        specifyBody: "json",
        jsonBody: "={\n  \"channel\": \"C0AQ8JB3D4G\",\n  \"text\": {{$json.fallback_text}},\n  \"blocks\": {{$json.blocks}}\n}"
      },
      id: "post-slack",
      name: "Post to Slack",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.1,
      position: [1200, 0],
      credentials: {
        httpHeaderAuth: { id: "", name: "Slack Bot Token" }
      }
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "UPDATE recommendations SET slack_message_ts = $1, slack_channel_id = $2 WHERE id = $3",
        additionalFields: {
          queryParams: "={{$json.ts}},{{$json.channel}},{{$('Build Slack Message').itemMatching(0).json.recommendation_id}}"
        }
      },
      id: "update-db",
      name: "Store Slack Message TS",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.2,
      position: [1400, 0],
      credentials: {
        postgres: { id: "", name: "Neon - Media Buying DB" }
      }
    }
  ],
  connections: {
    "Receive Ad Data": {
      main: [ [ { node: "Build Gemini Prompt", type: "main", index: 0 } ] ]
    },
    "Build Gemini Prompt": {
      main: [ [ { node: "Gemini 2.0 Flash Analysis", type: "main", index: 0 } ] ]
    },
    "Gemini 2.0 Flash Analysis": {
      main: [ [ { node: "Parse Recommendations", type: "main", index: 0 } ] ]
    },
    "Parse Recommendations": {
      main: [ [ { node: "Save to Neon", type: "main", index: 0 } ] ]
    },
    "Save to Neon": {
      main: [ [ { node: "Build Slack Message", type: "main", index: 0 } ] ]
    },
    "Build Slack Message": {
      main: [ [ { node: "Post to Slack", type: "main", index: 0 } ] ]
    },
    "Post to Slack": {
      main: [ [ { node: "Store Slack Message TS", type: "main", index: 0 } ] ]
    }
  },
  settings: {
    executionOrder: "v1"
  }
};

async function createWorkflow(wf) {
  const res = await fetch(N8N_BASE + "/api/v1/workflows", {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-N8N-API-KEY': N8N_KEY
    },
    body: JSON.stringify(wf)
  });
  const data = await res.json();
  if (!res.ok) throw new Error("HTTP " + res.status + " : " + JSON.stringify(data));
  return data;
}

async function run() {
  const w2 = { id: "iuSVdQFPbIDtqRC7" };
  console.log("✅ Workflow 2 already created: " + w2.id);
  
  // Now create workflow 1 that references workflow 2
  const wf1 = {
    name: "MB Advisor — 1. Daily Data Snapshot",
    nodes: [
      {
        parameters: {
          rule: { type: "cron", value: "0 8 * * *" }
        },
        id: "trigger",
        name: "Daily 8am Trigger",
        type: "n8n-nodes-base.scheduleTrigger",
        typeVersion: 1.1,
        position: [0, 0]
      },
      {
        parameters: {
          operation: "executeQuery",
          query: "SELECT platform, entity_type, entity_id, entity_name, date, spend, impressions, clicks, conversions, cpa, roas, ctr, cpm FROM normalised_ad_data WHERE date >= CURRENT_DATE - INTERVAL '14 days' ORDER BY entity_id, date ASC"
        },
        id: "fetch-data",
        name: "Fetch 14-Day Ad Data",
        type: "n8n-nodes-base.postgres",
        typeVersion: 2.2,
        position: [200, 0],
        credentials: {
          postgres: { id: "", name: "Neon - Media Buying DB" }
        }
      },
      {
        parameters: {
          jsCode: [
"const items = $input.all().map(i => i.json);",
"const groups = {};",
"for (const row of items) {",
"  if (!groups[row.entity_id]) groups[row.entity_id] = [];",
"  groups[row.entity_id].push(row);",
"}",
"",
"const summaries = [];",
"// For MVP with seed data (7 days max), we will split the rows dynamically",
"for (const entity_id in groups) {",
"  const rows = groups[entity_id].sort((a,b) => new Date(a.date) - new Date(b.date));",
"  ",
"  const current = rows.slice(-7);",
"  const prior = rows.length > 7 ? rows.slice(-14, -7) : rows.slice(0, Math.floor(rows.length/2));",
"  ",
"  const avg = (arr, col) => arr.length ? arr.reduce((sum, r) => sum + parseFloat(r[col]||0), 0) / arr.length : 0;",
"  ",
"  const currentCPA = avg(current, 'cpa');",
"  const priorCPA = avg(prior, 'cpa') || currentCPA;",
"  ",
"  const currentROAS = avg(current, 'roas');",
"  const priorROAS = avg(prior, 'roas') || currentROAS;",
"",
"  const pctChange = (curr, prev) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;",
"  ",
"  const cpaAlert = currentCPA > priorCPA * 1.3;",
"  const roasAlert = currentROAS < priorROAS * 0.7;",
"  const pauseSignal = currentCPA > 40 && cpaAlert;",
"  const scaleSignal = currentROAS > 4.0 && currentCPA < 15;",
"  ",
"  summaries.push({",
"    entity_id: entity_id,",
"    entity_name: current[0].entity_name,",
"    platform: current[0].platform,",
"    entity_type: current[0].entity_type,",
"    key_metrics: {",
"      current_cpa: currentCPA.toFixed(2),",
"      prior_cpa: priorCPA.toFixed(2),",
"      cpa_change_pct: pctChange(currentCPA, priorCPA).toFixed(1),",
"      current_roas: currentROAS.toFixed(2),",
"      prior_roas: priorROAS.toFixed(2),",
"      roas_change_pct: pctChange(currentROAS, priorROAS).toFixed(1)",
"    },",
"    signals: { cpaAlert, roasAlert, pauseSignal, scaleSignal }",
"  });",
"}",
"",
"return { json: { data: summaries } };"
          ].join('\n')
        },
        id: "calc-trends",
        name: "Calculate 7d vs Prior 7d Trends",
        type: "n8n-nodes-base.code",
        typeVersion: 2,
        position: [400, 0]
      },
      {
        parameters: {
          workflowId: w2.id,
          mode: "each"
        },
        id: "exec-wf",
        name: "Trigger Analysis Workflow",
        type: "n8n-nodes-base.executeWorkflow",
        typeVersion: 1,
        position: [600, 0]
      }
    ],
    connections: {
      "Daily 8am Trigger": {
        main: [ [ { node: "Fetch 14-Day Ad Data", type: "main", index: 0 } ] ]
      },
      "Fetch 14-Day Ad Data": {
        main: [ [ { node: "Calculate 7d vs Prior 7d Trends", type: "main", index: 0 } ] ]
      },
      "Calculate 7d vs Prior 7d Trends": {
        main: [ [ { node: "Trigger Analysis Workflow", type: "main", index: 0 } ] ]
      }
    },
    settings: {
      executionOrder: "v1"
    }
  };
  
  console.log("Creating Workflow 1...");
  const w1 = await createWorkflow(wf1);
  console.log("✅ Workflow 1 created: " + w1.id);
  console.log("\n🎉 Workflows deployed!");
  console.log("WF1 ID: " + w1.id);
  console.log("WF2 ID: " + w2.id);
}

run().catch(console.error);
