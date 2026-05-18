FEBio native-only handoff for S10_pipette_nc_refined

Parameter digest: fdig_5297d3af
Export ready: true

Run:
powershell -ExecutionPolicy Bypass -File scripts/run_febio_case.ps1 -FebFile "/home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh.feb"

Artifacts:
- feb: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh.feb
- effective native spec: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh_effective_native_spec.json
- native model: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh_native_model.json
- manifest: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh_manifest.json
- expected log: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh.log
- expected xplt: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh.xplt
- expected result JSON: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/current_mesh_result.json
- expected CSV: /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_interface_nc_top.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_interface_cell_dish.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_pipette_cell_contact.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_pipette_contact.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nucleus_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_cytoplasm_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_pipette_suction_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_pipette_suction_patch_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_pipette_contact_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_left_nucleus_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_left_cytoplasm_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_right_nucleus_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_right_cytoplasm_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_top_nucleus_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_top_cytoplasm_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_bottom_nucleus_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_nc_bottom_cytoplasm_nodes.csv, /home/xiogo/projects/nuclear_simu/febio_exports/current_mesh/febio_rigid_pipette.csv
