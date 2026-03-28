# AI Media Buying Advisor (n8n + Gemini 2.0 + Slack)

An automated MVP for analyzing paid media performance using AI, generating actionable recommendations, and sending interactive approval workflows via Slack.

This system evaluates 14-day trailing performance from a normalized PostgreSQL database and uses Gemini 2.0 Flash to strictly follow CPA/ROAS parameters to suggest scaling, pausing, or adjusting campaigns.

## 🏗 System Architecture

The MVP consists of 3 continuous components managed entirely within n8n:
1. **Daily Data Snapshot (Workflow 1):** Connects to the database every morning, pulls 14 days of ad performance data, calculates 7-day velocity arrays (CPA/ROAS changes), and bundles the statistics.
2. **AI Analysis & Slack Digest (Workflow 2):** Takes the bundled statistics, injects them into a strict System Prompt, and calls Gemini 2.0 Flash. Outputs a parsed JSON decision, writes the exact recommendation as `pending` to the Postgres Database, and pushes a Block Kit message with **[Approve]** and **[Reject]** buttons to Slack.
3. **Slack Interactive Webhook (Workflow 3):** A webhook listener that intercepts button clicks from the Slack app, instantly updates the PostgreSQL `recommendations` table to `approved` or `rejected`, logs an audit trail in `decision_log`, and silently overwrites the Slack buttons indicating the job is done.

---

## 🔑 Prerequisites & Credentials

Before spinning up the workflows, you need the following integrations properly configured. **Do not embed these directly in code; strictly use n8n's Credential Vault:**

*   **Neon DB Connection String:** `postgresql://[username]:[password]@[neon-host]/[dbname]?sslmode=require&channel_binding=require`
    *   *How to get:* Create a Project on Neon.tech and copy the standard connection string.

*   **Gemini API Key:** `AIza...YOUR_KEY...`
    *   *How to get:* Generate a key at [Google AI Studio](https://aistudio.google.com/).
    *   *Action:* Put inside n8n via **Generic Credential Type > Header Auth** (`Name: x-goog-api-key`).

*   **Slack Bot Token:** `xoxb-YOUR-SLACK-BOT-TOKEN`
    *   *How to get:* Go to [api.slack.com] > OAuth & Permissions. Ensure the bot has `chat:write.public` scopes.
    *   *Action:* Put inside n8n via **Generic Credential Type > Header Auth** (`Name: Authorization`, `Value: Bearer xoxb-...`).

*   **Slack Channel ID:** `C0A...YOUR_CHANNEL`
    *   *How to get:* Right-click the target channel in Slack Desktop > Copy Link. The ID is the string at the very end of the URL.

*   **Slack Signing Secret:** `e1b7...YOUR_SECRET...`
    *   *How to get:* Go to [api.slack.com] > Basic Information.

*   **n8n Webhook Base URL:** `https://n8n.yourdomain.dev`
    *   *Action:* Point your Slack App's "Interactivity & Shortcuts" Request URL to the production webhook URL of Workflow 3 (`[your_n8n_domain]/webhook/slack-interactive`).

---

## 🚀 Quickstart

1. Spin up a Postgres database and run the schema setup (or `setup_db.mjs` to seed dummy data).
2. Create standard n8n Credentials using the secrets acquired above (`PostgreSQL`, and two `Header Auth` nodes).
3. Import the workflows one by one into n8n via **Import from File**:
    *   `workflow-1-data-snapshot.json` 
    *   `workflow-2-ai-analysis.json`
    *   `workflow-3-slack-webhook.json`
4. Update the "Trigger Workflow" node in Workflow 1 to point exactly to the ID of your imported Workflow 2.
5. In Workflow 2, verify your Slack channel ID is correctly entered in the **Post to Slack** node.
6. Click **Test Workflow** on Workflow 1 to run a test pipeline!

---

## 🤖 Built Autonomously with Google Antigravity & n8n-MCP

This entire database schema, javascript calculations, strict Gemini prompt structure, and Slack block kit rendering were generated and deployed **autonomously** using prompting via **Google Antigravity** acting alongside an **n8n-MCP** server. 

### How to reproduce this Agentic Build:

If you are using Antigravity (or another advanced MCP-capable Agent logic like Claude Desktop) and wish to have the AI build this for you from scratch:

1. Follow standard [n8n-MCP setup instructions](https://github.com/n8n-io/n8n-mcp) to install the MCP server sidecar alongside your editor/agent. Ensure your workspace agent can successfully call `npx @n8n/n8n-mcp` and authenticate with your self-hosted n8n instance.
2. Initialize the agent session in the intended workspace directory.
3. Paste the contents of `initial_prompt.md` directly into the agent.
4. The agent will read its constraints and actively leverage MCP to:
    * Interrogate the n8n instance
    * Generate and test local NodeJS deployment scripts for schema creation
    * Use n8n-mcp to map out API nodes and build workflows dynamically
    * Prompt you to input the mandatory credentials *before* proceding down the pipeline execution path

> **Note:** Due to parallelization limits inside certain Agent architectures acting concurrently with MCP (e.g. `get_node` spamming), if the `n8n-mcp` connection drops (`EOF` error), simply restart the MCP process from the Agent's server checklist and instruct the agent to use standard REST API failovers as seen in `build_workflows.mjs`!
