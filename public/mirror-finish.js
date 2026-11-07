const TAU = Math.PI * 2;
const MAP_WIDTH = 384;
const MAP_HEIGHT = 192;
const clamp = (n, low, high) => Math.min(high, Math.max(low, n));
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const smooth = value => {
  const t = clamp(value, 0, 1);
  return t*t*(3-2*t);
};

// Wide, low-intensity bounce light and small directional sources give the
// mirrors a silver body with separate points of warm and cool light.
const lights = [
  [-.57, .38, 1, .32, .39, .63, .70, .80],
  [-.73, .52, 1, .092, .14, 1.20, 1.13, 1.03],
  [-.39, .69, 1, .052, .073, 1.58, 1.76, 1.92],
  [-.82, .13, 1, .07, .15, .82, .94, 1.11],
  [-.48, -.08, 1, .06, .064, 1.17, 1.05, .92],
  [.73, .28, 1, .25, .49, .48, .57, .72],
  [.91, .22, 1, .056, .23, .69, .83, 1.08],
  [.57, .43, 1, .052, .11, 1.16, 1.28, 1.49],
  [.95, -.34, .85, .081, .064, 1.04, 1.22, 1.47],
  [-.03, .93, .71, .39, .095, .47, .58, .73],
  [.14, .91, .59, .068, .056, 1.15, 1.27, 1.48],
  [-.29, -.65, 1, .51, .14, .16, .20, .29],
  [-.92, -.13, -.22, .24, .43, .19, .23, .31],
].map(([x,y,z,width,height,...color]) => {
  const length = Math.hypot(x,y,z);
  const horizontal = Math.hypot(x,z);
  const direction = [x/length,y/length,z/length];
  const right = [z/horizontal,0,-x/horizontal];
  const up = [direction[1]*right[2],direction[2]*right[0]-direction[0]*right[2],-direction[1]*right[0]];
  return {direction,right,up,width,height,color};
});

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function environmentMap() {
  const canvas = makeCanvas(MAP_WIDTH, MAP_HEIGHT);
  const ctx = canvas.getContext('2d');
  const pixels = ctx.createImageData(MAP_WIDTH, MAP_HEIGHT);
  for (let y=0; y<MAP_HEIGHT; y++) {
    const latitude = (.5-(y+.5)/MAP_HEIGHT)*Math.PI;
    const latitudeCos = Math.cos(latitude);
    const latitudeSin = Math.sin(latitude);
    for (let x=0; x<MAP_WIDTH; x++) {
      const longitude = ((x+.5)/MAP_WIDTH-.5)*TAU;
      const ray = [Math.sin(longitude)*latitudeCos,latitudeSin,Math.cos(longitude)*latitudeCos];
      const bounce = Math.exp(-((ray[1]+.15)**2)*7)*.16;
      const ceiling = Math.max(0,ray[1])*.075;
      const light = [.065+bounce+ceiling,.073+bounce*1.06+ceiling,.087+bounce*1.18+ceiling];
      for (const {direction,right,up,width,height,color} of lights) {
        if (dot(ray,direction) < .25) continue;
        const dx = dot(ray,right)/width;
        const dy = dot(ray,up)/height;
        const power = Math.exp(-dx*dx-dy*dy);
        for (let channel=0; channel<3; channel++) light[channel] += power*color[channel];
      }
      const offset = (y*MAP_WIDTH+x)*4;
      for (let channel=0; channel<3; channel++) {
        pixels.data[offset+channel] = 255*(1-Math.exp(-light[channel]))**.79;
      }
      pixels.data[offset+3] = 255;
    }
  }
  ctx.putImageData(pixels,0,0);
  return {canvas,pixels:pixels.data};
}

export const PREVIEW_COLUMNS = 5;

function mirrorMap(image, [x,y,width,height], index, rows) {
  const canvas = makeCanvas(256, 200);
  const ctx = canvas.getContext('2d');
  const iw = image.naturalWidth/PREVIEW_COLUMNS;
  const ih = image.naturalHeight/rows;
  const col = index%PREVIEW_COLUMNS;
  const row = Math.floor(index/PREVIEW_COLUMNS);
  ctx.drawImage(image,(col+x)*iw,(row+y)*ih,width*iw,height*ih,0,0,canvas.width,canvas.height);
  const pixels = ctx.getImageData(0,0,canvas.width,canvas.height);
  for (let row=0; row<canvas.height; row++) {
    for (let col=0; col<canvas.width; col++) {
      const index = (row*canvas.width+col)*4;
      const r = pixels.data[index];
      const g = pixels.data[index+1];
      const b = pixels.data[index+2];
      const luma = (.2126*r+.7152*g+.0722*b)/255;
      const u = (col+.5)/canvas.width*2-1;
      const v = (row+.5)/canvas.height*2-1;
      const edge = 1-smooth((Math.hypot(u,v)-.49)/.51);
      const exposure = .23+.77*smooth((luma-.04)/.49);
      pixels.data[index] = r*.93+luma*255*.07;
      pixels.data[index+1] = g*.93+luma*255*.07;
      pixels.data[index+2] = b*.90+luma*255*.10;
      pixels.data[index+3] = 255*edge*exposure;
    }
  }
  ctx.putImageData(pixels,0,0);
  return canvas;
}

export function lightShift(yaw) {
  return (.50*Math.sin(yaw)+.14*Math.sin(2*yaw))/TAU;
}

export function makeMirrorFinish(previews, stories) {
  const {canvas,pixels} = environmentMap();
  const rows = Math.ceil(stories.length/PREVIEW_COLUMNS);
  const reflections = stories.map((story,index) => mirrorMap(previews,story.mirrorCrop,index,rows));
  return {
    environment: canvas,
    reflections,
    shade(normal, shift, seed) {
      const [x,y,z] = normal;
      const incidence = z-.11*(1-z*z);
      const lateral = 2*incidence+.11;
      const u = Math.atan2(x*lateral,z*lateral-1)/TAU+.5+shift;
      const v = .5-Math.asin(clamp(y*lateral,-1,1))/Math.PI;
      const mx = (u-Math.floor(u))*MAP_WIDTH-.5;
      const my = clamp(v*MAP_HEIGHT-.5,0,MAP_HEIGHT-1);
      const left = Math.floor(mx);
      const top = Math.floor(my);
      const dx = mx-left;
      const dy = my-top;
      const x0 = (left+MAP_WIDTH)%MAP_WIDTH;
      const x1 = (left+1)%MAP_WIDTH;
      const y1 = Math.min(top+1,MAP_HEIGHT-1);
      const a = (top*MAP_WIDTH+x0)*4;
      const b = (top*MAP_WIDTH+x1)*4;
      const c = (y1*MAP_WIDTH+x0)*4;
      const d = (y1*MAP_WIDTH+x1)*4;
      const strength = .68+seed*.60;
      const channel = i => {
        const upper = pixels[a+i]*(1-dx)+pixels[b+i]*dx;
        const lower = pixels[c+i]*(1-dx)+pixels[d+i]*dx;
        return clamp(Math.round((upper*(1-dy)+lower*dy)*strength),0,255);
      };
      return [channel(0),channel(1),channel(2)];
    },
  };
}
