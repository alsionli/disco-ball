const FADE_DURATION = 250;
const PATCH_SIZE = 256;
const BRUSH_SETTLE_DELAY = 800;
const clamp = (value,min,max) => Math.min(max,Math.max(min,value));

export function storyCover(width,height,image,focal,zoom=1) {
  const scale = Math.max(width/image.naturalWidth,height/image.naturalHeight)*zoom;
  const w = image.naturalWidth*scale;
  const h = image.naturalHeight*scale;
  return [clamp(width*.5-w*focal,width-w,0),(height-h)*.5,w,h];
}

function clothSurface(readback=false) {
  const canvas = document.createElement('canvas');
  canvas.width = PATCH_SIZE;
  canvas.height = PATCH_SIZE;
  const context = canvas.getContext('2d',{willReadFrequently:readback});
  return {canvas,context};
}

export class StoryEffects {
  constructor(images,stories) {
    this.images = images;
    this.stories = stories;
    this.reset();
  }

  reset() {
    this.fade = null;
    this.target = null;
    this.strength = 0;
  }

  crossfade(outgoing,now) {
    // Let rapid clicks advance underneath the fade already in progress.
    this.fade ??= {outgoing,start:now};
    this.release();
  }

  brushAt(x,y) {
    if(!this.strength){
      this.x = x;
      this.y = y;
    }
    this.target = [x,y];
    this.lastBrushAt = performance.now();
  }

  release() {
    this.target = null;
  }

  draw(context,width,height,scene,now,elapsed) {
    if(this.target && now-this.lastBrushAt>BRUSH_SETTLE_DELAY) this.release();
    const wasBrushed = this.strength>0;
    const ease = 1-Math.exp(-elapsed*15);
    this.strength += ((this.target ? 1 : 0)-this.strength)*ease;
    if(!this.target && this.strength<.008) this.strength = 0;
    if(!this.fade && !wasBrushed && !this.strength) return;

    context.clearRect(0,0,width,height);
    if(this.fade){
      const t = clamp((now-this.fade.start)/FADE_DURATION,0,1);
      if(t<1){
        const {outgoing} = this.fade;
        const image = this.images[outgoing];
        context.save();
        context.globalAlpha = 1-t*t*(3-2*t);
        context.drawImage(image,...storyCover(width,height,image,this.stories[outgoing].focal));
        context.restore();
        return;
      }
      this.fade = null;
    }

    if(!this.strength) return;
    if(this.target){
      this.x += (this.target[0]-this.x)*ease;
      this.y += (this.target[1]-this.y)*ease;
    }
    const image = this.images[scene];
    const crop = storyCover(width,height,image,this.stories[scene].focal);
    this.drawCloth(context,image,crop,Math.min(172,Math.min(width,height)*.26),now);
  }

  drawCloth(context,image,[left,top,width,height],radius,now) {
    this.source ??= clothSurface(true);
    this.cloth ??= clothSurface();
    this.pixels ??= this.cloth.context.createImageData(PATCH_SIZE,PATCH_SIZE);
    const size = PATCH_SIZE;
    const diameter = radius*2;
    const x = this.x-radius;
    const y = this.y-radius;
    const scale = size/diameter;
    const source = this.source.context;
    source.clearRect(0,0,size,size);
    source.drawImage(image,(left-x)*scale,(top-y)*scale,width*scale,height*scale);
    const original = source.getImageData(0,0,size,size).data;
    const output = this.pixels.data;
    const phase = now*.0034;
    const displacement = Math.min(10,radius*.065)*scale;

    // Two soft ridges carry the print sideways and catch a little directional light.
    for(let row=0;row<size;row++){
      const v = (row+.5)*2/size-1;
      for(let col=0;col<size;col++){
        const u = (col+.5)*2/size-1;
        const distance = u*u+v*v;
        const offset = (row*size+col)*4;
        if(distance>=1){
          output[offset+3] = 0;
          continue;
        }
        const edge = 1-distance;
        const weight = edge*edge*this.strength;
        const angle = u*8.5+v*4.4-phase;
        const fold = Math.sin(angle);
        const drape = Math.sin(v*7.3-u*3.4+phase*.65);
        const sampleX = clamp(col+(fold+drape*.32)*displacement*weight,0,size-1.001);
        const sampleY = clamp(row+(fold*.55-drape*.46)*displacement*weight,0,size-1.001);
        const ix = Math.floor(sampleX);
        const iy = Math.floor(sampleY);
        const tx = sampleX-ix;
        const ty = sampleY-iy;
        const a = (iy*size+ix)*4;
        const b = a+4;
        const c = a+size*4;
        const d = c+4;
        const slope = Math.cos(angle);
        const light = 1+slope*.19*weight;
        const sheen = Math.max(0,slope-.3)*11*weight;
        for(let channel=0;channel<3;channel++){
          const upper = original[a+channel]*(1-tx)+original[b+channel]*tx;
          const lower = original[c+channel]*(1-tx)+original[d+channel]*tx;
          output[offset+channel] = (upper*(1-ty)+lower*ty)*light+sheen;
        }
        output[offset+3] = original[a+3]*Math.min(1,edge*2.5)*this.strength;
      }
    }
    this.cloth.context.putImageData(this.pixels,0,0);
    context.drawImage(this.cloth.canvas,x,y,diameter,diameter);
  }
}
