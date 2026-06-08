// packages/server/src/routes/import.js
// GET /api/import/fetch-page?url=...&inlineImages=1&scripts=strip
// Маркер: IMPORT-PAGE-ROUTE-V3
import express from 'express';

const router = express.Router();
router.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const FETCH_TIMEOUT = 20000, ASSET_TIMEOUT = 15000;
const MAX_HTML = 8 * 1024 * 1024, MAX_ASSET = 3 * 1024 * 1024;
const UA = 'Mozilla/5.0 (KioskImportBot)';
const TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

function isPrivateHost(h) {
  if (!h) return true; h = h.toLowerCase();
  if (h === 'localhost' || h.endsWith('.local')) return true;
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) { const a = +m[1], b = +m[2];
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true; }
  if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
  return false;
}
async function timedFetch(url, opts = {}) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), opts.timeout || FETCH_TIMEOUT);
  try { return await fetch(url, { redirect: 'follow', signal: c.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } }); }
  finally { clearTimeout(t); }
}
function absolutize(u, base) { try { return new URL(u, base).href; } catch { return null; } }
async function fetchText(url, cache) {
  if (cache.has(url)) return cache.get(url);
  let txt = '';
  try { const r = await timedFetch(url, { timeout: ASSET_TIMEOUT }); if (r.ok) txt = await r.text(); } catch {}
  cache.set(url, txt); return txt;
}
async function toDataUri(url, cache) {
  const key = 'd:' + url;
  if (cache.has(key)) return cache.get(key);
  let out = null;
  try {
    const r = await timedFetch(url, { timeout: ASSET_TIMEOUT });
    if (r.ok) {
      const cl = +(r.headers.get('content-length') || 0);
      if (!cl || cl <= MAX_ASSET) {
        const buf = Buffer.from(await r.arrayBuffer());
        if (buf.length <= MAX_ASSET) {
          const ct = (r.headers.get('content-type') || 'application/octet-stream').split(';')[0].trim();
          out = `data:${ct};base64,${buf.toString('base64')}`;
        }
      }
    }
  } catch {}
  cache.set(key, out); return out;
}
function stripScriptsTags(s) {
  return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, '');
}

// CSS: @import (рекурсивно) + url()
async function processCss(css, base, inlineImages, stats, depth, cache) {
  if (depth > 0) {
    const importRe = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)\s*[^;]*;/gi;
    const found = []; let m;
    while ((m = importRe.exec(css)) !== null) found.push({ token: m[0], ref: m[2] || m[4] });
    for (const f of found) {
      let sub = ''; const abs = absolutize(f.ref, base);
      if (abs) { const raw = await fetchText(abs, cache); if (raw) sub = await processCss(raw, abs, inlineImages, stats, depth - 1, cache); }
      css = css.split(f.token).join(sub);
    }
  } else {
    css = css.replace(/@import[^;]*;/gi, '');
  }
  const re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/g;
  const raws = []; let mm;
  while ((mm = re.exec(css)) !== null) { const v = mm[2].trim(); if (!v.startsWith('data:')) { const abs = absolutize(v, base); if (abs) raws.push(abs); } }
  const uniq = [...new Set(raws)]; const map = {};
  if (inlineImages) {
    await Promise.all(uniq.map(async u => { const d = await toDataUri(u, cache); if (d) { map[u] = d; stats.imagesInlined++; } else { map[u] = null; stats.imagesSkipped++; } }));
  } else { uniq.forEach(u => { map[u] = u; }); }
  return css.replace(re, (full, q, v) => {
    const t = v.trim(); if (t.startsWith('data:')) return full;
    const abs = absolutize(t, base); if (!abs) return full;
    const val = map[abs];
    if (val === null) return 'none';
    if (val === undefined) return full;
    return `url("${val}")`;
  });
}

// инлайн-атрибуты style="..." с url()
async function processInlineStyles(html, base, inlineImages, stats, cache) {
  const re = /style\s*=\s*(["'])([^"']*?url\([^"']*?)\1/gi;
  const uniq = new Set(); let m;
  while ((m = re.exec(html)) !== null) uniq.add(m[2]);
  const map = {};
  for (const c of uniq) map[c] = await processCss(c, base, inlineImages, stats, 0, cache);
  return html.replace(re, (full, q, c) => (map[c] !== undefined ? `style=${q}${map[c]}${q}` : full));
}

router.get('/health', (req, res) => res.json({ success: true, marker: 'IMPORT-PAGE-ROUTE-V3' }));

router.get('/fetch-page', async (req, res) => {
  try {
    if (typeof fetch === 'undefined') return res.status(500).json({ success: false, error: 'нужен Node >= 18' });
    const target = String(req.query.url || '').trim();
    const inlineImages = String(req.query.inlineImages ?? '1') !== '0';
    const scripts = String(req.query.scripts || 'strip');
    if (!target) return res.status(400).json({ success: false, error: 'url обязателен' });
    let u; try { u = new URL(target); } catch { return res.status(400).json({ success: false, error: 'некорректный url' }); }
    if (!/^https?:$/.test(u.protocol)) return res.status(400).json({ success: false, error: 'только http/https' });
    if (isPrivateHost(u.hostname)) return res.status(400).json({ success: false, error: 'приватные адреса запрещены' });

    const cache = new Map();
    const r = await timedFetch(u.href);
    if (!r.ok) return res.status(502).json({ success: false, error: `источник вернул ${r.status}` });
    const finalUrl = r.url || u.href;
    let html = await r.text();
    if (html.length > MAX_HTML) html = html.slice(0, MAX_HTML);

    const stats = { cssInlined: 0, imagesInlined: 0, imagesSkipped: 0 };
    const tm = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = tm ? tm[1].trim().replace(/\s+/g, ' ') : u.hostname;

    if (scripts === 'strip') html = stripScriptsTags(html);

    // <link rel=stylesheet> -> inline <style> (с @import и url())
    const links = html.match(/<link\b[^>]*>/gi) || [];
    for (const tag of links) {
      if (!/rel\s*=\s*['"]?[^'">]*stylesheet/i.test(tag)) continue;
      const hrefM = tag.match(/href\s*=\s*(['"])(.*?)\1/i); if (!hrefM) continue;
      const cssUrl = absolutize(hrefM[2], finalUrl); if (!cssUrl) continue;
      const cssText = await fetchText(cssUrl, cache); if (!cssText) continue;
      const processed = await processCss(cssText, cssUrl, inlineImages, stats, 3, cache);
      stats.cssInlined++;
      html = html.replace(tag, `<style>\n${processed}\n</style>`);
    }
    // inline <style> блоки
    {
      const blocks = []; const styleRe = /<style\b[^>]*>([\s\S]*?)<\/style>/gi; let sm;
      while ((sm = styleRe.exec(html)) !== null) blocks.push(sm);
      for (const sm of blocks) {
        const processed = await processCss(sm[1], finalUrl, inlineImages, stats, 3, cache);
        html = html.split(sm[0]).join(`<style>\n${processed}\n</style>`);
      }
    }
    // inline style="..." атрибуты
    html = await processInlineStyles(html, finalUrl, inlineImages, stats, cache);

    // <img>
    {
      const imgs = html.match(/<img\b[^>]*>/gi) || []; const repl = [];
      for (const tag of imgs) {
        let nt = tag;
        const srcM = tag.match(/\ssrc\s*=\s*(['"])(.*?)\1/i);
        if (srcM && !srcM[2].startsWith('data:')) {
          const abs = absolutize(srcM[2], finalUrl);
          if (abs) {
            let val = abs;
            if (inlineImages) { const d = await toDataUri(abs, cache); if (d) { val = d; stats.imagesInlined++; } else { val = TRANSPARENT; stats.imagesSkipped++; } }
            nt = nt.replace(srcM[0], ` src="${val}"`);
          }
        }
        // srcset: онлайн -> абсолютные; офлайн(inline) -> вырезаем (чтобы не тянуть сеть)
        const ssM = nt.match(/\ssrcset\s*=\s*(['"])(.*?)\1/i);
        if (ssM) {
          if (inlineImages) nt = nt.replace(ssM[0], '');
          else {
            const fixed = ssM[2].split(',').map(p => { const s = p.trim().split(/\s+/); const abs = absolutize(s[0], finalUrl); return abs ? [abs, ...s.slice(1)].join(' ') : p.trim(); }).join(', ');
            nt = nt.replace(ssM[0], ` srcset="${fixed}"`);
          }
        }
        if (nt !== tag) repl.push([tag, nt]);
      }
      for (const [a, b] of repl) html = html.split(a).join(b);
    }

    // полный html для превью
    let fullHtml = html;
    if (!inlineImages && !/<base\b/i.test(fullHtml)) fullHtml = fullHtml.replace(/<head([^>]*)>/i, `<head$1><base href="${finalUrl}">`);

    // fragment: <style> + body, без head/base/script; в офлайн-режиме обезвреживаем внешние теги
    const styleBlocks = (html.match(/<style\b[^>]*>[\s\S]*?<\/style>/gi) || []).join('\n');
    let body;
    const bm = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    body = bm ? bm[1] : html.replace(/<head[\s\S]*?<\/head>/i, '').replace(/<\/?(?:html|body)[^>]*>/gi, '');
    body = stripScriptsTags(body)
      .replace(/<base\b[^>]*>/gi, '')
      .replace(/<link\b[^>]*>/gi, '')
      .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
      .replace(/<iframe\b[^>]*\/?>/gi, '');
    if (inlineImages) body = body.replace(/<source\b[^>]*>/gi, ''); // picture/video внешние источники
    const fragment = `${styleBlocks}\n${body}`.trim();

    res.json({ success: true, finalUrl, title, html: fullHtml, fragment, stats });
  } catch (e) {
    const msg = e && e.name === 'AbortError' ? 'таймаут запроса' : (e?.message || String(e));
    res.status(500).json({ success: false, error: msg });
  }
});

export default router;
