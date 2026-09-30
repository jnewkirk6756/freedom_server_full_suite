/** Flat-video WebXR theater. Not a volumetric avatar, 180/360 movie, or a 3D body. */
export async function xrSupport(){return !!(globalThis.isSecureContext&&navigator.xr&&await navigator.xr.isSessionSupported('immersive-vr').catch(()=>false));}
export function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let sum=0;for(let k=0;k<4;k++)sum+=a[k*4+r]*b[c*4+k];out[c*4+r]=sum;}return out;}
export class XRTheater{
 constructor(getVideo,onEnd=()=>{}){this.getVideo=getVideo;this.onEnd=onEnd;this.session=null;this.canvas=null;this.disposed=false;}
 async enter(){
  if(this.session)throw Error('XR_ALREADY_OPEN');
  // This is invoked directly by an explicit click; do not request an immersive session on page load.
  const session=await navigator.xr.requestSession('immersive-vr');this.session=session;
  const canvas=document.createElement('canvas');this.canvas=canvas;const gl=canvas.getContext('webgl',{xrCompatible:true,alpha:false,antialias:false});
  const cleanup=()=>{if(this.disposed)return;this.disposed=true;this.session=null;try{gl?.deleteTexture(this.texture);gl?.deleteBuffer(this.buffer);gl?.deleteProgram(this.program);gl?.getExtension('WEBGL_lose_context')?.loseContext();}catch{}canvas.remove();this.onEnd();};session.addEventListener('end',cleanup,{once:true});
  try{
   if(!gl)throw Error('WEBGL_UNAVAILABLE');await gl.makeXRCompatible();const layer=new XRWebGLLayer(session,gl);session.updateRenderState({baseLayer:layer});const space=await session.requestReferenceSpace('local');
   const shader=(type,src)=>{const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error('XR_SHADER_FAILED');return s;};
   const vs=shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec2 uv; varying vec2 t; uniform mat4 mvp; void main(){t=uv;gl_Position=mvp*vec4(p,1.0);}');
   const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float; varying vec2 t; uniform sampler2D image; void main(){gl_FragColor=texture2D(image,t);}');
   const program=gl.createProgram();this.program=program;gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('XR_SHADER_FAILED');gl.useProgram(program);
   const buffer=gl.createBuffer();this.buffer=buffer;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
   const p=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv'),mvp=gl.getUniformLocation(program,'mvp');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
   const texture=gl.createTexture();this.texture=texture;gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,1,1,0,gl.RGBA,gl.UNSIGNED_BYTE,new Uint8Array([12,10,18,255]));
   let model=null,lastAspect=0;
   session.addEventListener('select',()=>{const v=this.getVideo();if(!v)return;if(v.paused)v.play().catch(()=>{});else v.pause();});
   session.addEventListener('visibilitychange',()=>{if(session.visibilityState!=='visible')this.getVideo()?.pause();});
   const frame=(_time,xrFrame)=>{
    if(this.session!==session)return;session.requestAnimationFrame(frame);const pose=xrFrame.getViewerPose(space);if(!pose)return;
    if(!model){const m=pose.transform.matrix,yaw=Math.atan2(m[8],m[10]),c=Math.cos(yaw),s=Math.sin(yaw);model=new Float32Array([c,0,-s,0,0,1,0,0,s,0,c,0,m[12]-s*2.2,m[13],m[14]-c*2.2,1]);}
    gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.018,.014,.032,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);
    const video=this.getVideo(),aspect=video?.videoWidth/video?.videoHeight||16/9;
    if(aspect!==lastAspect){const halfW=1.1,halfH=Math.min(1.3,halfW/aspect);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-halfW,-halfH,0,0,0,halfW,-halfH,0,1,0,-halfW,halfH,0,0,1,halfW,halfH,0,1,1]),gl.STATIC_DRAW);lastAspect=aspect;}
    if(video?.readyState>=2)try{gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,video);}catch{this.end();return;}
    for(const view of pose.views){const viewport=layer.getViewport(view);gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);gl.uniformMatrix4fv(mvp,false,multiply(view.projectionMatrix,multiply(view.transform.inverse.matrix,model)));gl.drawArrays(gl.TRIANGLE_STRIP,0,4);}
   };session.requestAnimationFrame(frame);
  }catch(error){await session.end().catch(()=>{});cleanup();throw error;}
 }
 async end(){await this.session?.end().catch(()=>{});}
}
