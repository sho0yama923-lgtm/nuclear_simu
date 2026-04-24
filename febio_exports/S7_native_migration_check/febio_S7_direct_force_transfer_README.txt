FEBio-native direct handoff for S7_direct_force_transfer

Parameter digest: fdig_6a8ed2a9
Export ready: true

Stage S7 checks:
- FEBio Studio readability
- pressure load active in solver steps
- pipette contact pair declaration
- cell-dish contact pair declaration
- nonzero displacement/contact pressure/reaction force after FEBio run

Run:
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile "/Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/S7_direct_force_transfer.feb"

Studio confirmation targets:
- feb: /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/S7_direct_force_transfer.feb
- log: /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/S7_direct_force_transfer.log
- result: /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/S7_direct_force_transfer_result.json
- output CSV: /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/febio_pipette_contact.csv, /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/febio_rigid_pipette.csv, /Users/yamaoxiogo/Desktop/GitHub/nuclear_simu/febio_exports/S7_native_migration_check/febio_interface_cell_dish.csv
