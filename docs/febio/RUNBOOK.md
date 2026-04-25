# FEBio 実行手順

FEBio 実行と確認の手順です。現在の active export path は [FEBIO_PATH_OWNERSHIP.md](FEBIO_PATH_OWNERSHIP.md) を参照してください。退役済み bridge の詳細は [../../legacy/docs/febio/FEBIO_UI_BRIDGE.md](../../legacy/docs/febio/FEBIO_UI_BRIDGE.md)、契約は [../../legacy/docs/febio/BRIDGE_CONTRACT.md](../../legacy/docs/febio/BRIDGE_CONTRACT.md) に移動しています。

## 推奨 native-only export

```bash
node scripts/export_febio_native_case.mjs --case febio_cases/native/S7_baseline.native.json --out-dir febio_exports/S7_native_baseline
```

生成される主要 artifact:

- `febio_exports/S7_native_baseline/S7_native_baseline.feb`
- `febio_exports/S7_native_baseline/S7_native_baseline_effective_native_spec.json`
- `febio_exports/S7_native_baseline/S7_native_baseline_native_model.json`
- `febio_exports/S7_native_baseline/S7_native_baseline_manifest.json`
- `febio_exports/S7_native_baseline/S7_native_baseline_README.txt`

## FEBio CLI / Studio 確認

manifest の `commands.febioCli` と `studioConfirmation` を確認対象にする。

実行補助として残すもの:

- `scripts/run_febio_case.ps1`

旧 UI bridge / canonical export / converter は legacy / compatibility 扱い。必要なときだけ `legacy/` と `docs/febio/FEBIO_PATH_OWNERSHIP.md` を確認する。

## 確認ポイント

- `.feb` が生成されている。
- FEBio CLI が `NORMAL TERMINATION` まで到達している。
- effective native spec と native model JSON が保存されている。
- manifest に expected log / xplt / CSV / result JSON path が含まれている。

## 失敗時に見るもの

- `febio_exports/S7_native_baseline/S7_native_baseline_manifest.json`
- FEBio CLI log
- Studio の surface orientation / pressure sign / contact pair 表示

`generated/**` は調査用出力であり、恒久的な source-of-truth ではない。
