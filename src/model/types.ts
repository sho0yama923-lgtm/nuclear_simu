/**
 * SOURCE OF TRUTH: shared model constants and canonical region names.
 *
 * Responsibility: define canonical identifiers, region names, and shared model constants.
 * Owns: app schema version, region arrays, coordinate metadata, pinned field ordering.
 * Does NOT own: parameter defaults, validation rules, FEBio export behavior, classification logic.
 * Primary entrypoints: APP_SCHEMA_VERSION, NC_REGIONS, CD_REGIONS, MEMBRANE_REGIONS, COORDINATE_SYSTEM_SPEC.
 * Depends on: none.
 */

export const APP_SCHEMA_VERSION = "2026-04-22-ts-split";

export const NC_REGIONS = ["left", "top", "right", "bottom"];
export const CD_REGIONS = ["left", "center", "right"];
export const MEMBRANE_REGIONS = ["top_neck", "side", "basal"];

export const PINNED_OPERATION_KEYS = ["xp", "zp"];

export const COORDINATE_SYSTEM_SPEC = {
  sectionPlane: "x-z",
  topViewPlane: "x-y",
  verticalAxis: "z",
  tangentialAxis: "y",
  lengthUnit: "um",
  stressUnit: "kPa",
  viscosityUnit: "kPa*s",
  energyReleaseUnit: "N/m",
  note: "Fhold and P_hold remain internal proxy units until the native hold law is upgraded.",
};

export const CLASSIFICATION_THRESHOLDS = {
  detachmentStartDamage: 0.45,
  detachmentCompleteDamage: 0.72,
  detachmentAreaRatio: 0.35,
  detachmentDisplacement: 0.18,
  cellDishDamage: 0.28,
  membraneDamage: 0.18,
};

export function structuredCloneSafe(value) {
  return globalThis.structuredClone ? globalThis.structuredClone(value) : JSON.parse(JSON.stringify(value));
}
