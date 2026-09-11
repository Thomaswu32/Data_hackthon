# Compounding Support Desk

An AI IT support assistant that retrieves prior tickets and verified fixes, drafts a grounded suggestion, and — only after a human confirms the fix actually worked — saves it as a reusable playbook for qualifying future tickets.

## What it does

1. Create a ticket (system, symptom, description, priority).
2. The app retrieves related historical tickets and checks whether any **verified playbook** already matches this ticket's system + symptom + prerequisite checklist (never text similarity alone).
3. It checks current ticket volume for the same system/symptom (mass-incident signal) and SLA backlog.
4. It drafts a suggestion citing its sources — an AI suggestion is never treated as a confirmed fix.
5. A human confirms before anything runs, and execution only ever touches the **demo environment**, never a real company system.
6. Once a human explicitly marks the ticket resolved, the resolution is saved and (if none existed yet) promoted to a reusable playbook.
7. The next similar ticket that satisfies the same prerequisites finds and reuses that playbook directly.

See the workspace root `README.md` for the full architecture, the tool status table (real vs. mock integrations), and how to run the verification script.
