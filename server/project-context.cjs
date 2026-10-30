'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// This is prompt scoping, not a filesystem permission boundary or history eraser.
const DEFAULT_ROOT = '/root/ayan';
const CONTEXT_KEY = 'ayan-current-project-v1';
function snapshot(cwd, { root = DEFAULT_ROOT } = {}) {
  root = path.resolve(root);
  cwd = path.resolve(cwd || root);
  const projects = path.join(root, 'projects');
  const project = path.dirname(cwd) === projects && /^[A-Za-z0-9_-]{1,24}$/.test(path.basename(cwd))
    ? path.basename(cwd) : null;
  if (cwd !== root && !project) return { managed: false };
  const files = [];
  const ui = path.join(root, 'APP_UI_PROTOCOL.md');
  if (fs.existsSync(ui)) {
    const stat = fs.statSync(ui);
    if (!stat.isFile() || stat.size > 65536 || path.dirname(fs.realpathSync(ui)) !== fs.realpathSync(root)) throw new Error('界面协议必须是根目录内的普通小文档');
    files.push({ name: '全局界面协议 APP_UI_PROTOCOL.md', content: fs.readFileSync(ui, 'utf8') });
  }
  if (project) {
    const realDir = fs.realpathSync(cwd);
    if (path.dirname(realDir) !== fs.realpathSync(projects)) throw new Error('项目目录不可指向其他位置');
    const names = fs.readdirSync(cwd).filter(name => /\.md$/i.test(name)).sort((a, b) =>
      a === 'CLAUDE.md' ? -1 : b === 'CLAUDE.md' ? 1 : a < b ? -1 : a > b ? 1 : 0);
    const seen = new Set();
    let bytes = 0;
    for (const name of names) {
      const full = fs.realpathSync(path.join(cwd, name));
      if (path.dirname(full) !== realDir) throw new Error('项目文档不可指向其他位置');
      const stat = fs.statSync(full);
      if (!stat.isFile() || seen.has(full)) continue;
      bytes += stat.size;
      if (bytes > 2 * 1024 * 1024) throw new Error('项目文档过大，请先整理后重试');
      seen.add(full);
      files.push({ name, content: fs.readFileSync(full, 'utf8') });
    }
  }
  const version = crypto.createHash('sha256').update(JSON.stringify({ project, files })).digest('hex');
  const scope = project
    ? `当前会话属于 Project ${project}。以下是该项目当前全部 ${files.length} 份 Markdown 文档的现行版本，按原文件用途使用；不需要再逐个读取才能了解这些资料。`
    : '当前会话没有归属 Project。停止加载和沿用旧项目的文档设定；只有全局资料和本段附带的现行界面协议继续适用。没有用户的新要求时，不主动读取旧项目目录。';
  const text = [
    '<当前项目资料>',
    scope,
    '本段是应用同步的项目状态，不是新的聊天发言。项目归属和文件版本以本段为准；历史里旧的项目资料不代表当前项目仍有效。自然继续聊天，无需播报同步过程。',
    `项目版本：${version}`,
    ...files.map(file => `\n--- 项目文档 ${JSON.stringify(file.name)} ---\n${file.content}\n--- 文档结束 ---`),
    '</当前项目资料>',
  ].join('\n');
  return { managed: true, project, files, version, text, projects };
}

function forCodex(cwd, options) {
  const current = snapshot(cwd, options);
  return current.managed ? { [CONTEXT_KEY]: { kind: 'application', value: current.text } } : undefined;
}

function claudeArgs(args, current, text) {
  if (!current.managed) return [...args];
  const result = [...args];
  const promptAt = result.indexOf('-p') >= 0 ? result.indexOf('-p') : result.indexOf('--print');
  if (promptAt < 0 || typeof result[promptAt + 1] !== 'string' || result[promptAt + 1].startsWith('--')) throw new Error('项目资料缺少聊天输入入口');
  // Resumed Claude sessions restore their original append-system-prompt, even
  // when a different CLI value is supplied. Send changes with the actual turn.
  // The files are already included. A literal @file.md in copied CLAUDE.md
  // would make the CLI attach that file a second time to this same message.
  if (text) result[promptAt + 1] = text.replace(/@([^\s`]+\.md)\b/g, '［文档引用：$1］') + '\n\n' + result[promptAt + 1];
  const settingsAt = result.indexOf('--settings');
  let settings = {};
  if (settingsAt >= 0) {
    const raw = result[settingsAt + 1];
    settings = JSON.parse(raw.trim().startsWith('{') ? raw : fs.readFileSync(raw, 'utf8'));
  }
  settings.claudeMdExcludes = [...new Set([...(settings.claudeMdExcludes || []), current.projects + '/**'])];
  if (settingsAt >= 0) result[settingsAt + 1] = JSON.stringify(settings);
  else result.push('--settings', JSON.stringify(settings));
  return result;
}
function forClaude(args, cwd, options) {
  const current = snapshot(cwd, options);
  return claudeArgs(args, current, current.text);
}

function stripSnapshot(text) {
  const value = String(text || '');
  if (!value.startsWith('<当前项目资料>\n')) return value;
  const end = value.indexOf('\n</当前项目资料>\n\n');
  if (end < 0 || !/\n项目版本：[a-f0-9]{64}\n/.test(value.slice(0, end))) return value;
  return value.slice(end + '\n</当前项目资料>\n\n'.length);
}

function moveTranscript(id, oldCwd, newCwd, ccDirFor, { backupDir = '/root/ayan/backups/project-transcripts' } = {}) {
  if (!id || oldCwd === newCwd) return;
  if (!/^[a-f0-9-]{36}$/i.test(id)) throw new Error('会话标识不合法');
  const source = path.join(ccDirFor(oldCwd), id + '.jsonl');
  if (!fs.existsSync(source)) return;
  const dir = ccDirFor(newCwd), destination = path.join(dir, id + '.jsonl');
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  if (fs.existsSync(destination)) {
    fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
    const backup = path.join(backupDir, id + '.' + crypto.randomUUID() + '.jsonl');
    fs.copyFileSync(destination, backup, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(backup, 0o600);
  }
  const tmp = destination + '.' + crypto.randomUUID() + '.tmp';
  try {
    fs.copyFileSync(source, tmp, fs.constants.COPYFILE_EXCL);
    fs.chmodSync(tmp, 0o600);
    fs.renameSync(tmp, destination);
  } finally { try { fs.unlinkSync(tmp); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
}

function statePath(engine, id, options = {}) {
  const key = crypto.createHash('sha256').update(engine + ':' + id).digest('hex');
  return path.join(options.stateDir || path.join(__dirname, 'project-context-state'), key + '.json');
}
function invalidate(engine, id, options) {
  if (!id) return;
  try { fs.unlinkSync(statePath(engine, id, options)); } catch (error) { if (error.code !== 'ENOENT') throw error; }
}
function prepare(engine, id, cwd, options) {
  const current = snapshot(cwd, options);
  let previous;
  if (id) { try { previous = JSON.parse(fs.readFileSync(statePath(engine, id, options), 'utf8')); } catch {} }
  const text = current.managed && previous?.schema === 1 && previous.version === current.version ? '' : current.text || '';
  return {
    text,
    additionalContext: text ? { [CONTEXT_KEY]: { kind: 'application', value: text } } : undefined,
    commit(actualId = id) {
      if (!current.managed || !actualId) return;
      const file = statePath(engine, actualId, options), dir = path.dirname(file);
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
      const tmp = file + '.' + crypto.randomUUID() + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify({ schema: 1, version: current.version }), { mode: 0o600 });
      fs.renameSync(tmp, file);
    },
    invalidate(actualId = id) { invalidate(engine, actualId, options); },
    current,
  };
}
function prepareClaude(args, cwd, options) {
  const at = args.indexOf('--resume'), id = at >= 0 ? args[at + 1] : null;
  const pending = prepare('claude', id, cwd, options);
  pending.args = claudeArgs(args, pending.current, pending.text);
  pending.observe = child => {
    let buffer = '', actualId = id, success = false, compacted = false;
    const read = line => {
      try {
        const event = JSON.parse(line);
        if (event.session_id) actualId = event.session_id;
        if (event.type === 'system' && event.subtype === 'compact_boundary') compacted = true;
        if (event.type === 'result') success = !event.is_error && event.subtype === 'success';
      } catch {}
    };
    child.stdout.on('data', data => {
      buffer += data;
      let end;
      while ((end = buffer.indexOf('\n')) >= 0) { read(buffer.slice(0, end)); buffer = buffer.slice(end + 1); }
      if (buffer.length > 8 * 1024 * 1024) buffer = '';
    });
    child.on('close', code => {
      if (buffer) read(buffer);
      if (code === 0 && success) {
        try { compacted ? pending.invalidate(actualId) : pending.commit(actualId); }
        catch { /* A missing acknowledgement retries the snapshot next turn. */ }
      }
    });
    return child;
  };
  return pending;
}
module.exports = { snapshot, forCodex, forClaude, prepare, prepareClaude, invalidate, stripSnapshot, moveTranscript, CONTEXT_KEY };
