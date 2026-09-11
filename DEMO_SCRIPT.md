# 3-Minute Demo Script — Compounding Support Desk

Audience: hackathon judges. Goal: show the compounding loop (diagnose → confirm → execute → verify → save → reuse), not just a chat UI.

Setup beforehand: app open in the browser (or `pnpm run check` in a terminal as a live backup if the UI environment isn't available), demo data freshly reset (**Reset demo data** button, or a fresh `pnpm run check` run).

---

**[0:00–0:20] The problem**

"Support teams re-solve the same issue over and over because nobody captures *verified* fixes in a form the next agent can actually trust. This is the Compounding Support Desk: every verified resolution makes the next similar ticket faster — but only when it's genuinely the same problem, not just similar-sounding text."

**[0:20–0:55] Ticket #1 — first time diagnosing**

- Click **+ Demo ticket #1**. Point out the KPI bar updating (total tickets, open count).
- Ticket detail opens: "Reset my password, still can't log in to Corporate SSO."
- Point to **Related history**: several past tickets look almost identical in wording — but one of them was actually on the VPN Gateway, not SSO. "The app doesn't reuse that one — different system, so different root cause, even though the words match."
- Point to **Hotdata**: real-time count of similar recent tickets and current SLA breach numbers, computed live from the ticket store.
- Point to **Suggested next steps**: no verified playbook exists yet, so it proposes prerequisite checks first, not a fix — "an AI suggestion is not a confirmed fix."

**[0:55–1:30] Narrowing the diagnosis and executing**

- Toggle the prerequisite checks (cache cleared: yes, account unlock: yes, MFA re-enrolled: **no**).
- Suggestion updates: now cites a specific historical ticket with the same root cause, confidence rises, but still flagged as "a precedent, not a verified playbook" — confirmation still required.
- Click **Confirm & execute (demo environment)** — call out explicitly: "this only touches a simulated demo environment, never a real company system."
- Click **Mark resolved** — now, and only now, the ticket is verified, and the app saves this as a new reusable playbook. Point to the **Run log** panel on the right: real internal Modiq/Hotdata calls, timestamped and timed, versus the Cognee/HydraDB calls clearly labeled MOCK because no credentials are configured in this environment.

**[1:30–2:15] Ticket #2 — the payoff**

- Click **+ Demo ticket #2** — a different customer, same "reset password, still can't log in" complaint.
- Set the same prerequisite (MFA re-enrolled: no).
- The suggestion panel now shows **"verified playbook reuse"** directly, citing the exact playbook saved from ticket #1 — no re-diagnosis needed.
- Confirm & execute, mark resolved — point out the playbook's reuse counter incrementing, and that this is a *different* ticket, *different* customer, reusing the *same* verified knowledge.

**[2:15–2:45] Guardrails, not just automation**

- Briefly show creating a ticket on VPN Gateway with the same symptom text: the playbook does **not** match — different system. "Text similarity alone would have gotten this wrong; system + symptom + prerequisites is what keeps it safe."
- Mention: `pnpm run check` (terminal) proves this exact loop — including idempotency (marking resolved twice doesn't duplicate anything) and persistence (closing and reopening the store doesn't lose the saved playbook) — from the command line, independent of the UI.

**[2:45–3:00] Close**

"Six services collaborate here — RocketRide orchestrates, Hotdata and Modiq are real working modules, Cognee and HydraDB have real adapters and pipelines ready to go the moment credentials are added, and Snyk caught and we fixed real dependency vulnerabilities in the build. Every run you saw is logged, timed, and labeled real or mock — nothing here is smoke and mirrors."
