const {session,BASE}=require('./lib.js');
const step=process.argv[2];
(async()=>{
 const log=(...a)=>console.log(...a);
 const role={submit:'trainee',hot:'head_of_training',hots:'head_of_trainee_support',retry:'head_of_trainee_support',own:'trainee',view:'trainee'}[step];
 const {b,p}=await session(role);
 p.on('pageerror',e=>log('PAGEERROR',e.message));
 p.on('response',async r=>{const u=r.url();if(r.status()>=400&&u.includes('supabase'))log('HTTP',r.status(),u.split('/').slice(-2).join('/'),(await r.text().catch(()=>'')).slice(0,250))});
 const txt=async s=>(await p.locator(s).first().innerText().catch(()=>'')).replace(/\s+/g,' ');
 if(step==='submit'||step==='view'){
  await p.goto(BASE+'/trainee/transfer',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
  if(step==='submit'){
   await p.click('[aria-label="Destination VTC"]');await p.click('[role=option]:has-text("Gobabis")');
   await p.fill('#reason','Family has relocated to Gobabis region');
   await p.click('button:has-text("Submit request")');await p.waitForTimeout(3000);
  }
  await p.screenshot({path:'tr_'+step+'.png',fullPage:true});
  log('page:',(await p.locator('main').innerText()).replace(/\s+/g,' ').slice(0,700));
 } else {
  await p.goto(BASE+'/transfers',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
  if(step==='hot'||step==='hots'){
   await p.locator('button:has-text("Review")').first().click();
   await p.locator('[role=dialog] textarea').fill('Approved after review of the request');
   await p.locator('[role=dialog] button:has-text("Approve")').click();await p.waitForTimeout(4000);
  }
  if(step==='retry'){
   await p.click('[role=tab]:has-text("In progress")').catch(()=>{});await p.waitForTimeout(500);
   await p.locator('button:has-text("Retry move")').first().click();await p.waitForTimeout(4000);
  }
  await p.screenshot({path:'tr_'+step+'.png',fullPage:true});
  for(const t of ['Needs my decision','In progress','Finished']){await p.click(`[role=tab]:has-text("${t}")`).catch(()=>{});await p.waitForTimeout(500);log(t+':',(await p.locator('[role=tabpanel]:visible').innerText()).replace(/\s+/g,' ').slice(0,350));}
 }
 await b.close();
})();
