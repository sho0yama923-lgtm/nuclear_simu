# FEBio Path Ownership

## Active Path

The only active FEBio export path for new solver-facing work is:

```text
febio_cases/native/*.native.json
  -> scripts/export_febio_native_case.mjs
  -> src/febio/native/caseSpec.ts
  -> src/febio/native/mesh.ts
  -> src/febio/native/interfaces.ts
  -> src/febio/native/outputs.ts
  -> src/febio/native/model.ts
  -> src/febio/native/xml.ts
  -> src/febio/native/exportCase.ts
  -> febio_exports/<case>/<case>.feb
```

This path owns new FEBio `.feb` generation, effective native spec output, native model output, manifest output, and README handoff output.

## Legacy Freeze

Everything outside the active path above is legacy / compatibility for FEBio export work. Do not edit these paths for new solver behavior, force-transfer validation, pressure/contact behavior, output mapping, or physics source-of-truth changes unless the user explicitly asks for compatibility maintenance:

```text
src/model/
src/public-api.ts
src/febio/spec/
src/febio/export/
src/febio/import/
src/results/
src/browser/
scripts/export_febio_case.mjs
scripts/export_febio_direct_case.mjs
scripts/convert_febio_output.mjs
simulation.js
js/simulation-febio.js
js/simulation-ui.js
legacy/docs/febio/PARAMETER_MAPPING.md
legacy/docs/febio/FEBIO_UI_BRIDGE.md
legacy/docs/febio/FEBIO_FRONTEND_ARCHITECTURE.md
legacy/docs/febio/FEBIO_HANDOFF.md
legacy/docs/febio/BRIDGE_CONTRACT.md
legacy/febio_exports/
```

Legacy paths may still be read for historical context, existing regression tests, or compatibility bug fixes. They should not receive new active FEBio behavior.

## Allowed Exceptions

Edit legacy paths only when one of these is true:

- The user explicitly asks for a legacy / compatibility fix.
- A regression test proves the active native-only path is broken because of a shared dependency, and the smallest safe fix must be made there.
- A documentation update is needed to mark a legacy path as legacy or to point readers to the active path.

When an exception is used, record the reason in `PROGRESS.md`.
