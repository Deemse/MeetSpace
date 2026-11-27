const catalog=await fetch('./catalog.json');
if(!catalog.ok)throw Error('Appearance catalog unavailable');
const fields=await catalog.json();
const defaults=Object.fromEntries(fields.map(([key,,options])=>[key,options[0]]));
const key='meetspace.figure.v1';
function valid(data){return Object.fromEntries(fields.map(([k,,opts])=>[k,opts.includes(data?.[k])?data[k]:defaults[k]]))}
let saved;
try {saved=JSON.parse(localStorage.getItem(key))}catch{}
export const look=valid(saved);
const shared=new URLSearchParams(location.hash.slice(1)).get('look');
if(shared)try{Object.assign(look,valid(JSON.parse(shared)))}catch{}
export let editing=false;
const hairColors=['533729','27252A','A95332','CDA564','A8A6A4'];
const skinColors=['E6AA87','F3C9AD','D99D66','B67C53','905C42','684333'];
const fabrics=['304552','4C6557','AE614C','DED9C8','774E69'];
function tint(hex,factor=1){return [...[0,2,4].map(i=>Math.min(1,Math.pow(parseInt(hex.slice(i,i+2),16)/255,2.2)*factor)),1]}
export function appearance(name,base,figure){
 if(editing&&!figure)return null;
 if(!figure)return base;
 const visible=[
 [/^(Swept fringe|Side lock)/,look.hair==='Swept'],[/^Top bun/,look.hair==='Top bun'],[/^Coil/,look.hair==='Curly'],[/^Sculpted hair cap/,look.hair!=='Shaved'],
 [/^Round acetate/,look.glasses==='Round'],[/^Frame rectangular/,look.glasses==='Rectangular'],[/^(Glasses temple|Bridge)/,look.glasses!=='Off'],
 [/^(Gathered hood|Hood cord)/,look.top==='Hoodie'],[/^Shirt /,look.top==='Button shirt'],[/Sneaker|Suede sneaker/,look.shoes==='Sneakers'],[/^Boot /,look.shoes==='Boots'],
 [/^Headphone/,look.accessory.includes('Headphones')],[/^Watch/,look.accessory.toLowerCase().includes('watch')]];
 if(visible.some(([match,on])=>!on&&match.test(name)))return null;
 if(/^(Face and jaw|Ear$|Inner ear|Nose|Hand|Fingertip)/.test(name))return tint(skinColors[fields[0][2].indexOf(look.skin)],name==='Inner ear'?.79:1);
 if(/^(Eyebrow|Sculpted hair|Side lock|Swept fringe|Top bun|Coil)/.test(name))return tint(hairColors[fields[2][2].indexOf(look.dye)],name==='Eyebrow'?.73:1+(.05*((Number(name.slice(-2))||0)%3)));
 if(/^(Hoodie body|Bent hoodie sleeve|Gathered hood)/.test(name))return tint(fabrics[fields[5][2].indexOf(look.fabric)]);
 return base;
}
export function mountWardrobe(onChange){
 const panel=document.querySelector('#wardrobe'),toggle=document.querySelector('#customize'),message=document.querySelector('#note'),controls=document.querySelector('#fields');
 const groups={Appearance:['skin','hair','dye'],Outfit:['top','fabric','shoes'],Accessories:['glasses','accessory']};
 const palettes={skin:skinColors,dye:hairColors,fabric:fabrics};
 const tabs=document.querySelector('#categories');
 const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
 function animate(element,frames,duration){
   if(!motion.matches&&element.animate)element.animate(frames,{duration,easing:'cubic-bezier(.22,.8,.2,1)'});
 }
 function display(group){
   for(const tab of tabs.children)tab.setAttribute('aria-pressed',String(tab.textContent===group));
   controls.replaceChildren();
   for(const id of groups[group]){
     const [,label,options]=fields.find(row=>row[0]===id);
     const block=document.createElement('fieldset'),title=document.createElement('legend'),current=document.createElement('span');
     current.textContent=look[id];title.append(label,current);block.append(title);
     const grid=document.createElement('div');grid.className=palettes[id]?'swatches':'tiles';block.append(grid);
     for(const [index,option] of options.entries()){
       const choice=document.createElement('button');choice.type='button';choice.title=option;choice.setAttribute('aria-label',label+' · '+option);
       choice.setAttribute('aria-pressed',String(look[id]===option));
       if(palettes[id])choice.style.setProperty('--tone','#'+palettes[id][index]);
       else{
         if(option==='Off'||option==='None'){const symbol=document.createElement('span');symbol.className='empty';symbol.textContent='∅';choice.append(symbol)}
         else{const img=document.createElement('img');img.src='./options/'+id+'-'+index+'.webp';img.alt='';choice.append(img)}
         const caption=document.createElement('span');caption.textContent=option;choice.append(caption);
       }
       choice.onclick=()=>{
         if(look[id]===option)return;
         look[id]=option;current.textContent=option;
         for(const item of grid.children)item.setAttribute('aria-pressed',String(item===choice));
         animate(choice,[{transform:'scale(.92)'},{transform:'scale(1.04)'},{transform:'scale(1)'}],240);
         save.textContent='Save look';message.textContent=option+' applied · Unsaved';
         onChange(false,id);
       };
       grid.append(choice);
     }
     controls.append(block);
   }
   controls.scrollTop=0;animate(controls,[{opacity:.3,transform:'translateY(7px)'},{opacity:1,transform:'translateY(0)'}],180);
 }
 for(const group of Object.keys(groups)){
   const tab=document.createElement('button');tab.textContent=group;tab.onclick=()=>display(group);tabs.append(tab);
 }
 display('Appearance');
 function open(value){
   editing=value;panel.hidden=!value;document.body.classList.toggle('editing',value);toggle.setAttribute('aria-expanded',String(value));onChange(true);
   if(value){animate(panel,[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],280);tabs.querySelector('[aria-pressed=true]').focus({preventScroll:true})}
   else toggle.focus({preventScroll:true});
 }
 panel.onkeydown=e=>{if(e.key==='Escape')open(false)};
 toggle.hidden=false;toggle.onclick=()=>open(!editing);document.querySelector('#done').onclick=()=>open(false);
 const save=document.querySelector('#saveLook');
 save.textContent='Keep & share look';
 message.textContent='Preview mode · Looks stay in this browser; share a look using its link.';
 save.onclick=()=>{
   const snapshot=JSON.stringify(look),url=new URL(location.href);
   url.searchParams.delete('look');url.hash='look='+encodeURIComponent(snapshot);
   history.replaceState(null,'',url);
   try{localStorage.setItem(key,snapshot);message.textContent='Kept in this browser. Copy the address to share this look.'}
   catch{message.textContent='Copy the address to share this look. Browser storage is unavailable.'}
   save.textContent='Link ready';
 };
}
