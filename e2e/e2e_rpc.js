const {session,BASE}=require('./lib.js');
const [role,...ids]=process.argv.slice(2);
(async()=>{
 const {b,p}=await session(role);
 const AK=require('fs').readFileSync(require('path').join(__dirname,'..','.env'),'utf8').match(/PUBLISHABLE_KEY="([^"]+)"/)[1];
 const out=await p.evaluate(async([ids,AK])=>{
  const k=Object.keys(localStorage).find(x=>/sb-.*auth-token/.test(x));const s=JSON.parse(localStorage[k]);
  const ref=k.match(/sb-(.*)-auth-token/)[1];const base=`https://${ref}.supabase.co`;
  const key=window.__SUPABASE_ANON__||null;
  const res=[];
  for(const id of ids){
   const [kind,rid]=id.split(':');
   const r=await fetch(`${base}/rest/v1/rpc/${kind}`,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer '+s.access_token,apikey:AK},body:JSON.stringify(kind==='log_proof_print'?{_registration:rid,_action:'print'}:{_registration:rid})});
   res.push([kind,rid.slice(0,8),r.status,(await r.text()).slice(0,140)]);
  }
  return res;
 },[ids,AK]);
 out.forEach(o=>console.log(o.join(' | ')));
 await b.close();
})();
