const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const source=fs.readFileSync(process.env.SHOPPING_TEST_WORKER || path.join(__dirname,'shopping-browser-worker.cjs'),'utf8');
 const literal=source.match(/launchPersistentContext\(PROFILE, (\{.*\})\);/)[1];
 const opts=Function('return ('+literal+')')(); opts.headless=true;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'shopping-display-test-'));
 let context;
 try {
  context=await chromium.launchPersistentContext(dir,opts);
  const page=context.pages()[0];
  await page.setContent('<button style="position:absolute;left:900px;top:430px;width:120px;height:100px" onclick="window.clicked=true">Test</button>');
  const actual=await page.evaluate(()=>({language:navigator.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone,screen:[screen.width,screen.height],viewport:[innerWidth,innerHeight],webdriver:navigator.webdriver}));
  assert.equal(actual.language,'zh-CN');assert.equal(actual.timezone,'Asia/Shanghai');assert.deepEqual(actual.screen,[1920,1080]);assert.deepEqual(actual.viewport,[1920,960]);assert.equal(actual.webdriver,false);
  await page.mouse.click(640*1920/1280,450*960/900);assert.equal(await page.evaluate(()=>window.clicked),true);
  console.log(JSON.stringify({passed:true,actual,networkRequestsToJD:0}));
 }finally{await context?.close();fs.rmSync(dir,{recursive:true,force:true});}
})().catch(e=>{console.error(e.message);process.exitCode=1;});

