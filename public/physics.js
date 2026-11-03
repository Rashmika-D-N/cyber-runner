export const STEP=1/120;
export function jumpHeight(time,start,duration){const u=(time-start)/duration;return u>0&&u<1?6.4*u*(1-u):0;}
export function playerHeight(duck){return duck?1.05:2.05;}
// Depth is swept across each fixed step; lateral position is the moving body, not target lane.
export function hitsObstacle(o,previousZ,x,y,duck){
 const depth=o.type==='block'?.75:.2;
 if(Math.min(previousZ,o.z)>8+depth+.3||Math.max(previousZ,o.z)<8-depth-.3)return false;
 const dx=Math.abs(x-o.lane*3);if(dx>1.2+.28)return false;
 const top=y+playerHeight(duck);
 if(o.type==='block')return y<1.65&&top>0;
 if(dx>.82&&y<(o.type==='duck'?1.65:.86))return true;
 const lo=o.type==='duck'?1.44:.65,hi=o.type==='duck'?1.86:1.07;
 return y<hi&&top>lo;
}
