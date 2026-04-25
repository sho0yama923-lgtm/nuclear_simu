import { cloneNativeValue as clone } from "./caseSpec.ts";

function buildFaceDataOutputSpec(name, file, surface, currentCoverage = {}) {
  return {
    name,
    file,
    surface,
    logfileData: "contact gap;contact pressure",
    logfileFields: ["contact gap", "contact pressure"],
    optionalExternalFields: ["contact traction", "traction x", "traction y", "traction z", "tangential traction", "shear traction"],
    currentCoverage: {
      normal: currentCoverage.normal || "native-face-data-preferred",
      damage: currentCoverage.damage || "native-face-data-preferred",
      shear: currentCoverage.shear || "proxy-fallback-explicit"
    }
  };
}

function buildPlotfileSurfaceTractionSpec(name, surface, interfaceGroup, region, sectionAxes) {
  return {
    name,
    variable: "contact traction",
    surface,
    interfaceGroup,
    region,
    alias: `${name}_contact_traction`,
    payloadPath: `plotfileSurfaceData.${interfaceGroup}.${region}`,
    preferredSource: "native-plotfile-contact-traction",
    sectionAxes
  };
}

export function buildNativeOutputs(spec, mesh) {
  const mouthPlaneX = mesh.bounds?.pipetteContactX ?? mesh.bounds?.pipetteLeft ?? spec.geometry.pipette.tip.x;
  return {
    faceData: [
      buildFaceDataOutputSpec("nucleus_cytoplasm_interface_surface", "febio_interface_nucleus_cytoplasm.csv", "nucleus_interface_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_left_surface", "febio_interface_nc_left.csv", "nucleus_interface_left_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_right_surface", "febio_interface_nc_right.csv", "nucleus_interface_right_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_top_surface", "febio_interface_nc_top.csv", "nucleus_interface_top_surface"),
      buildFaceDataOutputSpec("nucleus_cytoplasm_bottom_surface", "febio_interface_nc_bottom.csv", "nucleus_interface_bottom_surface"),
      buildFaceDataOutputSpec("cell_dish_interface_surface", "febio_interface_cell_dish.csv", "cell_dish_surface"),
      buildFaceDataOutputSpec("cell_dish_left_surface", "febio_interface_cd_left.csv", "cell_dish_left_surface"),
      buildFaceDataOutputSpec("cell_dish_center_surface", "febio_interface_cd_center.csv", "cell_dish_center_surface"),
      buildFaceDataOutputSpec("cell_dish_right_surface", "febio_interface_cd_right.csv", "cell_dish_right_surface"),
      buildFaceDataOutputSpec("pipette_cell_contact_surface", "febio_pipette_cell_contact.csv", "pipette_suction_surface", {
        damage: "proxy-fallback-explicit",
        shear: "proxy-fallback-explicit"
      }),
      buildFaceDataOutputSpec("pipette_contact_surface", "febio_pipette_contact.csv", "pipette_contact_surface", {
        damage: "proxy-fallback-explicit",
        shear: "not-used"
      })
    ],
    plotfileSurfaceData: [
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_left_surface", "nucleus_interface_left_surface", "localNc", "left", { normal: "x", tangential: "z" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_right_surface", "nucleus_interface_right_surface", "localNc", "right", { normal: "x", tangential: "z" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_top_surface", "nucleus_interface_top_surface", "localNc", "top", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("nucleus_cytoplasm_bottom_surface", "nucleus_interface_bottom_surface", "localNc", "bottom", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_left_surface", "cell_dish_left_surface", "localCd", "left", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_center_surface", "cell_dish_center_surface", "localCd", "center", { normal: "z", tangential: "x" }),
      buildPlotfileSurfaceTractionSpec("cell_dish_right_surface", "cell_dish_right_surface", "localCd", "right", { normal: "z", tangential: "x" })
    ],
    detachment: {
      evaluation: "damage-plus-geometry",
      preferredSource: "native-first / proxy-assisted fallback",
      events: ["detachmentStart", "detachmentComplete"],
      metrics: ["contactAreaRatio", "relativeNucleusDisplacement"],
      payloadPath: "normalizedResult.events"
    },
    aspiration: {
      name: "pipette_aspiration_length",
      metric: "L(t)",
      unit: "um",
      status: "native-or-postprocessed-contract",
      preferredSource: "native-node-displacement",
      payloadPath: "aspiration.length",
      historyPath: "history[].aspirationLength",
      peakPath: "peaks.peakAspirationLength",
      reference: { surface: "pipette_contact_surface", nodeSet: "pipette_contact_nodes", mouthPlaneX, inwardAxis: "-x", sectionPlane: "x-z" },
      definition: "Clamp to >=0 the projected distance from the pipette mouth plane to the most inward aspirated nucleus/cytoplasm node.",
      mapsTo: ["history[].aspirationLength", "aspiration.length", "peaks.peakAspirationLength"]
    }
  };
}

export function buildNativeLogOutputs(outputs) {
  return {
    nodeData: [
      { name: "nucleus_nodes", file: "febio_nucleus_nodes.csv", nodeSet: "nucleus", data: "ux;uy;uz" },
      { name: "cytoplasm_nodes", file: "febio_cytoplasm_nodes.csv", nodeSet: "cytoplasm", data: "ux;uy;uz" },
      { name: "pipette_contact_nodes", file: "febio_pipette_contact_nodes.csv", nodeSet: "pipette_contact_nodes", data: "ux;uy;uz" }
    ],
    rigidBodyData: [
      { name: "pipette_rigid_body", file: "febio_rigid_pipette.csv", data: "x;y;z;Fx;Fy;Fz", item: "pipette" }
    ],
    faceData: clone(outputs.faceData),
    plotfileSurfaceData: clone(outputs.plotfileSurfaceData),
    aspiration: clone(outputs.aspiration)
  };
}
