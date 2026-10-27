#!/usr/bin/env node
// 那家不能說的店：伺服器端程式（由 GitHub Actions 每天自動執行）
//
//   node picker/pick.mjs prepare   10:50 執行：查附近餐廳，更新聊天室的店名禁用字
//   node picker/pick.mjs pick      11:50 執行：開票、查 Google 地圖選店、寫入結果
//
// 需要的環境變數（存在 GitHub Secrets）：
//   GOOGLE_MAPS_API_KEY        Google 地圖金鑰
//   SUPABASE_URL               Supabase 專案網址
//   SUPABASE_SERVICE_ROLE_KEY  Supabase 的 service_role 金鑰（只放在伺服器，絕不能放進網頁）
//   OFFICE_LAT, OFFICE_LNG     公司座標
//
// 測試用參數：--mock（不連 Google 和 Supabase，用 fixtures 的資料）、--date 2026-10-28、--force（重新選店）

import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICES, DISTS, cats, decideAll, tieText, bannedFromNames, taipeiNow } from '../shared/rules.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const MODE = args[0];
const flag = n => args.includes(n);
const opt = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
const MOCK = flag('--mock');

const CFG = {
  office: { lat: Number(process.env.OFFICE_LAT || 25.0330), lng: Number(process.env.OFFICE_LNG || 121.5654) },
  minRating: 4.0, minReviews: 51,
  lunchStartMin: 12 * 60, lunchMinutes: 60,
  walkMetersPerMinute: 80,
  extraWalkMinutes: 5, maxWalkMinutes: 15,
  keywords: { '飯類': '飯 便當', '麵類': '麵' },
  // 用來收集附近店名（禁用字）的搜尋詞
  prepareQueries: ['餐廳', '小吃', '便當', '麵'],
  useRoutesApi: process.env.USE_ROUTES_API !== 'false'
};

const PRICE_LEVEL_RANGE = {
  PRICE_LEVEL_FREE: [0, 0], PRICE_LEVEL_INEXPENSIVE: [1, 200], PRICE_LEVEL_MODERATE: [200, 400],
  PRICE_LEVEL_EXPENSIVE: [400, 800], PRICE_LEVEL_VERY_EXPENSIVE: [800, 99999]
};

function need(name) {
  const v = process.env[name];
  if (!v) throw new Error(`缺少環境變數 ${name}。請到 GitHub repository 的 Settings → Secrets and variables → Actions 新增。`);
  return v;
}

// ---------------- Supabase（資料庫） ----------------
const MOCK_DB = join(HERE, '..', 'fixtures', 'mock-db.json');
async function mockDb() { return existsSync(MOCK_DB) ? JSON.parse(await readFile(MOCK_DB, 'utf8')) : { votes: [], results: [], banned_terms: [] }; }

async function sb(path, { method = 'GET', body, prefer } = {}) {
  const url = need('SUPABASE_URL').replace(/\/$/, '') + '/rest/v1/' + path;
  const key = need('SUPABASE_SERVICE_ROLE_KEY');
  const res = await fetch(url, {
    method,
    headers: {
      apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`資料庫錯誤（${res.status}）：${text}`);
  return text ? JSON.parse(text) : null;
}

const db = {
  async testDay() {
    if (MOCK) return null;
    return (await sb('settings?id=eq.1&select=test_day'))[0]?.test_day || null;
  },
  async votes(day) {
    if (MOCK) return (await mockDb()).votes.filter(v => v.day === day);
    return sb(`votes?day=eq.${day}&select=price,dist,cat`);
  },
  async lastResult(day) {
    if (MOCK) return (await mockDb()).results.filter(r => r.day < day).sort((a, b) => b.day.localeCompare(a.day))[0];
    return (await sb(`results?day=lt.${day}&place=not.is.null&order=day.desc&limit=1&select=day,place`))[0];
  },
  async resultExists(day) {
    if (MOCK) return (await mockDb()).results.some(r => r.day === day);
    return (await sb(`results?day=eq.${day}&select=day`)).length > 0;
  },
  async saveResult(row) {
    if (MOCK) {
      const d = await mockDb(); d.results = d.results.filter(r => r.day !== row.day); d.results.push(row);
      await writeFile(MOCK_DB, JSON.stringify(d, null, 2)); return;
    }
    await sb('results?on_conflict=day', { method: 'POST', body: row, prefer: 'resolution=merge-duplicates' });
  },
  async replaceBanned(rows) {
    if (MOCK) { const d = await mockDb(); d.banned_terms = rows; await writeFile(MOCK_DB, JSON.stringify(d, null, 2)); return; }
    await sb('banned_terms?term=neq.__none__', { method: 'DELETE' });
    for (let i = 0; i < rows.length; i += 500) await sb('banned_terms', { method: 'POST', body: rows.slice(i, i + 500) });
  }
};

// ---------------- Google 地圖 ----------------
function boxAround(c, r) {
  const dLat = r / 111320, dLng = r / (111320 * Math.cos(c.lat * Math.PI / 180));
  return { rectangle: { low: { latitude: c.lat - dLat, longitude: c.lng - dLng }, high: { latitude: c.lat + dLat, longitude: c.lng + dLng } } };
}
function haversine(a, b) {
  const R = 6371000, rad = x => x * Math.PI / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const DETAIL_FIELDS = [
  'places.id', 'places.displayName', 'places.formattedAddress', 'places.location',
  'places.rating', 'places.userRatingCount', 'places.priceLevel', 'places.priceRange',
  'places.regularOpeningHours', 'places.businessStatus', 'places.googleMapsUri'
];

async function searchText(textQuery, radius, fields, extra = {}) {
  if (MOCK) {
    const all = JSON.parse(await readFile(join(HERE, '..', 'fixtures', 'sample-places.json'), 'utf8')).places;
    const words = textQuery.split(/\s+/);
    if (['餐廳', '小吃'].includes(textQuery)) return all;
    return all.filter(p => words.some(w => p.displayName.text.includes(w) || (p.mockMenu || []).includes(w)));
  }
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': need('GOOGLE_MAPS_API_KEY'), 'X-Goog-FieldMask': fields.join(',') },
    body: JSON.stringify({
      textQuery, languageCode: 'zh-TW', regionCode: 'TW', pageSize: 20,
      locationRestriction: boxAround(CFG.office, radius), ...extra
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(`Google 地點搜尋失敗（${res.status}）：${data.error?.message || JSON.stringify(data)}`);
  return data.places || [];
}

async function walking(places) {
  const fallback = () => new Map(places.map((p, i) => {
    const m = haversine(CFG.office, { lat: p.location.latitude, lng: p.location.longitude }) * 1.3;
    return [i, { minutes: m / CFG.walkMetersPerMinute, meters: Math.round(m), est: true }];
  }));
  if (MOCK || !CFG.useRoutesApi || !places.length) return fallback();
  try {
    const res = await fetch('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'X-Goog-Api-Key': need('GOOGLE_MAPS_API_KEY'),
        'X-Goog-FieldMask': 'originIndex,destinationIndex,duration,distanceMeters,condition'
      },
      body: JSON.stringify({
        origins: [{ waypoint: { location: { latLng: { latitude: CFG.office.lat, longitude: CFG.office.lng } } } }],
        destinations: places.map(p => ({ waypoint: { location: { latLng: { latitude: p.location.latitude, longitude: p.location.longitude } } } })),
        travelMode: 'WALK'
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || JSON.stringify(data));
    const m = fallback();
    for (const el of data) {
      if (el.condition && el.condition !== 'ROUTE_EXISTS') continue;
      m.set(el.destinationIndex, { minutes: Number(String(el.duration || '0s').replace('s', '')) / 60, meters: el.distanceMeters, est: false });
    }
    return m;
  } catch (e) {
    console.warn(`（路線計算失敗，改用直線距離估算：${e.message}）`);
    return fallback();
  }
}

function openDuring(hours, weekday, startMin, lenMin) {
  const periods = hours?.periods;
  if (!periods?.length) return null;
  const WEEK = 7 * 1440, from = weekday * 1440 + startMin, to = from + lenMin;
  for (const p of periods) {
    if (!p.close) return true;
    const o = p.open.day * 1440 + p.open.hour * 60 + (p.open.minute || 0);
    let c = p.close.day * 1440 + p.close.hour * 60 + (p.close.minute || 0);
    if (c <= o) c += WEEK;
    for (const s of [0, -WEEK]) if (o + s <= from && to <= c + s) return true;
  }
  return false;
}
function priceRangeOf(p) {
  if (p.priceRange?.startPrice) {
    const lo = Number(p.priceRange.startPrice.units || 0);
    return { lo, hi: p.priceRange.endPrice ? Number(p.priceRange.endPrice.units || lo) : 99999, source: '金額' };
  }
  const lv = PRICE_LEVEL_RANGE[p.priceLevel];
  return lv ? { lo: lv[0], hi: lv[1], source: '等級' } : null;
}

// ---------------- 選店規則 ----------------
function choose(list, { price, walk, lastId, keyword }) {
  const steps = [];
  const note = (label, n, soft = false) => steps.push({ label, n, soft });
  note(`附近搜尋「${keyword}」`, list.length);
  const quality = r => r.rating >= CFG.minRating && r.reviews >= CFG.minReviews
    && r.status !== 'CLOSED_PERMANENTLY' && r.status !== 'CLOSED_TEMPORARILY' && r.open !== false;
  const within = m => list.filter(r => r.walk <= m && quality(r));
  const priceOK = r => !r.price || (r.price.lo <= price.max && r.price.hi >= price.min);

  let maxWalk = walk, pool = within(maxWalk);
  if (!pool.length && maxWalk < CFG.maxWalkMinutes) {
    maxWalk = CFG.maxWalkMinutes;
    note(`步行 ${walk} 分鐘內沒有合格的店，放寬到 ${maxWalk} 分鐘`, null, true);
    pool = within(maxWalk);
  }
  note(`步行 ${maxWalk} 分鐘內`, list.filter(r => r.walk <= maxWalk).length);
  note(`4 星以上、超過 50 則評論、中午有營業`, pool.length);

  const priced = pool.filter(priceOK);
  let priceMiss = !priced.length;
  if (priced.length) { pool = priced; note(`價格 ${price.label} 元`, pool.length); }
  else if (pool.length) note(`沒有剛好 ${price.label} 元的店，取價格最接近的`, pool.length, true);

  if (lastId) {
    const notY = pool.filter(r => r.id !== lastId);
    if (notY.length < pool.length) {
      if (notY.length) { pool = notY; note('排除上次吃過的店', pool.length); }
      else {
        const far = maxWalk + CFG.extraWalkMinutes;
        let alt = within(far).filter(r => r.id !== lastId);
        if (alt.length) {
          const ap = alt.filter(priceOK);
          if (ap.length) { alt = ap; priceMiss = false; } else priceMiss = true;
          pool = alt;
          note(`符合的只有上次那家，放寬到步行 ${far} 分鐘內找別家`, pool.length, true);
          if (priceMiss) note(`這些店都不在 ${price.label} 元，取價格最接近的`, pool.length, true);
        } else note('多走 5 分鐘也找不到別家，只好重複上次那家', pool.length, true);
      }
    }
  }
  if (priceMiss && pool.length) {
    const mid = (price.min + Math.min(price.max, 400)) / 2;
    const d = r => r.price ? Math.abs((r.price.lo + r.price.hi) / 2 - mid) : 9999;
    pool = [pool.slice().sort((a, b) => d(a) - d(b))[0]];
  }
  const score = r => r.rating + Math.log10(Math.max(r.reviews, 1)) * 0.3 + Math.random() * 0.15;
  return { best: pool.slice().sort((a, b) => score(b) - score(a))[0] || null, steps };
}

// ---------------- 兩個模式 ----------------
async function prepare() {
  const radius = CFG.maxWalkMinutes * CFG.walkMetersPerMinute * 1.2;
  const names = new Set();
  for (const q of CFG.prepareQueries) {
    const ps = await searchText(q, radius, ['places.id', 'places.displayName']);
    ps.forEach(p => p.displayName?.text && names.add(p.displayName.text));
  }
  const { chars, bigrams } = bannedFromNames([...names]);
  const rows = [...chars.map(term => ({ term, kind: 'char' })), ...bigrams.map(term => ({ term, kind: 'bigram' }))];
  await db.replaceBanned(rows);
  console.log(`附近找到 ${names.size} 家店，更新禁用字：${chars.length} 個單字、${bigrams.length} 組連續兩字。`);
}

async function pick() {
  const now = taipeiNow();
  const testDay = await db.testDay();
  const day = opt('--date') || testDay || now.iso;
  if (testDay) console.log(`（測試模式：使用測試日期 ${testDay}）`);
  const weekday = day !== now.iso ? new Date(day + 'T00:00:00Z').getUTCDay() : now.weekday;
  if (!flag('--force') && await db.resultExists(day)) { console.log(`${day} 已經有結果了，略過（加 --force 可重新選）。`); return; }

  const votes = await db.votes(day);
  const tally = { price: {}, dist: {}, cat: {} };
  for (const v of votes) for (const k of ['price', 'dist', 'cat']) if (v[k]) tally[k][v[k]] = (tally[k][v[k]] || 0) + 1;
  const decided = decideAll(tally, day, 'final');
  decided.voters = votes.length;
  decided.tieText = tieText(decided);

  if (!votes.length) {
    await db.saveResult({ day, decided, place: null, steps: [{ label: '今天沒有人投票', n: 0, soft: true }] });
    console.log(`${day}：沒有人投票。`); return;
  }

  const price = PRICES.find(p => p.id === decided.price.id);
  const walk = DISTS.find(d => d.id === decided.dist.id).minutes;
  const food = cats(day).find(c => c.id === decided.cat.id).label;
  const keyword = CFG.keywords[food] || food;
  const last = await db.lastResult(day);

  const radius = Math.max(walk + CFG.extraWalkMinutes, CFG.maxWalkMinutes) * CFG.walkMetersPerMinute * 1.2;
  const places = await searchText(keyword, radius, DETAIL_FIELDS, { minRating: CFG.minRating });
  const w = await walking(places);
  const list = places.map((p, i) => ({
    id: p.id, name: p.displayName?.text, address: p.formattedAddress, url: p.googleMapsUri,
    rating: p.rating ?? 0, reviews: p.userRatingCount ?? 0, status: p.businessStatus,
    price: priceRangeOf(p), open: openDuring(p.regularOpeningHours, weekday, CFG.lunchStartMin, CFG.lunchMinutes),
    walk: w.get(i).minutes, meters: w.get(i).meters, walkEstimated: w.get(i).est
  }));

  const { best, steps } = choose(list, { price, walk, lastId: last?.place?.id, keyword });
  const place = best && {
    id: best.id, name: best.name, address: best.address, url: best.url, rating: best.rating, reviews: best.reviews,
    walk: Math.round(best.walk), meters: best.meters, price: best.price
  };
  await db.saveResult({ day, decided, place, steps });

  console.log(`${day} 開票（${votes.length} 票）：${price.label} 元、步行 ${walk} 分鐘、${food}${decided.tieText ? '（' + decided.tieText + '）' : ''}`);
  steps.forEach(s => console.log(`  ${s.soft ? '！' : '・'} ${s.label}${s.n == null ? '' : `：${s.n} 家`}`));
  console.log(place ? `▶ 今天吃：${place.name}（評分 ${place.rating}，步行約 ${place.walk} 分鐘）` : '附近找不到符合條件的店。');
}

const run = { prepare, pick }[MODE];
if (!run) { console.log('用法：node picker/pick.mjs prepare|pick [--mock] [--date YYYY-MM-DD] [--force]'); process.exit(1); }
run().catch(e => { console.error(`錯誤：${e.message}`); process.exit(1); });
