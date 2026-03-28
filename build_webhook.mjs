const N8N_BASE = process.env.N8N_API_URL?.replace(/\/$/, '') || 'https://n8n.afrazkhan.dev';
const N8N_KEY  = process.env.N8N_API_KEY;

if (!N8N_KEY) {
  console.error('N8N_API_KEY missing');
  process.exit(1);
}

const wf3 = {
  name: "MB Advisor — 3. Slack Interactive Webhook",
  nodes: [
    {
      parameters: {
        httpMethod: "POST",
        path: "slack-interactive",
        options: {}
      },
      id: "webhook",
      name: "Slack Action Webhook",
      type: "n8n-nodes-base.webhook",
      typeVersion: 1.1,
      position: [0, 0],
      webhookId: "slack-interactive-1234"
    },
    {
      parameters: {
        jsCode: [
"const rawBody = $input.all()[0].json.body;",
"let payloadStr = rawBody.payload;",
"if (typeof payloadStr === 'string') {",
"  try {",
"    payloadStr = JSON.parse(payloadStr);",
"  } catch (e) {}",
"}",
"",
"const action = payloadStr.actions[0];",
"const actionId = action.action_id; // approve_recommendation or reject_recommendation",
"const val = JSON.parse(action.value);",
"",
"const newStatus = actionId.includes('approve') ? 'approved' : 'rejected';",
"const responseUrl = payloadStr.response_url;",
"",
"return {",
"  json: {",
"    recommendation_id: val.recommendation_id,",
"    entity_name: val.entity_name,",
"    status: newStatus,",
"    response_url: responseUrl",
"  }",
"};"
        ].join('\n')
      },
      id: "parse-slack",
      name: "Parse Slack Action",
      type: "n8n-nodes-base.code",
      typeVersion: 2,
      position: [200, 0]
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "UPDATE recommendations SET status = $1, decision_date = CURRENT_TIMESTAMP WHERE id = $2 RETURNING *",
        additionalFields: {
          queryParams: "={{$json.status}},{{$json.recommendation_id}}"
        }
      },
      id: "update-db",
      name: "Update Neon DB",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.2,
      position: [400, 0],
      credentials: {
        postgres: { id: "", name: "Neon - Media Buying DB" }
      }
    },
    {
      parameters: {
        operation: "executeQuery",
        query: "INSERT INTO decision_log (recommendation_id, user_id, user_email, decision, decision_time) VALUES ($1, 'slack_user', 'slack_user@example.com', $2, CURRENT_TIMESTAMP)",
        additionalFields: {
          queryParams: "={{$('Parse Slack Action').itemMatching(0).json.recommendation_id}},{{$('Parse Slack Action').itemMatching(0).json.status}}"
        }
      },
      id: "log-decision",
      name: "Log Decision",
      type: "n8n-nodes-base.postgres",
      typeVersion: 2.2,
      position: [600, 0],
      credentials: {
        postgres: { id: "", name: "Neon - Media Buying DB" }
      }
    },
    {
      parameters: {
        method: "POST",
        url: "={{$('Parse Slack Action').itemMatching(0).json.response_url}}",
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
"  \"replace_original\": true,",
"  \"text\": \"Recommendation {{$('Parse Slack Action').itemMatching(0).json.status}} for {{$('Parse Slack Action').itemMatching(0).json.entity_name}}.\"",
"}"
        ].join('\n')
      },
      id: "reply-slack",
      name: "Reply to Slack",
      type: "n8n-nodes-base.httpRequest",
      typeVersion: 4.1,
      position: [800, 0]
    }
  ],
  connections: {
    "Slack Action Webhook": {
      main: [ [ { node: "Parse Slack Action", type: "main", index: 0 } ] ]
    },
    "Parse Slack Action": {
      main: [ [ { node: "Update Neon DB", type: "main", index: 0 } ] ]
    },
    "Update Neon DB": {
      main: [ [ { node: "Log Decision", type: "main", index: 0 } ] ]
    },
    "Log Decision": {
      main: [ [ { node: "Reply to Slack", type: "main", index: 0 } ] ]
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
  console.log("Creating Workflow 3...");
  const w3 = await createWorkflow(wf3);
  console.log("✅ Workflow 3 created: " + w3.id);
  console.log("\\n🎉 Webhook workflow deployed!");
}

run().catch(console.error);
