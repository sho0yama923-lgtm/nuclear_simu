/**
 * Responsibility: Extract small diagnostic summaries from FEBio xplt files.
 * Owns: Minimal FEBio 4.x plotfile chunk walking for face contact force checks.
 * Does NOT own: General-purpose plotfile conversion or result normalization.
 */

const XPLT_MAGIC = "BEF\0";
const STATE_CHUNK = 0x00000002;
const STATE_TIME_CHUNK = 0x00000102;
const STATE_TIME_VALUE_CHUNK = 0x02000102;
const STATE_DATA_CHUNK = 0x00000202;
const FACE_DATA_GROUP_CHUNK = 0x00050202;
const FACE_VARIABLE_RECORD_CHUNK = 0x01000202;
const VARIABLE_ID_CHUNK = 0x02000202;
const VARIABLE_VALUES_CHUNK = 0x03000202;
const MESH_SURFACES_CHUNK = 0x00300401;
const SURFACE_RECORD_CHUNK = 0x00310401;
const SURFACE_ID_CHUNK = 0x02310401;
const SURFACE_NAME_CHUNK = 0x04310401;
const FLOAT32_BYTES = 4;
const VECTOR3_FLOAT_BYTES = 12;

function toBuffer(input) {
  if (!input) return null;
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return null;
}

function readChunk(buffer, offset, limit) {
  if (offset + 8 > limit) return null;
  const id = buffer.readUInt32BE(offset);
  const size = buffer.readUInt32LE(offset + 4);
  const dataOffset = offset + 8;
  const endOffset = dataOffset + size;
  if (size < 0 || endOffset > limit) return null;
  return { id, size, offset, dataOffset, endOffset };
}

function chunks(buffer, start, limit) {
  const result = [];
  let offset = start;
  while (offset + 8 <= limit) {
    const chunk = readChunk(buffer, offset, limit);
    if (!chunk) break;
    result.push(chunk);
    offset = chunk.endOffset;
  }
  return result;
}

function findChild(buffer, parent, id) {
  return chunks(buffer, parent.dataOffset, parent.endOffset).find((chunk) => chunk.id === id) || null;
}

function findDescendant(buffer, parent, id) {
  for (const child of chunks(buffer, parent.dataOffset, parent.endOffset)) {
    if (child.id === id) return child;
    const found = findDescendant(buffer, child, id);
    if (found) return found;
  }
  return null;
}

function readFloat32(buffer, offset, limit) {
  return offset + FLOAT32_BYTES <= limit ? buffer.readFloatLE(offset) : 0;
}

function readLengthPrefixedString(buffer, chunk) {
  if (!chunk || chunk.dataOffset + 4 > chunk.endOffset) return "";
  const length = buffer.readUInt32LE(chunk.dataOffset);
  const start = chunk.dataOffset + 4;
  const end = Math.min(start + length, chunk.endOffset);
  return buffer.subarray(start, end).toString("utf8").replace(/\0+$/g, "");
}

function parseSurfaceItemMap(buffer) {
  const map = {};
  const visit = (start, limit) => {
    chunks(buffer, start, limit).forEach((chunk) => {
      if (chunk.id === MESH_SURFACES_CHUNK) {
        chunks(buffer, chunk.dataOffset, chunk.endOffset).forEach((record) => {
          if (record.id !== SURFACE_RECORD_CHUNK) return;
          const idChunk = findDescendant(buffer, record, SURFACE_ID_CHUNK);
          const nameChunk = findDescendant(buffer, record, SURFACE_NAME_CHUNK);
          if (!idChunk || idChunk.dataOffset + 4 > idChunk.endOffset) return;
          const itemId = buffer.readInt32LE(idChunk.dataOffset);
          const name = readLengthPrefixedString(buffer, nameChunk);
          if (name) map[itemId] = name;
        });
        return;
      }
      if (chunk.size >= 8) visit(chunk.dataOffset, chunk.endOffset);
    });
  };
  visit(12, buffer.length);
  return map;
}

function parseStateTime(buffer, stateChunk) {
  const timeGroup = findChild(buffer, stateChunk, STATE_TIME_CHUNK);
  if (!timeGroup) return 0;
  const timeValue = findChild(buffer, timeGroup, STATE_TIME_VALUE_CHUNK);
  return timeValue ? readFloat32(buffer, timeValue.dataOffset, timeValue.endOffset) : 0;
}

function parseVectorRows(buffer, valuesChunk) {
  const rows = [];
  let offset = valuesChunk.dataOffset;
  while (offset + 8 <= valuesChunk.endOffset) {
    const itemId = buffer.readInt32LE(offset);
    const byteCount = buffer.readInt32LE(offset + 4);
    const valueOffset = offset + 8;
    const nextOffset = valueOffset + byteCount;
    if (byteCount < VECTOR3_FLOAT_BYTES || nextOffset > valuesChunk.endOffset) break;
    const x = buffer.readFloatLE(valueOffset);
    const y = buffer.readFloatLE(valueOffset + 4);
    const z = buffer.readFloatLE(valueOffset + 8);
    rows.push({ itemId, x, y, z, magnitude: Math.hypot(x, y, z) });
    offset = nextOffset;
  }
  return rows;
}

function parseFaceContactForceRows(buffer, stateChunk) {
  const dataGroup = findChild(buffer, stateChunk, STATE_DATA_CHUNK);
  if (!dataGroup) return [];
  const faceGroup = findChild(buffer, dataGroup, FACE_DATA_GROUP_CHUNK);
  if (!faceGroup) return [];

  return chunks(buffer, faceGroup.dataOffset, faceGroup.endOffset).flatMap((record) => {
    if (record.id !== FACE_VARIABLE_RECORD_CHUNK) return [];
    const variableIdChunk = findChild(buffer, record, VARIABLE_ID_CHUNK);
    const valuesChunk = findChild(buffer, record, VARIABLE_VALUES_CHUNK);
    if (!valuesChunk) return [];
    const variableId = variableIdChunk ? buffer.readInt32LE(variableIdChunk.dataOffset) : null;
    return parseVectorRows(buffer, valuesChunk).map((row) => ({ ...row, variableId }));
  });
}

function updateMax(current, candidate, field) {
  const value = Math.abs(candidate[field] || 0);
  if (!current || value > current.value) {
    return { value, time: candidate.time, itemId: candidate.itemId, signedValue: candidate[field] || 0 };
  }
  return current;
}

export function summarizeXpltContactForce(input) {
  const buffer = toBuffer(input);
  if (!buffer || buffer.length < 12 || buffer.subarray(0, 4).toString("latin1") !== XPLT_MAGIC) {
    return { available: false, reason: "missing-or-invalid-xplt" };
  }

  const surfaceByItemId = parseSurfaceItemMap(buffer);
  const states = [];
  const maxima = { x: null, y: null, z: null, magnitude: null };
  let nonzeroRowCount = 0;

  for (const topChunk of chunks(buffer, 12, buffer.length)) {
    if (topChunk.id !== STATE_CHUNK) continue;
    const time = parseStateTime(buffer, topChunk);
    const rows = parseFaceContactForceRows(buffer, topChunk).map((row) => ({
      ...row,
      surface: surfaceByItemId[row.itemId] || null
    }));
    rows.forEach((row) => {
      const timedRow = { ...row, time };
      maxima.x = updateMax(maxima.x, timedRow, "x");
      maxima.y = updateMax(maxima.y, timedRow, "y");
      maxima.z = updateMax(maxima.z, timedRow, "z");
      maxima.magnitude = updateMax(maxima.magnitude, timedRow, "magnitude");
      if (row.magnitude > 1e-9) nonzeroRowCount += 1;
    });
    states.push({ time, rowCount: rows.length, rows });
  }

  const maxAbsX = maxima.x?.value || 0;
  const maxAbsZ = maxima.z?.value || 0;
  return {
    available: true,
    stateCount: states.length,
    nonzeroRowCount,
    hasContactForce: nonzeroRowCount > 0,
    maxAbs: {
      x: maxAbsX,
      y: maxima.y?.value || 0,
      z: maxAbsZ,
      magnitude: maxima.magnitude?.value || 0
    },
    maxAt: maxima,
    surfaceByItemId,
    zToXRatio: maxAbsX > 0 ? maxAbsZ / maxAbsX : 0,
    finalState: states.at(-1) || { time: 0, rowCount: 0, rows: [] }
  };
}
