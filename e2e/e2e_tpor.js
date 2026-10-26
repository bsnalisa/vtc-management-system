const {session,BASE}=require('./lib.js');
(async()=>{
 const log=(...a)=>console.log(...a);
 const {b,p}=await session('trainee');
 p.on('pageerror',e=>log('PAGEERROR',e.message));
 p.on('response',async r=>{const u=r.url();if(r.status()>=400&&u.includes('supabase')&&!u.includes('active_package'))log('HTTP',r.status(),u.split('/').slice(-2).join('/'),(await r.text().catch(()=>'')).slice(0,150))});
 await p.addInitScript(()=>{window.print=()=>{}});
 await p.goto(BASE+'/trainee/registration',{waitUntil:'networkidle'});await p.waitForTimeout(2500);
 await p.screenshot({path:'tpor_page.png',fullPage:true});
 const btn=p.locator('button:has-text("Print proof")');log('buttons:',await btn.count());
 await btn.first().click();await p.waitForTimeout(3500);
 const dlg=p.locator('[role=dialog]');
 log('dialog:',(await dlg.innerText()).replace(/\s+/g,' ').slice(0,260));
 const html=await dlg.locator('iframe').getAttribute('srcdoc');
 log('html: Gobabis',/Gobabis/.test(html),'| Nakayale',/Nakayale/.test(html),'| ref',(html.match(/POR-\d\d-\d{5}/)||[])[0],'| number',/TEST-TRAINEE-01/.test(html));
 await dlg.locator('button:has-text("Print")').first().click();await p.waitForTimeout(2500);
 await p.screenshot({path:'tpor_dlg.png'});
 await b.close();
})();
