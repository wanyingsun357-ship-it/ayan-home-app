const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),config=require('../../server/sound-whitelist.json');
const rules=Object.entries(config.categories).map(([kind,item])=>`        "${kind}": ${Object.keys(item.classes).length?'['+Object.entries(item.classes).map(([index,threshold])=>`${index}: ${threshold}`).join(', ')+']':'[:]'},`).join('\n');
const generated=`    // BEGIN GENERATED YAMNET RULES\n    static let rules: [String: [Int: Double]] = [\n${rules}\n    ]\n    static let humanClasses: [Int] = [${config.humanClasses.join(', ')}]\n    // END GENERATED YAMNET RULES`;
const file=path.join(root,'ios/App/App/CallSoundPolicy.swift'),source=fs.readFileSync(file,'utf8'),updated=source.replace(/    \/\/ BEGIN GENERATED YAMNET RULES[\s\S]*?    \/\/ END GENERATED YAMNET RULES/,generated);
if(process.argv.includes('--check')){if(source!==updated)throw Error('Swift/server whitelist diverged');}else fs.writeFileSync(file,updated);
