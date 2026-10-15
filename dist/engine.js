export const angleDiff=(a,b)=>((a-b+540)%360)-180;
export function measure(l,w,h,m){
 const p=i=>({x:l[i].x*w,y:l[i].y*h});const d=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 const ear=ids=>{let a=ids.map(p);return (d(a[1],a[5])+d(a[2],a[4]))/(2*d(a[0],a[3]))};
 // Project onto the eye's local horizontal/vertical axes, so roll does not redefine gaze.
 const iris=(i,a,b,top,bottom)=>{let A=p(a),B=p(b),I=p(i),T=p(top),D=p(bottom);let vx=B.x-A.x,vy=B.y-A.y,den=vx*vx+vy*vy;let nx=-vy,ny=vx;let height=(D.x-T.x)*nx+(D.y-T.y)*ny;return {x:((I.x-A.x)*vx+(I.y-A.y)*vy)/den,y:((I.x-T.x)*nx+(I.y-T.y)*ny)/height}};
 const a=iris(468,33,133,159,145),b=iris(473,362,263,386,374);
 const pose=m?{yaw:Math.atan2(-m[2],Math.hypot(m[0],m[1]))*180/Math.PI,pitch:Math.atan2(m[6],m[10])*180/Math.PI,roll:Math.atan2(m[1],m[0])*180/Math.PI}:null;
 return {ear:(ear([33,160,158,133,153,144])+ear([362,385,387,263,373,380]))/2,irisX:(a.x+b.x)/2,irisY:(a.y+b.y)/2,pose};
}
export function csv(rows){return '\ufeff'+rows.map(row=>row.map(v=>{const s=typeof v==='string'?v.replace(/^([=+@\-])/ ,"'$1"):String(v??'');return '"'+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
