# AI Media Buying Advisor: Prediction Generation & Learning Loop

This document outlines how the MVP currently generates media buying predictions, details the active system prompt, and explains how the system captures data for future reinforcement learning.

## 1. How Predictions are Generated

Predictions are currently generated through a combination of hardcoded statistical analysis (JavaScript) and qualitative AI reasoning (Gemini 2.0 Flash).

### Step A: Statistical Trailing Velocity (n8n Code Node)
Before the data ever reaches the AI, **Workflow 1** performs a trailing 7-day vs. prior 7-day velocity check. It calculates exactly how fast CPA and ROAS are moving (e.g., CPA is up 15%, ROAS is down 5%). It also tags campaigns with Boolean signals (e.g., `cpaAlert: true`) if they cross specific mathematical thresholds.

### Step B: AI Qualitative Evaluation (Gemini 2.0 Flash)
The math is then bundled into a massive JSON array and passed directly into **Workflow 2**. Workflow 2 wraps the array inside a highly structured **System Prompt** and asks Gemini 2.0 Flash to evaluate the numbers against predefined benchmarks.

---

## 2. The Active System Prompt

The predictions are driven entirely by this static prompt located in the **"Build Gemini Prompt"** node of Workflow 2:

```text
SYSTEM:
You are an expert media buying analyst. You analyse paid advertising performance data and generate prioritised, actionable recommendations. You respond ONLY with valid JSON matching the schema provided. Never add explanations outside the JSON.

USER:
Analyse the following 7-day ad performance data (with prior 7-day trend comparison) and generate recommendations.

PERFORMANCE BENCHMARKS (targets):
- CPA target: $20 or below
- ROAS target: 3.0 or above
- CTR healthy: above 1.0%

DECISION RULES:
- PAUSE: CPA > 2x benchmark for 3+ days, or ROAS < 1.0
- DECREASE_BUDGET: CPA trending up >30%, ROAS trending down >20%
- INCREASE_BUDGET: ROAS > 1.5x target AND CPA < 70% of benchmark
- REALLOCATE: One platform significantly outperforming another by same budget
- MONITOR: Mixed signals, insufficient data, or minor variance within 15%

AD PERFORMANCE DATA:
{ ... dynamic JSON array of all ad campaigns & calculated trends ... }

Respond with ONLY this JSON structure...
```

Gemini reads this prompt, evaluates the statistics against the `DECISION RULES`, and outputs a perfectly formatted JSON recommendation (e.g., Action: "Pause", Priority: "High").

---

## 3. Does it learn from your responses?

**Currently: Partially.**

We have laid the architectural foundation for a reinforcement learning loop, but the loop is not "closed" yet.

### What works today:
When you click **"Approve"** or **"Reject"** in Slack, **Workflow 3** intercepts your click and permanently records it into the PostgreSQL `decision_log` table. The machine perfectly remembers every time you disagreed with it.

### What is missing:
**Workflow 2** does not yet read the `decision_log` table before it generates new predictions. It evaluates strictly based on the static rules in the System Prompt.

### How to complete the Learning Loop (Future Enhancement):
To transition this MVP from a "static rule-follower" into a true "Few-Shot self-correcting agent", we would implement the following logic:

1. **Query Past Mistakes:** Before calling Gemini, add a Postgres node to query: `SELECT * FROM decision_log WHERE decision = 'rejected' ORDER BY decision_time DESC LIMIT 5`.
2. **Inject Context:** Inject these historical failures dynamically into the bottom of the System Prompt.

**Example Dynamic Prompt Injection:**
> *PAST MISTAKES TO AVOID:*
> *Last week, you suggested pausing Campaign X because CPA hit $25, but the human REJECTED it because CTR was very high (1.5%). Adjust your threshold for high-CTR campaigns accordingly!*

Once this injection is active, Gemini will read its past failures and naturally adapt its internal logic to mimic your exact human media-buying preferences!
