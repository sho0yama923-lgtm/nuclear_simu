# Stage S4 Aspiration and Interface Output

Date: 2026-04-24

## Status

Stage S4 is completed at the export/import contract level.

The current FEBio path now declares:

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

Current converter definition:

- use native node displacement logs when available
- project inward motion along the pipette suction axis
- clamp the result to `>= 0`
- expose the final value at `aspiration.length`
- expose the timeline value at `history[].aspirationLength`
- expose the maximum value at `peaks.peakAspirationLength`

## Remaining Risk

This stage completes the output contract, not real solver validation.

Stage S5 must still verify that FEBio CLI / Studio can read the bundle and that the declared output files contain the expected solver data for sticky cohesive validation.
