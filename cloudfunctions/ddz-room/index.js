/* 斗地主记分器 · 云端房间服务（CloudBase HTTP 云函数） */
const cloudbase = require('@cloudbase/node-sdk');

const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV });
const db = app.database();
const COL = 'ddz_rooms';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};

function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

async function findRoom(code) {
  const r = await db.collection(COL).where({ code: String(code || '').toUpperCase() }).limit(1).get();
  return (r.data && r.data[0]) || null;
}

async function saveRoom(doc) {
  doc.updatedAt = Date.now();
  await db.collection(COL).doc(doc._id).update({
    code: doc.code,
    players: doc.players,
    records: doc.records,
    updatedAt: doc.updatedAt
  });
  return doc;
}

async function createRoom() {
  let code, exist;
  let times = 0;
  do {
    code = genCode();
    exist = await findRoom(code);
    times++;
  } while (exist && times < 10);
  const doc = {
    code,
    players: [null, null, null],
    records: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  const res = await db.collection(COL).add(doc);
  doc._id = res.id || res._id;
  return doc;
}

function usedNames(doc) {
  return (doc.players || []).filter(Boolean).map(p => p.name);
}

/**
 * 入座：服务端负责人数限制（最多 3 人）与名字去重
 */
async function join(doc, { name, origin, playerId }) {
  const seated = doc.players.filter(Boolean);
  if (playerId && seated.some(p => p.id === playerId)) {
    return { room: doc, playerId, seat: doc.players.findIndex(p => p && p.id === playerId) };
  }
  const idx = doc.players.findIndex(p => !p);
  if (idx < 0) throw new Error('房间已满（3/3）');
  if (name && usedNames(doc).indexOf(name) >= 0) throw new Error('NAME_TAKEN');
  const id = playerId || uid();
  doc.players[idx] = {
    id,
    name: name || ('玩家' + (idx + 1)),
    origin: origin || '江湖',
    score: 0,
    joinedAt: Date.now()
  };
  await saveRoom(doc);
  return { room: doc, playerId: id, seat: idx };
}

async function leave(doc, { playerId }) {
  const idx = doc.players.findIndex(p => p && p.id === playerId);
  if (idx >= 0) doc.players[idx] = null;
  await saveRoom(doc);
  return { room: doc };
}

async function sitReroll(doc, { playerId, name, origin }) {
  const p = doc.players.filter(Boolean).find(x => x.id === playerId);
  if (!p) throw new Error('座位不存在');
  if (name && usedNames(doc).filter(n => n !== p.name).indexOf(name) >= 0) throw new Error('NAME_TAKEN');
  p.name = name || p.name;
  p.origin = origin || p.origin;
  await saveRoom(doc);
  return { room: doc };
}

function calcTransfers(doc, p) {
  const ps = doc.players.filter(Boolean);
  const list = [];
  if (p.mode === 'landlord') {
    const amount = Math.max(0, Number(p.base || 0) * Number(p.multi || 1));
    const landlord = ps.find(x => x.id === p.landlordId);
    if (!landlord) throw new Error('地主不存在');
    const farmers = ps.filter(x => x.id !== landlord.id);
    if (farmers.length !== 2) throw new Error('需要 3 人就位');
    if (p.result === 'win') farmers.forEach(f => list.push({ from: f.id, to: landlord.id, amount }));
    else farmers.forEach(f => list.push({ from: landlord.id, to: f.id, amount }));
    return { amount, list };
  }
  const amount = Math.max(0, Number(p.amount || 0));
  const from = ps.find(x => x.id === p.from);
  if (!from) throw new Error('付款人不存在');
  (p.tos || []).forEach(tid => {
    const t = ps.find(x => x.id === tid);
    if (t && t.id !== from.id) list.push({ from: from.id, to: t.id, amount });
  });
  return { amount, list };
}

async function settle(doc, p) {
  const ps = doc.players.filter(Boolean);
  if (ps.length !== 3) throw new Error('需要 3 人就位后才能记分');
  const { amount, list } = calcTransfers(doc, p);
  if (!list.length) throw new Error('没有有效的转账');
  if (amount <= 0) throw new Error('分数需大于 0');

  const names = {};
  ps.forEach(x => { names[x.id] = x.name; });

  const delta = {};
  list.forEach(t => {
    delta[t.from] = (delta[t.from] || 0) - t.amount;
    delta[t.to] = (delta[t.to] || 0) + t.amount;
  });

  const rec = {
    id: uid(),
    ts: Date.now(),
    mode: p.mode,
    amount,
    result: p.mode === 'landlord' ? p.result : null,
    landlordId: p.mode === 'landlord' ? p.landlordId : null,
    transfers: list.map(t => ({
      from: t.from, to: t.to, amount: t.amount,
      fromName: names[t.from], toName: names[t.to]
    })),
    delta,
    note: p.mode === 'landlord' ? ('底分 ' + p.base + ' × ' + p.multi + ' = ' + amount) : '自由转账'
  };

  if (p.mode === 'landlord') {
    const lord = ps.find(x => x.id === p.landlordId);
    const farmers = ps.filter(x => x.id !== p.landlordId);
    rec.title = '地主「' + lord.name + '」' + (p.result === 'win' ? '获胜' : '失败') +
      '（对 ' + farmers.map(x => x.name).join('、') + '）';
  } else {
    const from = ps.find(x => x.id === p.from);
    rec.title = '「' + from.name + '」支付 ' + amount + ' 分';
  }

  list.forEach(t => {
    const a = ps.find(x => x.id === t.from);
    const b = ps.find(x => x.id === t.to);
    if (a) a.score -= t.amount;
    if (b) b.score += t.amount;
  });

  doc.records.unshift(rec);
  await saveRoom(doc);
  return { room: doc, recordId: rec.id };
}

async function undo(doc) {
  if (!doc.records.length) throw new Error('没有可撤销的记录');
  const rec = doc.records[0];
  const ps = doc.players.filter(Boolean);
  const missing = Object.keys(rec.delta).some(pid => !ps.find(x => x.id === pid));
  if (missing) throw new Error('该局玩家已离座，无法撤销');
  Object.keys(rec.delta).forEach(pid => {
    const pl = ps.find(x => x.id === pid);
    if (pl) pl.score -= rec.delta[pid];
  });
  doc.records.shift();
  await saveRoom(doc);
  return { room: doc };
}

async function reset(doc) {
  doc.players.forEach(p => { if (p) p.score = 0; });
  await saveRoom(doc);
  return { room: doc };
}

async function destroy(doc) {
  await db.collection(COL).doc(doc._id).remove();
  return { ok: true };
}

async function handle(body) {
  const action = body.action;

  if (action === 'create') {
    const doc = await createRoom();
    return { room: doc };
  }

  const code = String(body.code || '').toUpperCase();
  if (!code) throw new Error('房间码不能为空');
  const doc = await findRoom(code);
  if (!doc) throw new Error('房间不存在');

  switch (action) {
    case 'get': return { room: doc };
    case 'join': return await join(doc, body);
    case 'leave': return await leave(doc, body);
    case 'reroll': return await sitReroll(doc, body);
    case 'settle': return await settle(doc, body);
    case 'undo': return await undo(doc);
    case 'reset': return await reset(doc);
    case 'destroy': return await destroy(doc);
    default: throw new Error('未知操作: ' + action);
  }
}

exports.main = async (event) => {
  if (event && (event.httpMethod === 'OPTIONS' || event.Method === 'OPTIONS')) {
    return { statusCode: 204, headers: CORS, body: '' };
  }
  let body = {};
  try {
    const raw = event && (event.body || event.Body);
    body = typeof raw === 'string' ? JSON.parse(raw || '{}') : (raw || {});
  } catch (e) {
    body = {};
  }
  try {
    const res = await handle(body);
    return { statusCode: 200, headers: CORS, body: JSON.stringify(Object.assign({ ok: true }, res)) };
  } catch (e) {
    return { statusCode: 200, headers: CORS, body: JSON.stringify({ ok: false, error: e.message || '服务器错误' }) };
  }
};
