'use strict';
const pattern=/\[HEARD:([a-f0-9-]{36})\]([\s\S]*?)\[\/HEARD\]/gi;
function extract(source){
 const result=[];for(const m of String(source||'').matchAll(pattern)){
  const text=m[2].replace(/\[[^\]]*\]/g,'').replace(/[\u0000-\u001f]/g,' ').replace(/\s+/g,' ').trim();
  if(text&&text.length<=160)result.push({id:m[1].toLowerCase(),text});if(result.length>=8)break;
 }return result;
}
function strip(source){
 let text=String(source||'').replace(/\[HEARD:[^\]\r\n]*\][\s\S]*?(?:\[\/HEARD\]|$)/gi,'');
 const at=text.lastIndexOf('[');if(at>=0){const tail=text.slice(at).toUpperCase();if('[HEARD:'.startsWith(tail)||tail.startsWith('[HEARD:'))text=text.slice(0,at);}
 return text;
}
function instruction(event){
 const observation={names:event.names,continued:!!event.continued,measurements:event.measurements||[]};
 return '声音观察编号 '+event.id+'；分类和测量：'+JSON.stringify(observation)+'。请你依据这些观察，用自己的话写一句简短自然的中文听觉描述，放在 [HEARD:'+event.id+']描述[/HEARD] 中。这一句用于“听到了”提示，不是口头台词，不加ZH、不朗读；随后照常回应她。用你自己的措辞，不照抄数值模板，不虚构没有提供的音色、距离、情绪、身体状态或声源；信息不足时简单描述即可。';
}
module.exports={extract,strip,instruction};
