/** Safe provider evidence only. Never copy provider messages, prompts, URLs or arbitrary fields. */
export function billingEvidence(usage,requestId){
 const num=x=>Number.isSafeInteger(x)&&x>=0&&x<=100000000;
 const id=typeof requestId==='string'&&/^[A-Za-z0-9_-]{1,200}$/.test(requestId)?requestId:null;
 const result={model:'gpt-image-2.5-flare-2026-09-08',providerRequestId:id,usage:null,usageCostMicros:null,currency:'USD',pricingVersion:'openai-flare-standard-2026-10-13',chargeVerified:false};
 if(!usage||![usage.input_tokens,usage.output_tokens,usage.total_tokens,usage.input_tokens_details?.text_tokens,usage.input_tokens_details?.image_tokens].every(num))return result;
 const input=usage.input_tokens_details;if(usage.input_tokens!==input.text_tokens+input.image_tokens||usage.total_tokens!==usage.input_tokens+usage.output_tokens)return result;
 let outputImage=usage.output_tokens,outputText=0;
 if(usage.output_tokens_details){if(![usage.output_tokens_details.image_tokens,usage.output_tokens_details.text_tokens].every(num)||usage.output_tokens_details.image_tokens+usage.output_tokens_details.text_tokens!==usage.output_tokens)return result;outputImage=usage.output_tokens_details.image_tokens;outputText=usage.output_tokens_details.text_tokens;}
 result.usage={input_tokens:usage.input_tokens,output_tokens:usage.output_tokens,total_tokens:usage.total_tokens,input_tokens_details:{text_tokens:input.text_tokens,image_tokens:input.image_tokens},output_tokens_details:{image_tokens:outputImage,text_tokens:outputText}};
 // Micros: $5/M input text, $8/M input image, $30/M output image; text output uncharged.
 result.usageCostMicros=5*input.text_tokens+8*input.image_tokens+30*outputImage;
 return result;
}
export function normalizeBillingEvidence(value){
 if(!value||value.model!=='gpt-image-2.5-flare-2026-09-08')return null;
 return billingEvidence(value.usage,value.providerRequestId);
}
