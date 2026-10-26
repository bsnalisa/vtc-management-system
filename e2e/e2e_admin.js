const {session,BASE}=require('./lib.js');
(async()=>{
 const log=(...a)=>console.log(...a);
 const {b,p}=await session('organization_admin');
 p.on('pageerror',e=>log('PAGEERROR',e.message));
 p.on('response',async r=>{const u=r.url();if(u.includes('save_proof')||u.includes('organization-logos')||(r.status()>=400&&u.includes('supabase')&&!u.includes('active_package')))log('HTTP',r.request().method(),r.status(),u.split('/').slice(-2).join('/'),(await r.text().catch(()=>'')).slice(0,150))});
 await p.goto(BASE+'/proof-of-registration-settings',{waitUntil:'networkidle'});await p.waitForTimeout(2500);
 await p.screenshot({path:'adm_before.png',fullPage:true});
 log('before:',(await p.locator('main').innerText()).replace(/\s+/g,' ').slice(0,250));
 await p.locator('input[type=file]').first().setInputFiles('test_logo.png');await p.waitForTimeout(4000);
 await p.click('button:has-text("Save settings")');await p.waitForTimeout(3500);
 await p.screenshot({path:'adm_after.png',fullPage:true});
 log('toasts:',(await p.locator('[role=status],li[data-sonner-toast]').allInnerTexts()).join(' | ').slice(0,200));
 await b.close();
})();
