import { MirrorBall, rotatePoint } from './ball.js';
import { lightShift, makeMirrorFinish } from './mirror-finish.js';
import { storyCover, StoryEffects } from './story-effects.js';

// Stagger longitudes across the upper, middle, and lower bands.
const stories = [
  {
    file: 'laundromat', name: 'The waiting room', title: 'The waiting\nroom.',
    time: '02:17 AM',
    text: 'The rain had outlasted the last bus. Inside the laundromat, a woman waited for one white shirt to finish drying. Every time it came around, she thought it was ready.',
    alt: 'A woman in a mustard coat waits by a row of dryers in a softly lit laundromat on a rainy street.',
    phi: -.38, theta: 1.60, focal: .66, color: '171, 146, 71',
    mirrorCrop: [.38,.31,.53,.48],
  },
  {
    file: 'taxi', name: 'Lost property', title: 'Lost\nproperty.',
    time: '01:42 AM',
    text: 'The driver found a single silver hoop in the crease of the back seat. He put it in the cup holder, where it made a very small sound at every red light.',
    alt: 'A silver hoop earring on the back seat of a taxi, with violet city lights and red tail lights through the window.',
    phi: 1.19, theta: 1.55, focal: .53, color: '160, 65, 113',
    mirrorCrop: [.34,.13,.57,.51],
  },
  {
    file: 'bakery', name: 'The first loaf', title: 'The first\nloaf.',
    time: '04:56 AM',
    text: 'The baker set one loaf on the sill to cool. Across the street, the laundromat was still lit. He left the door propped open for whoever came out first.',
    alt: 'A baker sets a tray in a brightly lit bakery window as dawn approaches on a quiet street.',
    phi: 2.76, theta: 1.63, focal: .65, color: '68, 142, 118',
    mirrorCrop: [.49,.26,.45,.51],
  },
  {
    file: 'last-bus', name: 'The last bus', title: 'The last\nbus.',
    time: '12:34 AM',
    text: 'The last bus waited with its doors open. A woman in a red scarf leaned in to ask the time. When the driver told her, she thanked him and walked home.',
    alt: 'A woman in a red scarf stands beside the brightly lit doorway of a city bus on a quiet street.',
    phi: 4.33, theta: 1.57, focal: .39, color: '65, 149, 151',
    mirrorCrop: [.14,.40,.50,.42],
  },
  {
    file: 'record-shop', name: 'The B-side', title: 'The B-side.',
    time: '11:23 PM',
    text: 'The shop had been closed for twenty minutes. The clerk turned the record over anyway. The speakers faced the glass, so the first person to hear the B-side was someone waiting to cross the street.',
    alt: 'A clerk turns over a record in a softly lit record shop after closing.',
    phi: 4.60, theta: .97, focal: .65, color: '153, 79, 133',
    mirrorCrop: [.41,.21,.47,.51],
  },
  {
    file: 'night-swim', name: 'Night swim', title: 'Night swim.',
    time: '03:08 AM',
    text: 'A yellow leaf was the only thing in lane four. The caretaker followed it along the pool with his net. He let it touch the wall before lifting it out.',
    alt: 'An empty blue pool at night with a single yellow leaf on the water and a caretaker by the far wall.',
    phi: 1.54, theta: 2.24, focal: .66, color: '66, 106, 192',
    mirrorCrop: [.54,.45,.42,.45],
  },
  {
    file: 'rooftop-radio', name: 'Rooftop radio', title: 'Rooftop\nradio.',
    time: '12:12 AM',
    text: 'The radio could pick up one station from the roof. The signal went soft whenever the white shirt on the line lifted in the wind. He listened through the quiet parts.',
    alt: 'A person sits beside a small radio and a clothesline on an apartment rooftop at night.',
    phi: 2.51, theta: .94, focal: .54, color: '115, 110, 181',
    mirrorCrop: [.36,.30,.43,.39],
  },
  {
    file: 'last-frame', name: 'The last frame', title: 'The last\nframe.',
    time: '01:06 AM',
    text: 'After the credits, she ran the reel a few seconds longer. The beam stayed on the wall. In it, dust kept moving long after everyone else had gone.',
    alt: 'A woman works beside a film projector casting a pale beam inside a cinema booth.',
    phi: .42, theta: .92, focal: .62, color: '183, 140, 105',
    mirrorCrop: [.33,.18,.56,.61],
  },
  {
    file: 'under-the-bridge', name: 'Under the bridge', title: 'Under the\nbridge.',
    time: '02:29 AM',
    text: 'A cyclist stopped to tighten a shoelace. The red light on the back of his bike painted a puddle. A train passed overhead and shook the red into pieces.',
    alt: 'A stopped cyclist and a red bicycle light reflect in a puddle under a brick bridge.',
    phi: 3.63, theta: 2.18, focal: .59, color: '82, 133, 108',
    mirrorCrop: [.33,.23,.53,.62],
  },
  {
    file: 'exact-change', name: 'Exact change', title: 'Exact\nchange.',
    time: '02:46 AM',
    text: 'The machine gave her back a coin warmer than the one she’d put in. She turned it over twice in her palm, then put it in the other pocket.',
    alt: 'A person reaches for a coin at a softly glowing vending machine under an apartment stairwell.',
    phi: -.55, theta: 2.20, focal: .69, color: '185, 105, 126',
    mirrorCrop: [.44,.30,.50,.59],
  },
];

const $ = id => document.getElementById(id);
const cover = $('cover');
const view = $('night-view');
const glints = $('glints');
const ctx = glints.getContext('2d');
const artStatus = $('art-status');
const images = new Array(stories.length);
const imageRequests = new Map();
let artRequest = null;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const lerp = (from, to, t) => from+(to-from)*t;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
let canvas = $('world');
let ball;
let storyEffects;
let yaw = .06;
let pitch = .12;
let selected = 0;
let hover = -1;
let drag = null;
let momentum = 0;
let targetRotation = null;
let selectionGlint = null;
let idleAt = 0;
let previousFrame = 0;
let state = 'cover';
let activeScene = 0;
let progress = 0;
let origin = [.5,.5];
let transition = null;
let returnFocus = null;
let dirty = true;

async function loadImage(path){
  const image = new Image();
  image.src = path;
  await image.decode();
  return image;
}

function loadArt(index){
  if(images[index]) return Promise.resolve(images[index]);
  if(!imageRequests.has(index)){
    const request=loadImage(`assets/${stories[index].file}.jpg`).then(image=>{
      images[index]=image;
      return image;
    }).finally(()=>imageRequests.delete(index));
    imageRequests.set(index,request);
  }
  return imageRequests.get(index);
}

function cancelArtRequest(){
  clearTimeout(artRequest?.timer);
  artRequest=null;
  artStatus.hidden=true;
}

async function withStoryArt(index,display){
  cancelArtRequest();
  if(images[index]){
    display();
    return;
  }
  const request={index};
  artRequest=request;
  request.timer=setTimeout(()=>{
    artStatus.textContent='Opening the night…';
    artStatus.hidden=false;
  },180);
  try{
    await loadArt(index);
  }catch{
    if(artRequest===request){
      cancelArtRequest();
      artStatus.textContent='This night didn’t load. Try again.';
      artStatus.hidden=false;
    }
    return;
  }
  if(artRequest===request){
    cancelArtRequest();
    display();
  }
}

const smooth = value => {
  const t=clamp(value,0,1);
  return t*t*(3-2*t);
};

// Keeps the sphere and the refraction available when WebGL is disabled.
class CanvasMirrorBall {
  constructor(element, images, finish) {
    this.canvas=element;
    this.ctx=element.getContext('2d');
    this.stories=stories;
    this.images=images;
    this.finish=finish;
    const mesh=MirrorBall.prototype.buildMesh.call(this,stories,37);
    this.tiles=[];
    for(let i=0;i<mesh.length;i+=72){
      const corners=[0,12,60,24].map(k=>mesh.slice(i+k,i+k+3));
      this.tiles.push({corners,normal:mesh.slice(i+3,i+6),seed:mesh[i+9],story:mesh[i+8],uv:[6,18,30].map(k=>mesh.slice(i+k,i+k+2))});
    }
    this.resize();
  }
  resize() { MirrorBall.prototype.resize.call(this); }
  project(...args) { return MirrorBall.prototype.project.apply(this,args); }
  scenePosition(...args) { return MirrorBall.prototype.scenePosition.apply(this,args); }
  hit(...args) { return MirrorBall.prototype.hit.apply(this,args); }
  sparkles(...args) { return MirrorBall.prototype.sparkles.apply(this,args); }
  draw({yaw,pitch,hover,glintScene,glint,progress,scene,origin}) {
    const c=this.ctx;
    c.setTransform(this.ratio,0,0,this.ratio,0,0);
    c.clearRect(0,0,this.width,this.height);
    if(progress<.999) this.drawTiles(yaw,pitch,hover,glintScene,glint);
    if(progress>0) this.drawScene(scene,origin,progress);
  }
  drawTiles(yaw,pitch,hover,glintScene,glint){
    const c=this.ctx;
    const shift=lightShift(yaw);
    const matrix=[rotatePoint([1,0,0],yaw,pitch),rotatePoint([0,1,0],yaw,pitch),rotatePoint([0,0,1],yaw,pitch)];
    const transform=([x,y,z])=>[
      matrix[0][0]*x+matrix[1][0]*y+matrix[2][0]*z,
      matrix[0][1]*x+matrix[1][1]*y+matrix[2][1]*z,
      matrix[0][2]*x+matrix[1][2]*y+matrix[2][2]*z,
    ];
    const project=point=>{
      const [x,y,z]=transform(point);
      const scale=this.radius/(1-z*.11);
      return [this.center[0]+x*scale,this.center[1]-y*scale];
    };
    const tiles=[];
    for(const tile of this.tiles){
      const normal=transform(tile.normal);
      if(normal[2]>.06)tiles.push({tile,normal});
    }
    tiles.sort((a,b)=>a.normal[2]-b.normal[2]);
    for(const {tile,normal} of tiles){
      const {seed,story,uv}=tile;
      const corners=tile.corners.map(project);
      const [a,b,,d]=corners;
      const color=this.finish.shade(normal,shift,seed);
      const rim=(1-normal[2])**4;
      color[0]+=rim*10;
      color[1]+=rim*14;
      color[2]+=rim*20;
      c.beginPath();
      c.moveTo(...a);
      for(const point of corners.slice(1))c.lineTo(...point);
      c.closePath();
      c.fillStyle=`rgb(${color.join(',')})`;
      c.fill();
      if(story>=0){
        const highlight=story===glintScene ? glint : 0;
        const thumb=this.finish.reflections[story];
        const [[u,v],[u1],[,v1]]=uv.map(([u,v])=>[u*thumb.width,(1-v)*thumb.height]);
        const ax=(b[0]-a[0])/(u1-u), ay=(b[1]-a[1])/(u1-u);
        const bx=(d[0]-a[0])/(v1-v), by=(d[1]-a[1])/(v1-v);
        c.save();c.clip();
        c.globalAlpha=lerp(.77,.97,story===hover ? 1 : highlight)*(.74+seed*.26);
        c.transform(ax,ay,bx,by,a[0]-ax*u-bx*v,a[1]-ay*u-by*v);
        c.drawImage(thumb,0,0);
        c.restore();
        if(highlight>0){
          c.fillStyle=`rgba(239,245,255,${highlight*.13})`;
          c.fill();
        }
      }
      if(color[2]>112){
        c.strokeStyle=`rgba(224,236,252,${Math.min(1,color[2]/255)*.39})`;
        c.lineWidth=.55;
        c.beginPath();c.moveTo(...d);c.lineTo(...corners[2]);c.stroke();
      }
    }
  }
  drawScene(scene,origin,progress){
    const c=this.ctx;
    const image=this.images[scene];
    const [x,y]=[origin[0]*this.width,origin[1]*this.height];
    const p=smooth(progress);
    const radius=(Math.hypot(Math.max(x,this.width-x),Math.max(y,this.height-y))+28)*p;
    const crop=storyCover(this.width,this.height,image,stories[scene].focal,1+.045*(1-p));
    const draw=()=>c.drawImage(image,...crop);
    c.save();
    if(progress<1){c.beginPath();c.arc(x,y,radius,0,Math.PI*2);c.clip();}
    draw();
    // Displace the picture by alternating amounts across narrow concentric bands.
    if(progress<.99 && radius>12){
      const bandWidth=8+radius*.022;
      const envelope=(1-p)*Math.min(1,radius/64);
      for(let band=0;band<5;band++){
        const outer=Math.max(0,radius-band*bandWidth),inner=Math.max(0,outer-bandWidth);
        if(outer<=0)break;
        const magnify=1+Math.cos(band*2.1)*.072*envelope*(1-band*.12);
        c.save();c.beginPath();
        c.arc(x,y,outer,0,Math.PI*2);
        c.moveTo(x+inner,y);c.arc(x,y,inner,0,Math.PI*2);
        c.clip('evenodd');
        c.translate(x,y);c.scale(magnify,magnify);c.translate(-x,-y);
        draw();c.restore();
      }
      const edge=c.createRadialGradient(x,y,Math.max(0,radius-10),x,y,radius);
      edge.addColorStop(0,'rgba(212,230,255,0)');
      edge.addColorStop(.8,`rgba(212,230,255,${envelope*.16})`);
      edge.addColorStop(1,`rgba(212,230,255,${envelope*.55})`);
      c.fillStyle=edge;c.fillRect(0,0,this.width,this.height);
    }
    c.restore();
  }
}

function resize(){
  ball.resize();
  glints.width = Math.round(ball.width*ball.ratio);
  glints.height = Math.round(ball.height*ball.ratio);
  dirty = true;
}

function updateSelection(index, announce=false) {
  const story = stories[index];
  if(index!==selected || announce) {
    $('selected-name').textContent=story.name;
    $('enter-night').setAttribute('aria-label',`Step into night ${index+1}: ${story.name}`);
    document.querySelector('.atmosphere').style.setProperty('--night-glow',`rgba(${story.color}, .10)`);
    loadArt(index).catch(()=>{});
    loadArt((index+1)%stories.length).catch(()=>{});
  }
  selected=index;
  if(announce) $('announcement').textContent=`${story.name}, ${story.time}.`;
}

function faceNight(index, immediate=false){
  selectionGlint=null;
  const story=stories[index];
  const diff=-story.phi-yaw;
  const target={yaw:yaw+Math.atan2(Math.sin(diff),Math.cos(diff)),pitch:Math.PI/2-story.theta};
  if(immediate){
    yaw=target.yaw;
    pitch=target.pitch;
    targetRotation=null;
  }else{
    targetRotation=target;
  }
  momentum=0;
  hover=-1;
  idleAt=performance.now()+5600;
  updateSelection(index,true);
  dirty=true;
}

function stepNight(direction){
  cancelArtRequest();
  const index=(selected+direction+stories.length)%stories.length;
  faceNight(index);
  if(!reducedMotion.matches) selectionGlint={scene:index,start:null};
}

function populateStory(index){
  const story=stories[index];
  $('story-title').textContent=story.title;
  $('story-meta').textContent=story.time;
  $('story-copy').textContent=story.text;
  view.setAttribute('aria-description',story.alt);
}

function ripple(x,y,reverse=false){
  if(reducedMotion.matches)return;
  const ring=$('ripple-ring');
  ring.style.left=`${x-5}px`;
  ring.style.top=`${y-5}px`;
  const frames=[
    {transform:'scale(1)',opacity:.9},
    {transform:'scale(20)',opacity:.55,offset:.33},
    {transform:'scale(95)',opacity:0},
  ];
  ring.getAnimations().forEach(animation=>animation.cancel());
  ring.animate(reverse?frames.map(frame=>({transform:frame.transform,opacity:frame.opacity})).reverse():frames,{duration:930,easing:'cubic-bezier(.21,.54,.31,1)'});
}

function moveProgress(to, duration, finish){
  transition={from:progress,to,start:performance.now(),duration:reducedMotion.matches?1:duration,finish};
  dirty=true;
}

function openNight(index, clickedPoint, focusSource=document.activeElement){
  if(state!=='cover')return;
  withStoryArt(index,()=>showNight(index,clickedPoint,focusSource));
}

function showNight(index,clickedPoint,focusSource){
  state='opening';
  returnFocus=focusSource;
  activeScene=index;
  updateSelection(index);
  const projected=ball.scenePosition(index,yaw,pitch);
  const point=clickedPoint??(projected.z>.18?projected:{x:ball.center[0],y:ball.center[1]});
  origin=[clamp(point.x/ball.width,0,1),clamp(point.y/ball.height,0,1)];
  progress=0;
  hover=-1;
  targetRotation=null;
  selectionGlint=null;
  momentum=0;
  populateStory(index);
  cover.inert=true;
  canvas.tabIndex=-1;
  document.body.classList.add('story-open');
  view.hidden=false;
  view.inert=true;
  ripple(point.x,point.y);
  moveProgress(1, 1220, ()=>{
    state='story';
    view.inert=false;
    view.classList.add('visible');
    $('return-button').focus({preventScroll:true});
  });
}

function nextStory(){
  if(state!=='story')return;
  const next=(activeScene+1)%stories.length;
  withStoryArt(next,()=>{
    if(!reducedMotion.matches) storyEffects.crossfade(activeScene,performance.now());
    activeScene=next;
    // Align the hidden ball so Back closes onto the current reflection.
    faceNight(activeScene,true);
    const point=ball.scenePosition(activeScene,yaw,pitch);
    origin=[point.x/ball.width,point.y/ball.height];
    populateStory(activeScene);
  });
}

function closeNight(){
  if(state!=='story'&&state!=='opening')return;
  cancelArtRequest();
  state='closing';
  storyEffects.reset();
  view.classList.remove('visible');
  view.inert=true;
  ripple(origin[0]*ball.width,origin[1]*ball.height,true);
  moveProgress(0, 880, ()=>{
    state='cover';
    view.hidden=true;
    cover.inert=false;
    canvas.tabIndex=0;
    document.body.classList.remove('story-open');
    idleAt=performance.now()+2400;
    (returnFocus?.isConnected?returnFocus:$('enter-night')).focus({preventScroll:true});
  });
}

function cross(x,y,size,alpha){
  ctx.save();
  ctx.translate(x,y);
  const glowRadius=size*2.1;
  const glow=ctx.createRadialGradient(0,0,0,0,0,glowRadius);
  glow.addColorStop(0,`rgba(225,240,255,${alpha*.58})`);
  glow.addColorStop(.25,`rgba(180,210,246,${alpha*.16})`);
  glow.addColorStop(1,'rgba(160,198,241,0)');
  ctx.fillStyle=glow;
  ctx.fillRect(-glowRadius,-glowRadius,glowRadius*2,glowRadius*2);
  ctx.fillStyle=`rgba(245,249,255,${alpha})`;
  ctx.beginPath();
  ctx.moveTo(-size,0);ctx.lineTo(-1.1,-1);ctx.lineTo(0,-size*.83);ctx.lineTo(1.1,-1);
  ctx.lineTo(size,0);ctx.lineTo(1.1,1);ctx.lineTo(0,size*.83);ctx.lineTo(-1.1,1);
  ctx.closePath();ctx.fill();
  ctx.restore();
}

function drawDetails(){
  const {width:w,height:h,center:[x,y],radius:r,ratio}=ball;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,w,h);
  if(state!=='cover')return;
  const limit=r*.99;
  const wire=ctx.createLinearGradient(0,y-limit-55,0,y-limit+7);
  wire.addColorStop(0,'rgba(150,156,167,0)');
  wire.addColorStop(.8,'rgba(137,143,153,.49)');
  wire.addColorStop(1,'rgba(158,168,179,.74)');
  ctx.strokeStyle=wire;
  ctx.lineWidth=1;
  ctx.beginPath();ctx.moveTo(x-.2,y-limit-55);ctx.lineTo(x-.2,y-limit+4);ctx.stroke();
  ctx.fillStyle='#707785';
  ctx.fillRect(x-3.5,y-limit-3,7,2.5);

  // Soft-edged projections of the mirror tiles onto the dark room.
  for(let i=0;i<23;i++){
    const a=i*2.39996+yaw*.24;
    const distance=r*(1.32+(i%5)*.27);
    const px=x+Math.cos(a)*distance*1.22;
    const py=y+Math.sin(a)*distance*.61;
    const near=1-(i%5)*.12;
    const pulse=.64+.36*Math.cos(yaw*1.8+i*6);
    const alpha=(i%6===0?.27:.13)*near*pulse;
    if(px<22||px>w-22)continue;
    ctx.save();ctx.translate(px,py);ctx.rotate(a*.8);
    const size=r*(.012+(i%4)*.004);
    ctx.shadowBlur=7;ctx.shadowColor='#b9ccf2';
    ctx.fillStyle=`rgba(199,215,240,${alpha})`;
    ctx.fillRect(-size,-size*.65,size*2,size*1.3);
    ctx.restore();
  }
  for(const glint of ball.sparkles(yaw,pitch)){
    cross(glint.x,glint.y,r*(.010+glint.strength*.038),glint.strength*.95);
  }
}

function frame(now){
  const frameSeconds=previousFrame ? Math.max(0,(now-previousFrame)/1000) : 0;
  const elapsed=Math.min(.034,frameSeconds);
  previousFrame=now;
  if(state==='cover'&&!artRequest&&!drag){
    if(targetRotation){
      const ease=reducedMotion.matches ? 1 : 1-Math.exp(-Math.min(.5,frameSeconds)*8);
      yaw=lerp(yaw,targetRotation.yaw,ease);
      pitch=lerp(pitch,targetRotation.pitch,ease);
      if(Math.abs(yaw-targetRotation.yaw)<.005 && Math.abs(pitch-targetRotation.pitch)<.005){
        yaw=targetRotation.yaw;
        pitch=targetRotation.pitch;
        targetRotation=null;
        if(selectionGlint){
          selectionGlint.start=now;
          idleAt=Math.max(idleAt,now+1100);
        }
      }
      dirty=true;
    }else if(Math.abs(momentum)>.015){
      yaw+=momentum*elapsed;
      momentum*=Math.exp(-elapsed*3.7);
      dirty=true;
    }else if(!reducedMotion.matches&&hover<0&&now>idleAt){
      yaw+=Math.min(.5,frameSeconds)*(ball.width <= 760 ? .11 : .073);
      dirty=true;
    }
    if(!targetRotation){
      const front=stories.map((_,i)=>ball.scenePosition(i,yaw,pitch).z);
      const best=front.indexOf(Math.max(...front));
      if(best!==selected) updateSelection(best);
    }
  }
  if(transition){
    const t=clamp((now-transition.start)/transition.duration,0,1);
    progress=lerp(transition.from,transition.to,t);
    dirty=true;
    if(t>=1){const finish=transition.finish;transition=null;finish();}
  }
  let glint=0;
  let glintScene=-1;
  if(selectionGlint?.start!=null){
    const phase=(now-selectionGlint.start)/900;
    if(phase>=1){
      selectionGlint=null;
    }else{
      glintScene=selectionGlint.scene;
      const rise=lerp(.55,1,smooth(phase/.22));
      glint=rise*(1-smooth((phase-.22)/.78));
    }
    dirty=true;
  }
  if(dirty){
    ball.draw({yaw,pitch,hover,glintScene,glint,progress,scene:activeScene,origin});
    drawDetails();
    dirty=false;
  }
  if(state==='story') storyEffects.draw(ctx,ball.width,ball.height,activeScene,now,elapsed);
  requestAnimationFrame(frame);
}

function bindInteractions(){
  canvas.addEventListener('pointerdown',event=>{
    if(state!=='cover'||event.button!==0||ball.hit(event.clientX,event.clientY,yaw,pitch)===-2)return;
    cancelArtRequest();
    canvas.setPointerCapture(event.pointerId);
    drag={id:event.pointerId,startX:event.clientX,startY:event.clientY,lastX:event.clientX,lastY:event.clientY,time:performance.now(),moving:false};
    momentum=0;
    targetRotation=null;
    selectionGlint=null;
    hover=-1;
    dirty=true;
  });
  canvas.addEventListener('pointermove',event=>{
    if(state!=='cover')return;
    if(drag?.id===event.pointerId){
      if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>5) drag.moving=true;
      if(drag.moving){
        const now=performance.now();
        const dx=event.clientX-drag.lastX;
        const dy=event.clientY-drag.lastY;
        const change=dx/ball.radius*1.09;
        yaw+=change;
        pitch=clamp(pitch+dy/ball.radius*.76,-.78,.78);
        momentum=clamp(change/Math.max(.012,(now-drag.time)/1000),-7,7);
        drag.lastX=event.clientX;
        drag.lastY=event.clientY;
        drag.time=now;
        dirty=true;
      }
    }else if(event.pointerType!=='touch'){
      const hit=ball.hit(event.clientX,event.clientY,yaw,pitch);
      canvas.style.cursor=hit>=0?'pointer':hit===-1?'grab':'default';
      if(hit!==hover){hover=hit;dirty=true;}
    }
  });
  canvas.addEventListener('pointerup',event=>{
    if(drag?.id!==event.pointerId)return;
    const wasMoving=drag.moving;
    if(performance.now()-drag.time>90||reducedMotion.matches) momentum=0;
    drag=null;
    idleAt=performance.now()+2200;
    if(!wasMoving){
      const hit=ball.hit(event.clientX,event.clientY,yaw,pitch);
      if(hit>=0)openNight(hit,{x:event.clientX,y:event.clientY},canvas);
      else if(hit===-1) faceNight(selected);
    }
  });
  canvas.addEventListener('pointercancel',()=>{drag=null;momentum=0;dirty=true;});
  canvas.addEventListener('pointerleave',()=>{hover=-1;dirty=true;});
  $('previous-night').addEventListener('click',()=>stepNight(-1));
  $('next-night').addEventListener('click',()=>stepNight(1));
  $('enter-night').addEventListener('click',()=>openNight(selected));
  $('return-button').addEventListener('click',()=>closeNight());
  $('story-next').addEventListener('click',nextStory);
  view.addEventListener('pointermove',event=>{
    if(state==='story' && event.pointerType==='mouse' && !reducedMotion.matches &&
      !event.target.closest('button, .story-bottom')){
      storyEffects.brushAt(event.clientX,event.clientY);
    }else{
      storyEffects.release();
    }
  });
  view.addEventListener('pointerleave',()=>storyEffects.release());
  reducedMotion.addEventListener('change',event=>{
    if(event.matches){
      storyEffects.reset();
      momentum=0;
      selectionGlint=null;
    }
    idleAt=performance.now();
    dirty=true;
  });
  window.addEventListener('keydown',event=>{
    if(state==='cover'){
      if(event.key==='ArrowRight'||event.key==='ArrowLeft'){
        event.preventDefault();stepNight(event.key==='ArrowRight'?1:-1);
      }else if(event.key==='Escape'&&artRequest){
        cancelArtRequest();
      }else if(event.key==='Enter'&&event.target===canvas){
        event.preventDefault();openNight(selected,undefined,canvas);
      }
    }else if(event.key==='Escape'){
      event.preventDefault();closeNight();
    }else if(event.key==='Tab'&&state==='story'){
      const first=$('return-button'), last=$('story-next');
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  window.addEventListener('resize',resize);
}

async function start(){
  const previews=await loadImage('assets/night-previews.webp');
  storyEffects=new StoryEffects(images,stories);
  const finish=makeMirrorFinish(previews,stories);
  try{
    ball=new MirrorBall(canvas,images,stories,finish);
  }catch(error){
    console.warn('Using the canvas mirror renderer.',error);
    const replacement=canvas.cloneNode();
    canvas.replaceWith(replacement);
    canvas=replacement;
    ball=new CanvasMirrorBall(canvas,images,finish);
  }
  resize();
  updateSelection(0,true);
  if(ball.width>760) idleAt=performance.now()+2400;
  bindInteractions();
  requestAnimationFrame(now=>{
    frame(now);
    cover.inert=false;
    canvas.tabIndex=0;
    document.body.classList.remove('cover-loading');
    const loading=$('loading');
    loading.addEventListener('transitionend',()=>loading.hidden=true,{once:true});
    loading.classList.add('done');
  });
}

start().catch(error=>{
  console.error(error);
  const message=$('loading-message');
  message.textContent='The night didn’t load. Refresh to try again.';
  message.classList.remove('sr-only');
});
