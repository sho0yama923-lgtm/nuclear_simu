# FEBio 実行手順

FEBio 実行と確認の手順です。bridge の詳細は [FEBIO_UI_BRIDGE.md](FEBIO_UI_BRIDGE.md)、契約は [BRIDGE_CONTRACT.md](BRIDGE_CONTRACT.md) を参照してください。

## 推奨 UI 実行

1. bridge を起動する。

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -OpenApp
```

2. [http://127.0.0.1:8765/](http://127.0.0.1:8765/) を開く。
3. UI から `FEBio実行` を押す。
4. physical result が表示されることを確認する。

## FEBio 実行ファイルを指定する場合

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start_febio_bridge.ps1 -FebioExe "C:\Program Files\FEBioStudio\bin\febio4.exe" -OpenApp
```

## CLI 変換の基本

export / run / convert の中心は次です。

- `scripts/export_febio_case.mjs`
- `scripts/run_febio_case.ps1`
- `scripts/convert_febio_output.mjs`

結果 JSON は app result schema に寄せられ、UI では normalized physical result として読む。

## 確認ポイント

- `.feb` が生成されている。
- FEBio CLI が `NORMAL TERMINATION` まで到達している。
- `case_*_result.json` が生成されている。
- `outputMapping` と `resultProvenance.interfaceObservation` が含まれている。
- `localNc` / `localCd` の native / proxy provenance が消えていない。
- classification が detachment 定義と矛盾していない。

## 失敗時に見るもの

- bridge status / `/health`
- `generated/febio_exports/ui_bridge/case_*/run/`
- FEBio CLI log
- converter の error
- `parameterDigest` mismatch

`generated/**` は調査用出力であり、恒久的な source-of-truth ではない。
