/** Official source catalog. Search citations are not live feeds or inventory integrations.
 * Keep this portable file byte-identical in the Node search service. No I/O. */
const storeRows = [
  {
    "id": "home-depot",
    "name": "The Home Depot",
    "domain": "homedepot.com",
    "group": "improvement",
    "kind": "retailer",
    "productPathHint": "/p/name/numeric-id",
    "website": "https://www.homedepot.com/l/store-locator",
    "priceCheck": true
  },
  {
    "id": "lowes",
    "name": "Lowe’s",
    "domain": "lowes.com",
    "group": "improvement",
    "kind": "retailer",
    "productPathHint": "/pd/name/numeric-id",
    "website": "https://www.lowes.com/store/",
    "priceCheck": true
  },
  {
    "id": "floor-and-decor",
    "name": "Floor & Decor",
    "domain": "flooranddecor.com",
    "group": "improvement",
    "kind": "retailer",
    "productPathHint": "/category/product-name-numeric-id.html",
    "website": "https://www.flooranddecor.com/stores",
    "priceCheck": true
  },
  {
    "id": "ikea",
    "name": "IKEA",
    "domain": "ikea.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/us/en/p/product-name-numeric-id/",
    "website": "https://www.ikea.com/us/en/",
    "priceCheck": false
  },
  {
    "id": "wayfair",
    "name": "Wayfair",
    "domain": "wayfair.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/category/pdp/product-name-id.html",
    "website": "https://www.wayfair.com/",
    "priceCheck": false
  },
  {
    "id": "west-elm",
    "name": "West Elm",
    "domain": "westelm.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/products/product-name/",
    "website": "https://www.westelm.com/",
    "priceCheck": false
  },
  {
    "id": "pottery-barn",
    "name": "Pottery Barn",
    "domain": "potterybarn.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/products/product-name/",
    "website": "https://www.potterybarn.com/",
    "priceCheck": false
  },
  {
    "id": "crate-and-barrel",
    "name": "Crate & Barrel",
    "domain": "crateandbarrel.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/product-name/snumeric-id",
    "website": "https://www.crateandbarrel.com/",
    "priceCheck": false
  },
  {
    "id": "cb2",
    "name": "CB2",
    "domain": "cb2.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/product-name/snumeric-id",
    "website": "https://www.cb2.com/",
    "priceCheck": false
  },
  {
    "id": "ashley",
    "name": "Ashley",
    "domain": "ashleyfurniture.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/p/product_name/product-id.html",
    "website": "https://www.ashleyfurniture.com/",
    "priceCheck": false
  },
  {
    "id": "article",
    "name": "Article",
    "domain": "article.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/product/numeric-id/product-name",
    "website": "https://www.article.com/",
    "priceCheck": false
  },
  {
    "id": "room-and-board",
    "name": "Room & Board",
    "domain": "roomandboard.com",
    "group": "furniture",
    "kind": "retailer",
    "productPathHint": "/catalog/room/category/product-name",
    "website": "https://www.roomandboard.com/",
    "priceCheck": false
  },
  {
    "id": "polywood",
    "name": "POLYWOOD",
    "domain": "polywood.com",
    "group": "exterior",
    "kind": "retailer",
    "productPathHint": "/products/product-name-model",
    "website": "https://www.polywood.com/",
    "priceCheck": false
  },
  {
    "id": "trex",
    "name": "Trex",
    "domain": "trex.com",
    "group": "exterior",
    "kind": "manufacturer",
    "productPathHint": "/products/decking/product-name/ or /products/railing/product-name/",
    "website": "https://www.trex.com/",
    "priceCheck": false
  },
  {
    "id": "timbertech",
    "name": "TimberTech",
    "domain": "timbertech.com",
    "group": "exterior",
    "kind": "manufacturer",
    "productPathHint": "/product/product-name/",
    "website": "https://www.timbertech.com/",
    "priceCheck": false
  },
  {
    "id": "belgard",
    "name": "Belgard",
    "domain": "belgard.com",
    "group": "exterior",
    "kind": "manufacturer",
    "productPathHint": "/product/product-name/",
    "website": "https://www.belgard.com/",
    "priceCheck": false
  },
  {
    "id": "siteone",
    "name": "SiteOne Landscape Supply",
    "domain": "siteone.com",
    "group": "exterior",
    "kind": "supplier",
    "productPathHint": "/en/product-name/p/product-id",
    "website": "https://www.siteone.com/en/store-finder",
    "priceCheck": false
  }
];
export const RETAILER_CATALOG = Object.freeze(Object.fromEntries(storeRows.map(row=>[row.id,Object.freeze({...row,lookupSupported:row.kind!=='manufacturer'})])));
export const RETAILER_IDS = Object.freeze(storeRows.filter(row=>row.kind!=='manufacturer').map(row=>row.id));
export const DEFAULT_STORE_IDS = Object.freeze(['home-depot','lowes','floor-and-decor']);
export const MAX_SELECTED_STORES = 3;
export const RETAILER_NAMES = Object.freeze(Object.fromEntries(storeRows.filter(row=>row.kind!=='manufacturer').map(row=>[row.id,row.name])));
export const RETAILER_DOMAINS = Object.freeze(Object.fromEntries(storeRows.filter(row=>row.kind!=='manufacturer').map(row=>[row.id,row.domain])));
export const RETAILER_GROUPS = Object.freeze([
 Object.freeze({id:'improvement',name:'Home improvement & finishes',description:'Building materials, flooring, kitchens and baths'}),
 Object.freeze({id:'furniture',name:'Furniture & decor',description:'Seating, tables, storage, rugs and lighting'}),
 Object.freeze({id:'exterior',name:'Outdoor living & landscape',description:'Patio furniture, decking, railings, pavers and landscape supplies'})
]);
const STORE_PRODUCT_PATTERNS = Object.freeze({
 'home-depot':/^\/p\/(?:[^/]+\/)?[0-9]{6,}\/?$/u,
 lowes:/^\/pd\/[^/]+\/[0-9]{6,}\/?$/u,
 'floor-and-decor':/^\/[^?#]+-[0-9]{6,}\.html$/u,
 ikea:/^\/us\/en\/p\/[a-z0-9-]+-[s]?[0-9]{8}\/?$/iu,
 wayfair:/^\/[^/]+\/pdp\/[a-z0-9-]+\.html$/iu,
 'west-elm':/^\/products\/[a-z0-9-]+\/?$/iu,
 'pottery-barn':/^\/products\/[a-z0-9-]+\/?$/iu,
 'crate-and-barrel':/^\/[a-z0-9-]+\/s[0-9]+\/?$/iu,
 cb2:/^\/[a-z0-9-]+\/s[0-9]+\/?$/iu,
 ashley:/^\/p\/[a-z0-9_-]+\/[a-z0-9_-]+\.html$/iu,
 article:/^\/product\/[0-9]+\/[a-z0-9-]+\/?$/iu,
 'room-and-board':/^\/catalog\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+\/?$/iu,
 polywood:/^\/products\/[a-z0-9-]+\/?$/iu,
 trex:/^\/products\/(?:decking|railing|lighting|fasteners|framing)\/[a-z0-9-]+(?:\/[a-z0-9-]+)?\/?$/iu,
 timbertech:/^\/product\/[a-z0-9-]+\/?$/iu,
 belgard:/^\/product\/[a-z0-9-]+\/?$/iu,
 siteone:/^\/en\/[a-z0-9_-]+\/p\/[a-z0-9_-]+\/?$/iu
});
/** Exact HTTPS official host and recognized detail path; never broad subdomains. */
export function isRetailerProductURL(value,storeId){
 if(typeof value!=='string'||value.length>2048||/[\s\\\u0000-\u001f\u007f]/u.test(value)||(!Object.hasOwn(RETAILER_CATALOG,storeId)||!RETAILER_CATALOG[storeId].lookupSupported))return false;
 try{const u=new URL(value),host=RETAILER_CATALOG[storeId].domain;return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&!u.hash&&(u.hostname===host||u.hostname==='www.'+host)&&STORE_PRODUCT_PATTERNS[storeId].test(u.pathname);}catch{return false;}
}
export function supportsRetailerPriceCheck(storeId){return Object.hasOwn(RETAILER_CATALOG,storeId)&&RETAILER_CATALOG[storeId].priceCheck;}
