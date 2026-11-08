@echo off
setlocal
chcp 65001 >nul
where node >nul 2>nul || (echo [ERR] node not found & exit /b 1)
node -e "const s=require('fs').readFileSync(process.argv[1],'utf8'),k='//__SERH_MHT_PAYLOAD__',i=s.lastIndexOf(k);if(i<0){console.error('[ERR] payload not found');process.exit(2)}eval(s.slice(i+k.length))" "%~f0" "%~dp0."
exit /b %ERRORLEVEL%
//__SERH_MHT_PAYLOAD__
const fs = require('fs'), path = require('path');
const ext = /\.mht(?:ml)?$/i;
let dir = process.cwd();
const scriptDir = process.argv[2] ? path.resolve(process.argv[2]) : '';
try {
  if (!fs.readdirSync(dir).some(f => ext.test(f)) && scriptDir && scriptDir !== path.resolve(dir) && fs.readdirSync(scriptDir).some(f => ext.test(f))) dir = scriptDir;
} catch (e) {}
const files = fs.readdirSync(dir).filter(f => ext.test(f)).map(f => path.join(dir, f));
if (!files.length) { console.log('[INFO] 未找到 .mht/.mhtml 文件(已检查当前目录与脚本所在目录)'); process.exit(0); }
const qpDecode = s => s.replace(/=\r?\n/g, '').replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
function decodeBody(body, enc, charset) {
  let buf;
  if (enc === 'base64') buf = Buffer.from(body.replace(/\s+/g, ''), 'base64');
  else if (enc === 'quoted-printable') buf = Buffer.from(qpDecode(body), 'binary');
  else buf = Buffer.from(body, 'binary');
  const dec = label => { try { return new TextDecoder(label, { fatal: false }).decode(buf); } catch (e) { return null; } };
  let text = dec(charset || 'utf-8');
  if (text === null) text = dec('utf-8');
  if (text === null) text = buf.toString('utf8');
  const bad = s => { let n = 0; for (let i = 0; i < s.length; i++) if (s.charCodeAt(i) === 0xfffd) n++; return n / Math.max(1, s.length); };
  if (bad(text) > 0.02) {
    const alt = dec('gb18030');
    if (alt !== null && bad(alt) < bad(text)) text = alt;
  }
  return text;
}
function collectParts(text, boundary, parts, depth) {
  if (!boundary || depth > 5) return;
  const bEsc = String(boundary).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const segs = text.split(new RegExp('--' + bEsc + '(?:--)?[ \\t]*(?:\\r?\\n|$)'));
  for (const seg of segs) {
    if (!seg || !seg.trim()) continue;
    const idx = seg.search(/\r?\n\r?\n/);
    if (idx === -1) continue;
    const head = seg.slice(0, idx), body = seg.slice(idx).replace(/^\r?\n\r?\n/, '').replace(/\r?\n$/, '');
    const ctm = head.match(/Content-Type:\s*([^;\r\n]+)/i);
    const ct = ctm ? ctm[1].trim().toLowerCase() : '';
    if (/^multipart\//.test(ct)) {
      const nb = head.match(/boundary="([^"]+)"/i) || head.match(/boundary=([^\s;]+)/i);
      if (nb) collectParts(body, nb[1], parts, depth + 1);
      continue;
    }
    const csm = head.match(/charset\s*=\s*"([^"]+)"|charset\s*=\s*([^\s;">]+)/i);
    const cte = head.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);
    const clm = head.match(/Content-Location:\s*([^\r\n]+)/i);
    parts.push({ ct, charset: csm ? (csm[1] || csm[2] || '').trim().toLowerCase() : '', enc: cte ? cte[1].trim().toLowerCase() : '', loc: clm ? clm[1].trim() : '', data: body });
  }
}
function parseMht(text) {
  const snapshot = (text.match(/Snapshot-Content-Location:\s*([^\r\n]+)/i) || [])[1] || '';
  const parts = [];
  const bm = text.match(/boundary="([^"]+)"/i) || text.match(/boundary=([^\s;]+)/i);
  if (bm) collectParts(text, bm[1], parts, 1);
  else parts.push({ ct: 'text/html', enc: '', data: text, charset: '', loc: '' });
  return { snapshot, parts };
}
function extractHtml(parsed) {
  const norm = u => String(u || '').replace(/#.*$/, '');
  const snap = norm(parsed.snapshot);
  let best = null, exact = null;
  for (const p of parsed.parts) {
    if (!/text\/html/.test(p.ct)) continue;
    const html = decodeBody(p.data, p.enc, p.charset);
    if (!best || html.length > best.html.length) best = { html, loc: p.loc };
    if (snap && p.loc && norm(p.loc) === snap) exact = { html, loc: p.loc };
  }
  const chosen = exact || best;
  if (!chosen) return null;
  return { html: chosen.html, loc: parsed.snapshot || chosen.loc };
}
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
const AUTOCLOSE = { li: ['li'], dt: ['dt','dd'], dd: ['dt','dd'], tr: ['tr','tbody','thead','tfoot'], td: ['td','th','tr','tbody','thead','tfoot'], th: ['td','th','tr','tbody','thead','tfoot'], tbody: ['tbody','thead','tfoot'], thead: ['tbody','thead','tfoot'], tfoot: ['tbody','thead','tfoot'], option: ['option','optgroup'], optgroup: ['optgroup'] };
const P_CLOSERS = new Set(['address','article','aside','blockquote','details','div','dl','dd','dt','fieldset','figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header','hr','li','main','menu','nav','ol','p','pre','section','table','ul']);
const TAB = new Set(['table','tbody','thead','tfoot','tr','td','th']);
const comb = (p, c) => (TAB.has(p) && TAB.has(c)) ? ' ' : '>';
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const decodeEnt = s => s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos|nbsp);/gi, (_, e) => {
  if (e[0] === '#') { const c = /^#x/i.test(e) ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10); return c > 31 && c < 0x110000 ? String.fromCodePoint(c) : ' '; }
  return ENT[e.toLowerCase()] || ' ';
});
function buildTree(html) {
  html = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<script[\s\S]*?<\/script\s*>/gi, '').replace(/<style[\s\S]*?<\/style\s*>/gi, '').replace(/<noscript[\s\S]*?<\/noscript\s*>/gi, '');
  const root = { tag: '#root', attrs: {}, children: [], parent: null, text: '' };
  let cur = root;
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let pos = 0, m;
  const addText = t => { t = decodeEnt(t).replace(/\s+/g, ' ').trim(); if (t && cur) cur.text = (cur.text || '') + ' ' + t; };
  while ((m = re.exec(html))) {
    addText(html.slice(pos, m.index)); pos = m.index + m[0].length;
    const full = m[0], closing = full.startsWith('</'), tag = m[1].toLowerCase(), attrsStr = m[2] || '';
    if (closing) { let p = cur; while (p && p.tag !== tag) p = p.parent; if (p && p.parent) cur = p.parent; continue; }
    while (cur && cur.tag !== '#root') {
      const cl = AUTOCLOSE[cur.tag];
      if (cl && cl.indexOf(tag) !== -1) { cur = cur.parent; continue; }
      if (cur.tag === 'p' && P_CLOSERS.has(tag)) { cur = cur.parent; continue; }
      break;
    }
    const attrs = {};
    const are = /([:\w-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let am;
    while ((am = are.exec(attrsStr))) {
      const key = am[1].toLowerCase();
      const val = am[3] !== undefined ? am[3] : am[4] !== undefined ? am[4] : (am[5] !== undefined ? am[5] : '');
      if (key === 'class') { if (!(key in attrs)) attrs[key] = val.trim(); }
      else if (!(key in attrs)) attrs[key] = val;
    }
    const node = { tag, attrs, children: [], parent: cur, text: '' };
    if (cur) cur.children.push(node);
    if (!VOID.has(tag) && !/\/\s*>$/.test(full)) cur = node;
  }
  addText(html.slice(pos));
  return root;
}
function walk(node, fn) { fn(node); for (const c of node.children) walk(c, fn); }
function hasDescLink(node) { let ok = false; walk(node, n => { if (n.tag === 'a' && n.attrs.href !== undefined) ok = true; }); return ok; }
function countDesc(node, pred) { let c = 0; walk(node, n => { if (pred(n)) c++; }); return c; }
function subText(node) { let t = node.text || ''; walk(node, c => { if (c !== node) t += c.text || ''; }); return t.length; }
function subTextAvg(nodes) { return nodes.reduce((s, n) => s + subText(n), 0) / Math.max(1, nodes.length); }
function analyzeEngine(html, loc) {
  const root = buildTree(html);
  const TOKEN_OK = /^[A-Za-z_][\w-]*$/;
  const WIDGET_RE = /(^|[^a-z])(side|sidebar|widget|mohe|banner|promo|advert|ads?|recommend|related|footer|header|nav|menu|comment|breadcrumb|pagination|pager|social|share|subscribe|login|signup|modal|dialog|popup|toast)([^a-z]|$)/i;
  const fc = n => {
    const cls = typeof n.attrs.class === 'string' ? n.attrs.class.trim() : '';
    for (const t of cls.split(/\s+/)) if (t && TOKEN_OK.test(t)) return t;
    return '';
  };
  const DATA_KEYS = ['data-testid', 'data-id', 'data-item-id', 'data-itemid', 'data-key'];
  function classGroups() {
    const g = new Map();
    const add = (k, n) => { if (!g.has(k)) g.set(k, []); g.get(k).push(n); };
    walk(root, n => {
      if (n.tag === '#root') return;
      const cls = typeof n.attrs.class === 'string' ? n.attrs.class.trim() : '';
      if (cls) for (const tok of new Set(cls.split(/\s+/))) if (tok && TOKEN_OK.test(tok)) add(n.tag + '.' + tok, n);
      const role = typeof n.attrs.role === 'string' ? n.attrs.role.trim() : '';
      if (role && TOKEN_OK.test(role)) add(n.tag + '[role="' + role + '"]', n);
      for (const da of DATA_KEYS) {
        if (n.attrs[da] === undefined) continue;
        const v = String(n.attrs[da]).trim();
        add(n.tag + (da === 'data-testid' && /^[A-Za-z][\w-]{0,40}$/.test(v) ? '[data-testid="' + v + '"]' : '[' + da + ']'), n);
        break;
      }
    });
    return g;
  }
  function structGroups() {
    const g = new Map();
    const add = (k, n) => { if (!g.has(k)) g.set(k, []); g.get(k).push(n); };
    walk(root, n => {
      if (n.tag === '#root' || !n.parent || n.parent.tag === '#root') return;
      if (typeof n.attrs.class === 'string' && n.attrs.class.trim()) return;
      const p = n.parent;
      add(p.tag + (fc(p) ? '.' + fc(p) : '') + comb(p.tag, n.tag) + n.tag, n);
    });
    return g;
  }
  const hasAtLeast = (node, set, k) => { let c = 0; walk(node, n => { if (c < k && set.has(n)) c++; }); return c >= k; };
  function buildCands(groups, minText) {
    const cands = [];
    for (const [key, nodes] of groups) {
      if (nodes.length < 3) continue;
      if (nodes.filter(hasDescLink).length / nodes.length < 0.6) continue;
      const text = subTextAvg(nodes);
      if (text < minText) continue;
      cands.push({ key, nodes, text, img: -1, pen: WIDGET_RE.test(key) ? 0.5 : 1 });
    }
    return cands;
  }
  function prune(cands) {
    for (const c of cands) c._set = new Set(c.nodes);
    let alive = cands.filter(c => !cands.some(d => d !== c && d.nodes.length < c.nodes.length * 0.4 && d.nodes.every(n => c._set.has(n))));
    alive = alive.filter(c => {
      for (const d of alive) {
        if (d === c) continue;
        if (!c.nodes.every(n => hasAtLeast(n, d._set, 2))) continue;
        let ok = true;
        for (const n of c.nodes) {
          let sum = 0;
          walk(n, x => { if (d._set.has(x)) sum += subText(x); });
          if (sum / Math.max(1, subText(n)) < 0.75) { ok = false; break; }
        }
        if (ok) return false;
      }
      return true;
    });
    return alive;
  }
  const score = c => Math.min(c.nodes.length, 40) * (1 + 3 * Math.min(c.text, 400) / 400) * (c.img >= 0 && c.img >= 0.6 && c.text < 25 ? 4 : 1) * c.pen;
  function pick(groups, minText, imgAware) {
    const cands = prune(buildCands(groups, minText));
    if (!cands.length) return null;
    if (imgAware) {
      for (const c of cands) {
        if (c.text >= 25) continue;
        let withImg = 0;
        for (const n of c.nodes) { let hi = false; walk(n, d => { if (d !== n && d.tag === 'img') hi = true; }); if (hi) withImg++; }
        c.img = withImg / c.nodes.length;
      }
    }
    cands.sort((a, b) => score(b) - score(a));
    return cands[0];
  }
  function promote(cont) {
    const parents = cont.nodes.map(n => n.parent);
    const p0 = parents[0];
    if (!p0 || p0.tag === '#root') return cont;
    if (parents.every(p => p === p0)) return cont;
    const sig = p0.tag + (fc(p0) ? '.' + fc(p0) : '');
    if (!parents.every(p => p && p.tag + (fc(p) ? '.' + fc(p) : '') === sig)) return cont;
    const gp = p0.parent;
    if (!gp || gp.tag === '#root') return cont;
    if (!parents.every(p => p.parent === gp)) return cont;
    const nodeSet = new Set(cont.nodes);
    for (const p of parents) {
      if (countDesc(p, x => nodeSet.has(x)) !== 1) return cont;
    }
    const items = parents;
    if (items.length < 3 || items.length !== cont.nodes.length) return cont;
    return { key: gp.tag + (fc(gp) ? '.' + fc(gp) : '') + comb(gp.tag, p0.tag) + sig, nodes: items };
  }
  let cont = pick(classGroups(), 35, false) || pick(structGroups(), 35, false) || pick(classGroups(), 0, true) || pick(structGroups(), 0, true);
  if (!cont) return null;
  cont = promote(cont);
  const sample = cont.nodes.slice(0, 40);
  const stats = new Map();
  const hBare = new Map();
  let imgItems = 0;
  for (const n of sample) {
    const seen = new Set();
    let hasImg = false;
    walk(n, d => {
      if (d === n) return;
      if (d.tag === 'img') hasImg = true;
      const c1 = fc(d);
      const key = d.tag + (c1 ? '.' + c1 : '');
      if (!seen.has(key)) {
        seen.add(key);
        let st = stats.get(key);
        if (!st) { st = { count: 0, len: 0, img: 0 }; stats.set(key, st); }
        st.count++;
        st.len += (d.text || '').length;
        if (d.tag === 'a') { let has = false; walk(d, x => { if (x.tag === 'img') has = true; }); if (has) st.img++; }
      }
      if (/^h[1-6]$/.test(d.tag) && !seen.has('#' + d.tag)) { seen.add('#' + d.tag); hBare.set(d.tag, (hBare.get(d.tag) || 0) + 1); }
    });
    if (hasImg) imgItems++;
  }
  const common = p => [...stats.entries()].filter(([k, s]) => p.test(k) && s.count >= sample.length * 0.6).sort((a, b) => b[1].count - a[1].count);
  let titles = [...hBare.entries()].filter(([t, c]) => c >= sample.length * 0.6).sort((a, b) => b[1] - a[1]).map(([t]) => t);
  let imageMode = false;
  if (!titles.length && imgItems >= sample.length * 0.6 && subTextAvg(sample) < 25) {
    imageMode = true;
    titles = ['img[alt]@attr:alt', 'img@attr:alt'];
  }
  if (!titles.length) {
    const bare = stats.get('a');
    if (bare && bare.count >= sample.length * 0.6 && bare.img === 0) titles.push('a');
    else {
      const aIn = common(/^a\.[\w-]+$/).filter(([k, s]) => s.img * 2 <= s.count);
      if (aIn.length) titles.push(aIn[0][0]);
      else if (bare && bare.img === 0 && [...stats.entries()].some(([k, s]) => /^a\./.test(k) && s.img > 0)) titles.push('a:not(:has(img))');
      else titles.push('a');
    }
  }
  const snipCands = [...stats.entries()].filter(([k, s]) => s.count >= sample.length * 0.9 && (/^(p|span|dd|td)(\.[\w-]+)?$/.test(k) || /^div\.[\w-]+$/.test(k)))
    .map(([k, s]) => ({ k, avg: s.len / sample.length })).filter(x => x.avg > 15).sort((a, b) => b.avg - a.avg);
  const snippets = snipCands.length ? [snipCands[0].k] : [];
  const linkCls = common(/^a\.[\w-]+$/);
  const links = linkCls.length ? ['a.' + linkCls[0][0].split('.').slice(1).join('.'), 'a[href]'] : ['a[href]'];
  let host = null;
  const baseM = html.match(/<base[^>]*href\s*=\s*["']([^"']+)["']/i);
  const canonM = html.match(/rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']+)["']/i) || html.match(/href\s*=\s*["']([^"']+)["'][^>]*rel\s*=\s*["']canonical["']/i);
  const ogM = html.match(/property\s*=\s*["']og:url["'][^>]*content\s*=\s*["']([^"']+)["']/i);
  for (const u of [loc, baseM && baseM[1], canonM && canonM[1], ogM && ogM[1]]) {
    if (u && /^https?:\/\//i.test(u)) { try { host = new URL(u).hostname; break; } catch (e) {} }
  }
  if (host) host = host.replace(/^www\./, '');
  const matchRe = host ? ('^https?:\\/\\/(?:www\\.)?' + host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:[\\/?#:]|$)') : '^$';
  return { containers: cont.key, contCount: cont.nodes.length, titles, snippets, links, matchRe, hostKnown: !!host, imageMode };
}
const BUILTIN = new Set(['google','google_scholar','bing','duckduckgo','duckduckgo_lite','yandex','brave','ecosia','startpage','yahoo','yahoo_japan','so360','sogou','toutiao','quark','github','greasyfork']);
const hash36 = s => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36); };
const q = s => "'" + String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
const idOk = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const arr = a => '[' + a.map(q).join(', ') + ']';
const used = new Set();
for (const f of files) {
  const raw = path.basename(f);
  const stem = path.basename(f, path.extname(f));
  let name = stem.replace(/[^A-Za-z0-9_-]/g, '-').replace(/^-+|-+$/g, '');
  if (!name) name = 'custom-' + hash36(stem.toLowerCase());
  if (name === 'other') { console.log('[WARN]', raw, 'other 为保留引擎ID,已改用 other-custom'); name = 'other-custom'; }
  const base = name; let n = 2;
  while (used.has(name)) { name = base + '-' + n++; }
  used.add(name);
  if (BUILTIN.has(name)) console.log('[WARN]', raw, '引擎ID ' + name + ' 与内置引擎同名,导入后将覆盖内置选择器');
  const out = path.join(dir, name + '.js');
  let html = null;
  try { html = extractHtml(parseMht(fs.readFileSync(f, 'latin1'))); }
  catch (e) { console.log('[ERR]', raw, e.message); continue; }
  if (!html) { console.log('[WARN]', raw, '未找到 text/html 部分'); continue; }
  const eng = analyzeEngine(html.html, html.loc);
  if (!eng) { console.log('[WARN]', raw, '未发现重复结果容器(≥3个同类且含链接)'); continue; }
  const body = [
    '  ' + (idOk.test(name) ? name : q(name)) + ': {',
    '    match: /' + eng.matchRe + '/i,',
    '    containers: ' + q(eng.containers) + ',',
    '    titles: ' + arr(eng.titles) + ',',
    '    snippets: ' + arr(eng.snippets) + ',',
    '    links: ' + arr(eng.links) + ',',
    '  },'
  ].join('\n');
  fs.writeFileSync(out, body + '\n');
  console.log('[OK]', raw, '->', path.basename(out), '| containers:', eng.containers + '(x' + eng.contCount + ')', '| titles:', eng.titles.join(','), '| snippets:', eng.snippets.join(',') || '-', '| links:', eng.links.join(','), '| match:', eng.hostKnown ? eng.matchRe : '/^$(占位)');
  if (!eng.hostKnown) console.log('[WARN]', raw, '未识别出站点主机,match 已写为惰性正则 /^$,请手动修改后再导入');
  if (eng.imageMode) console.log('[WARN]', raw, '识别为图片类结果页,建议将该块改写为 categories.images 结构');
}
