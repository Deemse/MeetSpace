// Depth-buffered triangle rendering for devices without a WebGL context.
export function softwareRenderer(canvas, items, styles) {
  const ctx = canvas.getContext('2d', {alpha:false});
  if (!ctx) throw Error('Canvas unavailable');
  const meshes = items.map(item => {
    const points = item.pos.slice();
    const shade = new Float32Array(points.length / 3);
    for (let i=0; i<points.length; i+=3) {
      points[i] += item.origin[0];
      points[i+1] += item.origin[1]-1.29;
      points[i+2] += item.origin[2];
      shade[i/3] = (item.light[i/3]/255)*(.80+.20*Math.max(0, -.50*item.norm[i]+.73*item.norm[i+1]+.46*item.norm[i+2]));
    }
    return {...item, points, projected:new Float32Array(points.length), shade,
      rgb:item.color.slice(0,3).map(v=>255*Math.pow(v,1/2.2))};
  });
  return function render(camera) {
    const {right,up,eye,distance}=camera;
    const ratio=Math.min(1,900/Math.max(canvas.clientWidth,canvas.clientHeight));
    const w=Math.max(1,Math.round(canvas.clientWidth*ratio)),h=Math.max(1,Math.round(canvas.clientHeight*ratio));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h}
    const image=ctx.createImageData(w,h), pixels=image.data, depth=new Float32Array(w*h);
    new Uint32Array(pixels.buffer).fill(0xffdfe3df);
    const focal=Math.min(w,h)*1.24;
    for(const m of meshes){
      const tint=styles.get(m.mesh);if(!tint)continue;
      if(tint!==m.lastTint){m.lastTint=tint;m.rgb=tint.slice(0,3).map(v=>255*Math.pow(v,1/2.2))}
      const p=m.points, q=m.projected;
      for(let i=0;i<p.length;i+=3){
        const x=p[i],y=p[i+1],z=p[i+2];
        const inv=1/(distance-x*eye[0]-y*eye[1]-z*eye[2]);
        q[i]=w/2+focal*inv*(x*right[0]+z*right[2]);
        q[i+1]=h/2-focal*inv*(x*up[0]+y*up[1]+z*up[2]); q[i+2]=inv;
      }
      const alpha=m.color[3],glass=alpha<1;
      for(let t=0;t<m.idx.length;t+=3){
        const a=m.idx[t]*3,b=m.idx[t+1]*3,c=m.idx[t+2]*3;
        const ax=q[a],ay=q[a+1],bx=q[b],by=q[b+1],cx=q[c],cy=q[c+1];
        const det=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy);
        if(Math.abs(det)<.015)continue;
        const x0=Math.max(0,Math.ceil(Math.min(ax,bx,cx)-.5)),x1=Math.min(w-1,Math.floor(Math.max(ax,bx,cx)-.5));
        const y0=Math.max(0,Math.ceil(Math.min(ay,by,cy)-.5)),y1=Math.min(h-1,Math.floor(Math.max(ay,by,cy)-.5));
        const du=(by-cy)/det,dv=(cy-ay)/det;
        for(let y=y0;y<=y1;y++){
          let u=du*(x0+.5-cx)+(cx-bx)*(y+.5-cy)/det;
          let v=dv*(x0+.5-cx)+(ax-cx)*(y+.5-cy)/det;
          for(let x=x0;x<=x1;x++,u+=du,v+=dv){
            const k=1-u-v;if(u<0||v<0||k<0)continue;
            const idx=y*w+x,inv=u*q[a+2]+v*q[b+2]+k*q[c+2];if(inv<=depth[idx])continue;
            if(!glass)depth[idx]=inv;
            const light=u*m.shade[a/3]+v*m.shade[b/3]+k*m.shade[c/3];
            for(let ch=0;ch<3;ch++)pixels[4*idx+ch]=m.rgb[ch]*light*alpha+pixels[4*idx+ch]*(1-alpha);
          }
        }
      }
    }
    ctx.putImageData(image,0,0);
  }
}
