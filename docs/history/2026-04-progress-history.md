# 2026-04 進捗履歴

`PROGRESS.md` から外した historical sections の退避先です。現在状態は [../../PROGRESS.md](../../PROGRESS.md) を参照してください。

## 2026-04-24 方針転換メモ

- Priority 2 Stage 6 を完了済みとして確定し、Stage 6 後の次焦点を sticky cohesive validation / bridge diagnostics から simulation condition advancement へ切り替えた。
- 以後の最優先は solver-active mesh、complete FEBio XML、pressure-driven suction、aspiration length output、native interface output、unit-system clarification とする。
- sticky cohesive validation は重要だが、実体 mesh・load・output が物理的に成立した後に進める。
- compatibility cleanup / classification cleanup は Stage 6 完了済みの前提で深追いせず、real solver outputs が出た後に再評価する。

## 2026-04-24 Stage S1 着手メモ

- refined mesh baseline に nucleus / cytoplasm / dish / pipette の非空 element set を追加した。
- `validateFebioMesh` は required domain / required surface / required surface pair の欠損を invalid として落とすようにした。
- solver-active mesh completeness はまだ in progress 扱いで、次は XML 側に nodes / elements / ElementSet / Surface / SurfacePair を実体出力する。

## 2026-04-24 Stage S2 着手メモ

- `serializeFebioTemplateToXml` が refined mesh の nodes / elements / ElementSet / Surface / SurfacePair を XML に出すようになった。
- nucleus / cytoplasm material の `E`, `nu`, `eta` も template data だけでなく XML に反映される。
- Stage S2 は in progress 扱いで、次は boundary / contact / load serialization を完成させる。

## 2026-04-24 Stage S2 完了メモ

- XML に dish fixed boundary、pipette prescribed motion、cell-dish contact、proxy hold force / pressure metadata、load controllers を追加した。
- `P_hold` はまだ pressure-driven suction ではなく、Stage S3 の pressure load curve へ移行するための placeholder として明示している。
- 次の焦点は Stage S3: pressure-driven pipette suction と unit-system clarification。

## 2026-04-24 Stage S3 completion memo

- `P_hold` is now a solver-active suction pressure magnitude in kPa.
- FEBio export writes `P_hold` as negative pressure on `pipette_contact_surface` with `suction_pressure_curve`.
- Prescribed pipette motion remains separate positioning control.
- Unit system is recorded as `um-s-kPa-nN` in `src/model/types.ts` and `docs/febio/PRESSURE_SUCTION_STAGE_S3.md`.
- Next focus is Stage S4: aspiration length `L(t)` and native/interface output.

## 過去の再開位置

- 最後に完了した節目: converter の face-data parser が descriptor-driven になり、leading entity id の有無だけでなく、extra metadata 列付き row と descriptor-driven field order も解釈できるようになった。加えて export metadata 側でも、標準 logfile `face_data` が現状 `contact gap;contact pressure` までで、tangential traction は optional external/plotfile-side extension であることを bundle から読めるようにした。
- 当時の未完了項目: export 側の標準 face_data はまだ `contact gap;contact pressure` で、native tangential observation は外部 payload か将来の plotfile/bridge 拡張に依存していた。また、non-canonical context では classification / detachment の compatibility fallback helper が一部残っていた。
- 当時次に開くファイル: `src/febio/export/index.ts`, `js/simulation-febio.js`, `scripts/convert_febio_output.mjs`, `simulation.js`
- 当時の完了条件: face-data export descriptor か compatibility-owned detachment/classification branch のどちらかをもう 1 つ native-first に移行し、browser compatibility を壊さず、対象テストが通り、`再開位置` が次の未解決枝を指す状態に更新されていること。

## 過去の次の3手

### Step 1

- Target files: `docs/febio/FEBIO_OUTPUT_MAPPING.md`, `scripts/convert_febio_output.mjs`, `src/febio/import/normalizeFebioResult.ts`, `tests/febio-front-end.test.mjs`
- Expected output: import 結果が `localNc` / `localCd` の shear または detachment provenance を proxy 補完前により多く native 保持し、現行の external payload 仮定が docs に正直に残る。
- Done condition: 対象の `localNc` shear または detachment path で native/proxy provenance が明示され、classification がそれを整合的に消費し、fallback がラベル付きで残り、mapping note に新しい native tangential branch が反映されている。

### Step 2

- Target files: `simulation.js`, `src/results/classification.ts`, `src/public-api.ts`, `tests/febio-front-end.test.mjs`
- Expected output: compatibility-owned な classification または detachment helper が 1 つ、独自 threshold や sequencing を持たず canonical `src/` code 経由へ寄る。
- Done condition: 対象 compatibility branch が振る舞いを所有しなくなり、browser compatibility が維持され、対象テストが通り、`再開位置` が次の未解決 branch を指す。

### Step 3

- Target files: `src/febio/interfaces/nucleusCytoplasm.ts`, `src/febio/export/index.ts`, `tests/febio-front-end.test.mjs`
- Expected output: sticky cohesive path が deferred physics へ広げずに、より安定して検証しやすくなる。
- Done condition: 対象 stabilization parameterization が clean に export され、現行 path を壊さず、次の検証論点が `未解決問題` または `再開位置` に記録されている。
