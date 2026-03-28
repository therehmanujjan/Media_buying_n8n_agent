Got it. So you're using **Google Antigravity** (Google's AI agent environment) with the **n8n-MCP server** connected to it, which means Antigravity can directly create/manage n8n workflows via MCP tool calls. Here's your complete prompt:

---Here's your complete Antigravity agent prompt — formatted as a ready-to-paste system instruction:A few things to note before you paste this into Antigravity:

**How to use it:** Paste this as your first message (or system instruction if Antigravity supports that). The agent will immediately start collecting credentials before touching anything — that's intentional and non-negotiable by design.

**The Slack webhook workflow (button clicks) is intentionally not included** in this session. That's Workflow 3 and needs to be a separate session once you've confirmed the Slack messages are appearing correctly with the buttons. The approve/reject interactivity requires a publicly accessible n8n webhook URL pointed to in your Slack app's Interactivity settings — easier to test that end-to-end once the digest is working.

**One thing to do before running:** Make sure your Slack bot has been added to the target channel. Even with `chat:write.public`, bots need to be invited to private channels. If it's a public channel you're fine.

**Gemini's `responseMimeType: "application/json"` is the key** — this is Gemini's equivalent of structured output mode and eliminates JSON parsing failures. The agent's prompt enforces this in the HTTP body.