export function toolInfo(raw) {
  const name = raw.match(/^([^\s({]+)/)?.[1] || '工具'
  const s = raw.toLowerCase()
  if (/chat-favorites/.test(s)) {
    const locked=/月亮锁收藏|["']?locked["']?\s*:\s*true/.test(s)
    const method=s.match(/(?:-x|method["']?\s*:)\s*["']?(post|patch|delete)/)?.[1]
    const label=locked?'收起一份月亮锁收藏':method==='post'?'收进自己的 Favorite':method==='patch'?'整理自己的 Favorite':method==='delete'?'移出一份 Favorite':'重看 Favorite'
    return {name,target:locked?'锁里的内容没有留在足迹':/owner=her/.test(s)?'婉莹的收藏':'阿晏的收藏',label,icon:'heart'}
  }
  const choices = [
    [/ombre|breath_search|echo|\/memory|\/memories/, '记忆', 'heart'],
    [/chat-favorites|favorites|收藏/, '重看或整理收藏', 'heart'],
    [/annotation|\/books|read_book|\/read\b/, '读书', 'book'],
    [/\/moments|朋友圈/, '朋友圈', 'chat'],
    [/wake-outbox|alarm|闹钟/, '设置或查看闹钟', 'voice'],
    [/diary|日记/, '日记', 'book'],
    [/\/tasks|\/plans|清单/, '清单', 'list'],
    [/\/gallery|imageview|查看图片|相册/, '图片与相册', 'image'],
    [/toolsearch|工具搜索/, '查找工具', 'search'],
    [/websearch|网页搜索|search|https?:\/\//, '查询与请求', 'globe'],
    [/filechange|文件修改|\bwrite\b|\bedit\b|apply_patch/, '修改文件', 'file'],
    [/\bread\b|\bcat\b|\bsed\b|\bhead\b|\btail\b|读取|file_path/, '读取文件', 'file'],
    [/bash|exec|终端/, '终端', 'terminal'],
  ]
  const match = choices.find(([pattern]) => pattern.test(s))
  const title=raw.match(/(?:title|name)[\"']?\s*[:=]\s*[\"']([^\"']{1,120})/)?.[1]
  const file=raw.match(/(?:\/[\w.\-\u4e00-\u9fff]+){2,}(?:\.[\w]+)?/)?.[0]
  const target=title ? '《'+title+'》' : /diary-for-ayan\.json/.test(raw) ? '日记库' : file ? file.split('/').pop() : ''
  return { name, target, label: match?.[1] || '工具调用', icon: match?.[2] || 'tool' }
}

export function parseTimeline(value) {
  const result = []
  let kind = 'voice', lines = []
  const flush = () => {
    let text = lines.join('\n').trim()
    const id = kind === 'tool' ? text.match(/^\[id=([^\]]+)\] /)?.[1] : null
    if (id) text=text.replace(/^\[id=[^\]]+\] /,'')
    if (text) result.push({ kind, text, ...(kind === 'tool' ? {...toolInfo(text),id,status:id?'running':'unknown'} : {}) })
    lines = []
  }
  for (const line of String(value || '').split(/\r?\n/)) {
    const status=line.match(/^【工具状态 (\S+) (completed|failed)】$/)
    if(status){flush();const tool=result.find(e=>e.kind==='tool'&&e.id===status[1]);if(tool)tool.status=status[2];kind='voice';continue}
    if (/^\s*【心声(?:[^】]*)】\s*$/.test(line)) { flush(); kind = 'voice'; continue }
    if (/^\s*【思考摘要】\s*$/.test(line)) { flush(); kind = 'summary'; continue }
    if (/^\s*⚙\uFE0F?\s*/.test(line)) {
      flush(); kind = 'tool'; lines.push(line.replace(/^\s*⚙\uFE0F?\s*/, '')); continue
    }
    if (kind === 'tool' && !line.trim()) { flush(); kind = 'voice'; continue }
    lines.push(line)
  }
  flush()
  return result
}
