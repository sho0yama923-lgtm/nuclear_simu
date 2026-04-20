# FEBio Front-End Architecture

## UI-only role
- UI is for parameter input, validation, export, bridge execution support, import, and rendering only.
- Main display accepts imported physical FEBio results only.
- Before import, the UI shows `export ready / awaiting FEBio result`.

## Canonical parameter schema
- Defined in `/C:/Users/xiogo/projects/nuclear_simu/simulation.js`.
- Every parameter is normalized into a canonical spec with:
  - `uiKey`
  - `internalKey`
  - `category`
  - `unit`
  - `defaultValue`
  - `min`
  - `max`
  - `required`
  - `validation`
  - `febioPath`
  - `transformIn`
  - `transformOut`
  - `description`
- `parameterDigest` is generated from the canonical FEBio-facing input.

## FEBio export / import flow
1. UI values
2. `buildSimulationInput()` canonical spec
3. `buildFebioTemplateData()`
4. `serializeFebioTemplateToXml()`
5. `buildFebioRunBundle()`
6. FEBio CLI execution
7. `convert_febio_output.mjs`
8. imported normalized physical result rendering

## Result rendering flow
- Main result requires `isPhysicalFebioResult === true`.
- Non-physical mock / bridge placeholder / legacy lightweight results are not rendered as the main result.
- Provenance shown in UI:
  - solver source
  - parameter digest
  - export time
  - import time
  - result provenance

## Mesh policy
- Coarse mesh builder remains as legacy reference.
- Refined mesh builder is the main export path.
- Validation report includes:
  - invalid element
  - zero or negative volume proxy
  - duplicated nodes
  - disconnected regions
  - aspect ratio warnings

## Added tests
- UI input -> canonical spec mapping
- canonical spec -> FEBio template mapping
- template -> XML serialization consistency
- digest consistency
- export/import digest match
- mesh validation report
- UI gate for non-physical result rejection

Run:

```powershell
node --test tests\febio-front-end.test.mjs
```

## Unfinished physical model areas
- full viscoelastic FEBio serialization
- shell membrane / cortex element model
- true cohesive traction-separation serialization for both interfaces
- further local mesh refinement and adaptive meshing
- direct `.xplt` parsing without intermediate JSON conversion
