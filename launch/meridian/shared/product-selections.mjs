import {RETAILER_IDS} from './store-catalog.mjs';
/** Bounded, exact, store-scoped SKU requests. This module performs no I/O. */
export const MAX_PRODUCT_SELECTIONS = 6;
const STORE_IDS = new Set(RETAILER_IDS);
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validateProductSelections(value, selectedStoreIds) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PRODUCT_SELECTIONS || !Array.isArray(selectedStoreIds)) throw new TypeError('Invalid store-scoped SKU selections.');
  const seen = new Set();
  return value.map(item => {
    if (!plain(item) || Object.keys(item).sort().join(',') !== 'sku,storeId' ||
        !STORE_IDS.has(item.storeId) || !selectedStoreIds.includes(item.storeId) ||
        typeof item.sku !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,63}$/.test(item.sku)) throw new TypeError('Invalid store-scoped SKU selections.');
    if(item.storeId==='amazon'&&!/^[A-Z0-9]{10}$/.test(item.sku))throw new TypeError('Amazon requires a 10-character uppercase ASIN.');
    const key = item.storeId + ':' + item.sku;
    if (seen.has(key)) throw new TypeError('Duplicate store-scoped SKU selection.');
    seen.add(key);
    return {storeId: item.storeId, sku: item.sku};
  });
}
/** The SKU label is case-insensitive; the identifier itself is exact. A dot
 * followed by another identifier character belongs to the identifier. */
export function exactSkuInQuote(quote, sku) {
  if (typeof quote !== 'string' || typeof sku !== 'string') return false;
  const escaped = sku.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const labelled = new RegExp('\\b(?:SKU|Item|Internet|Product|ASIN)(?:\\s*(?:number|no\\.?|#|:)){0,2}\\s*(' + escaped + ')(?![A-Za-z0-9_/-]|\\.[A-Za-z0-9])', 'gi');
  return [...quote.matchAll(labelled)].some(match => match[1] === sku);
}
/** Match SKU only, never model, partial identifier, case-folding or another store.
 * Multiple returned identities for a requested pair are unresolved, not a guess. */
export function resolveProductSelections(products, selections) {
  if (!selections.length) return {products};
  const productSelections = selections.map(({storeId, sku}) => {
    const matches = products.filter(product => product.storeId === storeId && product.sku === sku);
    return {storeId, sku, status: matches.length === 1 ? 'resolved' : 'unresolved', productId: matches.length === 1 ? matches[0].id : null};
  });
  const matchedIds = new Set(productSelections.filter(item => item.status === 'resolved').map(item => item.productId));
  return {products: products.filter(product => matchedIds.has(product.id)), productSelections,
    requestedProductsComplete: productSelections.every(item => item.status === 'resolved')};
}
/** Server-side gate used by selection, render dispatch and prompt construction. */
export function hasCompleteProductSelections(snapshot) {
  if (snapshot.productSelections === undefined && snapshot.requestedProductsComplete === undefined) return true;
  if (snapshot.requestedProductsComplete !== true || !Array.isArray(snapshot.productSelections) || !snapshot.productSelections.length || !Array.isArray(snapshot.products)) return false;
  let requested;
  try { requested = validateProductSelections(snapshot.productSelections.map(({storeId, sku}) => ({storeId, sku})), snapshot.selectedStoreIds); } catch { return false; }
  return requested.every(({storeId, sku}, index) => {
    const item = snapshot.productSelections[index];
    if (item.status !== 'resolved' || typeof item.productId !== 'string') return false;
    const matches = snapshot.products.filter(product => product.storeId === storeId && product.sku === sku);
    return matches.length === 1 && matches[0].id === item.productId;
  });
}

