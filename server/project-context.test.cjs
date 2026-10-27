'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path');
const context = require('./project-context.cjs');
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ayan-project-unit-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const home = path.join(root, 'projects', 'home');
  fs.mkdirSync(home, { recursive: true });
  const contents = { 'CLAUDE.md': 'HOME_INDEX\n@about-wanying.md\n@phone-intimacy.md', 'about-wanying.md': 'SYNTHETIC_ADDRESS_ONLY', 'phone-intimacy.md': '# phone intimacy\nSYNTHETIC_PHONE', 'nest.md': 'UNREFERENCED_NEST', 'memory-manual.md': 'MEMORY_MANUAL', 'monopoly.md': 'MONOPOLY' };
  for (const [name, text] of Object.entries(contents)) fs.writeFileSync(path.join(home, name), text);
  fs.writeFileSync(path.join(root, 'CLAUDE.md'), 'GLOBAL_REFERENCE');
  return { root, home, contents };
}
test('moving an old conversation in loads all six files once, including unreferenced files', t => {
  const f = fixture(t), options = { root: f.root };
  const current = context.snapshot(f.home, options);
  assert.equal(current.files.length, 6);
  assert.equal(current.files[0].name, 'CLAUDE.md');
  for (const text of Object.values(f.contents)) assert.equal(current.text.split(text).length - 1, 1);
  assert.ok(current.text.includes('UNREFERENCED_NEST'));
  assert.equal(current.text.includes('GLOBAL_REFERENCE'), false);
  assert.equal(context.snapshot(f.home, options).text, current.text);
});
test('edit/add/delete are reflected without stale content or relying on timestamps', t => {
  const f = fixture(t), options = { root: f.root };
  const before = context.snapshot(f.home, options);
  fs.writeFileSync(path.join(f.home, 'about-wanying.md'), 'NEW_SYNTHETIC_ADDRESS');
  fs.writeFileSync(path.join(f.home, 'new.md'), 'NEW_DOCUMENT');
  fs.unlinkSync(path.join(f.home, 'nest.md'));
  const after = context.snapshot(f.home, options);
  assert.notEqual(after.version, before.version);
  assert.ok(after.text.includes('NEW_SYNTHETIC_ADDRESS'));
  assert.ok(after.text.includes('NEW_DOCUMENT'));
  assert.equal(after.text.includes('UNREFERENCED_NEST'), false);
  assert.equal(after.text.includes('SYNTHETIC_ADDRESS_ONLY'), false);
});
test('move out emits an explicit no-project state; another project does not inherit home', t => {
  const f = fixture(t), options = { root: f.root };
  const out = context.snapshot(f.root, options);
  assert.equal(out.project, null);
  assert.equal(out.files.length, 0);
  assert.equal(out.text.includes('SYNTHETIC_ADDRESS_ONLY'), false);
  assert.ok(out.text.includes('停止加载'));
  const other = path.join(f.root, 'projects', 'other');
  fs.mkdirSync(other); fs.writeFileSync(path.join(other, 'CLAUDE.md'), 'OTHER_ONLY');
  const text = context.snapshot(other, options).text;
  assert.ok(text.includes('OTHER_ONLY'));
  assert.equal(text.includes('SYNTHETIC_ADDRESS_ONLY'), false);
});
test('Codex uses the same keyed application context for both enter and leave', t => {
  const f = fixture(t), options = { root: f.root };
  const inside = context.forCodex(f.home, options), outside = context.forCodex(f.root, options);
  assert.deepEqual(Object.keys(inside), [context.CONTEXT_KEY]);
  assert.deepEqual(Object.keys(outside), [context.CONTEXT_KEY]);
  assert.equal(inside[context.CONTEXT_KEY].kind, 'application');
  assert.equal(outside[context.CONTEXT_KEY].value.includes('SYNTHETIC_ADDRESS_ONLY'), false);
});
test('Claude preserves existing flags/settings/global loading while avoiding duplicate project import', t => {
  const f = fixture(t), options = { root: f.root };
  const before = ['-p', 'HELLO', '--resume', 'old-thread', '--append-system-prompt', 'CALLER_SYSTEM', '--settings', JSON.stringify({ permissions: { allow: ['Read'] }, claudeMdExcludes: ['OLD_EXCLUDE'] })];
  const result = context.forClaude(before, f.home, options);
  assert.equal(before[5], 'CALLER_SYSTEM');
  assert.equal(result[result.indexOf('--append-system-prompt') + 1], 'CALLER_SYSTEM');
  const prompt = result[result.indexOf('-p') + 1];
  assert.ok(prompt.endsWith('HELLO'));
  assert.ok(prompt.includes('SYNTHETIC_ADDRESS_ONLY'));
  assert.equal(prompt.split('SYNTHETIC_ADDRESS_ONLY').length - 1, 1);
  const settings = JSON.parse(result[result.indexOf('--settings') + 1]);
  assert.deepEqual(settings.permissions, { allow: ['Read'] });
  assert.deepEqual(settings.claudeMdExcludes, ['OLD_EXCLUDE', path.join(f.root, 'projects') + '/**']);
  assert.equal(result[result.indexOf('--resume') + 1], 'old-thread');
  const outside = context.forClaude(['-p', 'BYE'], f.root, options);
  assert.equal(outside.join(' ').includes('SYNTHETIC_ADDRESS_ONLY'), false);
});
test('unmanaged directories stay untouched; nested directories do not masquerade as projects', t => {
  const f = fixture(t), args = ['-p', 'HELLO'], options = { root: f.root };
  assert.deepEqual(context.forClaude(args, path.join(f.home, 'subdir'), options), args);
  assert.equal(context.forCodex(path.join(f.home, 'subdir'), options), undefined);
});
test('outside symlink content cannot enter a project snapshot', { skip: process.platform === 'win32' }, t => {
  const f = fixture(t), secret = path.join(f.root, 'outside.md');
  fs.writeFileSync(secret, 'OUTSIDE_SYNTHETIC_ONLY');
  fs.symlinkSync(secret, path.join(f.home, 'external.md'));
  assert.throws(() => context.snapshot(f.home, { root: f.root }), /其他位置/);
});
test('only completed snapshots are acknowledged; state is isolated per engine/thread and compaction refreshes it', t => {
  const f = fixture(t), options = { root: f.root, stateDir: path.join(f.root, 'state') };
  const first = context.prepare('codex', 'old-thread', f.home, options);
  assert.ok(first.text.includes('SYNTHETIC_ADDRESS_ONLY'));
  assert.ok(context.prepare('codex', 'old-thread', f.home, options).text);
  first.commit();
  assert.equal(context.prepare('codex', 'old-thread', f.home, options).text, '');
  assert.ok(context.prepare('codex', 'another-thread', f.home, options).text);
  assert.ok(context.prepare('claude', 'old-thread', f.home, options).text);
  context.invalidate('codex', 'old-thread', options);
  assert.ok(context.prepare('codex', 'old-thread', f.home, options).text);
  for (const name of fs.readdirSync(options.stateDir)) {
    assert.equal(fs.readFileSync(path.join(options.stateDir, name), 'utf8').includes('SYNTHETIC_ADDRESS_ONLY'), false);
  }
});
test('Claude failed output keeps snapshot pending; streamed success acknowledges the actual thread', t => {
  const { EventEmitter } = require('events');
  const f = fixture(t), options = { root: f.root, stateDir: path.join(f.root, 'state') };
  function child() { const p = new EventEmitter(); p.stdout = new EventEmitter(); return p; }
  const failed = context.prepareClaude(['-p', 'HELLO', '--resume', 'old'], f.home, options), bad = failed.observe(child());
  bad.stdout.emit('data', '{"type":"result","subtype":"error","is_error":true,"session_id":"old"}\n'); bad.emit('close', 1);
  assert.ok(context.prepareClaude(['-p', 'HELLO', '--resume', 'old'], f.home, options).text);
  const good = context.prepareClaude(['-p', 'HELLO'], f.home, options).observe(child());
  good.stdout.emit('data', '{"type":"result","subtype":"success","is_error":false,"session_id":"new-');
  good.stdout.emit('data', 'actual"}\n'); good.emit('close', 0);
  assert.equal(context.prepareClaude(['-p', 'HELLO', '--resume', 'new-actual'], f.home, options).text, '');
  const compacted = context.prepareClaude(['-p', 'HELLO', '--resume', 'new-actual'], f.home, options).observe(child());
  compacted.stdout.emit('data', '{"type":"system","subtype":"compact_boundary"}\n{"type":"result","subtype":"success","session_id":"new-actual"}\n'); compacted.emit('close', 0);
  assert.ok(context.prepareClaude(['-p', 'HELLO', '--resume', 'new-actual'], f.home, options).text);
});
test('moving back replaces an older target transcript and backs it up instead of resuming stale history', t => {
  const f = fixture(t), id = '12345678-1234-1234-1234-123456789abc';
  const cc = cwd => path.join(f.root, 'transcripts', cwd === f.home ? 'home' : 'root');
  const backupDir = path.join(f.root, 'backups');
  fs.mkdirSync(cc(f.home), { recursive: true }); fs.mkdirSync(cc(f.root), { recursive: true });
  fs.writeFileSync(path.join(cc(f.home), id + '.jsonl'), 'CURRENT_CHAT_HISTORY');
  fs.writeFileSync(path.join(cc(f.root), id + '.jsonl'), 'OLDER_HISTORY');
  context.moveTranscript(id, f.home, f.root, cc, { backupDir });
  assert.equal(fs.readFileSync(path.join(cc(f.root), id + '.jsonl'), 'utf8'), 'CURRENT_CHAT_HISTORY');
  assert.equal(fs.readFileSync(path.join(cc(f.home), id + '.jsonl'), 'utf8'), 'CURRENT_CHAT_HISTORY');
  assert.equal(fs.readdirSync(backupDir).length, 1);
  assert.equal(fs.readFileSync(path.join(backupDir, fs.readdirSync(backupDir)[0]), 'utf8'), 'OLDER_HISTORY');
});
