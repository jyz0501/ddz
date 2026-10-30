/* 斗地主记分器 —— 纯前端实现，无需后端，双击 index.html 即可运行 */
(function () {
  'use strict';

  /* ===================== 人物库 ===================== */
  var HEROES = {
    '三国人物': ['刘备', '关羽', '张飞', '赵云', '马超', '黄忠', '诸葛亮', '姜维', '魏延', '曹操',
      '典韦', '许褚', '郭嘉', '荀彧', '贾诩', '司马懿', '张辽', '徐晃', '孙权', '周瑜',
      '鲁肃', '陆逊', '吕蒙', '甘宁', '吕布', '貂蝉', '大乔', '小乔', '孙尚香', '黄盖',
      '太史慈', '庞统', '徐庶', '马岱', '关平', '廖化'],
    '射雕人物': ['郭靖', '黄蓉', '杨康', '穆念慈', '黄药师', '洪七公', '欧阳锋', '一灯大师', '周伯通',
      '梅超风', '陈玄风', '丘处机', '王处一', '马钰', '柯镇恶', '朱聪', '韩宝驹', '南希仁',
      '张阿生', '全金发', '韩小莹', '华筝', '拖雷', '哲别', '完颜洪烈', '杨铁心', '包惜弱',
      '傻姑', '陆冠英', '程瑶迦', '欧阳克', '裘千仞', '瑛姑', '鲁有脚', '彭长老', '梁子翁',
      '沙通天', '灵智上人'],
    '水浒英雄': ['宋江', '卢俊义', '吴用', '公孙胜', '林冲', '武松', '鲁智深', '李逵', '燕青', '花荣',
      '柴进', '杨志', '戴宗', '时迁', '阮小二', '阮小五', '阮小七', '张顺', '李俊', '扈三娘',
      '孙二娘', '顾大嫂', '秦明', '呼延灼', '关胜', '董平', '张清', '徐宁', '朱仝', '雷横',
      '晁盖', '王英', '石秀', '杨雄', '解珍', '解宝', '史进', '刘唐', '白胜', '朱贵'],
    '红楼人物': ['贾宝玉', '林黛玉', '薛宝钗', '王熙凤', '贾母', '贾政', '王夫人', '贾探春', '贾迎春',
      '贾惜春', '史湘云', '妙玉', '李纨', '贾元春', '秦可卿', '尤二姐', '尤三姐', '鸳鸯',
      '袭人', '晴雯', '平儿', '香菱', '薛蟠', '贾环', '贾琏', '刘姥姥', '紫鹃', '司棋',
      '金钏', '芳官', '小红', '邢岫烟', '薛宝琴', '贾蓉', '柳湘莲', '蒋玉菡']
  };
  var ORIGINS = Object.keys(HEROES);

  /* ===================== 存储 ===================== */
  var KEY_ROOM = function (code) { return 'ddz_room_' + code; };
  var KEY_ME = function (code) { return 'ddz_me_' + code; };
  var KEY_ME_SESSION = function (code) { return 'ddz_me_s_' + code; };
  var KEY_LAST = 'ddz_last_room';
  var KEY_MY_ROOMS = 'ddz_my_rooms';

  // 本机创建/加入过的房间（未解散的都留着，退出后也能从首页重新进入）
  function myRooms() {
    try {
      var a = JSON.parse(safeGet(KEY_MY_ROOMS) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) { return []; }
  }
  function addMyRoom(code) {
    if (!code) return;
    var list = myRooms().filter(function (c) { return c !== code; });
    list.unshift(code);
    safeSet(KEY_MY_ROOMS, JSON.stringify(list.slice(0, 12))); // 最多留 12 个
  }
  function removeMyRoom(code) {
    safeSet(KEY_MY_ROOMS, JSON.stringify(myRooms().filter(function (c) { return c !== code; })));
  }

  // 座位身份优先取当前标签页（sessionStorage），这样同一浏览器开多个标签也能各占一座
  function getMe(code) {
    var s = null;
    try { s = sessionStorage.getItem(KEY_ME_SESSION(code)); } catch (e) { }
    return s || safeGet(KEY_ME(code));
  }
  function setMe(code, id) {
    try { sessionStorage.setItem(KEY_ME_SESSION(code), id); } catch (e) { }
    safeSet(KEY_ME(code), id);
  }
  function clearMe(code) {
    try { sessionStorage.removeItem(KEY_ME_SESSION(code)); } catch (e) { }
    safeDel(KEY_ME(code));
  }

  function safeGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function safeSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }
  function safeDel(k) { try { localStorage.removeItem(k); } catch (e) { } }

  // 开局计时：人满（3 人就位）即视为开局，记下时刻；解散房间才清除
  var KEY_START = function (code) { return 'ddz_start_' + code; };

  function getStartTs(code) {
    if (!code) return 0;
    var v = safeGet(KEY_START(code));
    return v ? (Number(v) || 0) : 0;
  }
  function markStarted(code) {
    if (!code || getStartTs(code)) return;
    safeSet(KEY_START(code), String(Date.now()));
  }
  function clearStarted(code) { if (code) safeDel(KEY_START(code)); }

  function fmtDuration(ms) {
    if (ms < 0) ms = 0;
    var s = Math.floor(ms / 1000);
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    var p = function (n) { return n < 10 ? '0' + n : String(n); };
    return h > 0 ? h + ':' + p(m) + ':' + p(sec) : p(m) + ':' + p(sec);
  }

  function loadRoom(code) {
    var raw = safeGet(KEY_ROOM(code));
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  var bc = (typeof BroadcastChannel !== 'undefined') ? new BroadcastChannel('ddz_room_sync') : null;

  function saveRoom(silent) {
    if (!state.room) return;
    safeSet(KEY_ROOM(state.room.code), JSON.stringify(state.room));
    if (bc) bc.postMessage({ code: state.room.code, ts: Date.now() });
    if (!silent) render();
  }

  /* ===================== 工具 ===================== */
  function uid() { return Math.random().toString(36).slice(2, 10); }

  function genCode() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '', i;
    do {
      s = '';
      for (i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    } while (loadRoom(s));
    return s;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtTime(ts) {
    var d = new Date(ts), p = function (n) { return n < 10 ? '0' + n : '' + n; };
    return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  }

  function toast(msg) {
    var root = document.getElementById('toast-root');
    var el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    root.appendChild(el);
    setTimeout(function () { el.remove(); }, 1900);
  }

  function copyText(text, okMsg) {
    var done = function () { toast(okMsg || '已复制'); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('复制失败，请手动复制'); }
      ta.remove();
    }
  }

  // 静态资源统一用绝对路径，否则 /r/CODE 页面下会请求成 /r/logo.jpg 而 404
  function assetUrl(name) {
    return location.protocol === 'file:' ? name : '/' + name;
  }

  // 用路径形式 /r/CODE：微信对带 ? 参数的链接抓取命中率低，常常只显示一行网址
  function inviteLink(code) {
    if (location.protocol === 'file:') {
      return location.href.split('#')[0].split('?')[0] + '?room=' + code;
    }
    var origin = (location.origin && location.origin !== 'null')
      ? location.origin
      : location.href.split('#')[0].split('?')[0].replace(/index\.html$/, '');
    return origin.replace(/\/+$/, '') + '/r/' + code;
  }

  /* ===================== 邀请 / 微信转发 ===================== */
  var ICON_WECHAT = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
    '<path fill="currentColor" d="M9.1 3C5 3 1.6 5.7 1.6 9c0 1.8.9 3.4 2.5 4.5l-.6 2.1 2.5-1.3c.8.2 1.6.4 2.5.4h.5a5.9 5.9 0 0 1-.2-1.5C8.8 9.9 12 7.2 16 7.2h.5C15.8 4.7 12.7 3 9.1 3Z"/>' +
    '<circle cx="6.4" cy="8" r=".95" fill="#07C160"/><circle cx="11.2" cy="8" r=".95" fill="#07C160"/>' +
    '<path fill="currentColor" d="M22.4 14c0-2.7-2.7-4.9-6.1-4.9s-6.1 2.2-6.1 4.9 2.7 4.9 6.1 4.9c.8 0 1.6-.1 2.3-.4l2.3 1.2-.6-1.9c1.3-.9 2.1-2.3 2.1-3.8Z"/>' +
    '<circle cx="14.2" cy="13.2" r=".85" fill="#fff"/><circle cx="18.4" cy="13.2" r=".85" fill="#fff"/>' +
    '</svg>';

  function shareTitle() {
    return state.room ? '斗地主记分 · 房间 ' + state.room.code : '斗地主记分器';
  }

  function shareDesc() {
    if (!state.room) return '房间码组队 · 随机人物 · 一键记分，3 人同桌实时同步分数。';
    var seated = state.room.players.filter(Boolean).length;
    return '房间 ' + state.room.code + '：3 人斗地主记分，点开链接自动入座并随机分配人物名（已就位 ' +
      seated + '/3），每局分数实时同步。';
  }

  function setMeta(attr, key, val) {
    var el = document.querySelector ? document.querySelector('meta[' + attr + '="' + key + '"]') : null;
    if (el) el.setAttribute('content', val);
  }

  // 让微信/浏览器分享卡片显示当前房间信息
  function updateShareMeta() {
    var t = shareTitle(), d = shareDesc();
    if (document.title !== t) document.title = t;
    setMeta('name', 'description', d);
    setMeta('property', 'og:title', t);
    setMeta('property', 'og:description', d);
    setMeta('property', 'og:url', location.href);
    setMeta('itemprop', 'name', t);
    setMeta('itemprop', 'description', d);
    var link = document.querySelector ? document.querySelector('link[rel="canonical"]') : null;
    if (link) link.setAttribute('href', location.href);
  }

  function openInvite() {
    if (!state.room) return;
    closeWechatGuide();
    state.modal = { type: 'invite' };
    renderModal();
  }

  function inWechat() {
    return /MicroMessenger/i.test(navigator.userAgent || '');
  }

  // 微信内无法用 JS 直接调起分享面板，给出右上角菜单的指引
  function showWechatGuide() {
    var old = document.querySelector('.wx-guide');
    if (old) old.remove();
    var box = document.createElement('div');
    box.className = 'wx-guide';
    box.setAttribute('data-act', 'wx-guide-close');
    box.innerHTML =
      '<div class="wx-guide-inner">' +
      '<div class="wx-arrow">☝</div>' +
      '<p class="wx-main">点击右上角 <b>···</b><br/>选择「发送给朋友」</p>' +
      '<div class="wx-tip">点击任意处关闭</div>' +
      '</div>';
    document.body.appendChild(box);
  }

  function closeWechatGuide() {
    var g = document.querySelector('.wx-guide');
    if (g) g.remove();
  }

  function shareToFriend() {
    var link = inviteLink(state.room.code);
    var text = '斗地主记分 · 房间 ' + state.room.code + '，点开自动入座';

    if (inWechat()) { showWechatGuide(); return; }

    if (navigator.share && (!navigator.canShare || navigator.canShare({ url: link }))) {
      navigator.share({ title: shareTitle(), text: text, url: link })
        .catch(function () { copyText(link, '链接已复制，粘贴给好友即可'); });
      return;
    }
    copyText(link, '链接已复制，粘贴给好友即可');
  }

  /* ===================== 状态 ===================== */
  var state = {
    view: 'home',
    code: null,
    room: null,
    meId: null,
    modal: null,
    fabHidden: false,
    lastRoomCode: safeGet(KEY_LAST)
  };

  /* ===================== 云端同步（CloudBase HTTP 云函数） ===================== */
  // 同源接口（由 server/server.js 提供）；用 file:// 直接打开时自动回退为纯本地模式
  var API_BASE = window.DDZ_API_BASE || '/api';
  var POLL_MS = 2500;
  var pollTimer = null;

  function cloudOn() {
    if (!API_BASE || API_BASE.charAt(0) === '_') return false;
    if (location.protocol === 'file:') return false; // 本地双击打开时无法请求接口
    return true;
  }

  function api(payload) {
    return fetch(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (!data || !data.ok) throw new Error((data && data.error) || '网络异常');
      return data;
    });
  }

  function normalize(room) {
    if (!room) return null;
    room.players = room.players || [null, null, null];
    while (room.players.length < 3) room.players.push(null);
    room.records = room.records || [];
    return room;
  }

  function fail(e, what) {
    toast((what || '操作') + '失败：' + (e && e.message ? e.message : '网络异常'));
  }

  // 用服务端返回的房间局部刷新（带分数滚动动画）
  function applyRoomChange(newRoom, recId) {
    var before = snapshotScores();
    var idsBefore = playerIds();
    state.room = normalize(newRoom);
    saveRoom(true);
    if (canPatch() && playerIds() === idsBefore) patchRoom(before, recId);
    else {
      pendingNewId = recId || null;
      render();
      pendingNewId = null;
      playScoreAnim(before);
    }
  }

  function startPolling() {
    stopPolling();
    if (!cloudOn()) return;
    pollTimer = setInterval(pullRoom, POLL_MS);
  }

  function stopPolling() {
    if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
  }

  function pullRoom() {
    if (!cloudOn() || !state.code || state.view !== 'room') return;
    if (state.modal || state.busy) return;
    api({ action: 'get', code: state.code }).then(function (d) {
      var fresh = normalize(d.room);
      if (!state.room || fresh.updatedAt !== state.room.updatedAt) {
        var before = snapshotScores();
        var idsBefore = playerIds();
        state.room = fresh;
        saveRoom(true);
        if (canPatch() && playerIds() === idsBefore) patchRoom(before);
        else render();
      }
    }).catch(function () { /* 轮询失败静默 */ });
  }

  function enterRoom(room, meId) {
    state.room = normalize(room);
    state.code = state.room.code;
    state.meId = meId || null;
    safeSet(KEY_LAST, state.code);
    state.lastRoomCode = state.code;
    state.view = 'room';
    addMyRoom(state.code);
    saveRoom(true);
    render();
    startPolling();
    gotoUrl('/r/' + state.code); // 进入房间后跳到独立的房间页面
  }

  /* ===================== 房间 / 座位 ===================== */
  function newRoom() {
    return { code: genCode(), createdAt: Date.now(), players: [null, null, null], records: [] };
  }

  function usedNames() {
    return (state.room.players || []).filter(Boolean).map(function (p) { return p.name; });
  }

  function randomHero(room) {
    var used = ((room || state.room).players || []).filter(Boolean).map(function (p) { return p.name; });
    var pool = [];
    ORIGINS.forEach(function (o) {
      HEROES[o].forEach(function (n) { if (used.indexOf(n) === -1) pool.push({ name: n, origin: o }); });
    });
    if (!pool.length) pool = [{ name: '神秘人' + Math.floor(Math.random() * 99), origin: '江湖' }];
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // 服务端分配座位并做人数限制 / 名字去重，名字重复会自动重抽
  function cloudJoin(code, room, tries) {
    tries = tries === undefined ? 0 : tries;
    var hero = randomHero(room);
    return api({ action: 'join', code: code, name: hero.name, origin: hero.origin })
      .then(function (j) {
        setMe(code, j.playerId);
        enterRoom(j.room, j.playerId);
        toast('你抽到了「' + hero.name + '」');
      })
      .catch(function (e) {
        if (e.message === 'NAME_TAKEN' && tries < 3) return cloudJoin(code, room, tries + 1);
        throw e;
      });
  }

  function createRoom() {
    if (cloudOn()) {
      api({ action: 'create' }).then(function (d) {
        var room = normalize(d.room);
        return cloudJoin(room.code, room).then(function () {
          toast('房间已创建：' + room.code);
        });
      }).catch(function (e) { fail(e, '创建房间'); });
      return;
    }
    var room = newRoom();
    state.room = room;
    state.code = room.code;
    state.meId = uid();
    var hero = randomHero(room);
    room.players[0] = { id: state.meId, name: hero.name, origin: hero.origin, score: 0, joinedAt: Date.now() };
    setMe(room.code, state.meId);
    safeSet(KEY_LAST, room.code);
    state.lastRoomCode = room.code;
    state.view = 'room';
    saveRoom(true);
    render();
    toast('房间已创建：' + room.code);
  }

  function joinRoom(code) {
    code = String(code || '').trim().toUpperCase();
    if (!code) { toast('请输入房间码'); return; }

    if (cloudOn()) {
      api({ action: 'get', code: code }).then(function (d) {
        var room = normalize(d.room);
        var meId = getMe(code);
        meId = (meId && room.players.filter(Boolean).some(function (p) { return p.id === meId; })) ? meId : null;
        if (meId) { enterRoom(room, meId); toast('已回到房间 ' + code); return; }
        if (room.players.filter(Boolean).length >= 3) {
          enterRoom(room, null);
          toast('房间已满（3/3），你可以先观战');
          return;
        }
        return cloudJoin(code, room);
      }).catch(function (e) {
        toast(e.message === '房间不存在' ? '房间不存在，请确认房间码' : ('加入失败：' + e.message));
      });
      return;
    }

    var room = loadRoom(code);
    if (!room) { toast('房间不存在，请确认房间码'); return; }
    state.room = room;
    state.code = code;
    var meId = getMe(code);
    state.meId = (meId && room.players.filter(Boolean).some(function (p) { return p.id === meId; })) ? meId : null;
    safeSet(KEY_LAST, code);
    state.lastRoomCode = code;
    state.view = 'room';
    render();
    // 若本设备尚未入座且还有空位，自动入座
    if (!state.meId && room.players.filter(Boolean).length < 3) autoSit();
  }

  function autoSit() {
    var idx = state.room.players.findIndex(function (p) { return !p; });
    if (idx >= 0) sit(idx);
  }

  function sit(idx) {
    if (state.room.players[idx]) { toast('该座位已有人'); return; }

    if (cloudOn()) {
      if (state.meId) { toast('你已入座，如需换座请先「离开」'); return; }
      cloudJoin(state.code, state.room).catch(function (e) { fail(e, '入座'); });
      return;
    }

    var hero = randomHero();
    state.meId = uid();
    state.room.players[idx] = {
      id: state.meId, name: hero.name, origin: hero.origin, score: 0, joinedAt: Date.now()
    };
    setMe(state.room.code, state.meId);
    saveRoom(true);
    render();
    toast('你抽到了「' + hero.name + '」');
  }

  function reroll(idx) {
    var p = state.room.players[idx];
    if (!p) return;
    if (cloudOn() && p.id !== state.meId) { toast('只能给自己换人物'); return; }
    var old = p.name;
    var hero = randomHero();

    if (cloudOn()) {
      api({ action: 'reroll', code: state.code, playerId: p.id, name: hero.name, origin: hero.origin })
        .then(function (d) { applyRoomChange(d.room); toast(old + ' → ' + hero.name); })
        .catch(function (e) { fail(e, '换人'); });
      return;
    }

    p.name = hero.name;
    p.origin = hero.origin;
    saveRoom(true);
    render();
    toast(old + ' → ' + hero.name);
  }

  function leaveSeat(idx) {
    var p = state.room.players[idx];
    if (!p) return;
    if (!confirm('确定让「' + p.name + '」离开座位吗？该座位积分将清零（历史记录保留）。')) return;

    if (cloudOn()) {
      if (p.id !== state.meId) { toast('只能让自己离开座位'); return; }
      api({ action: 'leave', code: state.code, playerId: p.id }).then(function (d) {
        state.room = normalize(d.room);
        state.meId = null;
        clearMe(state.code);
        saveRoom(true);
        render();
        toast('已离开座位');
      }).catch(function (e) { fail(e, '离开座位'); });
      return;
    }

    state.room.players[idx] = null;
    if (state.meId === p.id) {
      state.meId = null;
      clearMe(state.room.code);
    }
    saveRoom(true);
    render();
    toast('已离开座位');
  }

  function exitRoom() {
    closeModal(true);
    stopPolling();
    // 退出即不再自动回到该房间：必须清掉「上次房间」记录，
    // 否则首页 boot 会重新载入房间并跳回 /r/CODE，形成来回跳转的死循环
    if (state.room && state.room.code) {
      if (state.lastRoomCode === state.room.code) safeDel(KEY_LAST);
      state.lastRoomCode = null;
    }
    state.view = 'home';
    state.room = null;
    state.code = null;
    state.meId = null;
    render();
    gotoUrl('/'); // 退出房间后回到首页
  }

  /* ===================== 记分 ===================== */
  function playerById(id) {
    return (state.room.players || []).filter(Boolean).find(function (p) { return p.id === id; }) || null;
  }

  function openSettle() {
    if (state.room.players.filter(Boolean).length < 3) {
      toast('需要 3 人就位后才能记分');
      return;
    }
    state.fabHidden = true; // 打开记分面板后收起悬浮按钮
    var first = state.room.players.filter(Boolean)[0];
    state.modal = {
      type: 'settle',
      tab: 'landlord',
      landlordId: first.id,
      result: 'win',
      base: 1,
      multi: 1,
      from: first.id,
      tos: state.room.players.filter(Boolean).slice(1).map(function (p) { return p.id; }),
      amount: 1
    };
    renderModal();
  }

  // 弹窗淡出后再移除，避免瞬间消失造成跳变
  function closeModal(instant) {
    var mask = modalRoot.querySelector ? modalRoot.querySelector('.mask') : null;
    state.modal = null;
    if (instant || !mask) { modalRoot.innerHTML = ''; return; }
    mask.classList.add('closing');
    setTimeout(function () { if (!state.modal) modalRoot.innerHTML = ''; }, 200);
  }

  function computeTransfers(m) {
    var ps = state.room.players.filter(Boolean);
    var amount = Math.max(0, (Number(m.base) || 0) * (Number(m.multi) || 1));
    if (m.tab === 'landlord') {
      var landlord = playerById(m.landlordId);
      if (!landlord) return { amount: amount, list: [] };
      var farmers = ps.filter(function (p) { return p.id !== landlord.id; });
      var list = [];
      if (m.result === 'win') {
        farmers.forEach(function (f) { list.push({ from: f.id, to: landlord.id, amount: amount }); });
      } else {
        farmers.forEach(function (f) { list.push({ from: landlord.id, to: f.id, amount: amount }); });
      }
      return { amount: amount, list: list };
    }
    var from = playerById(m.from);
    var amt = Math.max(0, Number(m.amount) || 0);
    var list2 = [];
    (m.tos || []).forEach(function (tid) {
      var t = playerById(tid);
      if (from && t && t.id !== from.id) list2.push({ from: from.id, to: t.id, amount: amt });
    });
    return { amount: amt, list: list2 };
  }

  function buildPreview(m) {
    var r = computeTransfers(m);
    var delta = {};
    r.list.forEach(function (t) {
      delta[t.from] = (delta[t.from] || 0) - t.amount;
      delta[t.to] = (delta[t.to] || 0) + t.amount;
    });
    var ps = state.room.players.filter(Boolean);
    return {
      amount: r.amount,
      list: r.list,
      delta: delta,
      rows: ps.map(function (p) {
        return { id: p.id, name: p.name, d: delta[p.id] || 0, score: p.score + (delta[p.id] || 0) };
      })
    };
  }

  function previewRowsHtml(m) {
    var pv = buildPreview(m);
    return {
      amount: pv.amount,
      html: pv.rows.map(function (row) {
        var d = row.d;
        var color = d > 0 ? 'var(--green)' : d < 0 ? 'var(--red)' : 'var(--muted)';
        var icon = (m.tab === 'landlord' && row.id === m.landlordId) ? '👑 ' : '';
        return '<div class="pv-row"><span>' + icon + esc(row.name) + '</span>' +
          '<span><b style="color:' + color + '">' + (d ? (d > 0 ? '+' : '') + d : '±0') + '</b> → ' + row.score + '</span></div>';
      }).join('') +
        '<div class="pv-row muted" style="margin-top:6px;font-size:12px"><span>本局总分</span><span>' + pv.amount + ' / 人</span></div>'
    };
  }

  function submitSettle() {
    var m = state.modal;
    var pv = buildPreview(m);
    if (!pv.list.length) { toast('请选择有效的支付对象'); return; }
    if (pv.amount <= 0) { toast('分数需大于 0'); return; }

    if (cloudOn()) {
      var payload = { action: 'settle', code: state.code, mode: m.tab };
      if (m.tab === 'landlord') {
        payload.landlordId = m.landlordId;
        payload.result = m.result;
        payload.base = m.base;
        payload.multi = m.multi;
      } else {
        payload.from = m.from;
        payload.tos = m.tos;
        payload.amount = m.amount;
      }
      closeModal();
      api(payload).then(function (d) {
        applyRoomChange(d.room, d.recordId);
        toast('记分完成');
      }).catch(function (e) { fail(e, '记分'); render(); });
      return;
    }

    var names = {}, scores = {};
    state.room.players.filter(Boolean).forEach(function (p) { names[p.id] = p.name; scores[p.id] = p.score; });

    var title, note;
    if (m.tab === 'landlord') {
      var landlord = playerById(m.landlordId);
      var farmers = state.room.players.filter(Boolean).filter(function (p) { return p.id !== m.landlordId; });
      title = '地主「' + landlord.name + '」' + (m.result === 'win' ? '获胜' : '失败') +
        '（对 ' + farmers.map(function (p) { return p.name; }).join('、') + '）';
      note = '底分 ' + m.base + ' × ' + m.multi + ' = ' + pv.amount;
    } else {
      var from = playerById(m.from);
      title = '「' + from.name + '」支付 ' + pv.amount + ' 分';
      note = '自由转账';
    }

    var rec = {
      id: uid(),
      ts: Date.now(),
      mode: m.tab,
      title: title,
      note: note,
      amount: pv.amount,
      result: m.tab === 'landlord' ? m.result : null,
      landlordId: m.tab === 'landlord' ? m.landlordId : null,
      transfers: pv.list.map(function (t) {
        return { from: t.from, to: t.to, amount: t.amount, fromName: names[t.from], toName: names[t.to] };
      }),
      delta: pv.delta
    };

    applyChange(function () {
      rec.transfers.forEach(function (t) {
        var a = playerById(t.from), b = playerById(t.to);
        if (a) a.score -= t.amount;
        if (b) b.score += t.amount;
      });
      state.room.records.unshift(rec);
      closeModal();
    }, rec.id);
    toast('记分完成');
  }

  function undoLast() {
    if (!state.room.records.length) return;
    var rec = state.room.records[0];
    var missing = Object.keys(rec.delta).some(function (pid) { return !playerById(pid); });
    if (missing) { toast('该局玩家已离座，无法撤销'); return; }
    if (!confirm('撤销最近一局：' + rec.title + '？')) return;

    if (cloudOn()) {
      api({ action: 'undo', code: state.code })
        .then(function (d) { applyRoomChange(d.room); toast('已撤销上一局'); })
        .catch(function (e) { fail(e, '撤销'); });
      return;
    }
    applyChange(function () {
      Object.keys(rec.delta).forEach(function (pid) {
        var p = playerById(pid);
        if (p) p.score -= rec.delta[pid];
      });
      state.room.records.shift();
    });
    toast('已撤销上一局');
  }

  function resetScores() {
    if (!confirm('将所有人的积分清零？（历史记录保留）')) return;

    if (cloudOn()) {
      api({ action: 'reset', code: state.code })
        .then(function (d) { applyRoomChange(d.room); toast('积分已清零'); })
        .catch(function (e) { fail(e, '清零'); });
      return;
    }
    applyChange(function () {
      state.room.players.forEach(function (p) { if (p) p.score = 0; });
    });
    toast('积分已清零');
  }

  function dismissRoom() {
    if (!confirm('解散房间「' + state.room.code + '」？所有记录将被删除。')) return;

    if (cloudOn()) {
      api({ action: 'destroy', code: state.code }).catch(function () { });
    }

    var gone = state.room.code;
    safeDel(KEY_ROOM(gone));
    clearStarted(gone);
    clearMe(gone);
    removeMyRoom(gone); // 已解散的房间不再显示在「我的房间」
    if (state.lastRoomCode === gone) safeDel(KEY_LAST);
    state.lastRoomCode = null;
    exitRoom();
    toast('房间已解散');
  }

  /* ===================== 渲染 ===================== */
  var appEl = document.getElementById('app');
  var modalRoot = document.getElementById('modal-root');

  function rankMap() {
    var ps = state.room.players.filter(Boolean);
    var sorted = ps.slice().sort(function (a, b) { return b.score - a.score; });
    var map = {};
    sorted.forEach(function (p, i) { map[p.id] = i + 1; });
    return map;
  }

  // 只有「当前选中的地主」（最近一局的地主）需要皇冠标记
  function lastLord() {
    for (var i = 0; i < state.room.records.length; i++) {
      var r = state.room.records[i];
      if (r.mode === 'landlord' && r.landlordId) return { id: r.landlordId, recId: r.id };
    }
    return { id: null, recId: null };
  }

  function playerCard(p, idx, lordId) {
    var rank = rankMap();
    var cls = 'avatar' + (idx === 0 ? ' s1' : idx === 1 ? ' s2' : ' s3');
    if (!p) {
      return '<div class="player empty" data-act="sit" data-idx="' + idx + '">' +
        '<div class="avatar" style="background:rgba(255,255,255,.10);color:rgba(255,255,255,.5)">+</div>' +
        '<div class="p-info"><div class="p-name">空位 ' + (idx + 1) + '</div>' +
        '<div class="p-origin">点击入座 · 随机人物</div></div></div>';
    }
    var r = rank[p.id];
    var medal = r === 1 ? '🥇 领先' : r === 2 ? '🥈 第二' : '🥉 第三';
    var isMe = state.meId && p.id === state.meId;
    var isLord = lordId && p.id === lordId;
    return '<div class="player' + (isMe ? ' me' : '') + (isLord ? ' lord' : '') + '" data-pid="' + p.id + '">' +
      (state.room.records.length ? '<div class="rank-medal">' + medal + '</div>' : '') +
      '<div class="' + cls + '">' + esc(p.name.slice(0, 1)) +
      (isLord ? '<span class="crown">👑</span>' : '') + '</div>' +
      '<div class="p-info">' +
      '<div class="p-name">' + esc(p.name) +
      (isLord ? '<span class="tag-lord">地主</span>' : '') +
      (isMe ? '<span class="tag-me">我</span>' : '') + '</div>' +
      '<div class="p-origin">' + esc(p.origin) + '</div>' +
      '</div>' +
      '<div class="p-score ' + (p.score > 0 ? 'pos' : p.score < 0 ? 'neg' : '') + '">' + (p.score > 0 ? '+' : '') + p.score + '</div>' +
      (isMe ? '<div class="p-actions"><button class="btn btn-sm btn-ghost" data-act="reroll" data-idx="' + idx + '">换人</button>' +
        '<button class="btn btn-sm btn-ghost" data-act="leave" data-idx="' + idx + '">离开</button></div>' : '') +
      '</div>';
  }

  function historyHtml() {
    if (!state.room.records.length) return '<div class="empty">还没有记分记录，来一局吧 🃏</div>';
    return '<div class="history">' + state.room.records.map(function (r) {
      var flow = r.transfers.map(function (t) {
        return '<div><span class="minus">' + esc(t.fromName) + ' -' + t.amount + '</span> → ' +
          '<span class="plus">' + esc(t.toName) + ' +' + t.amount + '</span></div>';
      }).join('');
      return '<div class="h-item' + (r.id === pendingNewId ? ' is-new' : '') + '">' +
        '<div class="h-head"><div class="h-title">' +
        (r.mode === 'transfer' ? '<span class="h-lord">💸</span>' : '') +
        esc(r.title) + '</div>' +
        '<div class="h-time">' + fmtTime(r.ts) + '</div></div>' +
        '<div class="h-flow">' + flow + '<div class="muted" style="margin-top:2px">' + esc(r.note) + '</div></div>' +
        '</div>';
    }).join('') + '</div>';
  }

  function renderHome() {
    var last = state.lastRoomCode ? loadRoom(state.lastRoomCode) : null;
    appEl.innerHTML =
      '<div class="hero">' +
      '<div class="logo">🃏</div>' +
      '<h1>斗地主记分器</h1>' +
      '<p>房间码组队 · 随机人物 · 一键记分</p>' +
      '<div class="hero-cards"><span>三国</span><span>射雕</span><span>水浒</span><span>红楼</span></div>' +
      '</div>' +

      '<div class="card">' +
      '<button class="btn btn-primary btn-block" data-act="create">创建房间（3 人局）</button>' +
      '<div style="height:14px"></div>' +
      '<div class="row">' +
      '<input id="join-code" class="input code grow" maxlength="4" placeholder="••••" autocomplete="off" />' +
      '<button class="btn" data-act="join">加入</button>' +
      '</div>' +
      '<div class="tips">' +
      '把房间码或<b>邀请链接</b>发给另外两位牌友，即可同房间记分。' +
      '</div>' +
      '</div>' +

      (last ? '<div class="card" style="margin-top:14px">' +
        '<div class="room-meta">上次房间</div>' +
        '<div class="row" style="align-items:center;margin-top:6px">' +
        '<div class="grow"><b>' + esc(last.code) + '</b> · ' +
        esc(last.players.filter(Boolean).map(function (p) { return p.name; }).join('、') || '暂无玩家') +
        ' · ' + last.records.length + ' 局</div>' +
        '<button class="btn btn-sm" data-act="resume">继续</button>' +
        '</div></div>' : '') +

      myRoomsHtml() +

      '<div class="section-title">玩法说明</div>' +
      '<div class="card tips">' +
      '1. 房主创建房间，得到 <b>4 位房间码</b>；<br/>' +
      '2. 每人点空位入座，系统从三国 / 射雕 / 水浒 / 红楼中<b>随机分配一个人物名</b>，不满意可「换人」；<br/>' +
      '3. 每局结束点<b>记分</b>：选地主与胜负，底分 × 倍数自动结算；也可以<b>自由转账</b>，一人给另外两人各付分；<br/>' +
      '4. 下方实时保留<b>积分流水</b>，记错了可以撤销上一局。<br/>' +
      '<span style="opacity:.75">注：' + (cloudOn()
        ? '已连接云端，不同设备输入同一房间码即可实时同桌记分（每 2.5 秒自动同步）。'
        : '数据保存在本机浏览器，同一浏览器多标签页实时同步。') + '</span>' +
      '</div>';
  }

  // 首页「我的房间」：本机建过/加入过的房间，点一下重新进入
  function myRoomsHtml() {
    var list = myRooms().filter(function (c) { return !state.room || c !== state.room.code; });
    if (!list.length) return '';
    var items = list.map(function (c) {
      var r = loadRoom(c);
      var info = r
        ? esc(r.players.filter(Boolean).map(function (p) { return p.name; }).join('、') || '暂无玩家') +
          ' · ' + r.records.length + ' 局'
        : '本机无缓存';
      return '<div class="my-room" data-act="open-room" data-code="' + esc(c) + '">' +
        '<div class="mr-main"><b>' + esc(c) + '</b> · ' + info + '</div>' +
        '<button class="btn btn-sm btn-ghost" data-act="forget-room" data-code="' + esc(c) + '">移除</button>' +
        '</div>';
    }).join('');
    return '<div class="card" style="margin-top:14px">' +
      '<div class="room-meta">我的房间（点一下重新进入）</div>' +
      '<div class="my-rooms">' + items + '</div></div>';
  }

  function roomMetaText(r) {
    return (cloudOn() ? '☁️ ' : '') + '房间码 · ' + r.players.filter(Boolean).length +
      '/3 人 · ' + r.records.length + ' 局';
  }
  function seatSubText(r) {
    var s = r.players.filter(Boolean).length;
    return s === 3 ? '已就位，可以开局' : '还差 ' + (3 - s) + ' 人';
  }
  function undoBtnHtml(r) {
    return r.records.length ? '<button class="btn btn-sm btn-ghost" data-act="undo">撤销上一局</button>' : '';
  }
  function playerIds() {
    return (state.room.players || []).map(function (p) { return p ? p.id : '-'; }).join(',');
  }

  // 只更新「记分相关区域」，不整页重建，避免闪屏
  function patchRoom(before, recId) {
    var r = state.room;
    var lord = lastLord();
    var q = function (sel) { return appEl.querySelector ? appEl.querySelector(sel) : null; };

    var meta = q('#room-meta'); if (meta) meta.textContent = roomMetaText(r);
    var seatSub = q('#seat-sub'); if (seatSub) seatSub.textContent = seatSubText(r);
    var undoBox = q('#hist-undo'); if (undoBox) undoBox.innerHTML = undoBtnHtml(r);

    if (recId) pendingNewId = recId;
    var histBox = q('#hist-box');
    if (histBox) histBox.innerHTML = historyHtml(lord.recId);
    pendingNewId = null;

    var cards = appEl.querySelectorAll ? appEl.querySelectorAll('.player[data-pid]') : [];
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var p = playerById(card.getAttribute('data-pid'));
      if (!p) continue;
      patchPlayerCard(card, p, lord.id);
    }
    playScoreAnim(before);
  }

  function patchPlayerCard(card, p, lordId) {
    var rank = rankMap();
    var rk = rank[p.id];
    var medal = rk === 1 ? '🥇 领先' : rk === 2 ? '🥈 第二' : '🥉 第三';
    var md = card.querySelector('.rank-medal');
    if (state.room.records.length) {
      if (md) { md.textContent = medal; }
      else {
        md = document.createElement('div');
        md.className = 'rank-medal';
        md.textContent = medal;
        card.appendChild(md);
      }
    } else if (md) { md.remove(); }

    var nameEl = card.querySelector('.p-name');
    var tag = card.querySelector('.tag-lord');
    var isLord = lordId && p.id === lordId;
    card.classList.toggle('lord', !!isLord);
    var av = card.querySelector('.avatar');
    var crown = av ? av.querySelector('.crown') : null;
    if (isLord && !crown && av) {
      crown = document.createElement('span');
      crown.className = 'crown';
      crown.textContent = '👑';
      av.appendChild(crown);
    } else if (!isLord && crown) { crown.remove(); }

    if (isLord && !tag && nameEl) {
      tag = document.createElement('span');
      tag.className = 'tag-lord';
      tag.textContent = '地主';
      nameEl.insertBefore(tag, nameEl.childNodes[1] || null);
    } else if (!isLord && tag) { tag.remove(); }
  }

  function renderRoom() {
    var r = state.room;
    var seated = r.players.filter(Boolean).length;
    var lord = lastLord();
    var lordId = lord.id;
    // 人满即自动开局：首次满员时记下开局时刻
    if (seated >= 3) markStarted(r.code);
    appEl.innerHTML =
      '<div class="card room-head">' +
      '<div class="code-box">' +
      '<div><div class="code-badge">' + esc(r.code) + '</div>' +
      '<div class="room-meta" id="room-meta">' + roomMetaText(r) + '</div></div>' +
      '</div>' +
      '<div class="row">' +
      '<button class="btn btn-sm" data-act="invite">邀请</button>' +
      '<button class="btn btn-sm btn-ghost" data-act="exit">退出</button>' +
      '</div>' +
      '</div>' +

      '<div class="section-title">座位 <span class="sub" id="seat-sub">' + seatSubText(r) + '</span></div>' +
      '<div class="players">' +
      r.players.map(function (p, i) { return playerCard(p, i, lordId); }).join('') + '</div>' +

      '<div class="section-title">记分记录 <span class="sub" id="hist-undo">' + undoBtnHtml(r) + '</span></div>' +
      '<div id="hist-box">' + historyHtml() + '</div>' +

      '<div class="card settings" style="margin-top:16px">' +
      '<details><summary>更多设置</summary><div class="s-body">' +
      '<div class="row"><button class="btn btn-sm grow btn-danger" data-act="reset">积分清零</button>' +
      '<button class="btn btn-sm grow btn-danger" data-act="dismiss">解散房间</button></div>' +
      '</div></details></div>' +

      '<div class="dock"><div class="dock-inner">' +
      '<button class="btn btn-primary grow" data-act="settle">记分</button>' +
      '</div></div>' +
      settleFabHtml();
  }

  // 3 人就位（人满）时，页面中央浮出「记分」按钮，点空白处隐藏
  function settleFabHtml() {
    var seated = (state.room.players || []).filter(Boolean).length;
    if (seated < 3) { state.fabHidden = false; return ''; } // 人没满时复位，下次满员会重新浮出
    if (state.fabHidden) return '';
    var ts = getStartTs(state.room.code);
    return '<div class="settle-fab-wrap" data-act="fab-dismiss">' +
      '<div class="settle-fab-box">' +
      '<div class="settle-fab-time" id="game-timer">⏱ 已开局 ' +
      fmtDuration(ts ? Date.now() - ts : 0) + '</div>' +
      '<button class="settle-fab" data-act="settle">记分</button>' +
      '</div>' +
      '<div class="settle-fab-tip">人已齐，点空白处隐藏</div>' +
      '</div>';
  }

  function render() {
    if (!appEl) return;
    if (state.view === 'room' && state.room) renderRoom();
    else renderHome();
    updateShareMeta();
    if (state.modal) renderModal();
    if (state.view === 'room' && state.room) startTimer();
    else stopTimer();
  }

  // 开局计时：每秒只改计时文本，不重绘整页
  var timerId = null;
  function startTimer() {
    if (timerId) return;
    timerId = setInterval(function () {
      var el = document.getElementById('game-timer');
      var ts = state.room ? getStartTs(state.room.code) : 0;
      if (!el || !ts) { stopTimer(); return; }
      el.textContent = '⏱ 已开局 ' + fmtDuration(Date.now() - ts);
    }, 1000);
  }
  function stopTimer() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  // 只在明确的进/退房间动作之后调用：跳转不能放在 render 里判断，
  // 否则加入房间的请求还没回来时会被误判成“不在房间”而跳回首页
  function gotoUrl(url) {
    try {
      if (location.protocol === 'file:') return; // 本地双击打开不支持路由
      if (location.pathname !== url) location.replace(url);
    } catch (e) { /* 某些环境不支持，忽略 */ }
  }

  /* ---- 结算动画：分数滚动 + 卡片闪烁 + 浮动增减 ---- */
  var pendingNewId = null;

  function snapshotScores() {
    var s = {};
    (state.room.players || []).forEach(function (p) { if (p) s[p.id] = p.score; });
    return s;
  }

  function canPatch() {
    if (state.view !== 'room' || !state.room) return false;
    return !!(appEl.querySelector && appEl.querySelector('#hist-box') && appEl.querySelector('.players'));
  }

  function applyChange(mutate, recId) {
    var before = snapshotScores();
    var idsBefore = playerIds();
    mutate();
    saveRoom(true);
    if (canPatch() && playerIds() === idsBefore) {
      patchRoom(before, recId);   // 局部更新：只动记分区域
    } else {
      pendingNewId = recId || null;
      render();
      pendingNewId = null;
      playScoreAnim(before);
    }
  }

  // 其他标签页/设备改动后的同步：结构没变就局部更新 + 分数滚动
  function syncRoom(fresh) {
    var before = state.room ? snapshotScores() : null;
    var idsBefore = playerIds();
    var ok = canPatch();
    state.room = fresh;
    if (ok && playerIds() === idsBefore) patchRoom(before);
    else render();
  }

  function playScoreAnim(before) {
    if (!before || !appEl.querySelectorAll) return;
    var cards = appEl.querySelectorAll('.player[data-pid]');
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var p = playerById(card.getAttribute('data-pid'));
      if (!p) continue;
      var from = before[p.id] === undefined ? 0 : before[p.id];
      if (from === p.score) continue;
      tweenScore(card, p, from, p.score);
    }
  }

  function tweenScore(card, p, from, to) {
    var d = to - from;
    card.classList.add(d > 0 ? 'flash-up' : 'flash-down');

    var tip = document.createElement('div');
    tip.className = 'float-delta';
    tip.style.color = d > 0 ? 'var(--green)' : 'var(--red)';
    tip.textContent = (d > 0 ? '+' : '') + d;
    card.appendChild(tip);
    setTimeout((function (node) { return function () { node.remove(); }; })(tip), 1300);

    var el = card.querySelector('.p-score');
    if (!el) return;
    var setVal = function (v) {
      el.textContent = (v > 0 ? '+' : '') + v;
      el.classList.toggle('pos', v > 0);
      el.classList.toggle('neg', v < 0);
    };
    if (typeof requestAnimationFrame !== 'function') { setVal(to); return; }

    el.classList.add('rolling');
    var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var dur = 620;
    (function step(now) {
      var t = Math.min(1, ((now || Date.now()) - t0) / dur);
      var e = 1 - Math.pow(1 - t, 3);
      setVal(Math.round(from + (to - from) * e));
      if (t < 1) requestAnimationFrame(step);
      else {
        el.classList.remove('rolling');
        setVal(to);
      }
    })(t0);
  }

  function renderModal() {
    var m = state.modal;
    if (!m) { modalRoot.innerHTML = ''; return; }
    var ps = state.room.players.filter(Boolean);

    if (m.type === 'invite') {
      var link = inviteLink(state.room.code);
      modalRoot.innerHTML =
        '<div class="mask" data-act="mask"><div class="sheet" data-stop="1">' +
        '<div class="sheet-head"><h3>邀请牌友</h3><button class="btn btn-sm btn-ghost" data-act="close">关闭</button></div>' +
        '<div class="invite-logo"><img src="' + assetUrl('logo.jpg') + '" alt="斗地主记分器" /></div>' +
        '<div class="invite-code">' + esc(state.room.code) + '</div>' +
        '<div class="invite-desc">房间码 <b>' + esc(state.room.code) + '</b> · 已就位 ' + ps.length + '/3 人<br/>' +
        '牌友打开链接会自动入座并随机抽到人物名，每局分数实时同步。</div>' +
        '<button class="btn btn-wechat btn-block" data-act="share">' + ICON_WECHAT + '转发给朋友</button>' +
        '<div style="height:10px"></div>' +
        '<div class="row">' +
        '<button class="btn btn-sm grow" data-act="copy-code">复制房间码</button>' +
        '<button class="btn btn-sm grow" data-act="copy-link">复制链接</button>' +
        '</div>' +
        '</div></div>';
      return;
    }

    var tabs = '<div class="tabs">' +
      '<div class="chip' + (m.tab === 'landlord' ? ' active' : '') + '" data-act="tab" data-tab="landlord">地主结算</div>' +
      '<div class="chip' + (m.tab === 'transfer' ? ' active' : '') + '" data-act="tab" data-tab="transfer">自由转账</div>' +
      '</div>';

    var body = '';
    if (m.tab === 'landlord') {
      body +=
        '<div class="field"><div class="label">本局地主</div><div class="chips">' +
        ps.map(function (p) {
          return '<div class="chip' + (m.landlordId === p.id ? ' active' : '') + '" data-act="pick-landlord" data-id="' + p.id + '">' +
            (m.landlordId === p.id ? '👑 ' : '') + esc(p.name) + '</div>';
        }).join('') + '</div></div>' +
        '<div class="field"><div class="label">本局结果</div><div class="chips">' +
        '<div class="chip' + (m.result === 'win' ? ' active' : '') + '" data-act="pick-result" data-r="win">🏆 地主胜</div>' +
        '<div class="chip' + (m.result === 'lose' ? ' active' : '') + '" data-act="pick-result" data-r="lose">💥 地主败</div>' +
        '</div></div>' +
        '<div class="field"><div class="label">底分</div><div class="chips">' +
        [1, 2, 3, 5, 10].map(function (v) {
          return '<div class="chip' + (m.base === v ? ' active' : '') + '" data-act="pick-base" data-v="' + v + '">' + v + '</div>';
        }).join('') +
        '<input class="chip" style="width:76px;padding:6px 10px" type="number" inputmode="numeric" min="1" value="' + m.base + '" data-act="input-base" />' +
        '</div></div>' +
        '<div class="field"><div class="label">倍数（春天 / 炸弹等）</div><div class="chips">' +
        [1, 2, 4, 8, 16].map(function (v) {
          return '<div class="chip' + (m.multi === v ? ' active' : '') + '" data-act="pick-multi" data-v="' + v + '">×' + v + '</div>';
        }).join('') +
        '<input class="chip" style="width:76px;padding:6px 10px" type="number" inputmode="numeric" min="1" value="' + m.multi + '" data-act="input-multi" />' +
        '</div></div>';
    } else {
      body +=
        '<div class="field"><div class="label">付款人</div><div class="chips">' +
        ps.map(function (p) {
          return '<div class="chip' + (m.from === p.id ? ' active' : '') + '" data-act="pick-from" data-id="' + p.id + '">' +
            (m.from === p.id ? '💸 ' : '') + esc(p.name) + '</div>';
        }).join('') + '</div></div>' +
        '<div class="field"><div class="label">收款人（可多选，默认另外两人）</div><div class="chips">' +
        ps.map(function (p) {
          return '<div class="chip' + (m.tos.indexOf(p.id) >= 0 ? ' active' : '') + '" data-act="toggle-to" data-id="' + p.id + '">' + esc(p.name) + '</div>';
        }).join('') + '</div></div>' +
        '<div class="field"><div class="label">每人支付</div><div class="chips">' +
        [1, 2, 3, 5, 10].map(function (v) {
          return '<div class="chip' + (m.amount === v ? ' active' : '') + '" data-act="pick-amount" data-v="' + v + '">' + v + '</div>';
        }).join('') +
        '<input class="chip" style="width:76px;padding:6px 10px" type="number" inputmode="numeric" min="1" value="' + m.amount + '" data-act="input-amount" />' +
        '</div></div>';
    }

    var pv = previewRowsHtml(m);
    var preview = '<div class="preview">' + pv.html + '</div>';

    modalRoot.innerHTML =
      '<div class="mask" data-act="mask"><div class="sheet" data-stop="1">' +
      '<div class="sheet-head"><h3>本局记分</h3><button class="btn btn-sm btn-ghost" data-act="close">关闭</button></div>' +
      tabs + body +
      '<div class="field"><div class="label">结算预览</div>' + preview + '</div>' +
      '<button class="btn btn-primary btn-block" data-act="submit">' +
      (m.tab === 'landlord' ? '确认结算（' + pv.amount + ' 分/人）' : '确认转账') + '</button>' +
      '</div></div>';
  }

  /* ===================== 事件 ===================== */
  document.addEventListener('click', function (e) {
    var el = e.target.closest ? e.target.closest('[data-act]') : null;
    if (!el) return;
    var act = el.getAttribute('data-act');

    switch (act) {
      case 'mask':
        if (e.target === el) closeModal();
        return;
      case 'close': closeModal(); return;
      case 'create': createRoom(); return;
      case 'join': {
        var input = document.getElementById('join-code');
        joinRoom(input ? input.value : '');
        return;
      }
      case 'resume': joinRoom(state.lastRoomCode); return;
      case 'fab-dismiss': state.fabHidden = true; render(); return;
      case 'open-room': joinRoom(el.getAttribute('data-code')); return;
      case 'forget-room': removeMyRoom(el.getAttribute('data-code')); render(); return;
      case 'sit': sit(Number(el.getAttribute('data-idx'))); return;
      case 'reroll': reroll(Number(el.getAttribute('data-idx'))); return;
      case 'leave': leaveSeat(Number(el.getAttribute('data-idx'))); return;
      case 'exit': exitRoom(); return;
      case 'copy-code': copyText(state.room.code, '房间码已复制'); return;
      case 'copy-link':
        copyText(inviteLink(state.room.code), inWechat()
          ? '已复制；请点右上角「···」发送才是卡片'
          : '邀请链接已复制，发给牌友即可');
        return;
      case 'invite': openInvite(); return;
      case 'share': shareToFriend(); return;
      case 'wx-guide-close': closeWechatGuide(); return;
      case 'settle': openSettle(); return;
      case 'undo': undoLast(); return;
      case 'reset': resetScores(); return;
      case 'dismiss': dismissRoom(); return;
    }

    if (!state.modal) return;
    var m = state.modal;
    switch (act) {
      case 'tab': m.tab = el.getAttribute('data-tab'); renderModal(); break;
      case 'pick-landlord': m.landlordId = el.getAttribute('data-id'); renderModal(); break;
      case 'pick-result': m.result = el.getAttribute('data-r'); renderModal(); break;
      case 'pick-base': m.base = Number(el.getAttribute('data-v')); renderModal(); break;
      case 'pick-multi': m.multi = Number(el.getAttribute('data-v')); renderModal(); break;
      case 'pick-from':
        m.from = el.getAttribute('data-id');
        m.tos = ps_ids().filter(function (id) { return id !== m.from; });
        renderModal();
        break;
      case 'toggle-to': {
        var id = el.getAttribute('data-id');
        var i = m.tos.indexOf(id);
        if (i >= 0) m.tos.splice(i, 1); else m.tos.push(id);
        renderModal();
        break;
      }
      case 'pick-amount': m.amount = Number(el.getAttribute('data-v')); renderModal(); break;
      case 'submit': submitSettle(); break;
    }
  });

  function ps_ids() {
    return state.room.players.filter(Boolean).map(function (p) { return p.id; });
  }

  // 输入框：不重建弹窗，避免焦点丢失
  document.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) return;
    var act = el.getAttribute('data-act');
    if (!act || !state.modal) return;
    var v = Number(el.value);
    if (act === 'input-base') state.modal.base = isNaN(v) || v < 0 ? 0 : v;
    else if (act === 'input-multi') state.modal.multi = isNaN(v) || v < 1 ? 1 : v;
    else if (act === 'input-amount') state.modal.amount = isNaN(v) || v < 0 ? 0 : v;
    else return;

    var pv = previewRowsHtml(state.modal);
    var box = document.querySelector('.preview');
    if (box) box.innerHTML = pv.html;
    var btn = document.querySelector('[data-act="submit"]');
    if (btn) btn.textContent = state.modal.tab === 'landlord'
      ? '确认结算（' + pv.amount + ' 分/人）'
      : '确认转账（' + pv.amount + ' 分/人）';
  });

  // 回车加入房间
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'join-code') joinRoom(e.target.value);
    if (e.key === 'Escape' && state.modal) closeModal();
  });

  /* ===================== 同步 ===================== */
  window.addEventListener('storage', function (e) {
    if (!state.code) return;
    if (e.key === KEY_ROOM(state.code)) {
      var fresh = loadRoom(state.code);
      if (fresh) { syncRoom(fresh); }
      else { toast('房间已被解散'); exitRoom(); }
    }
  });

  if (bc) {
    bc.onmessage = function (e) {
      if (!state.code || !e.data || e.data.code !== state.code) return;
      var fresh = loadRoom(state.code);
      if (fresh) { syncRoom(fresh); }
    };
  }

  window.addEventListener('pageshow', function () {
    if (state.code) {
      var fresh = loadRoom(state.code);
      if (fresh) state.room = fresh; else { exitRoom(); return; }
    }
    render();
  });

  /* ===================== 启动 ===================== */
  (function boot() {
    // 同时支持 /r/CODE 与 ?room=CODE 两种入房方式
    var m = /\/r\/([A-Za-z0-9]{4})(?:[/?#]|$)/.exec(location.pathname) ||
      /[?&]room=([A-Za-z0-9]{4})/.exec(location.search);
    if (m) { joinRoom(m[1]); return; }

    // 首页不再自动恢复上次房间（否则会和路由跳转来回打架），
    // 需要继续上一局时点首页的「返回房间」入口
    render();
  })();
})();
