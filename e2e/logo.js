const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({});const p=await b.newPage({viewport:{width:300,height:200}});
await p.setContent('<body style="margin:0;background:transparent"><div style="width:300px;height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;font:bold 44px Arial;color:#034EA1;border:6px solid #034EA1;box-sizing:border-box">NVTC<span style="font-size:15px;color:#EE4023">TEST LOGO</span></div></body>');
await p.screenshot({path:'test_logo.png',omitBackground:true});await b.close()})();
