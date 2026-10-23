(function(root,make){const P=make();if(typeof module!=='undefined')module.exports=P;else root.PW=P})(this,function(){
const OPT={decay:.9,eta:3,tie:1440};
const G=30,snap=x=>Math.round(x/G)*G;
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
function wmed(v,w){const p=v.map((x,i)=>[x,w[i]]).sort((a,b)=>a[0]-b[0]),t=w.reduce((a,b)=>a+b,0);let c=0;for(const[x,y]of p){c+=y;if(c>=t/2)return x}}
const dn=iso=>Math.round(Date.UTC(+iso.slice(0,4),+iso.slice(5,7)-1,+iso.slice(8,10))/864e5);
const isoOf=n=>new Date(n*864e5).toISOString().slice(0,10);

// The series has one slot per calendar day. A day nobody logged is null, so "3 days ago" always means 3 real days.
const lag=k=>({name:k===1?'Same as yesterday':k===7?'Same day last week':'Same as '+k+' days ago',f:s=>s[s.length-k]});
const analog=(L,m)=>({name:'Pattern match on the last '+(L===1?'day':L+' days'),f:s=>{
  const n=s.length;if(n<L+2)return;
  for(let i=1;i<=L;i++)if(s[n-i]==null)return;
  const c=[];
  for(let j=L;j<n;j++){if(s[j]==null)continue;let d=0,ok=true;
    for(let i=1;i<=L;i++){if(s[j-i]==null){ok=false;break}d+=Math.abs(s[j-i]-s[n-i])}
    if(ok)c.push({d:d+(n-j),v:s[j]})}
  if(!c.length)return;
  c.sort((a,b)=>a.d-b.d);const t=c.slice(0,m);
  return wmed(t.map(x=>x.v),t.map(x=>1/(1+x.d/G)));
}});
const common={name:'Most common recent time',f:s=>{
  const c={},n=s.length;
  for(let i=Math.max(0,n-14);i<n;i++)if(s[i]!=null){const k=snap(s[i]);c[k]=(c[k]||0)+Math.pow(.9,n-1-i)}
  const ks=Object.keys(c);return ks.length?+ks.sort((a,b)=>c[b]-c[a])[0]:undefined}};
const recent={name:'Middle of the last 5 days',f:s=>{const v=s.slice(-5).filter(x=>x!=null);return v.length?med(v):undefined}};
// Groups start times into 3 slots (morning/afternoon/evening style), learns which slot tends to follow which.
const slot={name:'Slot rotation (what usually follows)',f:s=>{
  const n=s.length,k=s.filter(v=>v!=null);
  if(n<2||s[n-1]==null||k.length<4)return;
  const srt=[...k].sort((a,b)=>a-b);let c=[srt[0],srt[srt.length>>1],srt[srt.length-1]];
  const lab=v=>c.reduce((b,x,i)=>Math.abs(v-x)<Math.abs(v-c[b])?i:b,0);
  for(let it=0;it<10;it++){const g=[[],[],[]];k.forEach(v=>g[lab(v)].push(v));c=c.map((x,i)=>g[i].length?avg(g[i]):x)}
  const cur=lab(s[n-1]),cnt=[0,0,0],by=[[],[],[]];
  for(let j=0;j<n;j++)if(s[j]!=null)by[lab(s[j])].push(s[j]);
  for(let j=1;j<n;j++)if(s[j]!=null&&s[j-1]!=null&&lab(s[j-1])===cur)cnt[lab(s[j])]+=Math.pow(.9,n-1-j);
  const b=cnt.indexOf(Math.max(...cnt));
  return cnt[b]?med(by[b].slice(-5)):undefined}};
const methods=()=>[lag(1),lag(2),lag(3),lag(4),lag(7),analog(1,3),analog(2,3),common,recent,slot];

function combine(ps,ws,how){
  const v=[],w=[];ps.forEach((p,i)=>{if(p!=null){v.push(p);w.push(ws[i])}});
  if(!v.length)return;
  const wm=wmed(v,w);if(how==='median')return wm;
  let best,bs=-1;
  for(const c of new Set(v)){
    let sc=0;v.forEach((x,i)=>sc+=w[i]*Math.max(0,1-Math.abs(x-c)/90));
    if(sc>bs+1e-9||(Math.abs(sc-bs)<1e-9&&Math.abs(c-wm)<Math.abs(best-wm))){bs=sc;best=c}
  }
  return best;
}
function run(s,how='vote'){
  const M=methods(),n=s.length,err=M.map(()=>[]),preds=M.map(()=>[]),ens=[];let last;
  for(let i=1;i<=n;i++){
    const h=s.slice(0,i);
    const ps=M.map(m=>{const v=m.f(h);return v==null||isNaN(v)?undefined:snap(v)});
    const ws=M.map((m,k)=>{let L=0;const e=err[k];
      for(let j=0;j<e.length;j++)L+=Math.pow(OPT.decay,e.length-1-j)*e[j];
      return Math.exp(-OPT.eta*L)});
    const val=combine(ps,ws,how);
    ps.forEach((p,k)=>preds[k][i]=p);ens[i]=val;
    if(i<n){if(s[i]!=null)ps.forEach((p,k)=>{const d=p==null?360:Math.min(Math.abs(p-s[i]),360);err[k].push((d<=G?0:1)+d/OPT.tie)})}
    else last={ps,ws,val};
  }
  return{M,preds,ens,last,s};
}
function stat(pairs){const e=pairs.map(([p,a])=>Math.abs(p-a));
  return e.length?{mae:avg(e),hit:e.filter(x=>x<=G).length/e.length,n:e.length}:{mae:null,hit:null,n:0}}
function score(r,from=4){
  const n=r.s.length,get=a=>{const o=[];for(let i=from;i<n;i++)if(a[i]!=null&&r.s[i]!=null)o.push([a[i],r.s[i]]);return o};
  return{methods:r.M.map((m,k)=>({name:m.name,...stat(get(r.preds[k]))})),ens:stat(get(r.ens))};
}
// days: [{date:'YYYY-MM-DD',from:minutes,to:minutes|null}]. target: the day to predict (defaults to the day after the last log).
function analyse(days,how,target){
  const c=days.filter(d=>d.to==null||d.to>d.from).sort((a,b)=>a.date<b.date?-1:1);
  if(c.length<3)return{c,idx:[],s:[],next:null};
  const base=dn(c[0].date),tgt=Math.max(dn(c[c.length-1].date)+1,target?dn(target):0);
  const s=Array(tgt-base).fill(null);c.forEach(d=>s[dn(d.date)-base]=snap(d.from));
  const idx=c.map(d=>dn(d.date)-base);
  const r=run(s,how),L=r.last,tw=L.ws.reduce((a,b)=>a+b,0),cand={};
  L.ps.forEach((p,k)=>{if(p!=null)cand[p]=(cand[p]||0)+1});
  const ct=Object.values(cand).reduce((a,b)=>a+b,0)||1;
  const cands=Object.entries(cand).map(([t,w])=>({t:+t,p:w/ct,n:w})).sort((a,b)=>b.n-a.n).slice(0,3);
  const agree=L.ps.reduce((a,p)=>a+(p!=null&&L.val!=null&&Math.abs(p-L.val)<=G?1:0),0)/ct;
  const du=c.filter(d=>d.to!=null).slice(-7).map(d=>d.to-d.from);
  const dur=du.length?Math.max(G,snap(med(du))):150;
  return{c,idx,s,r,stats:score(r),weights:L.ws.map(w=>w/(tw||1)),next:L.val==null?null:{date:isoOf(tgt),start:L.val,dur,cands,agree}};
}
return{OPT,G,snap,analyse,run,score,methods};
});
