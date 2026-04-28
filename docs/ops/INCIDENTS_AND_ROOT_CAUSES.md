# Incidents and Root Causes

This document is the permanent stock of major problem causes, prevention rules, and reusable failure patterns.

`PROGRESS.md` should stay focused on the active milestone. When a major issue is understood, the durable cause and guardrail must be moved here instead of being left only in a transient progress log.

## Purpose

- Keep `PROGRESS.md` focused on the active milestone.
- Stock major problem causes so they are not lost when old progress logs are retired.
- Preserve reusable prevention rules and diagnostic lessons.
- Keep transient run logs out of this file unless they explain a reusable failure mode.

## What must be recorded here

Record an entry when any of the following becomes clear:

- A failure had a non-obvious root cause.
- A bug could silently corrupt interpretation or diagnostics.
- A solver / Studio / parser behavior can recur later.
- A workaround becomes a rule that future work must preserve.
- A misleading metric or gate was discovered.
- A compatibility or handoff issue affected the active FEBio path.

Do not rely on git history alone for these cases. Git history is the raw archive; this document is the curated cause log.

## What should not be recorded here

- One-off scratch attempts without reusable lessons.
- Raw run logs that are already captured in artifacts.
- Long chronological milestone history.
- Temporary hypotheses that were not confirmed.

## Entry format

Each entry should include:

- Status
- Discovered in
- Symptom
- Cause
- Impact
- Fix or mitigation
- Regression guard
- References

## Current entries to expand

- Studio save failures caused by unstable internal named selections.
- FEBio logfile delimiter mismatches.
- Output-channel mismatches between logfile face data and plotfile vectors.
- Pressure-only `cellDishLoadBearing` interpretation being too narrow.
- Contact variants that cause initial negative jacobian.
