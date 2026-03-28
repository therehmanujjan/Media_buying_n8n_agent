# Media Buying Advisor — AI Workflows

This directory contains the 3 exported n8n workflows that make up the AI Media Buying Advisor.

## 1. `workflow-1-data-snapshot.json`
**Purpose:** Triggers on a daily schedule (or manually for testing), connects to the Neon PostgreSQL database, and fetches 14 days of normalized ad data. It dynamically processes the data in JavaScript to calculate prior vs. current 7-day CPA, ROAS, and Spend trends. It attaches simple algorithm markers (e.g. `cpaAlert`) and hands the bundled array to Workflow 2.

**How to Import:**
- Create a new Workflow in n8n.
- Import from File / Paste the JSON directly into the canvas.
- Re-configure the `Trigger Analysis Workflow` node to point to the actual ID of Workflow 2.

## 2. `workflow-2-ai-analysis.json`
**Purpose:** An event-driven workflow that accepts the array from Workflow 1. It constructs a very strict AI system prompt including the data output, targets, and decision rules. It queries **Gemini 2.0 Flash** via REST API, cleanly translates the JSON response back to n8n, inserts the recommendations into the Neon `recommendations` table, and finally generates a custom Slack `Block Kit` payload. The Slack payload contains two buttons (`Approve` and `Reject`) which are posted to your specific Slack Channel.

**How to Import:**
- Create a new Workflow.
- Import the JSON.
- Note: Both HTTP Request nodes (Gemini and Slack) rely on Header Authentication Credentials being assigned correctly via the n8n UI (`Generic Credential Type > Header Auth`).

## 3. `workflow-3-slack-webhook.json`
**Purpose:** An independent webhook listener handling Slack's interactive application events. When a user clicks "Approve" or "Reject" on the Slack Block Kit in their channel, Slack POSTs a JSON payload here. The workflow parses the Slack payload to identify which recommendation was clicked, updates the Neon `recommendations` table status directly, logs the action into `decision_log`, and silently POSTs back to Slack's `response_url` to change the original Slack buttons into static completed text.

**How to Import:**
- Create a new Workflow.
- Import the JSON.
- You must take the **Production Webhook URL** of the `Slack Action Webhook` node and paste it into your Slack App API Dashboard under **Interactivity & Shortcuts**.

---
**Required n8n Credentials:**
To ensure these workflows operate without error, you should configure the following inside your n8n Credentials dashboard:
1. `Neon - Media Buying DB` (Postgres credential for your host, username, database, etc. SSL required).
2. `Gemini API Key` (Header Auth credential: `x-goog-api-key: [key]`).
3. `Slack Bot Token` (Header Auth credential: `Authorization: Bearer xoxb-[token]`).
