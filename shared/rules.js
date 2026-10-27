// 網頁和選店程式共用的規則，確保兩邊算出來的結果一模一樣。

export const PRICES = [
  { id: 'p1', label: '50–100', min: 50, max: 100 },
  { id: 'p2', label: '100–150', min: 100, max: 150 },
  { id: 'p3', label: '150–200', min: 150, max: 200 },
  { id: 'p4', label: '200 以上', min: 200, max: 99999 }
];
export const DISTS = [
  { id: 'd1', label: '5 分鐘', sub: '400 m 內', minutes: 5 },
  { id: 'd2', label: '10 分鐘', sub: '800 m 內', minutes: 10 },
  { id: 'd3', label: '15 分鐘', sub: '1.2 km 內', minutes: 15 }
];
// 今日限定食物的候選
export const FOODS = ['雞翅', '薯條', '牛肉', '咖哩', '水餃', '蛋餅', '炒飯', '滷肉飯', '拉麵', '鍋貼', '鹹酥雞', '火鍋'];

// 店名裡可以照常說的食物字（不會被遮蔽）
export const FOOD_CHARS = '飯麵肉牛豬雞鴨羊魚蝦蚵仔湯粥餃包餅粉米燒烤炸滷爌蛋菜素蔬食便當排骨咖哩拉漢堡披薩鍋豆腐臭圓煎乾早午晚餐酥味噌爐翅薯條水炒火鹹茶奶冰甜辣麻醬油';
// 店名裡常見、單獨出現時不算辨識度的字（但跟其他字連在一起就會被遮）
export const SOFT_CHARS = '店館屋堂坊記口小大家號廳樓棧舖房';

// 字串 → 32 位元雜湊
export function hash(str) {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
// 可重現的隨機數（同一個種子，網頁和伺服器擲出同樣的骰子）
export function rng(seed) {
  let a = hash(seed);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dailyFood(dayISO) {
  return FOODS[hash('food:' + dayISO) % FOODS.length];
}
export function cats(dayISO) {
  return [
    { id: 'c0', label: '飯類' },
    { id: 'c1', label: '麵類' },
    { id: 'c2', label: dailyFood(dayISO), daily: true }
  ];
}

// 開票：counts = {p1: 3, p2: 2}；平手用以日期為種子的骰子決定
// 回傳 { id, win, tie, labels, max, faces }，faces 是擲骰動畫要顯示的點數
export function decide(counts, opts, title, seed) {
  const max = Math.max(0, ...opts.map(o => counts[o.id] || 0));
  let leaders = opts.filter(o => (counts[o.id] || 0) === max && max > 0);
  if (!leaders.length) leaders = opts.slice();          // 沒人投：全部一起抽
  const k = leaders.length;
  const per = Math.floor(6 / k);
  const r = rng(seed + ':' + title);
  const rolls = [];
  let pick;
  for (let guard = 0; guard < 20; guard++) {
    const face = 1 + Math.floor(r() * 6);
    rolls.push(face);
    const idx = Math.floor((face - 1) / per);
    if (idx < k) { pick = leaders[idx]; break; }        // 落在重擲點數就再擲一次
  }
  if (!pick) pick = leaders[0];
  return {
    title, id: pick.id, win: pick.label, tie: k > 1, max,
    ids: leaders.map(o => o.id), labels: leaders.map(o => o.label), rolls
  };
}

export function decideAll(tally, dayISO, stage) {
  const seed = `${dayISO}:${stage}`;
  return {
    price: decide(tally.price || {}, PRICES, '價格', seed),
    dist: decide(tally.dist || {}, DISTS, '距離', seed),
    cat: decide(tally.cat || {}, cats(dayISO), '類型', seed)
  };
}

export function tieText(d) {
  return [d.price, d.dist, d.cat].filter(x => x.tie)
    .map(x => `${x.title}「${x.labels.join('」「')}」各 ${x.max} 票平手，擲骰選了「${x.win}」`).join('；');
}

// 從店名算出禁用字：有辨識度的單字、以及任何不全是食物字的連續兩字
export function bannedFromNames(names) {
  const food = new Set(FOOD_CHARS), soft = new Set(SOFT_CHARS);
  const chars = new Set(), bigrams = new Set();
  const isHan = c => /\p{Script=Han}/u.test(c);
  for (const name of names) {
    const cs = [...name].filter(isHan);
    for (const c of cs) if (!food.has(c) && !soft.has(c)) chars.add(c);
    for (let i = 0; i < cs.length - 1; i++) {
      if (!(food.has(cs[i]) && food.has(cs[i + 1]))) bigrams.add(cs[i] + cs[i + 1]);
    }
  }
  return { chars: [...chars], bigrams: [...bigrams] };
}

// 台北時間
export function taipeiNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  const g = t => parts.find(p => p.type === t).value;
  const iso = `${g('year')}-${g('month')}-${g('day')}`;
  const [y, m, d] = iso.split('-').map(Number);
  return {
    iso,
    weekday: new Date(Date.UTC(y, m - 1, d)).getUTCDay(),   // 0 = 星期日
    seconds: Number(g('hour')) * 3600 + Number(g('minute')) * 60 + Number(g('second'))
  };
}
export const toSec = t => { const [h, m, s] = String(t).split(':').map(Number); return h * 3600 + m * 60 + (s || 0); };

export function phaseAt(now, s) {
  if (s.weekdays_only && (now.weekday === 0 || now.weekday === 6)) return 'closed';
  const t = now.seconds;
  if (t < toSec(s.vote_start)) return 'wait';
  if (t < toSec(s.lobby_start)) return 'vote';
  if (t < toSec(s.revote_start)) return 'lobby';
  if (t < toSec(s.result_at)) return 'revote';
  return 'result';
}
