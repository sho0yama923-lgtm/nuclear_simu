# Active Files

This is the current working surface for FEBio export and validation.

## Active FEBio Export Path

```text
febio_cases/native/S7_baseline.native.json
scripts/export_febio_native_case.mjs
src/febio/native/
tests/febio-native-pipeline.test.mjs
febio_exports/S7_native_baseline/
```

Use this path for new solver-facing work, pressure/contact changes, `.feb` serialization, output declarations, manifests, and Studio handoff artifacts.

## Active Policy / Resume Files

```text
README.md
AGENT.md
PROGRESS.md
docs/CODEBASE_STRUCTURE.md
docs/febio/FEBIO_PATH_OWNERSHIP.md
docs/febio/FEBIO_NATIVE_SPEC.md
docs/febio/GEOMETRY_CONVENTIONS.md
docs/ops/STUDIO_CONFIRMATION_GATES.md
```

## Legacy Location

Retired FEBio docs and historical export artifacts live under:

```text
legacy/
```

Do not use files in `legacy/` for new solver behavior. They are historical references only.
