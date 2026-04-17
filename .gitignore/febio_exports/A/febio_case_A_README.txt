FEBio handoff bundle
generatedAt: 2026-04-17T04:48:46.716Z
caseName: A
solver source shown in app: FEBio bridge (mock)

Files in this bundle:
- case_A.feb: FEBio input XML
- febio_case_A_input.json: normalized app input + FEBio template metadata
- febio_case_A_manifest.json: handoff manifest

Recommended workflow:
1. Place the downloaded files in one working folder on the FEBio machine.
2. Run: powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile case_A.feb
3. Keep the generated .log / .xplt together with the original .feb for traceability.
4. If you want to bring results back into this app, convert FEBio outputs into the normalized app result JSON schema first.

Important note:
The browser app can generate FEBio inputs, but the in-app febio solver mode is still a mock bridge and does not run FEBio itself.