(function(root,make){const P=make();if(typeof module!=='undefined')module.exports=P;else root.PW=P})(this,function(){
const OPT={decay:.9,eta:3,tie:1440};
const G=30,snap=x=>Math.round(x/G)*G;
const avg=a=>a.reduce((x,y)=>x+y,0)/a.length;
const med=a=>{const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
function wmed(v,w){const p=v.map((x,i)=>[x,w[i]]).sort((a,b)=>a[0]-b[0]),t=w.reduce((a,b)=>a+b,0);let c=0;for(const[x,y]of p){c+=y;if(c>=t/2)return x}}

const lag=k=>({name:k===1?'Same as yesterday':k===7?'Same day last week':'Same as '+k+' days ago',f:s=>s[s.length-k]});
const analog=(L,m)=>({name:'Pattern match on the last '+(L===1?'day':L+' days'),f:s=>{
  const n=s.length;if(n<L+2)return;const c=[];
  for(let j=L;j<n;j++){let d=0;for(let i=1;i<=L;i++)d+=Math.abs(s[j-i]-s[n-i]);c.push({d:d+(n-j),v:s[j]})}
  c.sort((a,b)=>a.d-b.d);const t=c.slice(0,m);
  return wmed(t.map(x=>x.v),t.map(x=>1/(1+x.d/G)));
}});
const common={name:'Most common recent time',f:s=>{
  const h=s.slice(-14),c={};h.forEach((v,i)=>{const k=snap(v);c[k]=(c[k]||0)+Math.pow(.9,h.length-1-i)});
  return +Object.keys(c).sort((a,b)=>c[b]-c[a])[0]}};
const recent={name:'Middle of the last 5 days',f:s=>s.length?med(s.slice(-5)):undefined};
const methods=()=>[lag(1),lag(2),lag(3),lag(4),lag(7),analog(1,3),analog(2,3),common,recent];

// Combine method guesses into one start time on the 30-minute grid.
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
// Walk forward through history: each day is predicted using only earlier days.
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
    if(i<n)ps.forEach((p,k)=>{const d=p==null?360:Math.min(Math.abs(p-s[i]),360);err[k].push((d<=G?0:1)+d/OPT.tie)});
    else last={ps,ws,val};
  }
  return{M,preds,ens,last,s};
}
function stat(pairs){const e=pairs.map(([p,a])=>Math.abs(p-a));
  return e.length?{mae:avg(e),hit:e.filter(x=>x<=G).length/e.length,n:e.length}:{mae:null,hit:null,n:0}}
function score(r,from=4){
  const n=r.s.length,get=a=>{const o=[];for(let i=from;i<n;i++)if(a[i]!=null)o.push([a[i],r.s[i]]);return o};
  return{methods:r.M.map((m,k)=>({name:m.name,...stat(get(r.preds[k]))})),ens:stat(get(r.ens))};
}
function analyse(days,how){
  const c=days.filter(d=>d.to!=null&&d.to>d.from).sort((a,b)=>a.date<b.date?-1:1);
  const s=c.map(d=>snap(d.from));
  if(s.length<3)return{c,s,next:null};
  const r=run(s,how),L=r.last,tw=L.ws.reduce((a,b)=>a+b,0),cand={};
  L.ps.forEach((p,k)=>{if(p!=null)cand[p]=(cand[p]||0)+1});
  const ct=Object.values(cand).reduce((a,b)=>a+b,0);
  const cands=Object.entries(cand).map(([t,w])=>({t:+t,p:w/ct,n:w})).sort((a,b)=>b.p-a.p).slice(0,3);
  const agree=L.ps.reduce((a,p,k)=>a+(p!=null&&Math.abs(p-L.val)<=G?1:0),0)/ct;
  const dur=Math.max(G,snap(med(c.slice(-7).map(d=>d.to-d.from))));
  return{c,s,r,stats:score(r),weights:L.ws.map(w=>w/tw),next:{start:L.val,dur,cands,agree}};
}
return{OPT,G,snap,analyse,run,score,methods};
});
