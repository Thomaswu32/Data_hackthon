# 3-Minute Demo Script — Compounding Support Desk

Audience: hackathon judges. Goal: show the compounding loop (diagnose → confirm → execute → verify → save → reuse), not just a chat UI.

Setup beforehand: app open in the browser, demo data freshly reset (**⋯ → Reset demo data** in the ticket list, or a fresh `pnpm run check` run as a terminal backup if the UI environment isn't available).

---

**[0:00–0:20] The problem**

"Support teams re-solve the same issue over and over because nobody captures *verified* fixes in a form the next agent can actually trust. This is the Compounding Support Desk: every verified resolution makes the next similar ticket faster — but only when it's genuinely the same problem, not just similar-sounding text."

**[0:20–0:55] Ticket #1 — first time diagnosing**

- Click **⋯ → Create demo ticket #1**. Point out the thin stat strip at the top updating (tickets, open, SLA breaches).
- The middle panel opens on **stage 2 · Diagnose**: "Reset my password, still can't log in to Corporate SSO."
- The panel shows a short "checking similar issues…" beat, then settles: **"3 similar cases found · View"** — click to expand it. "One of these looks almost identical in wording but was actually on the VPN Gateway, not SSO — the app won't reuse that one, because the *system* is different, even though the words match."
- Point at the **Live workflow panel** on the right: Cognee, Hotdata, and Modiq nodes lit up together during that lookup (they ran in parallel, not a scripted sequence) — Hotdata/Modiq pulse green (real, local computation); Cognee is labeled **Demo** because this deployed browser build doesn't yet have the real RocketRide shell wired in (explained in README section 7 — the check script proves the real path separately).
- The suggestion card shows **"A few quick checks"** instead of a fix yet — no verified playbook exists, so it asks prerequisites first. "An AI suggestion is not a confirmed fix."

**[0:55–1:30] Narrowing the diagnosis and executing**

- Answer the quick checks one at a time (cache cleared: **Yes**, account unlock: **Yes**, MFA re-enrolled: **No**) — point out the "1 of 3" progress and that you can go back and change an answer.
- The suggestion updates live: now cites a specific historical ticket with the same root cause, but is still flagged as a precedent, not a verified playbook — confirmation is still required.
- Click **Run approved steps** — call out explicitly: "this only touches a simulated demo environment, never a real company system."
- Stage 3 · **Take action** shows the steps that ran, then asks **"Can you sign in now?"** — click **Yes, it works**.
- Stage 4 shows a green **✓ Resolved** card: **"Fix saved for similar issues"** — this only appears because the playbook genuinely saved; if it hadn't, it would say so and offer a retry, not fake success.

**[1:30–2:15] Ticket #2 — the payoff**

- Click **⋯ → Create demo ticket #2** — a different customer, same "reset password, still can't log in" complaint.
- Answer the same prerequisite (MFA re-enrolled: **No**).
- The suggestion card now shows a direct **playbook reuse** — no re-diagnosis needed, citing the exact playbook saved from ticket #1.
- Run approved steps → **Yes, it works** — point out this is a *different* ticket, *different* customer, reusing the *same* verified knowledge, and the Live workflow panel's HydraDB node lighting up again as the reuse gets persisted.

**[2:15–2:45] Guardrails, not just automation**

- Briefly create a ticket on VPN Gateway with the same symptom text: the playbook does **not** match — different system. "Text similarity alone would have gotten this wrong; system + symptom + prerequisites is what keeps it safe."
- Open **View technical details** at the bottom of the Live workflow panel — show the real call log: service, real duration, real/mock label, no fabricated numbers.
- Mention: `pnpm run check` (terminal) proves this exact loop end-to-end — including idempotency (marking resolved twice doesn't duplicate anything), persistence (closing and reopening the store doesn't lose the saved playbook), *and* that Cognee/HydraDB genuinely go real there once Gemini + credentials are configured (README section 6) — the deployed browser build is a separate, still-mock integration path pending the real RocketRide shell package.

**[2:45–3:00] Close**

"Five services show up in that live workflow diagram — RocketRide hosts and coordinates, Hotdata and Modiq are real working modules every time, Cognee and HydraDB have real, verified integrations (proven from the command line, wiring into the browser app is the one thing still pending), and Snyk caught and we fixed real dependency vulnerabilities in the build. Every run you saw is logged, timed, and labeled real, demo, or error — nothing here is smoke and mirrors."
