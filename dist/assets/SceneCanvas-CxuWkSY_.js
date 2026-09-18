import{C as e,E as t,S as n,_ as r,a as i,b as a,c as o,d as s,f as c,g as l,h as u,i as d,l as f,m as p,o as m,p as h,r as g,s as _,t as v,u as y,v as b,x,y as S}from"./index-BPCK-0Sr.js";import{K as C,N as w,P as T,k as E,mo as D,no as O,or as k,ro as A,sr as j,t as M,tn as N}from"./manifest-619viu1t.js";import{_ as ee,a as te,c as ne,d as re,f as P,g as ie,h as F,i as ae,l as oe,m as se,n as ce,o as le,p as ue,r as de,s as fe,u as pe}from"./loaders-CZrfr52g.js";var I=t(e(),1);function me(e,t){let n;return(...r)=>{window.clearTimeout(n),n=window.setTimeout(()=>e(...r),t)}}function he({debounce:e,scroll:t,polyfill:n,offsetSize:r}={debounce:0,scroll:!1,offsetSize:!1}){let i=n||(typeof window>`u`?class{}:window.ResizeObserver);if(!i)throw Error(`This browser does not support ResizeObserver out of the box. See: https://github.com/react-spring/react-use-measure/#resize-observer-polyfills`);let[a,o]=(0,I.useState)({left:0,top:0,width:0,height:0,bottom:0,right:0,x:0,y:0}),s=(0,I.useRef)({element:null,scrollContainers:null,resizeObserver:null,lastBounds:a,orientationHandler:null}),c=e?typeof e==`number`?e:e.scroll:null,l=e?typeof e==`number`?e:e.resize:null,u=(0,I.useRef)(!1);(0,I.useEffect)(()=>(u.current=!0,()=>void(u.current=!1)));let[d,f,p]=(0,I.useMemo)(()=>{let e=()=>{if(!s.current.element)return;let{left:e,top:t,width:n,height:i,bottom:a,right:c,x:l,y:d}=s.current.element.getBoundingClientRect(),f={left:e,top:t,width:n,height:i,bottom:a,right:c,x:l,y:d};s.current.element instanceof HTMLElement&&r&&(f.height=s.current.element.offsetHeight,f.width=s.current.element.offsetWidth),Object.freeze(f),u.current&&!be(s.current.lastBounds,f)&&o(s.current.lastBounds=f)};return[e,l?me(e,l):e,c?me(e,c):e]},[o,r,c,l]);function m(){s.current.scrollContainers&&(s.current.scrollContainers.forEach(e=>e.removeEventListener(`scroll`,p,!0)),s.current.scrollContainers=null),s.current.resizeObserver&&(s.current.resizeObserver.disconnect(),s.current.resizeObserver=null),s.current.orientationHandler&&(`orientation`in screen&&`removeEventListener`in screen.orientation?screen.orientation.removeEventListener(`change`,s.current.orientationHandler):`onorientationchange`in window&&window.removeEventListener(`orientationchange`,s.current.orientationHandler))}function h(){s.current.element&&(s.current.resizeObserver=new i(p),s.current.resizeObserver.observe(s.current.element),t&&s.current.scrollContainers&&s.current.scrollContainers.forEach(e=>e.addEventListener(`scroll`,p,{capture:!0,passive:!0})),s.current.orientationHandler=()=>{p()},`orientation`in screen&&`addEventListener`in screen.orientation?screen.orientation.addEventListener(`change`,s.current.orientationHandler):`onorientationchange`in window&&window.addEventListener(`orientationchange`,s.current.orientationHandler))}return _e(p,!!t),ge(f),(0,I.useEffect)(()=>{m(),h()},[t,p,f]),(0,I.useEffect)(()=>m,[]),[e=>{!e||e===s.current.element||(m(),s.current.element=e,s.current.scrollContainers=ve(e),h())},a,d]}function ge(e){(0,I.useEffect)(()=>{let t=e;return window.addEventListener(`resize`,t),()=>void window.removeEventListener(`resize`,t)},[e])}function _e(e,t){(0,I.useEffect)(()=>{if(t){let t=e;return window.addEventListener(`scroll`,t,{capture:!0,passive:!0}),()=>void window.removeEventListener(`scroll`,t,!0)}},[e,t])}function ve(e){let t=[];if(!e||e===document.body)return t;let{overflow:n,overflowX:r,overflowY:i}=window.getComputedStyle(e);return[n,r,i].some(e=>e===`auto`||e===`scroll`)&&t.push(e),[...t,...ve(e.parentElement)]}var ye=[`x`,`y`,`top`,`bottom`,`left`,`right`,`width`,`height`],be=(e,t)=>ye.every(n=>e[n]===t[n]),L=i();n();function xe({ref:e,children:t,fallback:n,resize:r,style:i,gl:a,events:o=le,eventSource:s,eventPrefix:c,shadows:l,linear:u,flat:d,legacy:f,orthographic:p,frameloop:m,dpr:h,performance:g,raycaster:_,camera:v,scene:y,onPointerMissed:b,onCreated:x,...S}){I.useMemo(()=>ne(ee),[]);let C=re(),[w,T]=he({scroll:!0,debounce:{scroll:50,resize:0},...r}),E=I.useRef(null),D=I.useRef(null);I.useImperativeHandle(e,()=>E.current);let O=se(b),[k,A]=I.useState(!1),[j,M]=I.useState(!1);if(k)throw k;if(j)throw j;let N=I.useRef(null);return ue(()=>{let e=E.current;if(T.width>0&&T.height>0&&e){N.current||=fe(e);async function n(){await N.current.configure({gl:a,scene:y,events:o,shadows:l,linear:u,flat:d,legacy:f,orthographic:p,frameloop:m,dpr:h,performance:g,raycaster:_,camera:v,size:T,onPointerMissed:(...e)=>O.current==null?void 0:O.current(...e),onCreated:e=>{e.events.connect==null||e.events.connect(s?oe(s)?s.current:s:D.current),c&&e.setEvents({compute:(e,t)=>{let n=e[c+`X`],r=e[c+`Y`];t.pointer.set(n/t.size.width*2-1,-(r/t.size.height)*2+1),t.raycaster.setFromCamera(t.pointer,t.camera)}}),x?.(e)}}),N.current.render((0,L.jsx)(C,{children:(0,L.jsx)(te,{set:M,children:(0,L.jsx)(I.Suspense,{fallback:(0,L.jsx)(ae,{set:A}),children:t??null})})}))}n()}}),I.useEffect(()=>{let e=E.current;if(e)return()=>pe(e)},[]),(0,L.jsx)(`div`,{ref:D,style:{position:`relative`,width:`100%`,height:`100%`,overflow:`hidden`,pointerEvents:s?`none`:`auto`,...i},...S,children:(0,L.jsx)(`div`,{ref:w,style:{width:`100%`,height:`100%`},children:(0,L.jsx)(`canvas`,{ref:E,style:{display:`block`},children:n})})})}function Se(e){return(0,L.jsx)(ie,{children:(0,L.jsx)(xe,{...e})})}var Ce=(0,I.createContext)(null);function we({iterations:e=10,ms:t=250,threshold:n=.75,step:r=.1,factor:i=.5,flipflops:a=1/0,bounds:o=e=>e>100?[60,100]:[40,60],onIncline:s,onDecline:c,onChange:l,onFallback:u,children:d}){let[f,p]=(0,I.useState)(()=>({fps:0,index:0,factor:i,flipped:0,refreshrate:0,fallback:!1,frames:[],averages:[],subscriptions:new Map,subscribe:e=>{let t=Symbol();return f.subscriptions.set(t,e.current),()=>void f.subscriptions.delete(t)}})),m=0;return P(()=>{let{frames:i,averages:d}=f;if(!f.fallback&&d.length<e){i.push(performance.now());let p=i[i.length-1]-i[0];if(p>=t){if(f.fps=Math.round(i.length/p*1e3*1)/1,f.refreshrate=Math.max(f.refreshrate,f.fps),d[f.index++%e]=f.fps,d.length===e){let[t,i]=o(f.refreshrate),p=d.filter(e=>e>=i),h=d.filter(e=>e<t);p.length>e*n&&(f.factor=Math.min(1,f.factor+r),f.flipped++,s&&s(f),f.subscriptions.forEach(e=>e.onIncline&&e.onIncline(f))),h.length>e*n&&(f.factor=Math.max(0,f.factor-r),f.flipped++,c&&c(f),f.subscriptions.forEach(e=>e.onDecline&&e.onDecline(f))),m!==f.factor&&(m=f.factor,l&&l(f),f.subscriptions.forEach(e=>e.onChange&&e.onChange(f))),f.flipped>a&&!f.fallback&&(f.fallback=!0,u&&u(f),f.subscriptions.forEach(e=>e.onFallback&&e.onFallback(f))),f.averages=[]}f.frames=[]}}}),I.createElement(Ce.Provider,{value:f},d)}var R={void:`#070908`,ink:`#EAE8E1`,cloud:`#96A79B`,accent:`#9BD07F`},Te=[{id:`plant-height`,startPoint:{x:-1.08,y:0,z:.1},endPoint:{x:-1.08,y:1,z:.1},anchor:{x:-.8,y:.96,z:.1},attachment:`clearance`,side:`right`,at:0,priority:0},{id:`leaf-length`,startPoint:{x:-.035,y:.686,z:-.117},endPoint:{x:.66,y:.701,z:-.371},anchor:{x:.78,y:.7,z:-.371},attachment:`surface`,side:`right`,at:.16,priority:1},{id:`leaf-width`,startPoint:{x:-.477,y:.413,z:-.19},endPoint:{x:-.422,y:.413,z:.119},anchor:{x:-.62,y:.3,z:-.03},attachment:`surface`,side:`left`,at:.28,priority:2},{id:`leaf-area`,startPoint:{x:.14,y:.487,z:.212},endPoint:{x:.301,y:.487,z:-.041},anchor:{x:.52,y:.6,z:.08},attachment:`surface`,side:`right`,at:.42,priority:4},{id:`leaf-angle`,startPoint:{x:-.05,y:.762,z:-.117},endPoint:{x:-.3,y:.812,z:-.22},anchor:{x:-.54,y:.88,z:-.22},attachment:`surface`,side:`left`,at:.55,priority:5},{id:`internode-distance`,startPoint:{x:-.074,y:.538,z:-.124},endPoint:{x:-.067,y:.612,z:-.096},anchor:{x:-.42,y:.575,z:-.11},attachment:`surface`,side:`left`,at:.68,priority:3},{id:`stem-diameter`,startPoint:{x:-.127,y:.22,z:-.086},endPoint:{x:-.065,y:.22,z:-.086},anchor:{x:.2,y:.2,z:-.086},attachment:`surface`,side:`right`,at:.8,priority:6}],Ee={desktop:7,mobile:4},z=Te.map(e=>({...e,...d[e.id]})).sort((e,t)=>e.at-t.at);function De(e){return Ee[e]}var B={minY:-1.92,maxY:1.92,planHalfExtent:1.55};function Oe(e){let t=1/0,n=-1/0,r=0;for(let i=0;i<e.length;i+=3){let a=e[i],o=e[i+1],s=e[i+2];o<t&&(t=o),o>n&&(n=o);let c=a<0?-a:a,l=s<0?-s:s;c>r&&(r=c),l>r&&(r=l)}return n>t?{minY:t,maxY:n,planHalfExtent:r>1e-4?r:B.planHalfExtent}:B}function V(e,t,n){n.x=e.x*t.planHalfExtent,n.y=t.minY+e.y*(t.maxY-t.minY),n.z=e.z*t.planHalfExtent}function ke(e,t){let n=(e-t*.64)/.24;return n<0?0:n>1?1:n}function Ae(e){return e.value.toFixed(e.precision)}var je=()=>({container:null,items:[],note:null}),Me=14;function Ne({handlesRef:e}){return(0,L.jsxs)(`div`,{ref:t=>{e.current.container=t},className:`annotation-layer`,style:{visibility:`hidden`},children:[z.map((t,n)=>(0,L.jsxs)(`div`,{ref:t=>{e.current.items[n]=t},className:`annotation`,style:{opacity:0},children:[(0,L.jsx)(`span`,{className:`annotation__label`,children:t.label}),(0,L.jsxs)(`span`,{className:`annotation__value`,children:[Ae(t),(0,L.jsx)(`span`,{className:`annotation__unit`,children:t.unit})]})]},t.id)),(0,L.jsx)(`div`,{ref:t=>{e.current.note=t},className:`annotation__note`,style:{opacity:0},children:g})]})}function Pe({bounds:e,breakpointRef:t,weightsRef:n,handlesRef:r}){let i=F(e=>e.camera),a=F(e=>e.size),o=(0,I.useMemo)(()=>z.map(t=>{let n=new A;return V(t.anchor,e,n),n}),[e]),s=(0,I.useRef)(new A);return P(()=>{let e=r.current,c=e.container;if(!c)return;let l=n.current.phenotype,u=l>.001?`visible`:`hidden`;if(c.style.visibility!==u&&(c.style.visibility=u),u===`hidden`)return;let d=De(t.current),f=a.width/2,p=a.height/2,m=0;for(let t=0;t<z.length;t++){let n=e.items[t];if(!n)continue;let r=z[t],a=r.priority<d?ke(l,r.at):0,c=S(.86,1,a);if(c<.004){n.style.opacity!==`0`&&(n.style.opacity=`0`);continue}let u=s.current.copy(o[t]).project(i);if(u.z>1){n.style.opacity!==`0`&&(n.style.opacity=`0`);continue}let h=f+u.x*f,g=p-u.y*p;c>m&&(m=c),n.style.opacity=c.toFixed(3),n.style.transform=r.side===`left`?`translate3d(${(h-Me).toFixed(1)}px, ${g.toFixed(1)}px, 0) translate(-100%, -50%)`:`translate3d(${(h+Me).toFixed(1)}px, ${g.toFixed(1)}px, 0) translate(0, -50%)`}let h=e.note;if(h){let e=m.toFixed(3);h.style.opacity!==e&&(h.style.opacity=e)}}),null}var H={x:1.447,y:1.6,z:1.336},Fe=.82,Ie=(()=>{let e=[];for(let t of[-1,1])for(let n of[-1,1])for(let r of[-1,1])e.push(new A(t*H.x,n*H.y,r*H.z));return e})(),Le=160,Re=new A(0,1,0),U={position:[0,0,0],target:[0,0,0]},W=new A,G=new A,ze=new A,Be=new A,Ve=new A,He=new A,K=new A,Ue=new k,We=``,Ge=1;function Ke(e,t,n){if(!(n>0)||!(t>0))return 1;let r=`${e}|${t.toFixed(2)}|${n.toFixed(4)}`;if(r===We)return Ge;let i=Fe*Math.tan(t/2*(Math.PI/180)),a=i*n,o=1;for(let t=0;t<=Le;t++){u(t/Le,e,U),G.set(U.target[0],U.target[1],U.target[2]),W.set(U.position[0],U.position[1],U.position[2]),ze.copy(W).sub(G);let n=ze.length();if(n<1e-6)continue;Ue.lookAt(W,G,Re);let r=Ue.elements;Be.set(r[0],r[1],r[2]),Ve.set(r[4],r[5],r[6]),He.set(r[8],r[9],r[10]);for(let e of Ie){K.copy(e).sub(G);let t=Math.abs(K.dot(Be)),r=Math.abs(K.dot(Ve)),s=-K.dot(He),c=(t/a-s)/n,l=(r/i-s)/n;c>o&&(o=c),l>o&&(o=l)}}return We=r,Ge=o,o}var q=new A,J=new A,Y=p();function qe(){let{stateRef:e,breakpointRef:t,reducedMotion:n}=m(),i=F(e=>e.camera),a=(0,I.useRef)(new A(0,0,0)),o=(0,I.useRef)(!1),s=(0,I.useRef)(1),c=(0,I.useRef)(0),l=(0,I.useRef)(null);return P((d,f)=>{let{camera:p}=e.current,m=Math.min(f,.05),g=t.current,_=h[g];i.fov!==_&&(i.fov=_,i.updateProjectionMatrix()),(i.aspect!==c.current||g!==l.current)&&(c.current=i.aspect,l.current=g,s.current=Ke(g,_,i.aspect)),q.set(p.position[0],p.position[1],p.position[2]),J.set(p.target[0],p.target[1],p.target[2]),n&&(u(.35,t.current,Y),q.set(Y.position[0],Y.position[1],Y.position[2]),J.set(Y.target[0],Y.target[1],Y.target[2])),s.current!==1&&q.sub(J).multiplyScalar(s.current).add(J),o.current?(i.position.x=r(i.position.x,q.x,14,m),i.position.y=r(i.position.y,q.y,14,m),i.position.z=r(i.position.z,q.z,14,m),a.current.x=r(a.current.x,J.x,14,m),a.current.y=r(a.current.y,J.y,14,m),a.current.z=r(a.current.z,J.z,14,m)):(i.position.copy(q),a.current.copy(J),o.current=!0),i.lookAt(a.current)},-900),null}var Je=class extends I.Component{state={error:null};static getDerivedStateFromError(e){return{error:e}}componentDidCatch(e,t){this.props.onError?.(e),console.error(`[assets] failed to load reconstruction — falling back to placeholder`,e,t)}render(){return this.state.error?this.props.fallback:this.props.children}};function Ye(e){let t=[],n=0;e.updateMatrixWorld(!0);let r=new A;if(e.traverse(e=>{if(!(e instanceof j))return;let i=e.geometry.getAttribute(`position`);if(!i)return;let a=new Float32Array(i.count*3);for(let t=0;t<i.count;t++)r.fromBufferAttribute(i,t).applyMatrix4(e.matrixWorld),a[t*3+0]=r.x,a[t*3+1]=r.y,a[t*3+2]=r.z;t.push(a),n+=a.length}),t.length===1)return t[0];let i=new Float32Array(n),a=0;for(let e of t)i.set(e,a),a+=e.length;return i}var Xe=class{cell;nx;ny;nz;minX;minY;minZ;start;items;points;count;constructor(e){this.points=e,this.count=e.length/3|0;let t=1/0,n=1/0,r=1/0,i=-1/0,a=-1/0,o=-1/0;for(let s=0;s<this.count;s++){let c=e[s*3],l=e[s*3+1],u=e[s*3+2];c<t&&(t=c),l<n&&(n=l),u<r&&(r=u),c>i&&(i=c),l>a&&(a=l),u>o&&(o=u)}this.minX=t,this.minY=n,this.minZ=r;let s=Math.max(i-t,a-n,o-r,1e-6),c=Math.min(96,Math.max(4,Math.round(Math.cbrt(this.count))));this.cell=s/c,this.nx=Math.max(1,Math.ceil((i-t)/this.cell)+1),this.ny=Math.max(1,Math.ceil((a-n)/this.cell)+1),this.nz=Math.max(1,Math.ceil((o-r)/this.cell)+1);let l=this.nx*this.ny*this.nz,u=new Int32Array(l+1),d=new Int32Array(this.count);for(let t=0;t<this.count;t++){let n=this.bucket(e[t*3],e[t*3+1],e[t*3+2]);d[t]=n,u[n+1]++}for(let e=0;e<l;e++)u[e+1]+=u[e];this.start=u,this.items=new Int32Array(this.count);let f=u.slice(0,l);for(let e=0;e<this.count;e++)this.items[f[d[e]]++]=e}clampAxis(e,t){return e<0?0:e>=t?t-1:e}bucket(e,t,n){let r=this.clampAxis(Math.floor((e-this.minX)/this.cell),this.nx),i=this.clampAxis(Math.floor((t-this.minY)/this.cell),this.ny),a=this.clampAxis(Math.floor((n-this.minZ)/this.cell),this.nz);return r+this.nx*(i+this.ny*a)}nearest(e,t,n){if(this.count===0)return-1;let r=this.clampAxis(Math.floor((e-this.minX)/this.cell),this.nx),i=this.clampAxis(Math.floor((t-this.minY)/this.cell),this.ny),a=this.clampAxis(Math.floor((n-this.minZ)/this.cell),this.nz),o=Math.max(this.nx,this.ny,this.nz),s=-1,c=1/0;for(let l=0;l<=o;l++){if(s>=0){let e=(l-1)*this.cell;if(e>0&&e*e>c)break}for(let o=-l;o<=l;o++){let u=a+o;if(!(u<0||u>=this.nz))for(let a=-l;a<=l;a++){let d=i+a;if(d<0||d>=this.ny)continue;let f=Math.abs(o)===l||Math.abs(a)===l;for(let i=-l;i<=l;i++){if(!f&&Math.abs(i)!==l)continue;let a=r+i;if(a<0||a>=this.nx)continue;let o=a+this.nx*(d+this.ny*u),p=this.start[o],m=this.start[o+1];for(let r=p;r<m;r++){let i=this.items[r],a=this.points[i*3]-e,o=this.points[i*3+1]-t,l=this.points[i*3+2]-n,u=a*a+o*o+l*l;u<c&&(c=u,s=i)}}}}}return s}};function Ze(e,t){let n=e.length/3|0,r=new Float32Array(e.length);if(t.length===0)return r.set(e),{positions:r,meanTravel:0,maxTravel:0};let i=new Xe(t),a=0,o=0;for(let s=0;s<n;s++){let n=e[s*3],c=e[s*3+1],l=e[s*3+2],u=i.nearest(n,c,l),d=t[u*3],f=t[u*3+1],p=t[u*3+2];r[s*3+0]=d,r[s*3+1]=f,r[s*3+2]=p;let m=Math.hypot(d-n,f-c,p-l);a+=m,m>o&&(o=m)}return{positions:r,meanTravel:n>0?a/n:0,maxTravel:o}}function Qe(e,t){let n=[],r=[];e.updateMatrixWorld(!0);let i=new A;e.traverse(e=>{if(!(e instanceof j))return;let t=e.geometry.getAttribute(`position`);if(!t)return;let a=e.geometry.getIndex(),o=a?a.count/3:t.count/3,s=t.count,c=new Set,l=new Float32Array(s*3);for(let n=0;n<s;n++)i.fromBufferAttribute(t,n).applyMatrix4(e.matrixWorld),l[n*3+0]=i.x,l[n*3+1]=i.y,l[n*3+2]=i.z;let u=(e,t)=>{let i=e<t?e:t,a=e<t?t:e,o=i*s+a;c.has(o)||(c.add(o),n.push(l[i*3],l[i*3+1],l[i*3+2]),r.push(l[a*3],l[a*3+1],l[a*3+2]))};for(let e=0;e<o;e++){let t=a?a.getX(e*3):e*3,n=a?a.getX(e*3+1):e*3+1,r=a?a.getX(e*3+2):e*3+2;u(t,n),u(n,r),u(r,t)}});let a=n.length/3|0,o=t&&a>t?Math.ceil(a/t):1,s=o===1?a:Math.floor((a+o-1)/o),c=new Float32Array(s*2*3),l=new Float32Array(s*2*3),u=new Float32Array(s*2),d=1/0,f=-1/0;for(let e=0,t=0;e<s;e++,t+=o){let e=(n[t*3+1]+r[t*3+1])*.5;e<d&&(d=e),e>f&&(f=e)}let p=f-d>1e-6?f-d:1;for(let e=0,t=0;e<s;e++,t+=o){let i=n[t*3],a=n[t*3+1],o=n[t*3+2],s=r[t*3],f=r[t*3+1],m=r[t*3+2];c[e*6+0]=i,c[e*6+1]=a,c[e*6+2]=o,c[e*6+3]=s,c[e*6+4]=f,c[e*6+5]=m,l[e*6+0]=i,l[e*6+1]=a,l[e*6+2]=o,l[e*6+3]=i,l[e*6+4]=a,l[e*6+5]=o;let h=((a+f)*.5-d)/p;u[e*2+0]=h,u[e*2+1]=h}let m=new T;return m.setAttribute(`position`,new w(c,3)),m.setAttribute(`aOther`,new w(l,3)),m.setAttribute(`aReveal`,new w(u,1)),m.computeBoundingSphere(),{geometry:m,segments:s,sourceSegments:a}}var $e=()=>({cloudOpacity:0,reveal:0,scan:0,rigAngle:0,rigOpacity:0,tiePoints:0,snap:0,vertexEmphasis:0,drift:1,wireBuild:0,wireOpacity:0,surface:0,finalPlant:0,phenotype:0});function et(e,t){let n=l(e),r=c(`scan`,n),i=c(`rig`,n),a=y(n),u=s(n),d=o(n),p=f(n),m=_(n);t.cloudOpacity=(.4+.22*r+.38*a)*(1-.8*p)*(1-.55*m),t.reveal=a,t.scan=r,t.rigAngle=i;let h=S(0,.25,i);return t.rigOpacity=(.32+.68*h)*(1-a),t.tiePoints=h*(1-a),t.snap=u,t.vertexEmphasis=u*(1-.65*p),t.drift=1-.92*u,t.wireBuild=d,t.wireOpacity=d*(1-.72*p)*(1-.75*m),t.surface=p,t.finalPlant=m,t.phenotype=c(`phenotype`,n),t}var tt=Math.PI/2,X=e=>(e-.5)*Math.PI*2+tt,nt=(e,t)=>{let n=X(e);t.x=Math.sin(n),t.z=Math.cos(n)},rt=(e,t)=>{let n=(Math.atan2(e,t)-tt)/(Math.PI*2)+.5;return n-Math.floor(n)},it=`
  uniform float uHead;
  /** 1 → orbit path (trail behind the rig), 0 → frustum ray (fade along it). */
  uniform float uTrail;

  attribute float aAt;

  varying float vAlpha;
  varying float vHead;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    float since = uHead - aAt;

    // The orbit path states three things at once, which is the most a single
    // faint line can carry: where the rig will go (base), where it has been
    // (trail), and where it is (head).
    float travelled = smoothstep(0.0, 0.008, since);
    float head = exp(-max(since, 0.0) * 38.0) * travelled;
    float ring = 0.22 + 0.42 * travelled + 0.9 * head;

    // Frustum rays fade away from the sensor, so the lines are densest at the
    // apparatus and dissolve before they arrive at the specimen. A ray of even
    // brightness terminating in mid-air looks like an unfinished line; one that
    // fades looks like the edge of a field of view, which is what it is.
    float ray = 1.0 - 0.82 * aAt;

    vAlpha = mix(ray, ring, uTrail);
    vHead = head;
  }
`,at=`
  uniform vec3 uColor;
  uniform vec3 uHeadColor;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vHead;

  void main() {
    // Accent only at the head of the traverse, and only there. This palette has
    // exactly one saturated colour and spending it on the whole instrument would
    // make the instrument the subject.
    vec3 color = mix(uColor, uHeadColor, vHead * 0.85);
    float alpha = uOpacity * vAlpha;
    if (alpha < 0.004) discard;
    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`,ot=`
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxPixelSize;
  uniform float uHead;
  /** Width of the capture flash, in traverse units. */
  uniform float uFlashWidth;

  attribute float aAt;

  varying float vLit;
  varying float vFlash;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    float since = uHead - aAt;

    // Soft over ~1% of the traverse rather than a hard step: at 720 tie points
    // a true step pops them in one at a time as a visible stutter, and the
    // sub-pixel aliasing on a 3 px mark appearing instantly is worse than the
    // pop itself.
    vLit = smoothstep(0.0, 0.010, since);
    vFlash = exp(-max(since, 0.0) / max(uFlashWidth, 0.0001)) * vLit;

    // Attenuated like the point cloud, so the marks sit *in* the volume rather
    // than floating on the glass in front of it. Constant screen size was the
    // first thing I tried and it reads as an overlay drawn on the image, which
    // is exactly the game-HUD failure this is trying to avoid.
    float depth = max(-mv.z, 0.001);
    gl_PointSize = min(
      uSize * uPixelRatio * (1.0 + 0.85 * vFlash) / depth,
      uMaxPixelSize * uPixelRatio
    );
  }
`,st=`
  uniform vec3 uColor;
  uniform vec3 uFlashColor;
  uniform float uOpacity;

  varying float vLit;
  varying float vFlash;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;

    // Square, and that is load-bearing. The point cloud's raw returns are soft
    // round blobs because that is what an unresolved sensor return looks like.
    // These are the opposite thing — discrete, located, recorded readings — and
    // a crisp square is how measurement reads. Using the same soft disc for
    // both would collapse the distinction the beat exists to draw.
    float r = max(abs(uv.x), abs(uv.y));
    float mask = 1.0 - smoothstep(0.32, 0.5, r);

    vec3 color = mix(uColor, uFlashColor, vFlash * 0.9);
    float alpha = uOpacity * mask * vLit * (1.0 + 2.4 * vFlash);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`,ct=new A(0,0,0);function lt({config:e,dpr:t,weightsRef:n}){let r=(0,I.useRef)(null),i=(0,I.useRef)(null),a=(0,I.useRef)(null),o=(0,I.useRef)(null),s=(0,I.useRef)(null),c=(0,I.useMemo)(()=>{let t=new Float32Array(579),n=new Float32Array(193);for(let r=0;r<=192;r++){let i=r/192,a=X(i);t[r*3]=Math.sin(a)*e.orbitRadius,t[r*3+1]=e.orbitHeight,t[r*3+2]=Math.cos(a)*e.orbitRadius,n[r]=i}let r=new Uint16Array(384);for(let e=0;e<192;e++)r[e*2]=e,r[e*2+1]=e+1;let i=new T;return i.setAttribute(`position`,new w(t,3)),i.setAttribute(`aAt`,new w(n,1)),i.setIndex(new w(r,1)),i},[e.orbitRadius,e.orbitHeight]),l=(0,I.useMemo)(()=>{let t=e.stations,n=new Float32Array(t*3),r=new Float32Array(t);for(let i=0;i<t;i++){let a=i/t,o=X(a);n[i*3]=Math.sin(o)*e.orbitRadius,n[i*3+1]=e.orbitHeight,n[i*3+2]=Math.cos(o)*e.orbitRadius,r[i]=a}let i=new T;return i.setAttribute(`position`,new w(n,3)),i.setAttribute(`aAt`,new w(r,1)),i},[e.stations,e.orbitRadius,e.orbitHeight]),u=(0,I.useMemo)(()=>{let t=e.orbitRadius*e.frustumReach,n=t*.27,r=t*.36,i=[[0,0,0],[-n,-r,t],[n,-r,t],[n,r,t],[-n,r,t]],a=[0,1,1,1,1],o=[[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]],s=new Float32Array(i.length*3);i.forEach((e,t)=>s.set(e,t*3));let c=new Uint16Array(o.length*2);o.forEach((e,t)=>{c[t*2]=e[0],c[t*2+1]=e[1]});let l=new T;return l.setAttribute(`position`,new w(s,3)),l.setAttribute(`aAt`,new w(new Float32Array(a),1)),l.setIndex(new w(c,1)),l},[e.orbitRadius,e.frustumReach]);(0,I.useEffect)(()=>()=>{c.dispose(),l.dispose(),u.dispose()},[c,l,u]);let d=(0,I.useMemo)(()=>({uHead:{value:0},uTrail:{value:1},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uHeadColor:{value:new C(R.accent)}}),[]),f=(0,I.useMemo)(()=>({uHead:{value:0},uTrail:{value:0},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uHeadColor:{value:new C(R.accent)}}),[]),p=(0,I.useMemo)(()=>({uSize:{value:e.stationSize},uPixelRatio:{value:t},uMaxPixelSize:{value:9},uHead:{value:0},uFlashWidth:{value:.045},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uFlashColor:{value:new C(R.accent)}}),[]);return P(()=>{let c=n.current,l=r.current;if(!l)return;let u=c.rigOpacity>.004;if(l.visible=u,!u)return;let d=c.rigAngle;if(a.current&&(a.current.uniforms.uHead.value=d,a.current.uniforms.uOpacity.value=e.ringOpacity*c.rigOpacity),o.current&&(o.current.uniforms.uHead.value=d,o.current.uniforms.uOpacity.value=e.frustumOpacity*c.rigOpacity),s.current){let n=s.current.uniforms;n.uHead.value=d,n.uOpacity.value=c.rigOpacity,n.uSize.value=e.stationSize,n.uPixelRatio.value=t}let f=i.current;if(f){let t=X(d);f.position.set(Math.sin(t)*e.orbitRadius,e.orbitHeight,Math.cos(t)*e.orbitRadius),f.lookAt(ct)}}),(0,L.jsxs)(`group`,{ref:r,visible:!1,children:[(0,L.jsx)(`lineSegments`,{geometry:c,frustumCulled:!1,renderOrder:0,children:(0,L.jsx)(`shaderMaterial`,{ref:a,uniforms:d,vertexShader:it,fragmentShader:at,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})}),(0,L.jsx)(`points`,{geometry:l,frustumCulled:!1,renderOrder:0,children:(0,L.jsx)(`shaderMaterial`,{ref:s,uniforms:p,vertexShader:ot,fragmentShader:st,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})}),(0,L.jsx)(`group`,{ref:i,children:(0,L.jsx)(`lineSegments`,{geometry:u,frustumCulled:!1,renderOrder:0,children:(0,L.jsx)(`shaderMaterial`,{ref:o,uniforms:f,vertexShader:it,fragmentShader:at,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})})})]})}function ut({object:e,config:t,weightsRef:n}){let r=(0,I.useRef)(null),i=(0,I.useRef)(null),a=(0,I.useRef)(null),o=(0,I.useMemo)(()=>({uSurface:{value:0},uRevealSoftness:{value:t.revealSoftness},uFrontGlow:{value:t.frontGlow},uMeshOpacity:{value:0},uFinal:{value:0},uFrontColor:{value:new C(R.accent)},uBaseY:{value:0},uSpanY:{value:1}}),[]),s=(0,I.useMemo)(()=>{let t=new E().setFromObject(e),n=t.getSize(new A);o.uBaseY.value=t.min.y,o.uSpanY.value=n.y>1e-6?n.y:1;let r=[];return e.traverse(e=>{if(!(e instanceof j))return;e.castShadow=!1,e.receiveShadow=!1,e.renderOrder=0;let t=(Array.isArray(e.material)?e.material:[e.material]).map(e=>{let t=e.clone();return t.transparent=!0,t.depthWrite=!0,t.onBeforeCompile=e=>{Object.assign(e.uniforms,o),e.vertexShader=e.vertexShader.replace(`#include <common>`,`
                #include <common>
                uniform float uBaseY;
                uniform float uSpanY;
                varying float vHeight01;
              `).replace(`#include <project_vertex>`,`
                #include <project_vertex>
                vec4 revealWorld = modelMatrix * vec4(transformed, 1.0);
                vHeight01 = (revealWorld.y - uBaseY) / uSpanY;
              `),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`
                #include <common>
                uniform float uSurface;
                uniform float uRevealSoftness;
                uniform float uFrontGlow;
                uniform float uMeshOpacity;
                uniform float uFinal;
                uniform vec3 uFrontColor;
                varying float vHeight01;
              `).replace(`#include <clipping_planes_fragment>`,`
                #include <clipping_planes_fragment>
                // Endpoints chosen so the front starts fully below the mesh and
                // finishes fully above it for any softness value.
                float revealEdge = mix(-uRevealSoftness * 0.05, 1.0 + uRevealSoftness, uSurface);
                float revealed = 1.0 - smoothstep(revealEdge - uRevealSoftness, revealEdge, vHeight01);
                if (revealed < 0.012) discard;
              `).replace(`#include <opaque_fragment>`,`
                #include <opaque_fragment>

                // A band riding the reveal front — the surface knitting itself
                // shut. Gone by the final stage, when the plant should read as a
                // plant and not as a process.
                float revealBand = revealed * (1.0 - revealed) * 4.0;
                gl_FragColor.rgb += uFrontColor * revealBand * uFrontGlow * 0.55 * (1.0 - uFinal);

                // There was an additive Fresnel rim here, in the accent hue,
                // fading in with the final stage. Removed. There is already a
                // real rim light doing that job from behind the specimen, and a
                // physical light wrapping a real normal beats a constant-colour
                // edge term that ignores where the light actually is. Two rims
                // doing one job is how a scene starts looking like an effects
                // demo rather than a photograph.

                gl_FragColor.a *= revealed * uMeshOpacity;
              `)},t.needsUpdate=!0,t});e.material=Array.isArray(e.material)?t:t[0],r.push(...t)}),r},[e,o]);return(0,I.useEffect)(()=>()=>{for(let e of s)e.dispose()},[s]),P(()=>{let e=r.current;if(!e)return;let c=n.current,l=t.opacity*c.surface;if(e.visible=c.surface>.001,e.visible){o.uSurface.value=c.surface,o.uMeshOpacity.value=l,o.uFinal.value=c.finalPlant,o.uRevealSoftness.value=t.revealSoftness,o.uFrontGlow.value=t.frontGlow;for(let e of s)e.wireframe=t.wireframe,e.roughness=b(t.roughnessFrom,t.roughnessTo,c.finalPlant),t.emissiveBoost>0&&(e.emissiveIntensity=t.emissiveBoost);i.current&&(i.current.intensity=b(.55,2.1,c.finalPlant)),a.current&&(a.current.intensity=b(.25,.85,c.finalPlant))}}),(0,L.jsxs)(`group`,{ref:r,visible:!1,children:[(0,L.jsx)(`primitive`,{object:e}),(0,L.jsx)(`ambientLight`,{intensity:.32,color:R.cloud}),(0,L.jsx)(`directionalLight`,{ref:i,position:[2.5,4,3],intensity:.55,color:R.ink}),(0,L.jsx)(`directionalLight`,{ref:a,position:[-3,1.5,-2.5],intensity:.25,color:R.cloud})]})}var dt=`
  uniform float uOpacity;

  /** This vertex's annotation reveal, 0 → 1. Written per frame from the CPU. */
  attribute float aReveal;
  /** Position along this annotation's own line, 0 → 1. */
  attribute float aSpan;

  varying float vAlpha;
  varying float vHead;

  void main() {
    // The drawing front, offset so that reveal 0 is genuinely *nothing*.
    //
    // Using aReveal directly is the obvious version and it leaks: the softness
    // below is two-sided, so at aReveal = 0 the vertex at aSpan = 0 still
    // resolves to half alpha. Six of the seven annotations sit at reveal 0 for
    // the first part of the stage, and any over the breakpoint's capacity sit
    // there for all of it — so the leak is six stray dots on the specimen at
    // the moment the pass opens, which reads as dirt on the lens. Starting the
    // front behind zero costs one multiply and makes the off state exact.
    float front = aReveal * 1.04 - 0.04;

    // The line exists up to the front and not beyond it. Without the 0.02 of
    // softness the leading vertex pops on, which at these segment counts is a
    // visible stipple crawling along the line.
    float drawn = smoothstep(front + 0.02, front - 0.02, aSpan);

    // Brightening at the drawing tip, decaying fast behind it. Not a comet
    // trail — the exponent is steep enough that a settled line carries none of
    // it, so the effect is invisible once the stage is complete.
    vHead = exp(-max(front - aSpan, 0.0) * 26.0) * step(0.001, aReveal) * (1.0 - step(0.999, aReveal));

    vAlpha = drawn * uOpacity;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`,ft=`
  uniform vec3 uColor;
  uniform vec3 uHeadColor;

  varying float vAlpha;
  varying float vHead;

  void main() {
    if (vAlpha < 0.004) discard;
    // Colour shifts toward the accent only at the tip. A whole line in the
    // accent green reads as a highlight; a line in the resting cloud colour
    // with a bright tip reads as an instrument drawing it.
    vec3 c = mix(uColor, uHeadColor, vHead * 0.8);
    gl_FragColor = vec4(c * (1.0 + 0.5 * vHead), vAlpha);
    #include <colorspace_fragment>
  }
`,pt=`
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;

  attribute float aReveal;
  /** 0 for the span's endpoints, 1 for the label anchor. */
  attribute float aKind;

  varying float vAlpha;
  varying float vKind;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;

    // Endpoint markers land as their line arrives; the anchor marker waits
    // until the line has actually reached it. A marker that appears before the
    // line connects to it reads as an unrelated dot.
    float gate = mix(smoothstep(0.0, 0.12, aReveal), smoothstep(0.86, 1.0, aReveal), aKind);
    vAlpha = gate * uOpacity;
    vKind = aKind;

    // Constant screen size, not attenuated. These are annotation, not part of
    // the specimen — a tick that shrinks with distance reads as an object in
    // the scene rather than a mark on the drawing.
    gl_PointSize = uSize * uPixelRatio;
  }
`,mt=`
  uniform vec3 uColor;
  uniform vec3 uAnchorColor;

  varying float vAlpha;
  varying float vKind;

  void main() {
    if (vAlpha < 0.004) discard;

    vec2 uv = gl_PointCoord - 0.5;

    // Square, matching the capture rig's tie points. That vocabulary was
    // established earlier in the sequence — square means "a discrete recorded
    // reading" as against the point cloud's soft round sensor returns — and a
    // measurement endpoint is exactly that, so it reuses the shape rather than
    // introducing a third one.
    float r = max(abs(uv.x), abs(uv.y));

    // Endpoints are hollow, the label anchor is solid. One bit of information,
    // no extra geometry: a caliper's jaws are not the same mark as the point
    // the reading is written at.
    float mask = 1.0 - smoothstep(0.30, 0.46, r);
    float hollow = smoothstep(0.14, 0.24, r);
    mask *= mix(hollow, 1.0, vKind);

    if (mask < 0.01) discard;

    vec3 c = mix(uColor, uAnchorColor, vKind);
    gl_FragColor = vec4(c, mask * vAlpha);
    #include <colorspace_fragment>
  }
`,Z=20,Q=6,$=.62;function ht({bounds:e,breakpointRef:t,dpr:n,weightsRef:r}){let i=(0,I.useRef)(null),a=(0,I.useRef)(null),o=(0,I.useRef)(null),s=z,c=(0,I.useMemo)(()=>{let t=s.length*32,n=new Float32Array(t*3),r=new Float32Array(t),i=new Float32Array(t),a=[],o=new A,c=new A,l=new A,u=new A,d=new A,f=new A(0,1,0),p=new A,m=e.planHalfExtent*.045;s.forEach((t,i)=>{let s=i*32;V(t.startPoint,e,o),V(t.endPoint,e,c),V(t.anchor,e,l),u.subVectors(c,o);let h=u.length();h>1e-6&&u.multiplyScalar(1/h),d.crossVectors(u,f),d.lengthSq()<1e-8&&d.set(1,0,0),d.normalize().multiplyScalar(m);let g=s;for(let e=0;e<=Z;e++){let t=e/Z;p.lerpVectors(o,c,t),n[s*3]=p.x,n[s*3+1]=p.y,n[s*3+2]=p.z,r[s]=t*$,s++}for(let e=0;e<Z;e++)a.push(g+e,g+e+1);let _=s;for(let[e,t]of[[o,0],[c,$]])for(let i of[-1,1])n[s*3]=e.x+d.x*i,n[s*3+1]=e.y+d.y*i,n[s*3+2]=e.z+d.z*i,r[s]=t,s++;a.push(_,_+1,_+2,_+3);let v=gt(o,c,l);p.lerpVectors(o,c,v);let y=s;for(let e=0;e<=Q;e++){let t=e/Q;n[s*3]=p.x+(l.x-p.x)*t,n[s*3+1]=p.y+(l.y-p.y)*t,n[s*3+2]=p.z+(l.z-p.z)*t,r[s]=$+t*.38,s++}for(let e=0;e<Q;e++)a.push(y+e,y+e+1)});let h=new T;return h.setAttribute(`position`,new w(n,3)),h.setAttribute(`aSpan`,new w(r,1)),h.setAttribute(`aReveal`,new w(i,1)),h.setIndex(a),{geometry:h,perAnnotation:32,revealAttr:h.getAttribute(`aReveal`)}},[s,e]),l=(0,I.useMemo)(()=>{let t=s.length*3,n=new Float32Array(t*3),r=new Float32Array(t),i=new Float32Array(t),a=new A;s.forEach((t,i)=>{[t.startPoint,t.endPoint,t.anchor].forEach((t,o)=>{let s=i*3+o;V(t,e,a),n[s*3]=a.x,n[s*3+1]=a.y,n[s*3+2]=a.z,r[s]=+(o===2)})});let o=new T;return o.setAttribute(`position`,new w(n,3)),o.setAttribute(`aKind`,new w(r,1)),o.setAttribute(`aReveal`,new w(i,1)),{geometry:o,revealAttr:o.getAttribute(`aReveal`)}},[s,e]);(0,I.useEffect)(()=>()=>{c.geometry.dispose(),l.geometry.dispose()},[c,l]);let u=(0,I.useMemo)(()=>({uOpacity:{value:0},uColor:{value:new C(R.cloud)},uHeadColor:{value:new C(R.accent)}}),[]),d=(0,I.useMemo)(()=>({uSize:{value:7},uPixelRatio:{value:n},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uAnchorColor:{value:new C(R.accent)}}),[]);return P(()=>{let e=i.current;if(!e)return;let u=r.current.phenotype,d=u>.001;if(e.visible=d,!d)return;let f=c.revealAttr,p=l.revealAttr,m=c.perAnnotation,h=De(t.current);for(let e=0;e<s.length;e++){let t=s[e],n=t.priority<h?ke(u,t.at):0,r=e*m;for(let e=0;e<m;e++)f.array[r+e]=n;let i=e*3;p.array[i]=n,p.array[i+1]=n,p.array[i+2]=n}f.needsUpdate=!0,p.needsUpdate=!0,a.current&&(a.current.uniforms.uOpacity.value=.78),o.current&&(o.current.uniforms.uOpacity.value=.9,o.current.uniforms.uPixelRatio.value=n)}),(0,L.jsxs)(`group`,{ref:i,visible:!1,children:[(0,L.jsx)(`lineSegments`,{geometry:c.geometry,frustumCulled:!1,renderOrder:3,children:(0,L.jsx)(`shaderMaterial`,{ref:a,uniforms:u,vertexShader:dt,fragmentShader:ft,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})}),(0,L.jsx)(`points`,{geometry:l.geometry,frustumCulled:!1,renderOrder:3,children:(0,L.jsx)(`shaderMaterial`,{ref:o,uniforms:d,vertexShader:pt,fragmentShader:mt,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})})]})}function gt(e,t,n){let r=t.x-e.x,i=t.y-e.y,a=t.z-e.z,o=r*r+i*i+a*a;if(o<1e-9)return 0;let s=((n.x-e.x)*r+(n.y-e.y)*i+(n.z-e.z)*a)/o;return s<0?0:s>1?1:s}var _t=`
  uniform float uTime;
  uniform float uScan;
  uniform float uPointCloud;
  uniform float uMesh;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uDrift;

  attribute vec3 aScatter;
  attribute float aRevealOrder;
  attribute float aSeed;

  varying float vScan;
  varying float vSeed;
  varying float vDepth;

  void main() {
    // Staggered cohesion: lower samples settle first, so the cloud gathers
    // from the base upward rather than snapping together uniformly.
    float stagger = clamp((uPointCloud * 1.35) - aRevealOrder * 0.35, 0.0, 1.0);
    float cohere = stagger * stagger * (3.0 - 2.0 * stagger);

    vec3 pos = mix(aScatter, position, cohere);

    float driftAmount = (1.0 - cohere * 0.75) * uDrift;
    pos.x += sin(uTime * 0.35 + aSeed * 12.566) * 0.045 * driftAmount;
    pos.y += cos(uTime * 0.29 + aSeed * 9.424) * 0.045 * driftAmount;
    pos.z += sin(uTime * 0.31 + aSeed * 7.853) * 0.045 * driftAmount;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;

    // Sensor sweep: a plane travelling base → apex across the specimen.
    float sweepY = mix(-2.0, 2.0, uScan);
    float band = 1.0 - smoothstep(0.0, 0.30, abs(pos.y - sweepY));
    // NB: 'active' is a reserved word in GLSL ES — do not rename this back.
    float sweepActive = step(0.001, uScan) * (1.0 - step(0.999, uScan));
    vScan = band * sweepActive * (1.0 - uMesh);

    vSeed = aSeed;
    vDepth = -mv.z;

    // Only a mild shrink as the surface closes — at 0.55 the specimen faded to
    // nothing by the end of the page.
    float shrink = mix(1.0, 0.82, uMesh);
    gl_PointSize = uSize * uPixelRatio * shrink * (0.55 + 0.45 * aSeed) / max(vDepth, 0.001);
  }
`,vt=`
  uniform vec3 uColorBase;
  uniform vec3 uColorAccent;
  uniform float uPhenotype;
  uniform float uOpacity;

  varying float vScan;
  varying float vSeed;
  varying float vDepth;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d = dot(uv, uv);
    if (d > 0.25) discard;

    float alpha = 1.0 - smoothstep(0.03, 0.25, d);

    vec3 color = mix(uColorBase, uColorAccent, uPhenotype * 0.85);
    color = mix(color, vec3(1.0), vScan * 0.9);

    float depthFade = 1.0 - smoothstep(3.5, 12.0, vDepth);
    alpha *= (0.38 + 0.62 * vSeed) * (0.42 + 0.58 * depthFade) * uOpacity;
    alpha += vScan * 0.35;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`,yt=Math.PI*(3-Math.sqrt(5));function bt(e){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=Math.imul(t^t>>>15,1|t);return e=e+Math.imul(e^e>>>7,61|e)^e,((e^e>>>14)>>>0)/4294967296}}function xt(e){let t=bt(20260831),n=new Float32Array(e*3),r=new Float32Array(e*3),i=new Float32Array(e),a=new Float32Array(e);for(let o=0;o<e;o++){let s=1-o/(e-1)*2,c=Math.sqrt(Math.max(0,1-s*s)),l=o*yt,u=Math.cos(l)*c,d=Math.sin(l)*c,f=1.3*(1+(.1*Math.sin(3.1*u+1.7)*Math.cos(2.3*s-.4)+.055*Math.sin(4.7*d+2.1)+.03*Math.cos(6.2*s+.9))),p=1+(t()-.5)*.035,m=s*f*1.24*p;n[o*3+0]=u*f*p,n[o*3+1]=m,n[o*3+2]=d*f*p;let h=1+t()**2.2*.95,g=t()*Math.PI*2,_=Math.acos(2*t()-1),v=t()**1.6*.6;r[o*3+0]=u*f*p*h+Math.sin(_)*Math.cos(g)*v,r[o*3+1]=m*h+Math.cos(_)*v,r[o*3+2]=d*f*p*h+Math.sin(_)*Math.sin(g)*v,i[o]=Math.min(1,Math.max(0,m/3.1+.5+(t()-.5)*.08)),a[o]=t()}let o=new T;return o.setAttribute(`position`,new w(n,3)),o.setAttribute(`aScatter`,new w(r,3)),o.setAttribute(`aRevealOrder`,new w(i,1)),o.setAttribute(`aSeed`,new w(a,1)),o}function St({pointCount:e,pointSize:t,dpr:n}){let{stateRef:r,reducedMotion:i}=m(),a=(0,I.useRef)(null),o=(0,I.useRef)(null),s=(0,I.useRef)(0),c=(0,I.useMemo)(()=>xt(e),[e]),l=(0,I.useMemo)(()=>{let e=new N(1.62,2),t=new D(e);return e.dispose(),t},[]),u=(0,I.useMemo)(()=>({uTime:{value:0},uScan:{value:0},uPointCloud:{value:0},uMesh:{value:0},uPhenotype:{value:0},uSize:{value:t},uPixelRatio:{value:n},uDrift:{value:1},uOpacity:{value:1},uColorBase:{value:new C(R.cloud)},uColorAccent:{value:new C(R.accent)}}),[]);return(0,I.useEffect)(()=>()=>{c.dispose(),l.dispose()},[c,l]),P((e,c)=>{let l=r.current;s.current+=Math.min(c,.05);let u=a.current?.uniforms;u&&(u.uTime.value=s.current,u.uScan.value=l.scanProgress,u.uPointCloud.value=l.pointCloudProgress,u.uMesh.value=l.meshProgress,u.uPhenotype.value=l.phenotypeProgress,u.uSize.value=t,u.uPixelRatio.value=n,u.uDrift.value=+!i),o.current&&(o.current.opacity=l.geometryProgress*.17*(1-l.phenotypeProgress*.5))}),(0,L.jsxs)(`group`,{children:[(0,L.jsx)(`points`,{geometry:c,frustumCulled:!1,children:(0,L.jsx)(`shaderMaterial`,{ref:a,uniforms:u,vertexShader:_t,fragmentShader:vt,transparent:!0,depthWrite:!1,blending:2})}),(0,L.jsx)(`lineSegments`,{geometry:l,frustumCulled:!1,children:(0,L.jsx)(`lineBasicMaterial`,{ref:o,color:R.accent,transparent:!0,opacity:0,depthWrite:!1})})]})}var Ct=`
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uMaxPixelSize;
  uniform float uSparkle;

  uniform float uTime;
  uniform float uReveal;
  /** Strength of the sensor's illuminated lobe. */
  uniform float uScan;
  /**
   * Where the sensor is, as a unit direction in plan view — NOT an angle.
   * Supplied by experience/captureRig.ts so the convention is never re-derived
   * here. See the sensor-lobe block in main().
   */
  uniform vec2 uSensorDir;
  uniform float uSnap;
  uniform float uDrift;
  uniform float uDriftAmount;
  uniform float uVertexEmphasis;
  uniform float uVertexSize;
  uniform float uDispersion;

  attribute float aSeed;
  attribute float aRevealOrder;

  #ifdef MORPH
    attribute vec3 aTarget;
  #endif

  varying float vSeed;
  varying float vDepth;
  varying float vAppear;
  varying float vScanBand;
  varying float vEmphasis;

  #ifdef USE_COLOR
    varying vec3 vLinearColor;

    // sRGB → linear. The renderer works in linear space and converts back on
    // output; feeding it sRGB directly double-brightens the midtones.
    vec3 srgbToLinear(vec3 c) {
      return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
    }
  #endif

  /**
   * Coherent drift.
   *
   * A smooth function of *position*, so neighbouring samples move together and
   * the cloud breathes as a body. Per-point random velocity — the obvious
   * implementation — reads as television static and destroys any sense that the
   * particles describe a real object. The per-point phase term is deliberately
   * small (< 1 radian) so it adds measurement jitter without breaking that
   * local coherence.
   */
  vec3 driftField(vec3 p, float t, float seed) {
    float ph = seed * 0.9;
    return vec3(
      sin(p.y * 1.9 + t * 0.43 + ph) + 0.6 * sin(p.z * 1.3 - t * 0.29),
      0.55 * sin(p.x * 1.6 + t * 0.37 + ph),
      cos(p.y * 1.7 + t * 0.31 + ph) + 0.6 * cos(p.x * 1.4 + t * 0.33)
    );
  }

  void main() {
    // ── Progressive reveal, base → apex ──────────────────────────────────
    // At uReveal = 1 the expression is >= 1.0 for every point, so the whole
    // cloud is guaranteed present; at 0 it is <= 0 for every point.
    float appear = smoothstep(0.0, 0.35, uReveal * 1.35 - aRevealOrder * 0.35);

    // Floored, not gated. A hard gate leaves the hero — 15% of the page before
    // the reveal window opens — as an empty frame. A floor renders it as a faint
    // unresolved haze instead, which is what a raw capture actually looks like.
    //
    // 0.58, not 0.30. This floor is multiplied by cloudOpacity, which carries a
    // floor of its own (see the presence block in experience/representation.ts),
    // and the product is what the opening frame is actually drawn at — 0.072
    // under the old pair, measured at 0.19% bright pixels against a 2.83% peak.
    // Two independently-authored "faint floors" are not a faint floor; they are a
    // dark one. Raising this one compresses the reveal's alpha range, which is
    // fine here because the reveal is not carried by alpha alone: uDispersion
    // contracts the cloud onto itself and uDrift stills it, and those two are
    // what make the sweep read as resolution rather than as a fade-in.
    vAppear = mix(0.58, 1.0, appear);

    // Unresolved samples sit slightly outside their true position, radially.
    // Scaling about the model origin keeps this coherent — the cloud contracts
    // onto itself as it resolves, rather than individual points twitching home.
    vec3 scanned = position * (1.0 + (1.0 - appear) * uDispersion);

    // ── Migration onto the reconstruction's vertices ─────────────────────
    // Staggered by height so the snap sweeps upward instead of the whole cloud
    // teleporting on one frame. Bounds are chosen so every point completes:
    // max start 0.53, max end 0.95.
    float stagger = aRevealOrder * 0.55 + aSeed * 0.18;
    float snapT = smoothstep(stagger * 0.72, stagger * 0.72 + 0.42, uSnap);

    vec3 base = scanned;
    #ifdef MORPH
      base = mix(scanned, aTarget, snapT);
    #endif

    // ── The side facing the sensor ──────────────────────────────────────
    // This used to be a band travelling vertically up the specimen, driven by
    // its own progress value. It was replaced because it had no visible cause:
    // once the capture rig exists and is orbiting, a *second* unexplained
    // motion sweeping the other way is two effects at once, and the eye reads
    // the pair as decoration rather than as an instrument taking a reading.
    //
    // What a multi-view or structured-light rig actually produces is a lit
    // side — the half of the canopy the sensor can currently see. So the band
    // is now angular and centred on the rig's own azimuth, which means it is
    // not an animation at all: it is the consequence of where the sensor is.
    //
    // No attribute is needed, and deliberately no angle either. An earlier
    // version recomputed the azimuth here with atan and differenced it against
    // the rig's traverse. That worked, but it meant the convention was written
    // out twice — once in TS, once inverted in GLSL — which is exactly the
    // mistake that produced a lit patch trailing the sensor by 90°.
    //
    // Comparing directions instead makes the error unrepresentable: the lobe is
    // just "how closely does this sample's bearing align with the sensor's",
    // one dot product, no seam to wrap and no branch. The cosine threshold is
    // ~±50° of arc — wider and the whole plant is lit at once so there is no
    // readable direction; much narrower and it becomes a rotating blade.
    vec2 bearing = normalize(vec2(base.x, base.z) + vec2(1e-5));
    float band = smoothstep(0.64, 1.0, dot(bearing, uSensorDir));

    // Facing the sensor is only meaningful while there IS a sensor. uScan is
    // the envelope; (1 - uReveal) retires it as the data becomes legible in
    // its own right.
    vScanBand = band * uScan * (1.0 - uReveal);

    // Drift stops as samples lock onto vertices — a cloud still breathing after
    // it has become geometry reads as noise rather than as measurement.
    vec3 drifted = base + driftField(base, uTime, aSeed) * uDriftAmount * uDrift * (1.0 - snapT);

    vec4 mv = modelViewMatrix * vec4(drifted, 1.0);
    gl_Position = projectionMatrix * mv;

    vSeed = aSeed;
    vDepth = -mv.z;
    vEmphasis = uVertexEmphasis;

    #ifdef USE_COLOR
      vLinearColor = srgbToLinear(color);
    #endif

    // Sparkle drives size as well as alpha. Varying only alpha reads as noisy
    // flicker; varying both reads as depth.
    float variation = mix(1.0, 0.55 + 0.45 * aSeed, uSparkle);

    // Vertices are smaller and more uniform than scan returns — that size change
    // is most of what sells "this is now a vertex, not a sample".
    //
    // The scan band deliberately does NOT inflate point size any more. It was
    // boosting size, colour, brightness and alpha at once, and four boosts on
    // one moving band is a laser sweep out of a title sequence, not a structured
    // light pass. Brightness alone is what a real illuminated band does; the
    // size term was the part that bloomed.
    float sizeBase = mix(uSize, uVertexSize, uVertexEmphasis);

    #ifdef ATTENUATE
      gl_PointSize = sizeBase * uPixelRatio * variation / max(vDepth, 0.001);
    #else
      gl_PointSize = sizeBase * uPixelRatio * variation;
    #endif

    gl_PointSize = min(gl_PointSize, uMaxPixelSize * uPixelRatio);
  }
`,wt=`
  uniform vec3 uTint;
  uniform vec3 uVertexTint;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uDepthFadeNear;
  uniform float uDepthFadeFar;
  uniform float uSparkle;

  varying float vSeed;
  varying float vDepth;
  varying float vAppear;
  varying float vScanBand;
  varying float vEmphasis;

  #ifdef USE_COLOR
    varying vec3 vLinearColor;
  #endif

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float d2 = dot(uv, uv);

    #if defined(SHAPE_SQUARE)
      float mask = 1.0;
    #elif defined(SHAPE_RING)
      if (d2 > 0.25) discard;
      float r = sqrt(d2);
      float mask = smoothstep(0.16, 0.30, r) * (1.0 - smoothstep(0.42, 0.50, r));
    #elif defined(SHAPE_DISC)
      if (d2 > 0.25) discard;
      float mask = 1.0;
    #else
      // SHAPE_SOFT. Hardens with vertex emphasis: a soft gaussian blob reads as
      // a sensor return, a crisp dot reads as a vertex. Interpolating the falloff
      // is how one buffer covers both without a shader swap.
      if (d2 > 0.25) discard;
      float soft = 1.0 - smoothstep(0.03, 0.25, d2);
      float crisp = 1.0 - smoothstep(0.17, 0.25, d2);
      float mask = mix(soft, crisp, vEmphasis);
    #endif

    #ifdef USE_COLOR
      vec3 color = vLinearColor;
    #else
      vec3 color = uTint;
    #endif

    // Foliage colour → measurement colour. Vertices are data about the plant,
    // not the plant, and reading as such is the point of the stage.
    color = mix(color, uVertexTint, vEmphasis * 0.72);
    // Restrained on purpose: the sweep should read as light falling across the
    // canopy for a moment, not as a highlighter drawn over it.
    color = mix(color, uVertexTint, vScanBand * 0.32);
    color *= uBrightness * (1.0 + 0.42 * vScanBand);

    // Distance attenuation. Without it every point is equally bright and the
    // cloud collapses into a flat sheet with no readable depth.
    float depthFade = 1.0 - smoothstep(uDepthFadeNear, uDepthFadeFar, vDepth);
    float sparkle = mix(1.0, 0.38 + 0.62 * vSeed, uSparkle);

    float alpha = mask * sparkle * (0.42 + 0.58 * depthFade) * uOpacity * vAppear;

    // Vertex-emphasis light compensation.
    //
    // Becoming a vertex costs a point most of its light twice over: the quad
    // shrinks (18 → 11 px, ~2.7x less area) and the mask hardens from a gaussian
    // to a crisp disc, which cuts integrated alpha again. Measured, the vertex
    // stage came out at less than half the mean luminance of the point-cloud
    // stage — the conceptual centre of the whole transformation was also its
    // dimmest, faintest frame.
    //
    // This restores the luminance the geometry change took away, without
    // touching the size or the hardness that are doing the actual storytelling.
    // A vertex should read as small, precise and *bright* — the way a measured
    // point reads on an instrument — not as a faint speck.
    alpha *= mix(1.0, 2.1, vEmphasis);

    alpha *= 1.0 + 0.55 * vScanBand;
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`,Tt={x:0,z:0};function Et({geometry:e,hasVertexColors:t,morphTargets:n,config:r,dpr:i,weightsRef:a}){let o=(0,I.useRef)(null),s=(0,I.useRef)(0);(0,I.useEffect)(()=>{if(n)return e.setAttribute(`aTarget`,new w(n,3)),()=>{e.deleteAttribute(`aTarget`)}},[e,n]);let c=(0,I.useMemo)(()=>({uSize:{value:r.size},uPixelRatio:{value:i},uMaxPixelSize:{value:r.maxPixelSize},uSparkle:{value:r.sparkle},uTint:{value:new C(R.cloud)},uVertexTint:{value:new C(R.accent)},uOpacity:{value:0},uBrightness:{value:r.brightness},uDepthFadeNear:{value:r.depthFadeNear},uDepthFadeFar:{value:r.depthFadeFar},uTime:{value:0},uReveal:{value:0},uScan:{value:0},uSensorDir:{value:new O(0,1)},uSnap:{value:0},uDrift:{value:1},uDriftAmount:{value:r.driftAmount},uVertexEmphasis:{value:0},uVertexSize:{value:r.vertexSize},uDispersion:{value:r.dispersion}}),[]),l=(0,I.useMemo)(()=>{let e={[`SHAPE_${r.shape.toUpperCase()}`]:`1`};return r.sizeAttenuation&&(e.ATTENUATE=`1`),n&&(e.MORPH=`1`),e},[r.shape,r.sizeAttenuation,n]),u=r.depthMode===`additive`;return P((e,t)=>{let n=o.current;if(!n)return;s.current+=Math.min(t,.05);let c=a.current,l=n.uniforms,u=r.opacity*c.cloudOpacity;l.uOpacity.value=u,l.uSize.value=r.size,l.uPixelRatio.value=i,l.uMaxPixelSize.value=r.maxPixelSize,l.uSparkle.value=r.sparkle,l.uBrightness.value=r.brightness,l.uDepthFadeNear.value=r.depthFadeNear,l.uDepthFadeFar.value=r.depthFadeFar,l.uTime.value=s.current,l.uReveal.value=c.reveal,l.uScan.value=c.scan,nt(c.rigAngle,Tt),l.uSensorDir.value.set(Tt.x,Tt.z),l.uSnap.value=c.snap,l.uDrift.value=c.drift,l.uDriftAmount.value=r.driftAmount,l.uVertexEmphasis.value=c.vertexEmphasis,l.uVertexSize.value=r.vertexSize,l.uDispersion.value=r.dispersion,n.visible=u>.002}),(0,L.jsx)(`points`,{geometry:e,frustumCulled:!1,renderOrder:2,children:(0,L.jsx)(`shaderMaterial`,{ref:o,uniforms:c,defines:l,vertexShader:Ct,fragmentShader:wt,vertexColors:t,transparent:!0,depthWrite:!u,depthTest:!0,blending:u?2:1},`${r.shape}-${r.sizeAttenuation}-${t}-${n?`morph`:`static`}`)})}function Dt({source:e,config:t,dpr:n,weightsRef:r}){let i=(0,I.useRef)(null),a=(0,I.useMemo)(()=>{let n=e.getAttribute(`position`).array,r=Math.floor(n.length/3),i=Math.min(t.tiePointCount,r),a=Math.max(1,Math.floor(r/i)),o=Math.floor((r-1)/a)+1,s=new Float32Array(o*3),c=new Float32Array(o);for(let e=0;e<o;e++){let t=e*a*3,r=n[t],i=n[t+1],o=n[t+2];s[e*3]=r,s[e*3+1]=i,s[e*3+2]=o,c[e]=rt(r,o)}let l=new T;return l.setAttribute(`position`,new w(s,3)),l.setAttribute(`aAt`,new w(c,1)),l},[e,t.tiePointCount]);(0,I.useEffect)(()=>()=>a.dispose(),[a]);let o=(0,I.useMemo)(()=>({uSize:{value:t.tiePointSize},uPixelRatio:{value:n},uMaxPixelSize:{value:7},uHead:{value:0},uFlashWidth:{value:.014},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uFlashColor:{value:new C(R.accent)}}),[]);return P(()=>{let e=i.current;if(!e)return;let a=r.current,o=e.uniforms,s=a.tiePoints;o.uHead.value=a.rigAngle,o.uOpacity.value=s,o.uSize.value=t.tiePointSize,o.uPixelRatio.value=n,e.visible=s>.004}),(0,L.jsx)(`points`,{geometry:a,frustumCulled:!1,renderOrder:2,children:(0,L.jsx)(`shaderMaterial`,{ref:i,uniforms:o,vertexShader:ot,fragmentShader:st,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})})}var Ot=`
  uniform float uBuild;

  attribute vec3 aOther;
  attribute float aReveal;

  varying float vGrown;
  varying float vFront;

  void main() {
    // Bounds chosen so every edge completes exactly at uBuild = 1:
    // max start 0.42, max end 1.0.
    float start = aReveal * 0.42;
    float grown = smoothstep(start, start + 0.58, uBuild);

    vec3 pos = mix(aOther, position, grown);

    // There was a travelling sine shimmer on the growth front here. It is gone.
    // An inferred edge is an assertion about where the surface is — making it
    // wobble says the opposite of what the stage means. It also measured out at
    // 0.004 world units, which at the working distance of ~7.5 is under a pixel,
    // so it cost a per-vertex trig call across 60k edges to say nothing.

    // 1 where this edge is actively being drawn, 0 once settled. Drives the
    // bright tip so the eye follows the construction.
    vFront = grown * (1.0 - grown) * 4.0;
    vGrown = grown;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`,kt=`
  uniform vec3 uColor;
  uniform vec3 uFrontColor;
  uniform float uOpacity;

  varying float vGrown;
  varying float vFront;

  void main() {
    // An edge that has not started growing must not paint its origin vertex.
    if (vGrown < 0.001) discard;

    // Stand-in for line weight: the growth front burns brighter, settled edges
    // sit back. Reads as weight without needing instanced quads.
    vec3 color = mix(uColor, uFrontColor, clamp(vFront, 0.0, 1.0) * 0.85);

    float alpha = uOpacity * vGrown * (0.55 + 0.45 * vFront);
    if (alpha < 0.004) discard;

    gl_FragColor = vec4(color, alpha);

    #include <colorspace_fragment>
  }
`;function At({geometry:e,config:t,weightsRef:n}){let r=(0,I.useRef)(null),i=(0,I.useMemo)(()=>({uBuild:{value:0},uOpacity:{value:0},uColor:{value:new C(R.cloud)},uFrontColor:{value:new C(R.accent)}}),[]);return P(()=>{let e=r.current;if(!e)return;let i=n.current,a=e.uniforms,o=t.opacity*i.wireOpacity;a.uBuild.value=i.wireBuild,a.uOpacity.value=o,e.visible=o>.002&&i.wireBuild>.001}),(0,L.jsx)(`lineSegments`,{geometry:e,frustumCulled:!1,renderOrder:1,children:(0,L.jsx)(`shaderMaterial`,{ref:r,uniforms:i,vertexShader:Ot,fragmentShader:kt,transparent:!0,depthWrite:!1,depthTest:!0,blending:1})})}var jt={size:18,opacity:1,sizeAttenuation:!0,brightness:1,shape:`soft`,depthMode:`additive`,depthFadeNear:6,depthFadeFar:13.5,sparkle:.3,maxPixelSize:24,vertexSize:11,driftAmount:.02,dispersion:.09},Mt={low:{size:15,maxPixelSize:16,vertexSize:9},medium:{size:16.5,maxPixelSize:20,vertexSize:10},high:{size:18,maxPixelSize:24,vertexSize:11}},Nt={orbitRadius:1.9,orbitHeight:-1.6,stations:12,ringOpacity:.5,frustumOpacity:.42,frustumReach:.62,stationSize:34,tiePointCount:720,tiePointSize:26},Pt={opacity:1,wireframe:!1,emissiveBoost:0,revealSoftness:.2,frontGlow:.55,roughnessFrom:.92,roughnessTo:.55},Ft={opacity:.62,maxEdges:6e4};function It({progress:e,tier:t,dpr:n,cloudPoints:r=null,pointCloud:i,mesh:a,wireframe:o,capture:s,placeholderPoints:c,placeholderPointSize:l,labelsRef:u}){let{stateRef:d,breakpointRef:f,reducedMotion:p}=m(),h=(0,I.useRef)($e()),g=(0,I.useMemo)(()=>({...jt,...Mt[t],...i,...p?{driftAmount:0}:null}),[t,i,p]),_=(0,I.useMemo)(()=>({...Pt,...a}),[a]),v=(0,I.useMemo)(()=>({...Ft,...o}),[o]),y=(0,I.useMemo)(()=>({...Nt,...s}),[s]);P(()=>{et(e??d.current.experienceProgress,h.current)},-1e3);let b=(0,L.jsx)(St,{pointCount:c,pointSize:l,dpr:n}),x=(0,L.jsx)(lt,{config:y,dpr:n,weightsRef:h}),S={pointCloudConfig:g,meshConfig:_,wireframeConfig:v,captureConfig:y,cloudPoints:r,dpr:n,weightsRef:h,breakpointRef:f,labelsRef:u};return(0,L.jsxs)(L.Fragment,{children:[x,!M.pointCloud&&!M.mesh?(0,L.jsxs)(L.Fragment,{children:[b,(0,L.jsx)(Lt,{bounds:B,breakpointRef:f,dpr:n,weightsRef:h,labelsRef:u})]}):(0,L.jsx)(Je,{fallback:b,children:(0,L.jsx)(I.Suspense,{fallback:b,children:M.pointCloud&&M.mesh?(0,L.jsx)(Rt,{...S}):M.pointCloud?(0,L.jsx)(zt,{...S}):(0,L.jsx)(Bt,{...S})})})]})}function Lt({bounds:e,breakpointRef:t,dpr:n,weightsRef:r,labelsRef:i}){return(0,L.jsxs)(L.Fragment,{children:[(0,L.jsx)(ht,{bounds:e,breakpointRef:t,dpr:n,weightsRef:r}),(0,L.jsx)(Pe,{bounds:e,breakpointRef:t,weightsRef:r,handlesRef:i})]})}function Rt(e){let t=ce(M.pointCloud,e.cloudPoints),n=de(M.mesh);return(0,L.jsx)(Vt,{cloud:t,mesh:n,...e})}function zt(e){let t=ce(M.pointCloud,e.cloudPoints);return(0,L.jsx)(Vt,{cloud:t,mesh:null,...e})}function Bt(e){let t=de(M.mesh);return(0,L.jsx)(Vt,{cloud:null,mesh:t,...e})}function Vt({cloud:e,mesh:t,pointCloudConfig:n,meshConfig:r,wireframeConfig:i,captureConfig:a,dpr:o,weightsRef:s,breakpointRef:c,labelsRef:l}){let u=(0,I.useMemo)(()=>{if(t){let e=Ye(t.object);if(e.length>0)return Oe(e)}return e?Oe(e.geometry.getAttribute(`position`).array):B},[e,t]);(0,I.useEffect)(()=>{console.info(`[phenotype] specimen bounds — y ${u.minY.toFixed(3)} → ${u.maxY.toFixed(3)}, plan half-extent ${u.planHalfExtent.toFixed(3)}`)},[u]);let d=(0,I.useMemo)(()=>{if(!e||!t)return;let n=Ye(t.object);if(n.length===0)return;let r=e.geometry.getAttribute(`position`).array,i=Ze(r,n),a=r.length/3,o=n.length/3,s=a/o;return console.info(`[assets] morph targets — mean travel ${i.meanTravel.toFixed(3)}, max ${i.maxTravel.toFixed(3)} scene units; ${a.toLocaleString()} samples → ${o.toLocaleString()} vertices (${s.toFixed(1)}:1)`),s>20&&console.warn(`[assets] sample:vertex ratio is ${s.toFixed(0)}:1 — the vertex stage will render sparsely. Expect ~2:1 between a scan and its own reconstruction.`),i.positions},[e,t]),f=(0,I.useMemo)(()=>t?Qe(t.object,i.maxEdges):null,[t,i.maxEdges]);return(0,I.useEffect)(()=>{let e=f?.geometry;return()=>e?.dispose()},[f]),(0,I.useEffect)(()=>{if(!e)return;let t=e.count<e.sourceCount?` (decimated from ${e.sourceCount.toLocaleString()})`:``;console.info(`[assets] point cloud ready — ${e.count.toLocaleString()} points${t}, vertex colours: ${e.hasVertexColors}`)},[e]),(0,I.useEffect)(()=>{t&&console.info(`[assets] mesh ready — ${t.triangles.toLocaleString()} triangles`)},[t]),(0,I.useEffect)(()=>{if(!f)return;let e=f.segments<f.sourceSegments?` (capped from ${f.sourceSegments.toLocaleString()})`:``;console.info(`[assets] wireframe ready — ${f.segments.toLocaleString()} edges${e}`)},[f]),(0,L.jsxs)(L.Fragment,{children:[e&&(0,L.jsx)(Dt,{source:e.geometry,config:a,dpr:o,weightsRef:s}),e&&(0,L.jsx)(Et,{geometry:e.geometry,hasVertexColors:e.hasVertexColors,morphTargets:d,config:n,dpr:o,weightsRef:s}),f&&(0,L.jsx)(At,{geometry:f.geometry,config:i,weightsRef:s}),t&&(0,L.jsx)(ut,{object:t.object,config:r,weightsRef:s}),(0,L.jsx)(Lt,{bounds:u,breakpointRef:c,dpr:o,weightsRef:s,labelsRef:l})]})}function Ht(){let e=F(e=>e.gl),t=F(e=>e.scene),n=F(e=>e.camera),r=F(e=>e.advance);return(0,I.useEffect)(()=>{let i=window,o=e=>{let t=performance.now()+e;for(;performance.now()<t;);};return i.__scene={gl:e,scene:t,camera:n,advance:r,settle:(e=16,t=50)=>{let n=i.__t??0;for(let i=0;i<e;i++)o(t),n+=t,a.update(),x.ticker.tick(),r(n,!0);i.__t=n}},()=>{delete i.__scene}},[e,t,n,r]),null}function Ut(){if(typeof navigator>`u`)return`medium`;let e=navigator.hardwareConcurrency,t=navigator.deviceMemory,n=typeof matchMedia==`function`&&matchMedia(`(pointer: coarse) and (hover: none)`).matches;return e!==void 0&&e<=4||t!==void 0&&t<=4?`low`:n||e!==void 0&&e<=8||e===void 0?`medium`:`high`}var Wt={low:{points:9e3,maxDpr:1.25,pointSize:11,cloudPoints:6e4},medium:{points:2e4,maxDpr:1.6,pointSize:12,cloudPoints:12e4},high:{points:34e3,maxDpr:2,pointSize:13,cloudPoints:null}};function Gt(){let{reducedMotion:e}=m(),[t]=(0,I.useState)(Ut),n=Wt[t],[r,i]=(0,I.useState)(()=>Math.min(n.maxDpr,1.5)),[a]=(0,I.useState)(v),o=(0,I.useRef)(je()),s=(0,I.useCallback)(()=>{i(e=>Math.min(n.maxDpr,Math.round((e+.25)*100)/100))},[n.maxDpr]),c=(0,I.useCallback)(()=>{i(e=>Math.max(1,Math.round((e-.25)*100)/100))},[]),l=(0,I.useCallback)(()=>i(1),[]);return(0,L.jsxs)(L.Fragment,{children:[(0,L.jsx)(`div`,{className:`scene-canvas`,"aria-hidden":`true`,children:(0,L.jsxs)(Se,{dpr:r,gl:{antialias:t!==`low`,alpha:!1,powerPreference:`high-performance`,stencil:!1,depth:!0},camera:{fov:h.desktop,near:.1,far:60,position:[.55,.42,8.55]},children:[(0,L.jsx)(we,{flipflops:3,onIncline:s,onDecline:c,onFallback:l}),(0,L.jsx)(`color`,{attach:`background`,args:[R.void]}),a&&(0,L.jsx)(Ht,{}),(0,L.jsx)(qe,{}),(0,L.jsx)(It,{tier:t,dpr:r,cloudPoints:n.cloudPoints,placeholderPoints:e?Math.min(n.points,14e3):n.points,placeholderPointSize:n.pointSize,labelsRef:o})]})}),(0,L.jsx)(Ne,{handlesRef:o})]})}export{Gt as SceneCanvas};