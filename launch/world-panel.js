/** The same controls render to HTML and to a texture inside immersive VR. */
export const PANEL_W=1200,PANEL_H=1320;
export function paintPanel(canvas,{title,subtitle,controls,notice='',tab='',hover=null}){canvas.width=PANEL_W;canvas.height=PANEL_H;const c=canvas.getContext('2d');c.fillStyle='#11141e';c.fillRect(0,0,PANEL_W,PANEL_H);const grad=c.createLinearGradient(0,0,PANEL_W,250);grad.addColorStop(0,'#342544');grad.addColorStop(1,'#1c2430');c.fillStyle=grad;c.fillRect(0,0,PANEL_W,210);
 c.fillStyle='#cfb090';c.font='600 22px system-ui';c.fillText('A U R E L I A   /   S P A T I A L',54,56);c.fillStyle='#f6f1fc';c.font='500 42px system-ui';c.fillText(title,54,121);c.font='23px system-ui';c.fillStyle='#b7b3c6';c.fillText(subtitle.slice(0,76),54,165);
 const buttons=[];let y=238;
 for(const item of controls){
  if(item.type==='note'){c.font='23px system-ui';c.fillStyle='#b4b9c9';const lines=wrap(c,item.text,PANEL_W-112);for(const line of lines){if(y>1150)break;c.fillText(line,54,y+28);y+=32;}y+=12;continue;}
  const group=item.type==='row'?item.items:[item];const gap=12,w=(PANEL_W-108-gap*(group.length-1))/group.length,h=item.height||72;
  for(let i=0;i<group.length;i++){const b=group[i],x=54+i*(w+gap);const highlight=hover===b.id;c.fillStyle=b.primary?'#c7a5f2':highlight?'#42405a':b.selected?'#3a2d51':'#232838';c.beginPath();c.roundRect(x,y,w,h,14);c.fill();c.strokeStyle=b.selected?'#a687cc':'#42465a';c.lineWidth=1;c.stroke();c.fillStyle=b.disabled?'#707888':b.primary?'#22182e':'#efeaf7';c.font=(group.length>4?'25':'24')+'px system-ui';const lines=wrap(c,b.label||'',w-28).slice(0,2);lines.forEach((l,n)=>c.fillText(l,x+16,y+(lines.length===1?h/2+8:27+n*26)));buttons.push({...b,x,y,w,h});}
  y+=h+14;if(y>1150)break;
 }
 c.fillStyle='#1b202e';c.fillRect(0,1216,PANEL_W,104);c.font='22px system-ui';c.fillStyle='#c9d8cf';wrap(c,notice||'Device-local. Live AI and generation are not connected.',PANEL_W-108).slice(0,2).forEach((l,i)=>c.fillText(l,54,1254+i*28));
 return buttons;}
export function wrap(c,text,width){const lines=[];let line='';for(const word of String(text).split(/\s+/)){const next=line?line+' '+word:word;if(c.measureText(next).width>width&&line){lines.push(line);line=word;}else line=next;}if(line)lines.push(line);return lines;}
export function htmlPanel(root,model,dispatch){root.replaceChildren();const title=document.createElement('h2');title.textContent=model.title;root.append(title);const sub=document.createElement('p');sub.className='hint';sub.textContent=model.subtitle;root.append(sub);
 for(const item of model.controls){if(item.type==='row'&&item.items.every(b=>b.id.startsWith('tab:')))continue;if(item.type==='note'){const p=document.createElement('p');p.className='hint';p.textContent=item.text;root.append(p);continue;}const row=document.createElement('div');row.className=item.type==='row'?'control-row':'control-line';for(const b of item.type==='row'?item.items:[item]){const button=document.createElement('button');button.textContent=b.label;button.disabled=!!b.disabled;button.dataset.action=b.id;button.className=(b.primary?'primary ':'')+(b.selected?'selected':'');button.onclick=()=>dispatch(b.id);row.append(button);}root.append(row);}
 const p=document.createElement('p');p.className='notice';p.textContent=model.notice||'Saved on this device. No live model requests.';p.setAttribute('role','status');root.append(p);}
