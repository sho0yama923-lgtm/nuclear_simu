import { buildRefinedFebioGeometry, validateFebioMesh } from "../mesh/index.ts";

function geometryForNativeMesh(spec) {
  return {
    geometry: {
      Ln: spec.geometry.nucleus.width,
      Hn: spec.geometry.nucleus.height,
      Lc: spec.geometry.cytoplasm.width,
      Hc: spec.geometry.cytoplasm.height,
      xn: spec.geometry.nucleus.center.x,
      yn: spec.geometry.nucleus.center.z,
      rp: spec.geometry.pipette.radius,
      xp: spec.geometry.pipette.tip.x,
      zp: spec.geometry.pipette.tip.z,
      punctureX: spec.geometry.pipette.puncture?.x ?? spec.geometry.pipette.tip.x,
      punctureZ: spec.geometry.pipette.puncture?.z ?? spec.geometry.pipette.tip.z,
      pipetteSuctionSurface: spec.loads.suctionPressure.surface,
      meshMode: spec.geometry.meshMode || "s7-debug-local-nucleus"
    }
  };
}

export function buildNativeMesh(spec) {
  return buildRefinedFebioGeometry(geometryForNativeMesh(spec));
}

export { validateFebioMesh as validateNativeMesh };
