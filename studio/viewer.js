import {appearance, editing, mountWardrobe} from './wardrobe.js?v=5';
import {softwareRenderer} from './software.js?v=6';
const office=new URLSearchParams(location.search).has('office');
let canvas=document.querySelector('canvas');const status=document.querySelector('#status');
const gl=canvas.getContext('webgl',{antialias:true,alpha:false});
async function openStudio(){

 const response=await fetch(office?'./office.glb?v=8':'./wardrobe.glb');if(!response.ok)throw Error('Could not load the model.');
 const bytes=await response.arrayBuffer(),header=new DataView(bytes),len=header.getUint32(12,true);
 const model=JSON.parse(new TextDecoder().decode(new Uint8Array(bytes,20,len))),start=28+len;
 const lightingResponse=await fetch('./lighting.bin');if(!lightingResponse.ok)throw Error('Lighting unavailable');
 const lighting=new Uint8Array(await lightingResponse.arrayBuffer());let offset=0;const lights=new Map();
 for(const n of model.nodes.filter(n=>n.mesh!==undefined)){
   const count=model.accessors[model.meshes[n.mesh].primitives[0].attributes.POSITION].count;
   lights.set(n.mesh,offset+count<=lighting.length?lighting.subarray(offset,offset+count):new Uint8Array(count).fill(235));offset+=count;
   if(office||/^(Face and jaw|Ear$|Inner ear|Nose|Hand|Fingertip)/.test(n.name))lights.set(n.mesh,new Uint8Array(count).fill(255));
 }
 const figureNodes=new Set(model.nodes.filter(n=>n.name==='Character'||n.name==='Wardrobe').flatMap(n=>n.children));
 const styles=new Map();
 function updateStyles(){model.nodes.forEach((node,index)=>{
   if(node.mesh===undefined)return;
   const primitive=model.meshes[node.mesh].primitives[0];
   styles.set(node.mesh,office?model.materials[primitive.material].pbrMetallicRoughness.baseColorFactor:appearance(node.name,model.materials[primitive.material].pbrMetallicRoughness.baseColorFactor,figureNodes.has(index)));
 })}
 updateStyles();
 function gpuRenderer(){
 if(!gl)throw Error('WebGL unavailable');
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
 const program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,`precision mediump float;attribute vec3 position,normal;attribute float exposure;varying float shade;uniform vec3 origin,right,up,eye;uniform vec2 scale;uniform float distanceToEye;varying vec3 N;void main(){vec3 p=position+origin-vec3(0.,1.3,0.);float d=distanceToEye-dot(p,eye);gl_Position=vec4(dot(p,right)*scale.x,dot(p,up)*scale.y,d*.99-.12,d);N=normal;shade=exposure;}`));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying float shade;uniform vec4 tint;uniform vec3 eye;varying vec3 N;void main(){vec3 n=normalize(N);float light=.70+.30*max(dot(n,normalize(vec3(-.45,.85,.65))),0.);float rim=pow(1.-abs(dot(n,eye)),3.);gl_FragColor=vec4(shade*pow(tint.rgb*light,vec3(.4545))+.08*rim,tint.a);}`));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('Could not initialize renderer.');gl.useProgram(program);
 const loc=Object.fromEntries(['position','normal','exposure'].map(k=>[k,gl.getAttribLocation(program,k)]));
 const u=Object.fromEntries(['origin','right','up','eye','scale','distanceToEye','tint'].map(k=>[k,gl.getUniformLocation(program,k)]));
 function buffer(acc,target){const view=model.bufferViews[model.accessors[acc].bufferView],b=gl.createBuffer();gl.bindBuffer(target,b);gl.bufferData(target,new Uint8Array(bytes,start+view.byteOffset,view.byteLength),gl.STATIC_DRAW);return b}
 const items=model.nodes.filter(n=>n.mesh!==undefined).map(n=>{const p=model.meshes[n.mesh].primitives[0];const ao=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,ao);gl.bufferData(gl.ARRAY_BUFFER,lights.get(n.mesh),gl.STATIC_DRAW);return {mesh:n.mesh,ao,origin:n.translation,color:model.materials[p.material].pbrMetallicRoughness.baseColorFactor,pos:buffer(p.attributes.POSITION,gl.ARRAY_BUFFER),norm:buffer(p.attributes.NORMAL,gl.ARRAY_BUFFER),idx:buffer(p.indices,gl.ELEMENT_ARRAY_BUFFER),count:model.accessors[p.indices].count}});
 return function({right,up,eye,distance}){const d=Math.min(devicePixelRatio,2),w=Math.round(canvas.clientWidth*d),h=Math.round(canvas.clientHeight*d);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}gl.viewport(0,0,w,h);gl.clearColor(.86,.89,.89,1);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.enable(gl.DEPTH_TEST);
 gl.uniform3fv(u.eye,eye);gl.uniform3fv(u.right,right);gl.uniform3fv(u.up,up);gl.uniform1f(u.distanceToEye,distance);gl.uniform2f(u.scale,2.48*Math.min(1,h/w),2.48*Math.min(1,w/h));
 const glass=items.filter(i=>i.color[3]<1).sort((a,b)=>eye.reduce((d,v,k)=>d+v*(a.origin[k]-b.origin[k]),0));
 for(const i of [...items.filter(i=>i.color[3]===1),...glass]){const tint=styles.get(i.mesh);if(!tint)continue;if(i.color[3]<1){gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.depthMask(false)}else gl.disable(gl.BLEND);gl.bindBuffer(gl.ARRAY_BUFFER,i.ao);gl.enableVertexAttribArray(loc.exposure);gl.vertexAttribPointer(loc.exposure,1,gl.UNSIGNED_BYTE,true,0,0);gl.uniform3fv(u.origin,i.origin);gl.uniform4fv(u.tint,tint);for(const [key,b] of [['position',i.pos],['normal',i.norm]]){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.enableVertexAttribArray(loc[key]);gl.vertexAttribPointer(loc[key],3,gl.FLOAT,false,0,0)}gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,i.idx);gl.drawElements(gl.TRIANGLES,i.count,gl.UNSIGNED_SHORT,0)}}
 }
 let render;
 try { render=gpuRenderer(); } catch {
   const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;
   function array(index,Type){const access=model.accessors[index],view=model.bufferViews[access.bufferView];return new Type(bytes,start+view.byteOffset+(access.byteOffset||0),access.count*(access.type==='VEC3'?3:1))}
   const meshes=model.nodes.filter(n=>n.mesh!==undefined).map(n=>{
     const p=model.meshes[n.mesh].primitives[0];
     return {mesh:n.mesh,light:lights.get(n.mesh),origin:n.translation,color:model.materials[p.material].pbrMetallicRoughness.baseColorFactor,pos:array(p.attributes.POSITION,Float32Array),norm:array(p.attributes.NORMAL,Float32Array),idx:array(p.indices,Uint16Array)};
   }).sort((a,b)=>b.color[3]-a.color[3]);
   render=softwareRenderer(canvas,meshes,styles);
 }
 let yaw,pitch,zoom;
 function draw(){const y=Math.sin(yaw),c=Math.cos(yaw),s=Math.sin(pitch),t=Math.cos(pitch);render({right:[c,0,-y],up:[-y*s,t,-c*s],eye:[y*t,s,c*t],distance:3.05/zoom});if(office)window.dispatchEvent(new CustomEvent('office-camera',{detail:{yaw,pitch,zoom}}))}
 function reset(){yaw=office?.47:.60;pitch=office?.63:.39;zoom=office?.135:.48;draw()}function adjust(f){cancelAnimationFrame(cameraFrame);zoom=Math.min(office?.42:1.0,Math.max(office?.065:.22,zoom*f));draw()}function orbit(x,y){yaw+=x;pitch=Math.min(1.35,Math.max(-.35,pitch+y));draw()}
 let prev=null;canvas.onpointerdown=e=>{canvas.setPointerCapture(e.pointerId);prev=[e.clientX,e.clientY]};canvas.onpointermove=e=>{if(prev){orbit((prev[0]-e.clientX)*.009,(e.clientY-prev[1])*.008);prev=[e.clientX,e.clientY]}};canvas.onlostpointercapture=()=>prev=null;canvas.onwheel=e=>{e.preventDefault();adjust(Math.exp(-e.deltaY*.001))};canvas.onkeydown=e=>{const steps={ArrowLeft:[-.1,0],ArrowRight:[.1,0],ArrowUp:[0,.08],ArrowDown:[0,-.08]};if(steps[e.key]){e.preventDefault();orbit(...steps[e.key])}else if(e.key==='+'||e.key==='=')adjust(1.1);else if(e.key==='-')adjust(1/1.1)};
 let cameraFrame=0;
 function glide(angle,tilt,size){
   cancelAnimationFrame(cameraFrame);
   const start=performance.now(),from=[yaw,pitch,zoom],delta=Math.atan2(Math.sin(angle-yaw),Math.cos(angle-yaw));
   const duration=matchMedia('(prefers-reduced-motion: reduce)').matches?0:370;
   function frame(now){
     const t=duration?Math.min(1,(now-start)/duration):1,k=1-(1-t)**3;
     yaw=from[0]+delta*k;pitch=from[1]+(tilt-from[1])*k;zoom=from[2]+(size-from[2])*k;draw();
     if(t<1)cameraFrame=requestAnimationFrame(frame);
   }
   frame(start);
 }
 canvas.addEventListener('pointerdown',()=>cancelAnimationFrame(cameraFrame));
 canvas.addEventListener('wheel',()=>cancelAnimationFrame(cameraFrame));
 canvas.addEventListener('keydown',()=>cancelAnimationFrame(cameraFrame));
 if(!office)mountWardrobe((cameraChange,part)=>{
   updateStyles();
   if(cameraChange){if(editing)glide(.18,.12,.86);else glide(.60,.39,.48)}
   else if(part==='hair'||part==='accessory')glide(.42,.12,.87);
   else if(part==='shoes')glide(-.38,.16,.83);
   else draw();
 });
 document.querySelector('#desk').onclick=()=>glide(-.52,.28,.73);document.querySelector('#plus').onclick=()=>adjust(1.2);document.querySelector('#minus').onclick=()=>adjust(1/1.2);document.querySelector('#reset').onclick=()=>glide(office?.47:.60,office?.63:.39,office?.135:.48);window.addEventListener('resize',draw);reset();status.hidden=true;canvas.style.visibility='visible';document.querySelector('#turntable').hidden=true;
}
function showTurntable(){
 if(office){canvas.hidden=true;status.hidden=false;status.textContent='The office could not load. Please refresh to try again.';return;}
 canvas.hidden=true;document.querySelector("#wardrobe").hidden=true;document.querySelector("#customize").hidden=true;document.body.classList.remove("editing");document.querySelector('#desk').hidden=true;
 const view=document.querySelector('#turntable'), image=view.querySelector('img');
 view.hidden=false;
 status.hidden=true;
 document.querySelector('footer span').textContent='Rendered model views · Drag to turn';
 let angle=0,zoom=1,startX=null,startAngle=0;
 function show(){
   const frame=((angle%24)+24)%24;
   image.src='./angles/'+String(frame).padStart(2,'0')+'.webp';
   image.style.transform='scale('+zoom+')';
 }
 function adjust(factor){zoom=Math.min(2.4,Math.max(.6,zoom*factor));show()}
 view.onpointerdown=e=>{view.setPointerCapture(e.pointerId);startX=e.clientX;startAngle=angle};
 view.onpointermove=e=>{if(startX!==null){angle=startAngle+Math.round((startX-e.clientX)/15);show()}};
 view.onlostpointercapture=()=>startX=null;
 view.onkeydown=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();angle+=e.key==='ArrowRight'?1:-1;show()}};
 view.onwheel=e=>{e.preventDefault();adjust(Math.exp(-e.deltaY*.001))};
 document.querySelector('#plus').onclick=()=>adjust(1.2);
 document.querySelector('#minus').onclick=()=>adjust(1/1.2);
 document.querySelector('#reset').onclick=()=>{angle=0;zoom=1;show()};
 show();
}
canvas.addEventListener('webglcontextlost',showTurntable);
openStudio().catch(showTurntable);
