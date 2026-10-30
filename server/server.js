'use strict';
/* 斗地主记分器 · 服务端（零依赖，Node 内置 http）
 * 同时提供静态页面与 /api 房间接口，前后端同源，便于 Docker 部署
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'rooms.json');
const MAX_ROOM_AGE = 24 * 60 * 60 * 1000; // 24 小时无活动自动清理

/* ---------------- 存储 ---------------- */
let rooms = {};
try { rooms = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {}; } catch (e) { rooms = {}; }

let dirty = false;
function persist() {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = DATA_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(rooms));
    fs.renameSync(tmp, DATA_FILE);
    dirty = false;
  } catch (e) { console.error('[persist]', e.message); }
}
setInterval(function () { if (dirty) persist(); }, 800);
['SIGTERM', 'SIGINT'].forEach(function (s) {
  process.on(s, function () { persist(); process.exit(0); });
});
setInterval(function () {
  const now = Date.now();
  let changed = false;
  Object.keys(rooms).forEach(function (code) {
    if (now - (rooms[code].updatedAt || 0) > MAX_ROOM_AGE) { delete rooms[code]; changed = true; }
  });
  if (changed) dirty = true;
}, 60 * 60 * 1000);

/* ---------------- 工具 ---------------- */
function genCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = '';
  for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}
function touch(room) { room.updatedAt = Date.now(); dirty = true; }
function findRoom(code) { return rooms[String(code || '').toUpperCase()] || null; }
function usedNames(room) { return (room.players || []).filter(Boolean).map(function (p) { return p.name; }); }

/* ---------------- 业务 ---------------- */
function createRoom() {
  let code = genCode();
  let guard = 0;
  while (rooms[code] && guard++ < 20) code = genCode();
  const room = {
    code,
    players: [null, null, null],
    records: [],
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  rooms[code] = room;
  dirty = true;
  return { room };
}

function join(room, body) {
  const seated = room.players.filter(Boolean);
  if (body.playerId && seated.some(function (p) { return p.id === body.playerId; })) {
    return { room, playerId: body.playerId, seat: room.players.findIndex(function (p) { return p && p.id === body.playerId; }) };
  }
  const idx = room.players.findIndex(function (p) { return !p; });
  if (idx < 0) throw new Error('房间已满（3/3）');
  if (body.name && usedNames(room).indexOf(body.name) >= 0) throw new Error('NAME_TAKEN');
  const id = body.playerId || uid();
  room.players[idx] = {
    id,
    name: body.name || ('玩家' + (idx + 1)),
    origin: body.origin || '江湖',
    score: 0,
    joinedAt: Date.now()
  };
  touch(room);
  return { room, playerId: id, seat: idx };
}

function leave(room, body) {
  const idx = room.players.findIndex(function (p) { return p && p.id === body.playerId; });
  if (idx >= 0) room.players[idx] = null;
  touch(room);
  return { room };
}

function reroll(room, body) {
  const p = room.players.filter(Boolean).find(function (x) { return x.id === body.playerId; });
  if (!p) throw new Error('座位不存在');
  if (body.name && usedNames(room).filter(function (n) { return n !== p.name; }).indexOf(body.name) >= 0) {
    throw new Error('NAME_TAKEN');
  }
  p.name = body.name || p.name;
  p.origin = body.origin || p.origin;
  touch(room);
  return { room };
}

function settle(room, p) {
  const ps = room.players.filter(Boolean);
  if (ps.length !== 3) throw new Error('需要 3 人就位后才能记分');

  const list = [];
  let amount = 0;
  if (p.mode === 'landlord') {
    amount = Math.max(0, Number(p.base || 0) * Number(p.multi || 1));
    const landlord = ps.find(function (x) { return x.id === p.landlordId; });
    if (!landlord) throw new Error('地主不存在');
    const farmers = ps.filter(function (x) { return x.id !== landlord.id; });
    if (farmers.length !== 2) throw new Error('需要 3 人就位');
    if (p.result === 'win') farmers.forEach(function (f) { list.push({ from: f.id, to: landlord.id, amount }); });
    else farmers.forEach(function (f) { list.push({ from: landlord.id, to: f.id, amount }); });
  } else {
    amount = Math.max(0, Number(p.amount || 0));
    const from = ps.find(function (x) { return x.id === p.from; });
    if (!from) throw new Error('付款人不存在');
    (p.tos || []).forEach(function (tid) {
      const t = ps.find(function (x) { return x.id === tid; });
      if (t && t.id !== from.id) list.push({ from: from.id, to: t.id, amount });
    });
  }
  if (!list.length) throw new Error('没有有效的转账');
  if (amount <= 0) throw new Error('分数需大于 0');

  const names = {};
  ps.forEach(function (x) { names[x.id] = x.name; });

  const delta = {};
  list.forEach(function (t) {
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
    transfers: list.map(function (t) {
      return { from: t.from, to: t.to, amount: t.amount, fromName: names[t.from], toName: names[t.to] };
    }),
    delta,
    note: p.mode === 'landlord' ? ('底分 ' + p.base + ' × ' + p.multi + ' = ' + amount) : '自由转账'
  };

  if (p.mode === 'landlord') {
    const lord = ps.find(function (x) { return x.id === p.landlordId; });
    const farmers = ps.filter(function (x) { return x.id !== p.landlordId; });
    rec.title = '地主「' + lord.name + '」' + (p.result === 'win' ? '获胜' : '失败') +
      '（对 ' + farmers.map(function (x) { return x.name; }).join('、') + '）';
  } else {
    const from = ps.find(function (x) { return x.id === p.from; });
    rec.title = '「' + from.name + '」支付 ' + amount + ' 分';
  }

  list.forEach(function (t) {
    const a = ps.find(function (x) { return x.id === t.from; });
    const b = ps.find(function (x) { return x.id === t.to; });
    if (a) a.score -= t.amount;
    if (b) b.score += t.amount;
  });

  room.records.unshift(rec);
  touch(room);
  return { room, recordId: rec.id };
}

function undo(room) {
  if (!room.records.length) throw new Error('没有可撤销的记录');
  const rec = room.records[0];
  const ps = room.players.filter(Boolean);
  const missing = Object.keys(rec.delta).some(function (pid) { return !ps.find(function (x) { return x.id === pid; }); });
  if (missing) throw new Error('该局玩家已离座，无法撤销');
  Object.keys(rec.delta).forEach(function (pid) {
    const p = ps.find(function (x) { return x.id === pid; });
    if (p) p.score -= rec.delta[pid];
  });
  room.records.shift();
  touch(room);
  return { room };
}

function reset(room) {
  room.players.forEach(function (p) { if (p) p.score = 0; });
  touch(room);
  return { room };
}

function destroy(room) {
  delete rooms[room.code];
  dirty = true;
  return { ok: true };
}

function handle(body) {
  const action = body.action;
  if (action === 'health') return { ok: true, rooms: Object.keys(rooms).length };

  if (action === 'create') return createRoom();

  const room = findRoom(body.code);
  if (!room) throw new Error('房间不存在');

  switch (action) {
    case 'get': return { room };
    case 'join': return join(room, body);
    case 'leave': return leave(room, body);
    case 'reroll': return reroll(room, body);
    case 'settle': return settle(room, body);
    case 'undo': return undo(room);
    case 'reset': return reset(room);
    case 'destroy': return destroy(room);
    default: throw new Error('未知操作: ' + action);
  }
}

/* ---------------- HTTP ---------------- */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST,GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json; charset=utf-8'
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};
const STATIC_OK = ['index.html', 'app.js', 'styles.css', 'logo.jpg', 'apple-touch-icon.png', 'favicon.png'];

function serveStatic(req, res, pathname) {
  let name = pathname === '/' ? 'index.html' : decodeURIComponent(pathname.replace(/^\/+/, ''));
  // /r/ABCD 形式的房间链接：静态路径比 ?room= 更容易被微信抓成分享卡片
  let pathCode = '';
  const pm = /^r\/([A-Za-z0-9]{4})\/?$/.exec(name);
  if (pm) { pathCode = pm[1].toUpperCase(); name = 'index.html'; }
  if (STATIC_OK.indexOf(name) < 0) { res.writeHead(404); return res.end('not found'); }
  const file = path.join(ROOT, name);
  fs.readFile(file, function (err, buf) {
    if (err) { res.writeHead(404); return res.end('not found'); }
    const headers = {
      'Content-Type': MIME[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-cache'
    };
    // 微信等分享卡片抓取的是原始 HTML（不执行 JS），房间信息由服务端注入 og 标签
    if (name === 'index.html') {
      const qs = (req.url.split('?')[1] || '');
      const m = /(?:^|&)room=([A-Za-z0-9]{4})(?:&|$)/.exec(qs);
      const code = pathCode || (m ? m[1].toUpperCase() : '');
      // 房间链接按「内容页(article)」输出，微信对 article 更容易生成带标题/描述/缩略图的卡片
      const type = code ? 'article' : 'website';
      const title = code ? '斗地主记分 · 房间 ' + code : '斗地主记分器 · 房间码组队 · 随机人物 · 一键记分';
      const desc = code
        ? '房间 ' + code + '：3 人斗地主记分，点开链接自动入座并随机分配人物名，每局分数实时同步。'
        : '房间码组队、随机人物名、地主结算与自由转账记分，3 人同桌实时同步分数。';
      // 分享缩略图与规范链接必须是绝对地址，微信/QQ 抓取时才认
      const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
      const host = req.headers.host || 'ddz.qianxian.tech';
      const base = proto + '://' + host;
      const image = base + '/logo.jpg';
      const canonical = base + req.url;
      const keywords = code
        ? '斗地主记分,斗地主算分器,房间 ' + code + ',三人斗地主记分,实时同步'
        : '斗地主记分器,斗地主算分器,房间码组队,三人斗地主,实时记分,免注册';
      const html = buf.toString('utf8')
        .replace(/__SHARE_TYPE__/g, type)
        .replace(/__SHARE_KEYWORDS__/g, keywords)
        // 房间路由 /r/CODE 下，相对资源会被请求成 /r/app.js 而 404，统一改成绝对路径
        .replace(/(src|href)="(?!https?:|\/\/|#|\/)([^"]+)"/g, '$1="/$2"')
        .replace(/__SHARE_TITLE__/g, title)
        .replace(/__SHARE_DESC__/g, desc)
        .replace(/__SHARE_IMAGE__/g, image)
        .replace(/__SHARE_URL__/g, canonical);
      res.writeHead(200, headers);
      return res.end(html);
    }
    res.writeHead(200, headers);
    res.end(buf);
  });
}

const server = http.createServer(function (req, res) {
  const url = req.url.split('?')[0];

  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }

  if (url === '/api' || url === '/api/') {
    let raw = '';
    req.on('data', function (c) {
      raw += c;
      if (raw.length > 1e6) { req.destroy(); }
    });
    req.on('end', function () {
      let body = {};
      try { body = JSON.parse(raw || '{}'); } catch (e) { body = {}; }
      let out;
      try {
        out = Object.assign({ ok: true }, handle(body));
      } catch (e) {
        out = { ok: false, error: e.message || '服务器错误' };
      }
      res.writeHead(200, CORS);
      res.end(JSON.stringify(out));
      if (out.ok) persist();
    });
    return;
  }

  serveStatic(req, res, url);
});

server.listen(PORT, '0.0.0.0', function () {
  console.log('斗地主记分器服务已启动: http://0.0.0.0:' + PORT);
});
