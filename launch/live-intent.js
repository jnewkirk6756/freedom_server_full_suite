export const LIVE_INTENT_VERSION='0.65.1';
const pct=n=>Math.max(0,Math.min(100,Number(n)));
export function parseTelemetryIntent(text,{hasCustomPattern=false}={}){
  const t=String(text||'').toLowerCase().replace(/percent/g,'%').replace(/\s+/g,' ').trim();
  const telemetry={};
  const specs=[
    ['depth',[/(?:set|make|put)?\s*(?:the\s+)?depth\s*(?:at|to|=|of)?\s*(\d{1,3})\s*%?/,/(\d{1,3})\s*%\s*depth/]],
    ['pace',[/(?:set|make|put)?\s*(?:the\s+)?(?:pace|speed)\s*(?:at|to|=|of)?\s*(\d{1,3})\s*%?/,/(\d{1,3})\s*%\s*(?:pace|speed)/]],
    ['force',[/(?:set|make|put)?\s*(?:the\s+)?force\s*(?:at|to|=|of)?\s*(\d{1,3})\s*%?/,/(\d{1,3})\s*%\s*force/]],
    ['intensity',[/(?:set|make|put)?\s*(?:the\s+)?(?:energy|intensity)\s*(?:at|to|=|of)?\s*(\d{1,3})\s*%?/,/(\d{1,3})\s*%\s*(?:energy|intensity)/]]
  ];
  for(const[key,res]of specs){for(const re of res){const m=t.match(re);if(m){telemetry[key]=pct(m[1])/100;break}}}
  let pattern=null;
  const pm=t.match(/(?:use|switch to|change to|set)\s+(?:the\s+)?(steady|wave|pulse|build|variable|custom|saved|unique)(?:\s+pattern)?/);
  if(pm){pattern=['custom','saved','unique'].includes(pm[1])?(hasCustomPattern?'custom':null):pm[1]}
  else if(hasCustomPattern&&/\b(?:custom|saved|unique)\s+pattern\b/.test(t))pattern='custom';
  let position=null;
  const positions=[
    ['back',/(?:position|switch|change|move|go|set).*\b(?:on\s+back|back)\b|\bon\s+back\b/],
    ['side',/(?:position|switch|change|move|go|set).*\b(?:side|side\s+lay)\b/],
    ['standing',/(?:position|switch|change|move|go|set).*\bstanding\b/],
    ['squat',/(?:position|switch|change|move|go|set).*\bsquat\b/],
    ['doggy',/(?:position|switch|change|move|go|set).*\bdoggy\b/]
  ];
  for(const[p,re]of positions)if(re.test(t)){position=p;break}
  return{telemetry,pattern,position};
}
