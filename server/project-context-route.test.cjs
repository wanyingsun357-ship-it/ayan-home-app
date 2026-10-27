'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os'),vm=require('vm');
const context=require('./project-context.cjs');
const bridge=fs.readFileSync(process.env.AYAN_PROJECT_BRIDGE_SOURCE||'/root/ayan/bridge/bridge.js','utf8');
const start=bridge.indexOf("app.post('/api/sessions/project',");
assert.ok(start>0);const end=bridge.indexOf('\n});',start)+5;assert.ok(end>start);
const code=bridge.slice(start,end);
test('live move handler preserves newest history, rejects an in-flight move and leaves ownership on copy failure',t=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'ayan-project-route-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const projects=path.join(root,'projects');fs.mkdirSync(path.join(projects,'home'),{recursive:true});
 const id='12345678-1234-1234-1234-123456789abc';let saves=0,handler;
 const session={id:'test',claudeSessionId:id};const cwdFor=s=>s.project?path.join(projects,s.project):root;
 const ccDirFor=cwd=>path.join(root,'transcripts',cwd===root?'root':'home');
 for(const dir of [ccDirFor(root),ccDirFor(path.join(projects,'home'))])fs.mkdirSync(dir,{recursive:true});
 fs.writeFileSync(path.join(ccDirFor(root),id+'.jsonl'),'NEWEST_HISTORY');
 fs.writeFileSync(path.join(ccDirFor(path.join(projects,'home')),id+'.jsonl'),'STALE_HISTORY');
 let fail=false;
 const sandbox={app:{post:(route,fn)=>{assert.equal(route,'/api/sessions/project');handler=fn;}},store:{sessions:[session]},safeProjName:n=>String(n||'').replace(/[^A-Za-z0-9_-]/g,''),PROJECTS_DIR:projects,PROJECT_DIR:root,cwdFor,ccDirFor,path,fs,isProcessing:true,saveStore:()=>saves++,console:{log(){}},require:name=>{
  assert.equal(name,'./project-context.cjs');return {moveTranscript(...args){if(fail)throw Error('synthetic copy failure');return context.moveTranscript(...args,{backupDir:path.join(root,'backups')});}};
 }};
 vm.runInNewContext(code,sandbox);
 function move(project){let status=200,body;handler({body:{id:'test',project}},{status(n){status=n;return this;},json(value){body=value;return this;}});return{status,body};}
 assert.equal(move('home').status,409);assert.equal(session.project,undefined);assert.equal(saves,0);
 sandbox.isProcessing=false;fail=true;
 assert.equal(move('home').status,500);assert.equal(session.project,undefined);assert.equal(saves,0);
 fail=false;assert.equal(move('home').status,200);assert.equal(session.project,'home');assert.equal(saves,1);
 assert.equal(fs.readFileSync(path.join(ccDirFor(path.join(projects,'home')),id+'.jsonl'),'utf8'),'NEWEST_HISTORY');
 fs.writeFileSync(path.join(ccDirFor(path.join(projects,'home')),id+'.jsonl'),'LATEST_HOME_HISTORY');
 assert.equal(move(null).status,200);assert.equal(session.project,undefined);assert.equal(saves,2);
 assert.equal(fs.readFileSync(path.join(ccDirFor(root),id+'.jsonl'),'utf8'),'LATEST_HOME_HISTORY');
});
