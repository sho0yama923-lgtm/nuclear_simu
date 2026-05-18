# FEBio 実行手順

FEBio 実行と確認の手順です。現在の active export path は [FEBIO_PATH_OWNERSHIP.md](FEBIO_PATH_OWNERSHIP.md) を参照してください。退役済み bridge の詳細は [../../legacy/docs/febio/FEBIO_UI_BRIDGE.md](../../legacy/docs/febio/FEBIO_UI_BRIDGE.md)、契約は [../../legacy/docs/febio/BRIDGE_CONTRACT.md](../../legacy/docs/febio/BRIDGE_CONTRACT.md) に移動しています。

## 推奨 Gmsh mesh edit export

現在の正規 mesh edit workspace は `generated/gmsh_current/` です。

```bash
node scripts/dump_native_gmsh_baseline.mjs \
  --case febio_cases/native/S10_pipette_nc_refined.native.json \
  --run-gmsh
```

主要 artifact:

- `generated/gmsh_current/mesh.geo`
- `generated/gmsh_current/mesh.msh`
- `generated/gmsh_current/mesh.validation.json`
- `generated/gmsh_current/mesh.roundtrip.json`
- `generated/gmsh_current/mesh.source.json`
- `generated/gmsh_current/mesh.py`

手編集は `mesh.geo` を使う。`mesh.py` は再生成 artifact として扱う。

編集済み `.msh` から FEBio handoff を作る:

```bash
node scripts/export_febio_from_gmsh_mesh.mjs \
  --case febio_cases/native/S10_pipette_nc_refined.native.json \
  --msh generated/gmsh_current/mesh.msh
```

既定の出力先は `febio_exports/current_mesh/`。FEBio handoff 名はバージョンなしの `current_mesh.feb`。

Python API 経路を検証する場合:

```bash
node scripts/export_febio_from_gmsh_python_api.mjs \
  --case febio_cases/native/S10_pipette_nc_refined.native.json
```

既定の出力先は `febio_exports/current_mesh_api/`。FEBio handoff 名はバージョンなしの `current_mesh_api.feb`。

現在の S10-I は `meshMode="s10-top-pipette-reference"` の上吸引メッシュです。正規の current handoff は `febio_exports/current_mesh/current_mesh.feb` です。旧バージョン別生成物と solver evidence は `legacy/retired_generated_2026-05-18/` に退避済みです。退避前の Windows FEBio CLI evidence は FEBio 4.12.0 で `N O R M A L   T E R M I N A T I O N` まで到達し、`nucleus_cytoplasm_top_surface` を含む expected records を出力済みです。

## FEBio CLI / Studio 確認

FEBio solver / FEBio Studio の実行確認は Windows 環境で行う。WSL Ubuntu は native case JSON の編集、export、static diagnostics、Node/npm test に使い、FEBio solver 実行そのものには使わない。

manifest の `commands.febioCli` と `studioConfirmation` を確認対象にする。

実行補助として残すもの:

- `scripts/run_febio_case.ps1`

Windows 側での基本手順:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile febio_exports/current_mesh/current_mesh.feb
```

WSL/UNC 経由で runner が不安定な場合は、current `.feb` を Windows ローカルの run directory に置いてから、FEBio を直接実行する:

```cmd
cd /d C:\Users\xiogo\projects\nuclear_simu\febio_exports\current_mesh
C:\Progra~1\FEBioStudio\bin\febio4.exe -i current_mesh.feb
```

FEBioStudio で確認する場合も、同じ `febio_exports/<case>/...feb` を Windows 側から開く。

旧 UI bridge / canonical export / converter は legacy / compatibility 扱い。必要なときだけ `legacy/` と `docs/febio/FEBIO_PATH_OWNERSHIP.md` を確認する。

## 確認ポイント

- `.feb` が生成されている。
- FEBio CLI が `NORMAL TERMINATION` まで到達している。
- effective native spec と native model JSON が保存されている。
- manifest に expected log / xplt / CSV / result JSON path が含まれている。

## 失敗時に見るもの

- `legacy/retired_generated_2026-05-18/febio_exports/S7_native_baseline/S7_native_baseline_manifest.json`
- `generated/gmsh_current/mesh.validation.json`
- `febio_exports/current_mesh/current_mesh_manifest.json`
- `legacy/retired_generated_2026-05-18/febio_exports/S10_pipette_nc_refined/S10-I_S10_pipette_nc_refined_manifest.json`
- FEBio CLI log
- Studio の surface orientation / pressure sign / contact pair 表示

`generated/gmsh_current/mesh.geo` は現在の正規手編集 workspace。その他の `generated/**` は調査用出力であり、恒久的な source-of-truth ではない。
