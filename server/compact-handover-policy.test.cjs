'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),{EventEmitter}=require('events');
const policy=require('./compact-handover-policy.cjs');
const source=fs.readFileSync(process.env.AYAN_COMPACT_SOURCE||'/root/ayan/bridge/bridge.js','utf8');
const start=source.indexOf('function runHandoverLetterOnce('),end=source.indexOf('\nconst { buildTranscript, priorMemory }',start);
let args,role,timeout;
const sandbox={require:()=>policy,PROJECT_DIR:'/fixture',process:{env:{}},Date,clearTimeout(){},setTimeout(fn,ms){timeout=ms;return 1},spawnClaude(a,o,r){args=a;role=r;const p=new EventEmitter();p.stdout=new EventEmitter();setImmediate(()=>{p.stdout.emit('data',JSON.stringify({result:'a'.repeat(300)}));p.emit('close',0)});return p}};
vm.runInNewContext(source.slice(start,end)+'\nthis.call=runHandoverLetterOnce;',sandbox);
(async()=>{const text=await sandbox.call('original','/fixture','','');assert.equal(text.length,300);assert.equal(timeout,900000);assert.equal(role,'memory');assert(args.includes('--fork-session'));assert.equal(args[args.indexOf('--resume')+1],'original');assert.equal(args[args.indexOf('--tools')+1],'Write');assert(args.includes('--strict-mcp-config'));assert.equal(args[args.indexOf('--mcp-config')+1],'{"mcpServers":{}}');assert.equal(args[args.indexOf('--effort')+1],'low');console.log('PASS actual handover call: fork, bounded toolset, isolated MCP, larger timeout and valid result');})().catch(e=>{console.error(e);process.exitCode=1});
