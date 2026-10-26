const {session,BASE}=require('./lib.js');
(async()=>{
 const log=(...a)=>console.log(...a);
 const {b,p}=await session('pa_to_centre_manager');
 p.on('pageerror',e=>log('PAGEERROR',e.message));
 p.on('response',async r=>{if(r.status()>=400&&r.url().includes('supabase'))log('HTTP',r.status(),r.url().split('/').slice(-2).join('/'),(await r.text().catch(()=>'')).slice(0,160))});
 await p.goto(BASE+'/pa-dashboard',{waitUntil:'networkidle'});await p.waitForTimeout(1500);
 // correspondence
 await p.click('button:has-text("Correspondence"):has(svg)');
 await p.fill('label:has-text("Subject") ~ input, input[required] >> nth=0','Ministry circular on 2027 enrolment');
 const dlg=p.locator('[role=dialog]');
 await dlg.locator('input').nth(0).fill('Ministry circular on 2027 enrolment');
 await dlg.locator('input').nth(1).fill('Ministry of Education');
 const due=new Date(Date.now()+5*864e5).toISOString().slice(0,10);
 await dlg.locator('input[type=date]').nth(1).fill(due);
 await dlg.locator('button:has-text("Save")').click();
 await p.waitForTimeout(2500);
 log('letters:',(await p.locator('table').first().innerText().catch(()=>'none')).replace(/\s+/g,' ').slice(0,200));
 // meeting
 await p.click('button:has-text("Meeting"):has(svg)');
 const d2=p.locator('[role=dialog]');
 await d2.locator('input').nth(0).fill('Heads of department meeting');
 const md=new Date(Date.now()+2*864e5).toISOString().slice(0,10);
 await d2.locator('input[type=date]').fill(md);
 await d2.locator('input[type=time]').nth(0).fill('09:00');await d2.locator('input[type=time]').nth(1).fill('10:00');
 await d2.locator('button:has-text("Save")').click();await p.waitForTimeout(2000);
 // task
 await p.click('button:has-text("Task"):has(svg)');
 const d3=p.locator('[role=dialog]');
 await d3.locator('input').nth(0).fill('Prepare briefing for Ministry reply');
 await d3.locator('button:has-text("Save")').click();await p.waitForTimeout(2000);
 await p.click('[role=tab]:has-text("Meetings")');await p.waitForTimeout(800);
 log('meetings:',(await p.locator('[role=tabpanel]:visible').innerText()).replace(/\s+/g,' ').slice(0,200));
 await p.click('[role=tab]:has-text("Tasks")');await p.waitForTimeout(800);
 log('tasks:',(await p.locator('[role=tabpanel]:visible').innerText()).replace(/\s+/g,' ').slice(0,200));
 await p.click('[role=tab]:has-text("Delegations")');await p.waitForTimeout(1200);
 log('deleg:',(await p.locator('[role=tabpanel]:visible').innerText()).replace(/\s+/g,' ').slice(0,200));
 await p.screenshot({path:'pa_flow.png',fullPage:true});
 await b.close();
})();
