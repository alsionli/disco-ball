import { lightShift } from './mirror-finish.js';

const VERTEX = `
attribute vec3 aPosition;
attribute vec3 aNormal;
attribute vec2 aUv;
attribute float aScene;
attribute float aSeed;
attribute vec2 aCorner;
uniform mat3 uRotation;
uniform vec2 uResolution;
uniform vec2 uCenter;
uniform float uRadius;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vScene;
varying float vSeed;
varying vec2 vCorner;
void main(){
  vec3 p=uRotation*aPosition;
  vPosition=p;
  vNormal=uRotation*aNormal;
  vUv=aUv;
  vScene=aScene;
  vSeed=aSeed;
  vCorner=aCorner;
  float perspective=1.0/(1.0-p.z*.11);
  vec2 pixel=uCenter+p.xy*uRadius*perspective;
  gl_Position=vec4(pixel/uResolution*2.0-1.0,-p.z*.4,1.0);
}`;

const FRAGMENT = `
precision highp float;
uniform sampler2D uReflections;
uniform vec2 uReflectionGrid;
uniform vec2 uReflectionInset;
uniform sampler2D uEnvironment;
uniform float uLightShift;
uniform float uHover;
uniform vec2 uSelectionGlint;
varying vec3 vPosition;
varying vec3 vNormal;
varying vec2 vUv;
varying float vScene;
varying float vSeed;
varying vec2 vCorner;
void main(){
  vec3 n=normalize(vNormal);
  vec3 view=normalize(vec3(0.,0.,9.1)-vPosition);
  if(dot(n,view)<.015) discard;
  vec3 r=reflect(-view,n);
  vec2 uv=vec2(fract(atan(r.x,r.z)/6.283185+.5+uLightShift),asin(clamp(r.y,-1.,1.))/3.141593+.5);
  vec3 metal=texture2D(uEnvironment,uv).rgb*mix(.68,1.28,vSeed);
  float edge=1.-smoothstep(.88,1.,max(abs(vCorner.x),abs(vCorner.y)));
  metal*=mix(.80,1.,edge);
  vec3 col=metal;
  if(vScene>-.5){
    float index=floor(vScene+.5);
    vec2 slot=vec2(mod(index,uReflectionGrid.x),uReflectionGrid.y-1.-floor(index/uReflectionGrid.x));
    vec2 localUv=clamp(vUv,uReflectionInset,1.-uReflectionInset);
    vec4 reflected=texture2D(uReflections,(slot+localUv)/uReflectionGrid);
    float hover=1.-step(.1,abs(vScene-uHover));
    float glint=uSelectionGlint.y*(1.-step(.1,abs(vScene-uSelectionGlint.x)));
    float clarity=mix(.77,.97,max(hover,glint))*mix(.74,1.,vSeed);
    col=mix(metal,reflected.rgb*(1.+.28*glint),reflected.a*clarity);
    col+=max(metal-.40,0.)*reflected.a*.21;
  }
  float rim=pow(1.-max(dot(n,view),0.),4.);
  col+=vec3(.043,.062,.087)*rim;
  col+=metal*smoothstep(.87,1.,vCorner.y)*.10;
  gl_FragColor=vec4(col,1.);
}`;

const QUAD_VERTEX = `
attribute vec2 aPosition;
varying vec2 vUv;
void main(){vUv=aPosition*.5+.5;gl_Position=vec4(aPosition,0.,1.);}`;
const RIPPLE_FRAGMENT = `
precision highp float;
uniform sampler2D uImage;
uniform vec2 uResolution;
uniform vec2 uImageSize;
uniform vec2 uOrigin;
uniform float uProgress;
uniform float uFocal;
varying vec2 vUv;
void main(){
  float aspect=uResolution.x/uResolution.y;
  vec2 p=(vUv-uOrigin)*vec2(aspect,1.);
  float d=length(p);
  float maxD=max(max(length(vec2(uOrigin.x*aspect,uOrigin.y)),length(vec2((1.-uOrigin.x)*aspect,uOrigin.y))),max(length(vec2(uOrigin.x*aspect,1.-uOrigin.y)),length(vec2((1.-uOrigin.x)*aspect,1.-uOrigin.y))));
  float progress=uProgress*uProgress*(3.-2.*uProgress);
  float radius=progress*(maxD+.15);
  float delta=d-radius;
  float wave=sin(delta*76.)*exp(-abs(delta)*24.)*.022*(1.-progress);
  wave+=sin(d*58.-progress*21.)*.003*sin(progress*3.14159);
  vec2 direction=p/(d+.0001);
  vec2 uv=vUv+direction*wave/vec2(aspect,1.);
  float imageAspect=uImageSize.x/uImageSize.y;
  if(aspect>imageAspect) uv.y=(uv.y-.5)*(imageAspect/aspect)+.5;
  else {
    float span=aspect/imageAspect;
    uv.x=(uv.x-.5)*span+clamp(uFocal,span*.5,1.-span*.5);
  }
  uv=(uv-.5)/(1.+.045*(1.-progress))+.5;
  vec3 col=texture2D(uImage,uv).rgb;
  float mask=1.-smoothstep(-.025,.025,delta);
  if(uProgress<.001) mask=0.;
  if(uProgress>.999) mask=1.;
  float ring=exp(-abs(delta)*130.)*(1.-progress)*.32;
  col+=vec3(.42,.53,.64)*ring;
  gl_FragColor=vec4(col,mask);
}`;

function shader(gl, type, source) {
  const handle = gl.createShader(type);
  gl.shaderSource(handle, source);
  gl.compileShader(handle);
  if (!gl.getShaderParameter(handle, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(handle));
  return handle;
}
function program(gl, vertex, fragment) {
  const handle = gl.createProgram();
  gl.attachShader(handle, shader(gl, gl.VERTEX_SHADER, vertex));
  gl.attachShader(handle, shader(gl, gl.FRAGMENT_SHADER, fragment));
  gl.linkProgram(handle);
  if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(handle));
  return handle;
}
function makeTexture(gl, image) {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  return texture;
}
function makeReflectionAtlas(gl, reflections) {
  const {width,height}=reflections[0];
  const columns=Math.ceil(Math.sqrt(reflections.length));
  const rows=Math.ceil(reflections.length/columns);
  const atlas=document.createElement('canvas');
  atlas.width=columns*width;
  atlas.height=rows*height;
  const ctx=atlas.getContext('2d');
  reflections.forEach((image,index)=>{
    ctx.drawImage(image,(index%columns)*width,Math.floor(index/columns)*height);
  });
  return {texture:makeTexture(gl,atlas),grid:[columns,rows],inset:[.5/width,.5/height]};
}
export function rotatePoint(p, yaw, pitch=.12, roll=-.12) {
  const x = p[0]*Math.cos(yaw)+p[2]*Math.sin(yaw);
  const z = -p[0]*Math.sin(yaw)+p[2]*Math.cos(yaw);
  const y = p[1]*Math.cos(pitch)-z*Math.sin(pitch);
  const z2 = p[1]*Math.sin(pitch)+z*Math.cos(pitch);
  return [x*Math.cos(roll)-y*Math.sin(roll), x*Math.sin(roll)+y*Math.cos(roll), z2];
}
function spherePoint(theta, phi) {
  return [Math.sin(theta)*Math.sin(phi), Math.cos(theta), Math.sin(theta)*Math.cos(phi)];
}
const angularDelta = (a,b) => Math.atan2(Math.sin(a-b), Math.cos(a-b));
const MIRROR_HALF_WIDTH = .32;
const MIRROR_HALF_HEIGHT = .245;
const PERSPECTIVE = .11;

export class MirrorBall {
  constructor(canvas, images, stories, finish) {
    this.canvas=canvas;
    this.gl=canvas.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:false,preserveDrawingBuffer:false});
    if (!this.gl) throw new Error('WebGL is unavailable');
    const gl=this.gl;
    this.ballProgram=program(gl,VERTEX,FRAGMENT);
    this.rippleProgram=program(gl,QUAD_VERTEX,RIPPLE_FRAGMENT);
    this.reflections=makeReflectionAtlas(gl,finish.reflections);
    this.storyTexture=null;
    this.environmentTexture=makeTexture(gl,finish.environment);
    this.finish=finish;
    this.images=images;
    this.stories=stories;
    this.mesh=this.buildMesh(stories);
    this.ballBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.ballBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(this.mesh),gl.STATIC_DRAW);
    this.quadBuffer=gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    this.uniforms=new Map();
    this.resize();
  }
  location(prog,name){
    const key=(prog===this.ballProgram?'ball':'ripple')+name;
    if(!this.uniforms.has(key)) this.uniforms.set(key,this.gl.getUniformLocation(prog,name));
    return this.uniforms.get(key);
  }
  buildMesh(stories, rows=49) {
    const mesh=[];
    this.sparkleTiles=[];
    const step=Math.PI/rows;
    for(let row=0;row<rows;row++){
      const theta=(row+.5)*step;
      const count=Math.max(4,Math.round(2*Math.PI*Math.sin(theta)/step));
      const phiStep=2*Math.PI/count;
      for(let col=0;col<count;col++){
        const phi=(col+.5)*phiStep;
        const center=spherePoint(theta,phi);
        const tangent=[Math.cos(phi),0,-Math.sin(phi)];
        const vertical=[-Math.cos(theta)*Math.sin(phi),Math.sin(theta),-Math.cos(theta)*Math.cos(phi)];
        const halfW=Math.sin(theta)*Math.sin(phiStep*.5)*.965;
        const halfH=Math.sin(step*.5)*.965;
        const seed=(Math.sin(row*127.1+col*311.7)*43758.5453)%1;
        const random=seed-Math.floor(seed);
        const perturb=(random-.5)*.095;
        const tip=(Math.sin(row*29.6+col*97.3))*.038;
        const normal=center.map((v,k)=>v+tangent[k]*perturb+vertical[k]*tip);
        if(random>.974) this.sparkleTiles.push({center,normal,seed:random});
        let scene=-1;
        for(let s=0;s<stories.length;s++){
          if(Math.abs(angularDelta(phi,stories[s].phi))<MIRROR_HALF_WIDTH+phiStep*.5 &&
            Math.abs(theta-stories[s].theta)<MIRROR_HALF_HEIGHT+step*.5) scene=s;
        }
        for(const [cx,cy] of [[-1,-1],[1,-1],[-1,1],[-1,1],[1,-1],[1,1]]){
          const position=center.map((v,k)=>v+tangent[k]*cx*halfW+vertical[k]*cy*halfH);
          let uv=[0,0];
          if(scene>=0){
            const story=stories[scene];
            const mirrorWidth=2*MIRROR_HALF_WIDTH;
            const mirrorHeight=2*MIRROR_HALF_HEIGHT;
            uv=[.5+(angularDelta(phi,story.phi)+cx*phiStep*.5)/mirrorWidth,
              .5+(-(theta-story.theta)+cy*step*.5)/mirrorHeight];
          }
          mesh.push(...position,...normal,...uv,scene,random,cx,cy);
        }
      }
    }
    return mesh;
  }
  resize(){
    this.width=innerWidth;
    this.height=innerHeight;
    this.ratio=Math.min(devicePixelRatio||1,2);
    this.canvas.width=Math.round(this.width*this.ratio);
    this.canvas.height=Math.round(this.height*this.ratio);
    const mobile=this.width<=760;
    this.radius=mobile?Math.min(this.width*.355,this.height*.205,205):Math.min(this.width*.205,this.height*.235,265);
    this.center=[this.width*.5,this.height*(mobile?.485:.545)];
  }
  project(point,yaw,pitch){
    const p=rotatePoint(point,yaw,pitch);
    const perspective=1/(1-p[2]*PERSPECTIVE);
    return {x:this.center[0]+p[0]*this.radius*perspective,y:this.center[1]-p[1]*this.radius*perspective,z:p[2]};
  }
  scenePosition(index,yaw,pitch){
    const story=this.stories[index];
    return this.project(spherePoint(story.theta,story.phi),yaw,pitch);
  }
  hit(x,y,yaw,pitch){
    const sx=(x-this.center[0])/this.radius;
    const sy=(this.center[1]-y)/this.radius;
    const distance=sx*sx+sy*sy;
    const discriminant=1-distance*(1-PERSPECTIVE**2);
    if(discriminant<0) return -2;
    const z=(PERSPECTIVE*distance+Math.sqrt(discriminant))/(1+PERSPECTIVE**2*distance);
    const scale=1-PERSPECTIVE*z;
    const point=[sx*scale,sy*scale,z];
    const local=[[1,0,0],[0,1,0],[0,0,1]].map(axis=>
      rotatePoint(axis,yaw,pitch).reduce((dot,value,i)=>dot+value*point[i],0));
    const phi=Math.atan2(local[0],local[2]);
    const theta=Math.acos(Math.min(1,Math.max(-1,local[1])));
    for(let i=0;i<this.stories.length;i++){
      const story=this.stories[i];
      const dx=angularDelta(phi,story.phi)/MIRROR_HALF_WIDTH;
      const dy=(theta-story.theta)/MIRROR_HALF_HEIGHT;
      if(dx*dx+dy*dy<1.14) return i;
    }
    return -1;
  }
  sparkles(yaw,pitch){
    const shift=lightShift(yaw);
    const glints=[];
    for(const {center,normal,seed} of this.sparkleTiles){
      const rotated=rotatePoint(normal,yaw,pitch);
      if(rotated[2]<.28) continue;
      const color=this.finish.shade(rotated,shift,seed);
      const brightness=(color[0]+color[1]+color[2])/(3*255);
      if(brightness>.71){
        glints.push({...this.project(center,yaw,pitch),strength:Math.min(1,(brightness-.71)/.25)});
      }
    }
    return glints.sort((a,b)=>b.strength-a.strength).slice(0,5);
  }
  draw({yaw,pitch,hover=-1,glintScene=-1,glint=0,progress=0,scene=0,origin=[.5,.5]}){
    const gl=this.gl;
    gl.viewport(0,0,this.canvas.width,this.canvas.height);
    gl.clearColor(0,0,0,0);
    gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    if(progress<.999){
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LESS);
      gl.disable(gl.BLEND);
      const prog=this.ballProgram;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.ballBuffer);
      const attrs=[['aPosition',3],['aNormal',3],['aUv',2],['aScene',1],['aSeed',1],['aCorner',2]];
      let offset=0;
      for(const [name,size] of attrs){
        const loc=gl.getAttribLocation(prog,name);
        if(loc>=0){gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,48,offset*4);}
        offset+=size;
      }
      const matrix=[rotatePoint([1,0,0],yaw,pitch),rotatePoint([0,1,0],yaw,pitch),rotatePoint([0,0,1],yaw,pitch)].flat();
      gl.uniformMatrix3fv(this.location(prog,'uRotation'),false,new Float32Array(matrix));
      gl.uniform2f(this.location(prog,'uResolution'),this.width,this.height);
      gl.uniform2f(this.location(prog,'uCenter'),this.center[0],this.height-this.center[1]);
      gl.uniform1f(this.location(prog,'uRadius'),this.radius);
      gl.uniform1f(this.location(prog,'uLightShift'),lightShift(yaw));
      gl.uniform1f(this.location(prog,'uHover'),hover);
      gl.uniform2f(this.location(prog,'uSelectionGlint'),glintScene,glint);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D,this.reflections.texture);
      gl.uniform1i(this.location(prog,'uReflections'),0);
      gl.uniform2fv(this.location(prog,'uReflectionGrid'),this.reflections.grid);
      gl.uniform2fv(this.location(prog,'uReflectionInset'),this.reflections.inset);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D,this.environmentTexture);
      gl.uniform1i(this.location(prog,'uEnvironment'),1);
      gl.drawArrays(gl.TRIANGLES,0,this.mesh.length/12);
      for(const [name] of attrs){const loc=gl.getAttribLocation(prog,name);if(loc>=0)gl.disableVertexAttribArray(loc);}
    }
    if(progress>.0001){
      gl.disable(gl.DEPTH_TEST);
      gl.enable(gl.BLEND);
      gl.blendFuncSeparate(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA,gl.ONE,gl.ONE_MINUS_SRC_ALPHA);
      const prog=this.rippleProgram;
      gl.useProgram(prog);
      gl.bindBuffer(gl.ARRAY_BUFFER,this.quadBuffer);
      const position=gl.getAttribLocation(prog,'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
      gl.activeTexture(gl.TEXTURE0);
      if(this.storyTexture?.scene!==scene){
        if(this.storyTexture) gl.deleteTexture(this.storyTexture.texture);
        this.storyTexture={scene,texture:makeTexture(gl,this.images[scene])};
      }
      gl.bindTexture(gl.TEXTURE_2D,this.storyTexture.texture);
      gl.uniform1i(this.location(prog,'uImage'),0);
      gl.uniform2f(this.location(prog,'uResolution'),this.width,this.height);
      gl.uniform2f(this.location(prog,'uImageSize'),this.images[scene].naturalWidth,this.images[scene].naturalHeight);
      gl.uniform2f(this.location(prog,'uOrigin'),origin[0],1-origin[1]);
      gl.uniform1f(this.location(prog,'uProgress'),progress);
      gl.uniform1f(this.location(prog,'uFocal'),this.stories[scene].focal);
      gl.drawArrays(gl.TRIANGLES,0,6);
      gl.disableVertexAttribArray(position);
    }
  }
}
