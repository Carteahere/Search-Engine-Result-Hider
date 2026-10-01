'use strict';
/* 冒烟测试: 在 VM 沙箱里完整加载 lite 脚本, 断言
 *  1) 加载不抛异常;
 *  2) 从未发起任何网络请求 (GM_xmlhttpRequest / fetch / XHR);
 *  3) 从未调用 setInterval (后台订阅/WebDAV 自动同步已被移除);
 *  4) init 后规则索引真的编译出来了 (debug 模式 __SERH_DEBUG__)。
 *  同一沙箱也会跑一遍 8.5.5.js 作为对照, 证明探针本身有效。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('PASS ' + name); }
  else { fail++; console.log('FAIL ' + name + (extra !== undefined ? '  => ' + JSON.stringify(extra) : '')); }
}

function makeStyle() {
  const s = { setProperty(k, v) { this[k] = v; }, removeProperty(k) { delete this[k]; }, getPropertyValue(k) { return this[k] || ''; } };
  return s;
}
function makeClassList() {
  const set = new Set();
  return {
    add: (...c) => c.forEach(x => set.add(x)),
    remove: (...c) => c.forEach(x => set.delete(x)),
    toggle: (c, force) => { const on = force === undefined ? !set.has(c) : !!force; on ? set.add(c) : set.delete(c); return on; },
    contains: c => set.has(c),
    get value() { return [...set].join(' '); }
  };
}

function buildSandbox(opts) {
  const probe = { gmXHR: 0, fetch: 0, xhr: 0, intervals: 0, addStyle: 0, timeouts: 0, rafs: 0, errors: [] };
  const store = new Map(Object.entries(opts.store || {}).map(([k, v]) => [k, JSON.parse(JSON.stringify(v))]));
  const idMap = new Map();
  const timeouts = [];
  const rafs = [];

  function register(el) { if (el.id) idMap.set(el.id, el); }
  function unregister(el) { if (el.id && idMap.get(el.id) === el) idMap.delete(el.id); }

  function makeEl(tag) {
    const listeners = Object.create(null);
    const el = {
      tagName: String(tag || 'div').toUpperCase(),
      children: [], parentElement: null, isConnected: false,
      dataset: {}, style: makeStyle(), classList: makeClassList(),
      offsetWidth: 0, offsetHeight: 0, offsetTop: 0, clientHeight: 0, clientWidth: 0, scrollHeight: 0,
      scrollTop: 0, scrollLeft: 0,
      innerHTML: '', textContent: '', value: '', checked: false, type: '', accept: '',
      files: null, href: '', download: '', className: '',
      _id: '',
      get id() { return this._id; },
      set id(v) { unregister(this); this._id = String(v); register(this); },
      setAttribute(k, v) { if (k === 'id') { this.id = v; return; } this._attrs = this._attrs || new Map(); this._attrs.set(k, String(v)); if (k.startsWith('data-')) this.dataset[camel(k)] = String(v); },
      getAttribute(k) { if (k === 'id') return this._id; return (this._attrs && this._attrs.has(k)) ? this._attrs.get(k) : null; },
      hasAttribute(k) { if (k === 'id') return !!this._id; return !!(this._attrs && this._attrs.has(k)); },
      removeAttribute(k) { if (k === 'id') { this._id = ''; return; } if (this._attrs) this._attrs.delete(k); if (k.startsWith('data-')) delete this.dataset[camel(k)]; },
      appendChild(c) { if (c.parentElement) c.remove(); c.parentElement = this; c.isConnected = true; this.children.push(c); register(c); markConnected(c); return c; },
      insertBefore(c, ref) { const i = this.children.indexOf(ref); c.parentElement = this; c.isConnected = true; this.children.splice(i < 0 ? this.children.length : i, 0, c); register(c); markConnected(c); return c; },
      removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); c.parentElement = null; c.isConnected = false; return c; },
      remove() { unregister(this); if (this.parentElement) this.parentElement.removeChild(this); this.isConnected = false; },
      contains(n) { if (n === this) return true; return this.children.some(c => c.contains && c.contains(n)); },
      closest() { return null; },
      querySelector() { return null; },
      querySelectorAll() { return []; },
      addEventListener(t, fn) { (listeners[t] = listeners[t] || []).push(fn); },
      removeEventListener(t, fn) { const a = listeners[t]; if (a) { const i = a.indexOf(fn); if (i >= 0) a.splice(i, 1); } },
      dispatchEvent() { return true; },
      getBoundingClientRect() { return { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 }; },
      focus() {}, blur() {}, click() {}, scrollTo() {}, setSelectionRange() {},
      removeChildIdx() {}
    };
    Object.defineProperty(el, 'firstChild', { get() { return this.children[0] || null; } });
    Object.defineProperty(el, 'onchange', { get() { return this._onchange || null; }, set(v) { this._onchange = v; } });
    return el;
  }
  function camel(k) { return k.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase()); }
  function markConnected(el) { el.children.forEach(c => { c.isConnected = true; markConnected(c); }); }

  const body = makeEl('body'); body.isConnected = true;
  const documentEl = makeEl('html'); documentEl.isConnected = true;
  const document = {
    readyState: 'interactive',
    visibilityState: 'visible',
    activeElement: null,
    body, documentElement: documentEl,
    createElement: makeEl,
    createTextNode: () => makeEl('#text'),
    getElementById: (id) => idMap.get(id) || null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {}, removeEventListener() {},
    execCommand() { return true; }
  };

  const location = { href: 'https://www.google.com/search?q=test', hostname: 'www.google.com', pathname: '/search', search: '?q=test', protocol: 'https:', origin: 'https://www.google.com' };
  const history = { pushState() {}, replaceState() {} };

  const sandbox = {
    console,
    JSON, Math, Date, Promise, Map, Set, WeakMap, WeakSet, Symbol, Array, Object, String, Number, Boolean,
    RegExp, Error, TypeError, SyntaxError, URIError, parseInt, parseFloat, isNaN, isFinite,
    encodeURIComponent, decodeURIComponent, encodeURI, decodeURI, escape, unescape,
    Uint8Array, Uint16Array, Int32Array, Float32Array, ArrayBuffer, TextDecoder, TextEncoder,
    URL, URLSearchParams, structuredClone: (v) => JSON.parse(JSON.stringify(v)),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    crypto: { getRandomValues: (a) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) & 0xff; return a; } },
    setTimeout: (fn, ms) => { probe.timeouts++; timeouts.push({ fn, ms }); return timeouts.length; },
    clearTimeout: () => {},
    setInterval: () => { probe.intervals++; return 999; },
    clearInterval: () => {},
    requestAnimationFrame: (fn) => { rafs.push(fn); return rafs.length; },
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ lineHeight: '15.4px', position: 'static', getPropertyValue: () => '' }),
    alert: () => {},
    confirm: () => true,
    prompt: () => '',
    MutationObserver: class { constructor(cb) { this.cb = cb; } observe() {} disconnect() {} takeRecords() { return []; } },
    IntersectionObserver: class { constructor(cb) { this.cb = cb; } observe() {} unobserve() {} disconnect() {} },
    Blob: class Blob { constructor(parts) { this.parts = parts; } },
    FileReader: class FileReader { readAsText() {} },
    GM_getValue: (k, d) => (store.has(k) ? store.get(k) : d),
    GM_setValue: (k, v) => { store.set(k, v); },
    GM_deleteValue: (k) => { store.delete(k); },
    GM_addStyle: () => { probe.addStyle++; return makeEl('style'); },
    GM_registerMenuCommand: () => 1,
    GM_unregisterMenuCommand: () => {},
    GM_xmlhttpRequest: () => { probe.gmXHR++; throw new Error('GM_xmlhttpRequest called'); },
    fetch: () => { probe.fetch++; throw new Error('fetch called'); },
    XMLHttpRequest: function XMLHttpRequest() { probe.xhr++; throw new Error('XHR constructed'); },
    location, history, document,
    navigator: { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0', platform: 'Win32', language: 'zh-CN' }
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.top = sandbox;
  sandbox.window.location = location;
  sandbox.window.innerWidth = 1280;
  sandbox.window.innerHeight = 800;
  sandbox.window.getComputedStyle = sandbox.getComputedStyle;
  sandbox.window.addEventListener = () => {};
  sandbox.window.removeEventListener = () => {};
  sandbox.window.dispatchEvent = () => true;
  sandbox.window.open = () => null;

  const ctx = vm.createContext(sandbox);

  return {
    probe, ctx, sandbox, store, idMap,
    async drain(maxRounds = 200) {
      const tick = () => new Promise(r => setImmediate(r));
      for (let i = 0; i < maxRounds; i++) {
        const t = timeouts.splice(0, timeouts.length);
        const r = rafs.splice(0, rafs.length);
        if (!t.length && !r.length) return;
        for (const item of t) { try { item.fn(); } catch (e) { probe.errors.push(String(e && e.stack || e)); } }
        for (const fn of r) { try { fn(Date.now()); } catch (e) { probe.errors.push(String(e && e.stack || e)); } }
        await tick(); // 让 await/delay 之类的微任务链有机会推进
      }
      probe.errors.push('sandbox did not settle within ' + maxRounds + ' rounds');
    }
  };
}

const SEED_STORE = {
  searchfilter_blocker: {
    debug: true,
    showBubble: false,
    showCount: false,
    language: 'zh-CN',
    subscriptionAutoUpdate: true,
    rules: ['*://*.blocked-example.com/*', '@*://allowed.blocked-example.com/*', '/^https:\\/\\/regex\\.example\\.com\\//']
  },
  // 供 8.5.5.js 的自动订阅走网络; lite 版没有订阅实现, 该键不会被读取
  searchfilter_subscriptions: [{ url: 'https://example.com/rules.txt', enabled: true, rules: [], lastUpdate: 0 }]
};

async function runFile(file) {
  const src = fs.readFileSync(file, 'utf8');
  const sb = buildSandbox({ store: SEED_STORE });
  const errors = [];
  try {
    vm.runInContext(src, sb.ctx, { filename: path.basename(file), timeout: 20000 });
  } catch (e) {
    errors.push(String(e && e.stack || e));
  }
  await sb.drain();
  return { sb, errors, probe: sb.probe };
}

const TARGET = path.join(ROOT, '8.4.5_lite.js');
const CONTROL = path.join(ROOT, '8.5.5.js');

(async () => {

/* ---------------- 对照组: 8.5.5.js (证明探针能测出网络/定时器) ------------- */
const ctrl = await runFile(CONTROL);
check('对照: 8.5.5.js 加载无异常', ctrl.errors.length === 0, ctrl.errors[0]);
check('对照: 8.5.5.js 暴露 __SERH_DEBUG__(debug 管线有效)', !!ctrl.sb.sandbox.__SERH_DEBUG__);
check('对照: 8.5.5.js 确实发起了网络请求(探针有效)', ctrl.probe.gmXHR > 0 || ctrl.probe.fetch > 0 || ctrl.probe.xhr > 0, ctrl.probe);
check('对照: 8.5.5.js 确实调用了 setInterval(探针有效)', ctrl.probe.intervals > 0, ctrl.probe);

/* ---------------- 实验组: 8.4.5_lite.js ---------------------------------- */
const lite = await runFile(TARGET);
const p = lite.probe;

check('lite: 加载无异常', lite.errors.length === 0, lite.errors[0]);
check('lite: 沙箱无未捕获错误', p.errors.length === 0, p.errors[0]);
check('lite: 未调用 GM_xmlhttpRequest', p.gmXHR === 0, p.gmXHR);
check('lite: 未调用 fetch', p.fetch === 0, p.fetch);
check('lite: 未构造 XMLHttpRequest', p.xhr === 0, p.xhr);
check('lite: 未调用 setInterval', p.intervals === 0, p.intervals);

const dbg = lite.sb.sandbox.__SERH_DEBUG__;
check('lite: debug 模式暴露 __SERH_DEBUG__', !!dbg, Object.keys(lite.sb.sandbox).filter(k => k.startsWith('__SERH')));
if (dbg) {
  const cr = dbg.compiledRules;
  check('lite: 规则索引已编译', !!cr, cr && Object.keys(cr));
  if (cr) {
    // compiledRules.domains / whitelistDomains: Map<domain, entry[]>
    const flat = (mapLike) => [...mapLike.values()].reduce((acc, v) => acc.concat(Array.isArray(v) ? v : [v]), []);
    const domainEntries = cr.domains instanceof Map ? flat(cr.domains) : [];
    const wlEntries = cr.whitelistDomains instanceof Map ? flat(cr.whitelistDomains) : [];
    check('lite: 域名规则入索引', cr.domains instanceof Map && cr.domains.size >= 1, cr.domains && cr.domains.size);
    check('lite: 白名单规则入索引', cr.whitelistDomains instanceof Map && cr.whitelistDomains.size >= 1, cr.whitelistDomains && cr.whitelistDomains.size);
    check('lite: 正则规则入索引', Array.isArray(cr.urls) && cr.urls.length >= 1, cr.urls && cr.urls.length);
    check('lite: 索引内全部来源都是本地规则', domainEntries.every(e => e.isLocal === true), domainEntries);
    check('lite: 索引内没有订阅来源', !domainEntries.concat(wlEntries).some(e => String(e.source).includes('订阅') || String(e.source).startsWith('Sub')), domainEntries);
    check('lite: 来源标记为“本地规则”', domainEntries.every(e => e.source === '本地规则'), domainEntries.map(e => e.source));
  }
  check('lite: 引擎识别为 google', dbg.getSearchEngine() === 'google', dbg.getSearchEngine());
  const blocked = dbg.checkRuleMatchOptimized('https://www.blocked-example.com/page', 'blocked-example.com', 'title', 'snippet');
  check('lite: 黑名单域名命中', !!(blocked && blocked.blocked), blocked);
  const allowed = dbg.checkRuleMatchOptimized('https://allowed.blocked-example.com/page', 'allowed.blocked-example.com', 'title', 'snippet');
  check('lite: 白名单子域放行', allowed === false, allowed);
  const re = dbg.checkRuleMatchOptimized('https://regex.example.com/x', 'regex.example.com', 'title', 'snippet');
  check('lite: 正则规则命中', !!(re && re.blocked), re);
}

/* 面板/按钮残留检查(纯文本) */
const src = fs.readFileSync(TARGET, 'utf8');
const leftovers = ['serh-subscribe', 'serh-sync"', 'serh-webdav', 'serh-subscription', 'GM_xmlhttpRequest', '@connect'];
for (const l of leftovers) check('lite: 源码中不再包含 ' + l, !src.includes(l));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
