# Stage S4 Aspiration and Interface Output

Historical note. This file is retained for stage history only. It is not the active FEBio source of truth.

Current active references:

- `docs/febio/FEBIO_OUTPUT_MAPPING.md`
- `docs/febio/FEBIO_NATIVE_SPEC.md`
- `docs/febio/FEBIO_PATH_OWNERSHIP.md`

---

Date: 2026-04-24

## Status

Stage S4 was completed at the export/import contract level.

The FEBio path declared:

- `aspiration.length`
- `history[].aspirationLength`
- `peaks.peakAspirationLength`
- displacement node logs for nucleus / cytoplasm / pipette contact nodes
- rigid pipette body logs
- contact gap / contact pressure face logs
- plotfile `contact traction` bridge paths for `localNc.*` and `localCd.*`
- native / proxy / unavailable provenance through converter and import paths

## Definition

`L(t)` is the aspiration length in `um`.

Converter definition at the time:

- use native node displacement logs when available
- project inward motion along the pipette suction axis
- clamp the result to `>= 0`
- expose the final value at `aspiration.length`
- expose the timeline value at `history[].aspirationLength`
- expose the maximum value at `peaks.peakAspirationLength`

## Remaining Risk

This stage completed the output contract, not real solver validation.

Stage S5 still needed to verify that FEBio CLI / Studio could read the bundle and that the declared output files contained the expected solver data for sticky cohesive validation.
