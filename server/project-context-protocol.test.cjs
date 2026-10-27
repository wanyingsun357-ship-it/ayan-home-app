'use strict';
// Real installed CLIs, isolated homes, synthetic files, loopback model responses.
// This never authenticates to, or sends requests to, a real inference endpoint.
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('fs'),path=require('path'),os=require('os'),http=require('http');
const {spawn}=require('child_process');
const context=require('./project-context.cjs'),{CodexRpc}=require('./codex-rpc.cjs');
function fixture(t){
 const base=fs.mkdtempSync(path.join(os.tmpdir(),'ayan-project-protocol-'));
 const root=path.join(base,'app'),home=path.join(root,'projects/home');
 fs.mkdirSync(home,{recursive:true});
 const docs={'CLAUDE.md':'HOME_INDEX_TOKEN\n@about-wanying.md','about-wanying.md':'ADDRESS_FIXTURE_V1','nest.md':'NEST_UNREFERENCED_TOKEN','memory-manual.md':'MANUAL_TOKEN','monopoly.md':'MONOPOLY_TOKEN','phone-intimacy.md':'PHONE_TOKEN'};
 for(const [name,text]of Object.entries(docs))fs.writeFileSync(path.join(home,name),text);
 fs.writeFileSync(path.join(root,'CLAUDE.md'),'GLOBAL_FIXTURE_TOKEN');
 t.after(()=>fs.rmSync(base,{recursive:true,force:true}));
 return {base,root,home,docs};
}
async function modelServer(t){
 const requests=[];let seq=0;
 const server=http.createServer((req,res)=>{let raw='';req.on('data',d=>raw+=d);req.on('end',()=>{
  const body=raw?JSON.parse(raw):{};
  if(req.url.includes('count_tokens')){res.writeHead(200,{'Content-Type':'application/json'});res.end('{"input_tokens":10}');return;}
  if(!req.url.includes('/messages')&&!req.url.includes('/responses')){res.writeHead(200,{'Content-Type':'application/json'});res.end('{}');return;}
  requests.push(body);const id='fixture_'+(++seq),item={id:'msg_'+seq,type:'message',status:'completed',role:'assistant',content:[{type:'output_text',text:'OK',annotations:[]}]};
  res.writeHead(200,{'Content-Type':'text/event-stream'});
  const events=req.url.includes('/messages')?[
   {type:'message_start',message:{id,type:'message',role:'assistant',model:body.model,content:[],stop_reason:null,stop_sequence:null,usage:{input_tokens:10,output_tokens:0}}},
   {type:'content_block_start',index:0,content_block:{type:'text',text:''}},
   {type:'content_block_delta',index:0,delta:{type:'text_delta',text:'OK'}},
   {type:'content_block_stop',index:0},
   {type:'message_delta',delta:{stop_reason:'end_turn',stop_sequence:null},usage:{output_tokens:1}},
   {type:'message_stop'}
  ]:[
   {type:'response.created',response:{id,object:'response',status:'in_progress',output:[]}},
   {type:'response.output_item.added',output_index:0,item:{...item,status:'in_progress',content:[]}},
   {type:'response.output_text.delta',item_id:item.id,output_index:0,content_index:0,delta:'OK'},
   {type:'response.output_item.done',output_index:0,item},
   {type:'response.completed',response:{id,object:'response',status:'completed',output:[item],usage:{input_tokens:10,output_tokens:1,total_tokens:11}}}
  ];
  for(const event of events)res.write('event: '+event.type+'\ndata: '+JSON.stringify(event)+'\n\n');res.end();
 });});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(()=>{server.closeAllConnections();server.close();});
 return {requests,url:'http://127.0.0.1:'+server.address().port};
}
const count=(text,needle)=>text.split(needle).length-1;
function developerText(body){return(body.input||[]).filter(x=>x.role==='developer').map(x=>(x.content||[]).map(b=>b.text||'').join('\n')).join('\n');}

test('Codex: old thread enters, reconnects without duplicate, updates files, leaves and re-enters', {timeout:120000}, async t=>{
 const f=fixture(t),mock=await modelServer(t),codeHome=path.join(f.base,'codex');fs.mkdirSync(codeHome);
 const configArgs=['-c','model_provider="project_test"','-c','model_providers.project_test.name="Project test"','-c',`model_providers.project_test.base_url="${mock.url}/v1"`,'-c','model_providers.project_test.wire_api="responses"','-c','model_providers.project_test.requires_openai_auth=false','-c','model_providers.project_test.supports_websockets=false','-c','mcp_servers={}'];
 let rpc,threadId;
 async function open(cwd){rpc=new CodexRpc({cwd,configArgs,env:{CODEX_HOME:codeHome}});await rpc.initialize({experimentalApi:true});}
 async function turn(cwd,label,include=true){
  await open(cwd);
  const params={cwd,model:'gpt-5.6-sol',developerInstructions:'GLOBAL_FIXTURE_TOKEN',approvalPolicy:'never',sandbox:'read-only'};
  const result=threadId?await rpc.call('thread/resume',{...params,threadId}):await rpc.call('thread/start',params);
  if(threadId)assert.equal(result.thread.id,threadId);else threadId=result.thread.id;
  try{
   const project=include?context.prepare('codex',threadId,cwd,{root:f.root,stateDir:path.join(f.base,'state')}):null;
   await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('fixture turn timeout')),30000);
    rpc.on('notification',m=>{if(m.method==='turn/completed'){clearTimeout(timer);m.params.turn.status==='completed'?resolve():reject(Error('fixture turn failed'));}});
    rpc.call('turn/start',{threadId,input:[{type:'text',text:label}],...(project?{additionalContext:project.additionalContext}:{}),model:'gpt-5.6-sol'}).catch(e=>{clearTimeout(timer);reject(e);});
   });
   project?.commit();
   return developerText(mock.requests.at(-1));
  }finally{rpc.close();}
 }
 t.after(()=>rpc?.close());
 assert.equal((await turn(f.root,'legacy-before-project',false)).includes('ADDRESS_FIXTURE_V1'),false);
 const inside=await turn(f.home,'moved-in');
 for(const text of Object.values(f.docs))assert.equal(count(inside,text),1);
 const same=await turn(f.home,'same-project-next-process');assert.equal(count(same,'ADDRESS_FIXTURE_V1'),1);
 fs.writeFileSync(path.join(f.home,'about-wanying.md'),'ADDRESS_FIXTURE_V2');
 const edited=await turn(f.home,'edited-file');assert.equal(count(edited,'ADDRESS_FIXTURE_V2'),1);
 assert.ok(edited.lastIndexOf('ADDRESS_FIXTURE_V2')>edited.lastIndexOf('ADDRESS_FIXTURE_V1'));
 const outside=await turn(f.root,'moved-out');
 assert.ok(outside.includes('当前会话没有归属 Project'));
 assert.ok(outside.lastIndexOf('当前会话没有归属 Project')>outside.lastIndexOf('ADDRESS_FIXTURE_V2'));
 const outsideSame=await turn(f.root,'outside-again');assert.equal(count(outsideSame,'当前会话没有归属 Project'),1);
 const reentered=await turn(f.home,'moved-back-in');assert.ok(reentered.lastIndexOf('ADDRESS_FIXTURE_V2')>reentered.lastIndexOf('当前会话没有归属 Project'));
 assert.equal(mock.requests.length,7);
});

test('Claude: old resumed session receives all project files through one current system snapshot', {timeout:150000}, async t=>{
 const f=fixture(t),mock=await modelServer(t),configDir=path.join(f.base,'claude');fs.mkdirSync(configDir);
 let sessionId;
 async function turn(cwd,label){
  const project=context.prepareClaude(['-p',label,'--output-format','json','--model','claude-sonnet-4-6','--tools','','--strict-mcp-config','--mcp-config','{"mcpServers":{}}',...(sessionId?['--resume',sessionId]:[])],cwd,{root:f.root,stateDir:path.join(f.base,'state')});
  const args=project.args;
  const env={...process.env,CLAUDE_CONFIG_DIR:configDir,ANTHROPIC_BASE_URL:mock.url,ANTHROPIC_API_KEY:'fixture-only-not-a-real-key',ANTHROPIC_AUTH_TOKEN:'',CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC:'1',DISABLE_TELEMETRY:'1',DISABLE_AUTOUPDATER:'1',CLAUDE_CODE_DISABLE_AUTO_MEMORY:'1'};
  for(const key of ['CLAUDE_CODE_OAUTH_TOKEN','CLAUDECODE','CLAUDE_CODE_DISABLE_CLAUDE_MDS','HTTP_PROXY','HTTPS_PROXY','ALL_PROXY'])delete env[key];
  const child=project.observe(spawn('claude',args,{cwd,env,stdio:['ignore','pipe','pipe']}));let out='',err='';child.stdout.on('data',d=>out+=d);child.stderr.on('data',d=>err+=d);
  const code=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.kill();reject(Error('Claude fixture timeout'));},45000);child.on('error',reject);child.on('close',code=>{clearTimeout(timer);resolve(code);});});
  assert.equal(code,0,'isolated Claude process failed: '+err.slice(-300)+' '+out.slice(-300));
  const result=JSON.parse(out);assert.equal(result.is_error,false);if(sessionId)assert.equal(result.session_id,sessionId);else sessionId=result.session_id;
  const body=mock.requests.at(-1);
  return {all:JSON.stringify(body),latest:JSON.stringify(body.messages.at(-1)),sent:project.text};
 }
 await turn(f.root,'legacy-before-project');
 function copyTranscript(from,to){
  context.moveTranscript(sessionId,from,to,cwd=>path.join(configDir,'projects',cwd.replace(/\//g,'-')),{backupDir:path.join(f.base,'backups')});
 }
 copyTranscript(f.root,f.home);
 const inside=await turn(f.home,'moved-in');
 for(const text of ['HOME_INDEX_TOKEN','ADDRESS_FIXTURE_V1','NEST_UNREFERENCED_TOKEN','MANUAL_TOKEN','MONOPOLY_TOKEN','PHONE_TOKEN'])assert.equal(count(inside.all,text),1);
 assert.ok(inside.all.includes('GLOBAL_FIXTURE_TOKEN'));
 const same=await turn(f.home,'same-project');assert.equal(count(same.all,'ADDRESS_FIXTURE_V1'),1);assert.equal(same.sent,'');
 fs.writeFileSync(path.join(f.home,'about-wanying.md'),'ADDRESS_FIXTURE_V2');
 const edited=await turn(f.home,'edited');assert.ok(edited.latest.includes('ADDRESS_FIXTURE_V2'));assert.equal(edited.sent.includes('ADDRESS_FIXTURE_V1'),false);
 copyTranscript(f.home,f.root);
 const outside=await turn(f.root,'moved-out');assert.ok(outside.latest.includes('当前会话没有归属 Project'));assert.equal(outside.sent.includes('ADDRESS_FIXTURE_V2'),false);
 assert.equal(outside.sent.includes('NEST_UNREFERENCED_TOKEN'),false);assert.ok(outside.all.includes('GLOBAL_FIXTURE_TOKEN'));
});
