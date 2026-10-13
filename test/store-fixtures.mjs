export const storeFixtureURLs={
  "home-depot": "https://www.homedepot.com/p/Oak/123456789",
  "lowes": "https://www.lowes.com/pd/Oak/123456789",
  "floor-and-decor": "https://www.flooranddecor.com/tile/test-tile-123456789.html",
  "ikea": "https://www.ikea.com/us/en/p/kivik-sofa-tibbleby-beige-grey-39482846/",
  "wayfair": "https://www.wayfair.com/furniture/pdp/test-sofa-w123456789.html",
  "west-elm": "https://www.westelm.com/products/harmony-sofa-h2479/",
  "pottery-barn": "https://www.potterybarn.com/products/pearce-upholstered-sofa/",
  "crate-and-barrel": "https://www.crateandbarrel.com/lounge-sofa/s123456",
  "cb2": "https://www.cb2.com/test-sofa/s123456",
  "ashley": "https://www.ashleyfurniture.com/p/test_sofa/1234567.html",
  "article": "https://www.article.com/product/12345/test-sofa",
  "room-and-board": "https://www.roomandboard.com/catalog/living/sofas-and-loveseats/jasper-sofas",
  "polywood": "https://www.polywood.com/products/signature-dining-chair-1910",
  "siteone": "https://www.siteone.com/en/grasspave2-2020-invisible-structures-grasspave-2-grass-paver-66-ft-x-656-ft-roll/p/163925"
};

import {MATERIAL_MODEL} from '../launch/meridian/material-search-client.mjs';
export function mockProductProvider({storeId='west-elm',url=storeFixtureURLs[storeId],sku='ABC123',quote=`Test Product SKU ${sku} is $29.99 each.`,name='Test Product'}={}){
 const requests=[];let normalized;
 const fetchImpl=async(endpoint,options)=>{
  if(endpoint!=='https://api.openai.com/v1/responses')throw Error('Unexpected endpoint');
  const payload=JSON.parse(options.body);requests.push(payload);const search=requests.length%2===1;
  const evidence=search?null:JSON.parse(payload.input).evidence[0];
  normalized={sourceId:evidence?.sourceId,name,sku,model:null,quote,unitPriceCents:2999,priceUnit:'each'};
  return Response.json({id:search?'resp_search':'resp_normalize',status:'completed',model:MATERIAL_MODEL,usage:{input_tokens:100,output_tokens:100,total_tokens:200},output:[...(search?[{id:'ws_search',type:'web_search_call',status:'completed',action:{type:'search',sources:[{type:'url',url}]}}]:[]),{type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:search?quote:JSON.stringify({products:[normalized]}),annotations:search?[{type:'url_citation',url,title:'Product',start_index:0,end_index:quote.length}]:[]}]}]},{headers:{'x-request-id':search?'req_search':'req_normalize'}});
 };
 return{requests,fetchImpl};
}
