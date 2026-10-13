// Bounded container/header validation only, no pixel decode.
const RENDER_LIMITS={sourceEdge:2048};
const issue=(code,message)=>Object.assign(new Error(message),{code});
const tag=(bytes,at)=>String.fromCharCode(...bytes.subarray(at,at+4));
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const PNG_CHUNKS = new Set(['IHDR', 'IDAT', 'IEND', 'PLTE', 'tRNS', 'sRGB', 'gAMA', 'cHRM', 'pHYs']);
function joinBytes(parts) { const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0)); let offset = 0; for (const part of parts) { output.set(part, offset); offset += part.length; } return output; }
function jpegSource(bytes, strip = false) {
  if (bytes[0] !== 255 || bytes[1] !== 216) throw issue('INVALID_SOURCE', 'The normalized JPEG is invalid.');
  const parts = [bytes.subarray(0, 2)]; let at = 2, ended = false, width, height, scans = 0;
  while (at < bytes.length) {
    const start = at;
    if (bytes[at++] !== 255) throw issue('INVALID_SOURCE', 'The normalized JPEG is malformed.');
    while (bytes[at] === 255) at++;
    const marker = bytes[at++];
    if (marker === 217) { parts.push(Uint8Array.of(255, 217)); ended = true; if (!strip && at !== bytes.length) throw issue('INVALID_SOURCE', 'JPEG trailing data is not allowed.'); break; }
    if (at + 2 > bytes.length || ![192, 193, 194, 196, 219, 221, 218, 254].includes(marker) && !(marker >= 224 && marker <= 239)) throw issue('INVALID_SOURCE', 'The normalized JPEG contains an unsupported marker.');
    const length = (bytes[at] << 8) | bytes[at + 1];
    if (length < 2 || at + length > bytes.length) throw issue('INVALID_SOURCE', 'The normalized JPEG is truncated.');
    const metadata = marker >= 224 && marker <= 239 || marker === 254;
    let adobe;
    if (marker === 238 && length === 14 && String.fromCharCode(...bytes.subarray(at + 2, at + 7)) === 'Adobe' && bytes[at + 13] <= 2) adobe = Uint8Array.of(255, 238, 0, 14, 65, 100, 111, 98, 101, 0, 100, 0, 0, 0, 0, bytes[at + 13]);
    if (metadata) {
      if (adobe) {
        if (!strip && (at + length - start !== adobe.length || adobe.some((byte, index) => byte !== bytes[start + index]))) throw issue('INVALID_SOURCE', 'JPEG metadata must be stripped before upload.');
        parts.push(adobe);
      } else if (!strip) throw issue('INVALID_SOURCE', 'JPEG metadata must be stripped before upload.');
    } else {
      parts.push(bytes.subarray(start, at + length));
      if ([192, 193, 194].includes(marker)) {
        if (width || length < 8 || bytes[at + 2] !== 8) throw issue('INVALID_SOURCE', 'The normalized JPEG frame is invalid.');
        height = (bytes[at + 3] << 8) | bytes[at + 4]; width = (bytes[at + 5] << 8) | bytes[at + 6];
      }
    }
    at += length;
    if (marker === 218) {
      if (!width) throw issue('INVALID_SOURCE', 'The normalized JPEG scan has no frame.');
      scans++; const scanStart = at; let next = -1;
      while (at < bytes.length) {
        if (bytes[at++] !== 255) continue;
        const markerAt = at - 1; while (bytes[at] === 255) at++;
        const code = bytes[at++]; if (code === 0 || code >= 208 && code <= 215) continue;
        next = markerAt; break;
      }
      if (next < 0) throw issue('INVALID_SOURCE', 'The normalized JPEG has no closing marker.');
      parts.push(bytes.subarray(scanStart, next)); at = next;
    }
  }
  if (!ended || !scans || !width || !height || Math.max(width, height) > RENDER_LIMITS.sourceEdge) throw issue('INVALID_SOURCE', 'The normalized JPEG dimensions are invalid.');
  return { width, height, ...(strip ? { bytes: joinBytes(parts) } : {}) };
}
function pngSource(bytes, strip = false) {
  if (bytes.length < 45 || PNG_SIGNATURE.some((byte, index) => bytes[index] !== byte)) throw issue('INVALID_SOURCE', 'The normalized PNG is invalid.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), parts = [bytes.subarray(0, 8)]; let at = 8, width, height, data = false, ended = false;
  while (at + 12 <= bytes.length) {
    const length = view.getUint32(at), name = tag(bytes, at + 4), end = at + 12 + length;
    if (end > bytes.length || !/^[A-Za-z]{4}$/.test(name) || ['acTL', 'fcTL', 'fdAT'].includes(name)) throw issue('INVALID_SOURCE', 'The normalized PNG is truncated or animated.');
    if (name === 'IHDR') {
      if (at !== 8 || length !== 13) throw issue('INVALID_SOURCE', 'The normalized PNG header is invalid.');
      width = view.getUint32(at + 8); height = view.getUint32(at + 12);
    } else if (!width) throw issue('INVALID_SOURCE', 'The normalized PNG header is missing.');
    if (!PNG_CHUNKS.has(name)) {
      if (!strip || name[0] === name[0].toUpperCase()) throw issue('INVALID_SOURCE', 'PNG metadata must be stripped before upload.');
    } else parts.push(bytes.subarray(at, end));
    if (name === 'IDAT') data = true;
    at = end;
    if (name === 'IEND') { if (length !== 0 || !data || !strip && at !== bytes.length) throw issue('INVALID_SOURCE', 'The normalized PNG end is invalid.'); ended = true; break; }
  }
  if (!ended || !width || !height || Math.max(width, height) > RENDER_LIMITS.sourceEdge) throw issue('INVALID_SOURCE', 'The normalized PNG dimensions are invalid.');
  return { width, height, ...(strip ? { bytes: joinBytes(parts) } : {}) };
}

export {jpegSource,pngSource};
