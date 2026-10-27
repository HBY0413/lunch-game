// 那家不能說的店：正式版網頁
import { PRICES, DISTS, cats, decideAll, tieText, taipeiNow, phaseAt, toSec } from './shared/rules.js';

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const CFG = window.LUNCH_CONFIG || {};
const PHASE_TXT = { closed: '今天休息', wait: '還沒開始', vote: '投票中', lobby: '遊說中', revote: '改票中', result: '已定案', loading: '載入中' };
const nick = n => (n || '').split('的').pop();
const hue = n => [...(n || '?')].reduce((a, c) => (a * 31 + c.codePointAt(0)) % 360, 7);
const fmtHM = t => String(t).slice(0, 5);

const ICON={
 '雞翅':'<path d="M7 20 q-4 -10 6 -14 q10 -3 13 7 q2 9 -8 11 q-6 1 -11 -4z" fill="#d9822b"/><path d="M11 12 q4 -3 9 -1" stroke="#f3b562" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M7 20 l-3 5 M7 20 l-5 2" stroke="#f3ead7" stroke-width="2.6" stroke-linecap="round"/>',
 '薯條':'<path d="M9 13 l-1 -10 M13 13 l0 -12 M17 13 l1 -11 M21 13 l2 -9 M11 13 l-3 -7" stroke="#ffc843" stroke-width="2.6" stroke-linecap="round"/><path d="M6 12 h20 l-2 16 h-16z" fill="#e5484d"/><path d="M11 18 q5 3 10 0" stroke="#fff" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
 '牛肉':'<path d="M4 16 q0 -9 11 -10 q13 -1 13 9 q0 10 -12 11 q-12 0 -12 -10z" fill="#c2453b"/><path d="M8 16 q2 -6 8 -6 q8 0 8 5 q0 6 -8 6 q-8 0 -8 -5z" fill="#e36b5d"/><circle cx="21" cy="15" r="2.6" fill="#fbe3d6"/>',
 '咖哩':'<ellipse cx="16" cy="19" rx="14" ry="7" fill="#f1f1f1" stroke="#ddd" stroke-width="1"/><path d="M4 18 q4 -6 12 -6 q-2 6 2 10 q-10 2 -14 -4z" fill="#fff"/><path d="M16 12 q10 0 12 6 q-4 5 -10 4 q-4 -4 -2 -10z" fill="#c98a1f"/><circle cx="22" cy="17" r="1.6" fill="#e5733a"/>',
 '水餃':'<path d="M3 21 q1 -13 13 -14 q12 1 13 14z" fill="#fbf6ec" stroke="#e2d4b8" stroke-width="1.2"/><path d="M6 17 q2 -2 4 0 q2 -2 4 0 q2 -2 4 0 q2 -2 4 0 q2 -2 4 0" fill="none" stroke="#e2d4b8" stroke-width="1.2"/>',
 '蛋餅':'<rect x="3" y="10" width="26" height="12" rx="6" fill="#f2cf72"/><path d="M8 10 v12 M14 10 v12 M20 10 v12" stroke="#e0b24a" stroke-width="1.4"/><path d="M26 12 q3 4 0 8" fill="#ffe08a"/><circle cx="11" cy="14" r="1.5" fill="#6bbf59"/><circle cx="18" cy="18" r="1.3" fill="#6bbf59"/>',
 '飯類':'<path d="M5 15 q1 -8 11 -8 q10 0 11 8z" fill="#fff" stroke="#ddd" stroke-width="1"/><path d="M3 15 h26 q-1 12 -13 13 q-12 -1 -13 -13z" fill="#6aaee6"/>',
 '麵類':'<path d="M7 15 q1 -6 3 -1 q2 -6 4 -1 q2 -6 4 -1 q2 -6 4 -1 q3 -2 3 4" fill="none" stroke="#f2cf72" stroke-width="2" stroke-linecap="round"/><path d="M17 14 l9 -12 M20 15 l9 -11" stroke="#9a6b44" stroke-width="1.8" stroke-linecap="round"/><path d="M3 15 h26 q-1 12 -13 13 q-12 -1 -13 -13z" fill="#ff7a2f"/>',
 '熱湯':'<path d="M11 10 q-3 -3 0 -6 M16 9 q-3 -3 0 -6 M21 10 q-3 -3 0 -6" fill="none" stroke="#9aa1b2" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="16" cy="15" rx="13" ry="3" fill="#e2622f"/><path d="M3 15 h26 q-1 12 -13 13 q-12 -1 -13 -13z" fill="#d8b98a"/>',
 '素食':'<path d="M6 26 q0 -18 20 -20 q2 20 -20 20z" fill="#5fbf6a"/><path d="M6 26 q8 -10 16 -16" stroke="#2f8a3d" stroke-width="1.6" fill="none" stroke-linecap="round"/>',
 '速食':'<path d="M4 14 q0 -9 12 -9 q12 0 12 9z" fill="#e9a54b"/><rect x="3" y="15" width="26" height="3" rx="1.5" fill="#6bbf59"/><rect x="4" y="18" width="24" height="4" rx="2" fill="#7a3f22"/><path d="M4 22 h24 q0 5 -5 5 h-14 q-5 0 -5 -5z" fill="#e9a54b"/>',
 '早餐店':'<path d="M5 18 q-3 -9 6 -11 q4 -5 11 -1 q8 0 6 9 q3 8 -6 9 q-6 4 -12 0 q-7 0 -5 -6z" fill="#fff" stroke="#e3e3e3" stroke-width="1"/><circle cx="16" cy="16" r="5.5" fill="#ffb627"/>',
 '異國料理':'<path d="M9 9 q8 -2 10 6 q2 9 -8 14 q10 -9 -2 -20z" fill="#e5484d"/><path d="M9 9 q-1 -4 3 -6" stroke="#4caf50" stroke-width="2" fill="none" stroke-linecap="round"/>',
 '小吃':'<path d="M4 23 q0 -13 12 -15 q12 2 12 15z" fill="#fbf3e2" stroke="#e2d4b8" stroke-width="1.2"/><path d="M10 11 q6 4 12 0 M8 15 q8 5 16 0" fill="none" stroke="#e2d4b8" stroke-width="1.2"/><circle cx="16" cy="7" r="2" fill="#e2d4b8"/>'
};

const EMPTY_CHAT='<div class="empty"><svg class="steamer" viewBox="0 0 92 84" aria-hidden="true"><g class="steam"><path d="M30 26 q-6 -7 0 -13 q6 -7 0 -13"/><path d="M46 22 q-6 -7 0 -13 q6 -7 0 -13"/><path d="M62 26 q-6 -7 0 -13 q6 -7 0 -13"/></g><rect x="8" y="50" width="76" height="26" rx="6" fill="#d9b37a"/><path d="M8 58 h76 M8 68 h76" stroke="#b98d4f" stroke-width="2"/><g class="lid"><path d="M10 50 q36 -26 72 0 z" fill="#e6c48e"/><path d="M18 46 q28 -18 56 0" fill="none" stroke="#b98d4f" stroke-width="2"/><rect x="40" y="31" width="12" height="5" rx="2.5" fill="#b98d4f"/></g><path d="M22 50 q6 -9 13 0 z M38 50 q8 -11 16 0 z M57 50 q6 -9 13 0 z" fill="#fbf6ec" opacity="0"/></svg><p>遊說還沒開始。11:30 投票結束後，想翻盤的人可以在這裡說服大家。</p></div>';

const mtof=m=>440*Math.pow(2,(m-69)/12);
// 4-bar bouncy variety-show loop in C major, eighth-note steps
const MEL=[72,null,76,79, 77,76,74,null, 72,null,76,79, 81,79,77,null, 76,null,77,79, 81,null,79,77, 76,74,72,74, 76,null,67,null];
const ROOTS=[48,41,48,43];
const Snd={ctx:null,on:false,want:true,timer:null,step:0,next:0,bpm:132,phase:'idle',
  init(){
    if(this.ctx)return true;
    const C=window.AudioContext||window.webkitAudioContext;if(!C)return false;
    const c=this.ctx=new C();
    this.master=c.createGain();this.master.gain.value=.5;
    const comp=c.createDynamicsCompressor();this.master.connect(comp);comp.connect(c.destination);
    this.music=c.createGain();this.music.gain.value=.55;this.music.connect(this.master);
    this.lp=c.createBiquadFilter();this.lp.type='lowpass';this.lp.frequency.value=2600;this.lp.connect(this.music);
    const len=c.sampleRate*.5,buf=c.createBuffer(1,len,c.sampleRate),d=buf.getChannelData(0);
    for(let i=0;i<len;i++)d[i]=Math.random()*2-1;this.noiseBuf=buf;
    return true;
  },
  toggle(){
    this.want=!this.want;
    if(this.want)this.unlock(true);else{this.on=false;this.stopLoop()}
    return this.want;
  },
  unlock(chime){
    if(!this.want||this.on||!this.init())return;
    this.on=true;this.ctx.resume();if(chime)this.pop(.08);this.sync();
  },
  tone(f,t,dur,type,vol,dest,slideTo){
    const c=this.ctx,o=c.createOscillator(),g=c.createGain();
    o.type=type;o.frequency.setValueAtTime(f,t);if(slideTo)o.frequency.exponentialRampToValueAtTime(slideTo,t+dur);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.006);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
    o.connect(g);g.connect(dest||this.master);o.start(t);o.stop(t+dur+.02);
  },
  noise(t,dur,vol,freq,dest){
    const c=this.ctx,src=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();
    src.buffer=this.noiseBuf;f.type='highpass';f.frequency.value=freq;
    g.gain.setValueAtTime(vol,t);g.gain.exponentialRampToValueAtTime(.0008,t+dur);
    src.connect(f);f.connect(g);g.connect(dest||this.master);src.start(t);src.stop(t+dur+.02);
  },
  kick(t){this.tone(140,t,.22,'sine',.9,this.music,42)},
  playStep(i,t){
    const bar=Math.floor(i/8),b=i%8,root=ROOTS[bar],fast=this.phase==='lobby';
    if(MEL[i]!=null){this.tone(mtof(MEL[i]),t,.16,'square',.07,this.lp);this.tone(mtof(MEL[i]-12),t,.12,'triangle',.05,this.lp)}
    if(b%2===0)this.tone(mtof(b%4===0?root:root+7),t,.2,'triangle',.32,this.music);
    if(b%4===0)this.kick(t);
    if(b%4===2)this.noise(t,.12,.22,1800,this.music);
    this.noise(t,.03,fast?.09:.05,7000,this.music);
    if(fast)this.noise(t+60/this.bpm/4,.025,.05,7000,this.music);
    if(i===31&&this.phase!=='idle')this.tone(mtof(84),t,.08,'square',.04,this.lp);
  },
  sched(){
    const spb=60/this.bpm/2;
    while(this.next<this.ctx.currentTime+.12){this.playStep(this.step%32,this.next);this.next+=spb;this.step++}
  },
  startLoop(){if(this.timer)return;this.step=0;this.next=this.ctx.currentTime+.06;this.timer=setInterval(()=>this.sched(),25)},
  stopLoop(){clearInterval(this.timer);this.timer=null},
  setPhase(p){
    if(p===this.phase)return;this.phase=p;
    this.bpm=p==='lobby'?168:p==='revote'?144:132;
    this.sync();
  },
  sync(){if(!this.on||!this.ctx)return;if(this.phase==='result')this.stopLoop();else this.startLoop()},
  ok(){return this.on&&this.ctx},
  pop(v){if(!this.ok())return;const t=this.ctx.currentTime;this.tone(1180,t,.07,'sine',v||.05)},
  buzz(){if(!this.ok())return;const t=this.ctx.currentTime;this.tone(190,t,.16,'sawtooth',.12,null,120);this.tone(170,t+.19,.26,'sawtooth',.12,null,80)},
  roll(sec){if(!this.ok())return;const t=this.ctx.currentTime;for(let x=0;x<sec;x+=.045)this.noise(t+x,.05,.06+.12*(x/sec),1500)},
  boing(){if(!this.ok())return;const t=this.ctx.currentTime;this.tone(260,t,.3,'sine',.25,null,620)},
  ding(){if(!this.ok())return;const t=this.ctx.currentTime;this.kick(t);this.noise(t,.25,.25,3000);this.tone(mtof(84),t,.6,'triangle',.25);this.tone(mtof(88),t+.08,.6,'triangle',.18)},
  alarm(){
    if(!this.ok())return;const t=this.ctx.currentTime+.02;
    for(let k=0;k<3;k++)for(let j=0;j<6;j++){const x=t+k*.32+j*.045;this.tone(j%2?1980:1660,x,.04,'square',.06)}
  },
  fanfare(){
    if(!this.ok())return;const t=this.ctx.currentTime+.05;
    [67,72,76].forEach((m,k)=>{this.tone(mtof(m),t+k*.12,.12,'square',.13,this.lp);this.noise(t+k*.12,.05,.08,4000)});
    [72,76,79,84].forEach(m=>{this.tone(mtof(m),t+.42,1.2,'square',.07,this.lp);this.tone(mtof(m-12),t+.42,1.2,'triangle',.12)});
    this.kick(t+.42);this.noise(t+.42,.6,.25,2500);
  }
};
['pointerdown','keydown'].forEach(t=>document.addEventListener(t,e=>{if(e.target.closest&&e.target.closest('#soundBtn'))return;Snd.unlock()},true));
document.addEventListener('visibilitychange',()=>{if(!Snd.ctx)return;if(document.hidden)Snd.ctx.suspend();else if(Snd.on)Snd.ctx.resume()});


Object.assign(ICON,{'炒飯':ICON['飯類'],'滷肉飯':ICON['飯類'],'拉麵':ICON['麵類'],'鍋貼':ICON['水餃'],'鹹酥雞':ICON['雞翅'],'火鍋':ICON['熱湯']});
const icon=l=>ICON[l]?`<span class="ic" aria-hidden="true"><svg viewBox="0 0 32 30">${ICON[l]}</svg></span>`:'';


const S = {
  sb: null, settings: null, day: null, phase: 'loading', me: null,
  my: { price: null, dist: null, cat: null }, tally: null,
  msgs: [], result: null, last: null,
  round1: null, diceQ: [], paused: false, shownTies: new Set(), resultShown: false,
  scrollTo: null, warned: null, error: null
};

// ---------- 啟動 ----------
async function boot() {
  wireStatic();
  if (!CFG.supabaseUrl || !CFG.supabaseAnonKey || !window.supabase) {
    S.error = '網站還沒設定完成：缺少資料庫連線設定（config.js）。';
    render(); return;
  }
  S.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  try {
    const { data: { session } } = await S.sb.auth.getSession();
    if (!session) {
      const { error } = await S.sb.auth.signInAnonymously();
      if (error) throw error;
    }
    const { data: st, error: e1 } = await S.sb.from('settings').select('*').eq('id', 1).single();
    if (e1) throw e1;
    S.settings = st;
  } catch (e) {
    S.error = '連不上資料庫：' + (e.message || e);
    render(); return;
  }
  S.day = S.settings.test_day || taipeiNow().iso;
  await refreshAll(true);
  const p0 = phaseAt(taipeiNow(), S.settings);
  if (p0 === 'lobby' || p0 === 'revote') announceRound1();
  subscribe();
  setInterval(tick, 1000);
  setInterval(() => poll().catch(() => {}), 4000);
  render();
}

async function refreshAll(first) {
  const sb = S.sb;
  const phase = phaseAt(taipeiNow(), S.settings);
  if (phase !== 'closed' && phase !== 'wait' && !S.me) {
    const { data } = await sb.rpc('join_today');
    if (data) S.me = data;
  }
  const [{ data: mine }, { data: last }, tally] = await Promise.all([
    sb.from('votes').select('price,dist,cat').eq('day', S.day).maybeSingle(),
    sb.from('results').select('day,place').lt('day', S.day).not('place', 'is', null).order('day', { ascending: false }).limit(1),
    sb.rpc('get_tally')
  ]);
  if (mine && first) S.my = { price: mine.price, dist: mine.dist, cat: mine.cat };
  S.last = last?.[0] || null;
  if (tally.data) S.tally = tally.data;
  await loadMsgs();
  await loadResult();
}

async function loadMsgs() {
  const { data } = await S.sb.from('messages').select('id,nickname,body,hits,created_at').eq('day', S.day).order('id');
  if (data) { const grew = data.length > S.msgs.length; S.msgs = data; if (grew) chatDirty = true; }
}
async function loadResult() {
  const { data } = await S.sb.from('results').select('*').eq('day', S.day).maybeSingle();
  if (data && !S.result) { S.result = data; queueTies(data.decided, 'final'); }
}

function subscribe() {
  S.sb.channel('lunch')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `day=eq.${S.day}` }, p => {
      if (S.msgs.some(m => m.id === p.new.id)) return;
      S.msgs.push(p.new); chatDirty = true;
      if (p.new.hits) Snd.buzz(); else if (p.new.nickname !== S.me) Snd.pop();
      render();
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `day=eq.${S.day}` }, () => loadResult().then(render))
    .subscribe();
}

async function poll() {
  if (!S.sb || !S.settings) return;
  if (!S.settings.test_day && taipeiNow().iso !== S.day) { location.reload(); return; }
  const p = S.phase;
  if (['vote', 'lobby', 'revote', 'result'].includes(p)) {
    const { data } = await S.sb.rpc('get_tally'); if (data) S.tally = data;
  }
  if (p === 'lobby' || p === 'revote') await loadMsgs();
  if (p === 'result' && !S.result) await loadResult();
  render();
}

// ---------- 時間與階段 ----------
let prevPhase = null;
function tick() {
  if (!S.settings) return;
  const now = taipeiNow();
  const p = phaseAt(now, S.settings);
  if (p !== prevPhase) {
    if (prevPhase && prevPhase !== 'loading') onPhaseChange(prevPhase, p);
    prevPhase = p;
  }
  S.phase = p;
  render();
}
async function onPhaseChange(from, to) {
  if (to === 'vote') { if (!S.me) { const { data } = await S.sb.rpc('join_today'); S.me = data; } S.scrollTo = 'ballot'; }
  if (to === 'lobby') { S.scrollTo = 'lobby'; const { data } = await S.sb.rpc('get_tally'); if (data) S.tally = data; announceRound1(); }
  if (to === 'revote') S.scrollTo = 'ballot';
  if (to === 'result') { S.scrollTo = 'result'; loadResult().then(render); }
}

// 11:30 的開票（只是給大家看，最終以 11:50 為準）
function announceRound1() {
  if (S.round1 || !S.tally) return;
  S.round1 = decideAll(S.tally, S.day, 'round1');
  queueTies(S.round1, 'round1');
  chatDirty = true;
}

// ---------- 投票 ----------
let voteTimer = null;
function onChip(b) {
  if (!['vote', 'revote'].includes(S.phase)) return;
  S.my[b.dataset.f] = b.dataset.v;
  render();
  clearTimeout(voteTimer);
  voteTimer = setTimeout(async () => {
    $('ballotState').textContent = '送出中…';
    const { error } = await S.sb.rpc('cast_vote', { p_price: S.my.price, p_dist: S.my.dist, p_cat: S.my.cat });
    if (error) { $('ballotState').textContent = '沒有送出：' + error.message; return; }
    S.saved = Date.now(); $('ballotState').textContent = '';
    const { data } = await S.sb.rpc('get_tally'); if (data) S.tally = data;
    render();
  }, 350);
}

// ---------- 聊天 ----------
let chatDirty = true;
async function sendMsg(text) {
  $('sayErr').textContent = '';
  const { data, error } = await S.sb.rpc('post_message', { p_body: text });
  if (error) { $('sayErr').textContent = error.message; return false; }
  if (data?.hits) { Snd.buzz(); const f = $('sayForm'); f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); }
  await loadMsgs(); render();
  return true;
}
function renderMsgBody(body) {
  return [...body].map(c => c === '█' ? '<span class="ban" aria-label="已遮蔽">█</span>' : esc(c)).join('');
}

// ---------- 擲骰（平手時） ----------
const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function queueTies(dec, stage) {
  if (!dec) return;
  for (const k of ['price', 'dist', 'cat']) {
    const d = dec[k]; const key = stage + k;
    if (d?.tie && !S.shownTies.has(key)) { S.shownTies.add(key); S.diceQ.push({ ...d, stage: stage === 'final' ? '最後開票' : '11:30 開票' }); }
  }
}
function face(n) { const d = $('die'); [...d.children].forEach((p, i) => p.className = PIPS[n].includes(i) ? 'on' : ''); d.classList.toggle('one', n === 1); }
function faceMap(k) {
  const per = Math.floor(6 / k), map = [];
  for (let i = 0; i < k; i++) map.push(Array.from({ length: per }, (_, j) => i * per + j + 1));
  const left = []; for (let f = k * per + 1; f <= 6; f++) left.push(f);
  return { map, left };
}
const rngTxt = a => a.length > 1 ? `${a[0]}–${a[a.length - 1]}` : `${a[0]}`;
function maybeDice() { if (S.diceQ.length && !S.paused) playDice(); }
function playDice() {
  S.paused = true;
  const job = S.diceQ[0], { map, left } = faceMap(job.ids.length), win = job.ids.indexOf(job.id);
  $('diceField').textContent = `${job.stage}・${job.title}：${job.labels.join('、')} 各 ${job.max} 票`;
  $('diceMap').innerHTML = map.map((fs, i) => `<div data-i="${i}"><span>${rngTxt(fs)}</span><span>${esc(job.labels[i])}</span></div>`).join('') + (left.length ? `<div><span>${rngTxt(left)}</span><span>重擲</span></div>` : '');
  $('diceRes').textContent = '骰子滾動中…';
  $('diceOv').hidden = false;
  const d = $('die'); let round = 0;
  const rolls = job.rolls?.length ? job.rolls : [map[win][0]];
  function spin() {
    d.classList.remove('land'); d.classList.add('rolling');
    let n = 0; const total = reduceMotion ? 1 : 14; Snd.roll(total * .09);
    const iv = setInterval(() => { face(1 + Math.floor(Math.random() * 6)); if (++n >= total) { clearInterval(iv); settle(); } }, 90);
  }
  function settle() {
    d.classList.remove('rolling'); void d.offsetWidth; d.classList.add('land');
    const f = rolls[round];
    face(f);
    if (round < rolls.length - 1) { round++; Snd.boing(); $('diceRes').textContent = `擲出 ${f}，重擲！`; setTimeout(spin, 900); return; }
    Snd.ding();
    [...$('diceMap').children].forEach(el => el.classList.toggle('win', el.dataset.i == String(win)));
    $('diceRes').textContent = `擲出 ${f}：決定「${job.win}」`;
    setTimeout(() => { $('diceOv').hidden = true; S.diceQ.shift(); S.paused = false; render(); maybeDice(); }, 1600);
  }
  spin();
}

// ---------- 畫面 ----------
function chips(el, opts, field, enabled) {
  const key = opts.map(o => o.label).join('|');
  if (el.dataset.k !== key) {
    el.dataset.k = key;
    el.innerHTML = opts.map(o => `<button type="button" class="chip" id="opt-${o.id}" data-f="${field}" data-v="${o.id}" aria-pressed="false">${field === 'cat' ? icon(o.label) : ''}${esc(o.label)}${o.sub ? `<small>${o.sub}</small>` : ''}${o.daily ? '<span class="tag">今日限定</span>' : ''}</button>`).join('');
  }
  el.querySelectorAll('.chip').forEach(b => {
    const on = String(S.my[field] === b.dataset.v);
    if (b.getAttribute('aria-pressed') !== on) b.setAttribute('aria-pressed', on);
    if (b.disabled !== !enabled) b.disabled = !enabled;
  });
}
function bars(title, opts, field) {
  const counts = S.tally?.[field] || {};
  const max = Math.max(0, ...opts.map(o => counts[o.id] || 0));
  const leaders = opts.filter(o => (counts[o.id] || 0) === max && max > 0);
  const tot = Math.max(1, opts.reduce((a, o) => a + (counts[o.id] || 0), 0));
  return `<div class="group"><div class="label">${title}${leaders.length > 1 ? ' <span class="tieb">目前平手</span>' : ''}</div><div class="bars">${opts.map(o => {
    const n = counts[o.id] || 0, lead = leaders.includes(o);
    return `<div class="bar${lead ? ' lead' : ''}"><span>${esc(o.label)}</span><div class="track"><div class="fill" style="width:${n / tot * 100}%"></div></div><span class="n">${n}</span></div>`;
  }).join('')}</div></div>`;
}
const BELL = '<span class="bell" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M8 1.5a4 4 0 0 0-4 4v3l-1.5 2.5h11L12 8.5v-3a4 4 0 0 0-4-4z M6.5 13a1.5 1.5 0 0 0 3 0" fill="#fff"/></svg></span>';

let lastChatLen = -1, lastNotice = '', lastNudge = '', lastResultKey = '';
function render() {
  const p = S.phase, st = S.settings, CATS = S.day ? cats(S.day) : cats(taipeiNow().iso);
  document.body.dataset.phase = p === 'wait' || p === 'closed' || p === 'loading' ? 'idle' : p;
  Snd.setPhase(document.body.dataset.phase);

  // 錯誤 / 等待 / 休息
  let notice = '';
  if (S.error) notice = `<h2>暫時無法使用</h2><p class="hint">${esc(S.error)}</p>`;
  else if (p === 'closed') notice = '<h2>週末休息</h2><p class="hint">下個上班日 11:00 見！</p>';
  else if (p === 'wait' && st) {
    const left = toSec(st.vote_start) - taipeiNow().seconds;
    const h = Math.floor(left / 3600), m = Math.floor(left % 3600 / 60), s = left % 60;
    notice = `<h2>今天 ${fmtHM(st.vote_start)} 開打</h2><p class="big">${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}</p><p class="hint">時間到就可以投票了，開著這個頁面等就好。</p>`;
  }
  if (notice !== lastNotice) { lastNotice = notice; $('notice').innerHTML = notice; $('notice').hidden = !notice; }

  // 時鐘列
  const now = taipeiNow();
  $('clock').textContent = `${String(Math.floor(now.seconds / 3600)).padStart(2, '0')}:${String(Math.floor(now.seconds % 3600 / 60)).padStart(2, '0')}`;
  const END = st && { vote: toSec(st.lobby_start), lobby: toSec(st.revote_start), revote: toSec(st.result_at) }[p];
  const left = END ? (END - now.seconds) / 60 : 0, warn = !!END && left <= 3 && left > 0;
  $('phaseLabel').textContent = PHASE_TXT[p] + (warn ? `・剩 ${Math.max(1, Math.ceil(left))} 分` : '');
  document.querySelector('.bar-top').classList.toggle('warn', warn && !S.paused);
  if (warn && S.warned !== p) { S.warned = p; Snd.alarm(); }
  if (S.me && $('meName').textContent !== S.me) { $('meName').textContent = S.me; $('meAv').textContent = [...nick(S.me)][0]; }
  if (!S.me) { $('meName').textContent = p === 'wait' && st ? `（${fmtHM(st.vote_start)} 抽暱稱）` : '…'; $('meAv').textContent = '?'; }

  // 流程卡片
  if (st) {
    const T = { vote: `${fmtHM(st.vote_start)}–${fmtHM(st.lobby_start)}`, lobby: `${fmtHM(st.lobby_start)}–${fmtHM(st.revote_start)}`, revote: `${fmtHM(st.revote_start)}–${fmtHM(st.result_at)}`, result: fmtHM(st.result_at) };
    const order = ['vote', 'lobby', 'revote', 'result'], cur = order.indexOf(p);
    [...$('steps').children].forEach((li, i) => { li.querySelector('.t').textContent = T[li.dataset.p]; li.className = i < cur ? 'done' : i === cur ? 'on' : ''; });
  }

  // 選票
  const canVote = p === 'vote' || p === 'revote';
  chips($('g-price'), PRICES, 'price', canVote); chips($('g-dist'), DISTS, 'dist', canVote); chips($('g-cat'), CATS, 'cat', canVote);
  const missing = [!S.my.price && '價格', !S.my.dist && '距離', !S.my.cat && '類型'].filter(Boolean);
  if (!$('ballotState').textContent.startsWith('送出中') && !$('ballotState').textContent.startsWith('沒有送出')) {
    $('ballotState').textContent = p === 'vote' ? (missing.length ? '三項都要選' : '已送出，時間內都能改') : p === 'revote' ? '最後機會，可以改票' : p === 'lobby' ? '遊說期間選票鎖定' : p === 'result' ? '投票已結束' : st ? `${fmtHM(st.vote_start)} 開始投票` : '';
  }
  let nudge = '';
  if (p === 'vote' && missing.length) nudge = `${BELL}<div><b>輪到你投票了！</b>${fmtHM(st.lobby_start)} 前選好以下項目：<div class="miss">${missing.map(m => `<span>${m}</span>`).join('')}</div></div>`;
  else if (p === 'vote') nudge = `${BELL}<div><b>投好了！</b>${fmtHM(st.lobby_start)} 前都還能改。</div>`;
  else if (p === 'revote') nudge = `${BELL}<div><b>改票時間</b>：被說服了嗎？${fmtHM(st.result_at)} 前可以重新選，不改也沒關係。</div>`;
  const soft = p === 'revote' || (p === 'vote' && !missing.length);
  const nk = nudge + soft;
  if (nk !== lastNudge) { lastNudge = nk; $('nudge').innerHTML = nudge; $('nudge').hidden = !nudge; $('nudge').className = soft ? 'nudge soft' : 'nudge'; }
  $('ballot').classList.toggle('call', (p === 'vote' && missing.length > 0) || p === 'revote');

  // 開票
  const t = S.tally;
  $('voteCount').textContent = t ? `${t.voters} 人投票・今天 ${t.players} 人參加` : '';
  $('tally').innerHTML = bars('價格區間', PRICES, 'price') + bars('距離', DISTS, 'dist') + bars('類型', CATS, 'cat');

  // 聊天
  const lobbyOpen = p === 'lobby';
  $('sayInput').disabled = !lobbyOpen; $('sayBtn').disabled = !lobbyOpen;
  $('sayInput').placeholder = lobbyOpen ? '用形容的說服大家，例如：湯頭很濃、麵很Q的那種' : (p === 'vote' || p === 'wait') && st ? `${fmtHM(st.lobby_start)} 遊說開始後才能打字` : '遊說已結束';
  $('chatState').textContent = lobbyOpen ? `進行中，${fmtHM(st.revote_start)} 結束` : p === 'revote' || p === 'result' ? '已結束' : st ? `${fmtHM(st.lobby_start)} 開放` : '';
  if (chatDirty || S.msgs.length !== lastChatLen) {
    chatDirty = false; lastChatLen = S.msgs.length;
    let html = '';
    if (S.round1) {
      const r = S.round1, cl = cats(S.day);
      html += `<p class="sys">投票結束：${esc(PRICES.find(x => x.id === r.price.id).label)} 元、步行 ${esc(DISTS.find(x => x.id === r.dist.id).label)}、${esc(cl.find(x => x.id === r.cat.id).label)}</p>`;
      const tt = tieText(r); if (tt) html += `<p class="sys">${esc(tt)}。</p>`;
    }
    html += S.msgs.map(m => {
      const me = m.nickname === S.me;
      const row = `<div class="msg${me ? ' me' : ''}"><div class="av" aria-hidden="true" style="--h:${hue(m.nickname)}">${esc([...nick(m.nickname)][0] || '?')}</div><div class="body"><div class="who">${esc(m.nickname)}${me ? '（你）' : ''}${m.hits ? '<span class="flag">已遮蔽</span>' : ''}</div><div class="txt">${renderMsgBody(m.body)}</div></div></div>`;
      return row + (m.hits ? `<p class="sys warn">${esc(m.nickname)} 提到店名，已遮蔽 ${m.hits} 個字</p>` : '');
    }).join('');
    $('chat').innerHTML = html || EMPTY_CHAT.replace(/11:30/g, st ? fmtHM(st.lobby_start) : '11:30');
    $('chat').scrollTop = $('chat').scrollHeight;
  }

  renderResult();
  const food = S.day ? cats(S.day)[2].label : '';
  $('yday').textContent = `${S.last?.place ? `上次吃：${S.last.place.name}，今天會盡量避開。` : ''}今日限定：${food}。`;
  autoScroll();
  maybeDice();
}

function renderResult() {
  const el = $('result'), r = S.result, p = S.phase;
  let key = '';
  if (p === 'result' && !r) key = 'pending';
  else if (r && !S.paused && !S.diceQ.length) key = 'r' + r.day + (r.place?.id || 'none');
  if (key === lastResultKey) return;
  lastResultKey = key;
  if (!key) { el.hidden = true; return; }
  el.hidden = false;
  if (key === 'pending') { el.innerHTML = '<header><h2>今天吃這家</h2></header><div class="pending"><span class="spin" aria-hidden="true"></span>系統正在開票、查 Google 地圖選店，通常 1～5 分鐘內出爐…</div>'; return; }
  if (!S.resultShown) { S.resultShown = true; Snd.fanfare(); }
  const d = r.decided, cl = cats(r.day);
  const priceL = PRICES.find(x => x.id === d.price.id)?.label, distL = DISTS.find(x => x.id === d.dist.id)?.label, catL = cl.find(x => x.id === d.cat.id)?.label;
  const BOWL = '<svg class="bowl" viewBox="0 0 84 76" aria-hidden="true"><g class="steam"><path d="M28 30 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M42 26 q-6 -7 0 -14 q6 -7 0 -14"/><path d="M56 30 q-6 -7 0 -14 q6 -7 0 -14"/></g><path d="M8 40 h68 q-2 30 -34 32 q-32 -2 -34 -32 z" fill="var(--accent)"/><rect x="30" y="70" width="24" height="5" rx="2.5" fill="var(--accent)"/><path d="M8 40 h68" stroke="var(--accent-ink)" stroke-width="2" stroke-linecap="round"/><path d="M20 50 q22 8 44 0" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" stroke-linecap="round"/><path d="M60 38 l20 -26 M64 39 l20 -24" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round"/></svg>';
  const pl = r.place;
  const pr = pl?.price ? `${pl.price.lo}–${pl.price.hi >= 99999 ? '' : pl.price.hi} 元` : '價格未知';
  const body = pl ? `<div class="pick-row"><div class="pick"><span class="eyebrow">系統選出</span><span class="name">${esc(pl.name)}</span>
    <div class="meta"><span>評分 <b>${Number(pl.rating).toFixed(1)}</b> ★</span><span><b>${Number(pl.reviews).toLocaleString()}</b> 則評論</span><span>步行約 <b>${pl.walk}</b> 分鐘（${pl.meters} m）</span><span>每人約 <b>${esc(pr)}</b></span></div>
    ${pl.address ? `<p class="hint">${esc(pl.address)}</p>` : ''}${pl.url ? `<a class="maplink" href="${esc(pl.url)}" target="_blank" rel="noopener">在 Google 地圖開啟</a>` : ''}</div>${BOWL}</div>`
    : `<p>${d.voters ? '附近找不到符合條件的店，今天自由發揮吧！' : '今天沒有人投票。'}</p>`;
  const steps = (r.steps || []).map(s => `<li class="${s.soft ? 'soft' : ''}"><span>${esc(s.label)}</span><span class="n">${s.n == null ? '' : s.n + ' 家'}</span></li>`).join('');
  el.innerHTML = `<header><h2>今天吃這家</h2><small>${fmtHM(S.settings.result_at)} 定案</small></header>
    ${d.voters ? `<div class="decided"><span>${esc(priceL)} 元</span><span>步行 ${esc(distL)}</span><span>${esc(catL)}</span></div>` : ''}
    ${d.tieText ? `<p class="hint">${esc(d.tieText)}。</p>` : ''}${body}
    ${steps ? `<div class="group"><div class="label">篩選過程</div><ol class="funnel">${steps}</ol></div>` : ''}`;
}

function autoScroll() {
  if (!S.scrollTo || S.paused || S.diceQ.length) return;
  const el = $(S.scrollTo); if (!el || el.hidden) return;
  S.scrollTo = null;
  requestAnimationFrame(() => el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' }));
}

function wireStatic() {
  document.addEventListener('click', e => { const b = e.target.closest('.chip'); if (b && !b.disabled) onChip(b); });
  $('sayForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (Date.now() < composingUntil) return;
    const v = $('sayInput').value.trim(); if (!v || S.phase !== 'lobby') return;
    $('sayBtn').disabled = true;
    if (await sendMsg(v)) $('sayInput').value = '';
    $('sayBtn').disabled = S.phase !== 'lobby';
  });
  $('sayInput').addEventListener('compositionend', () => { composingUntil = Date.now() + 80; });
  $('soundBtn').addEventListener('click', () => { const on = Snd.toggle(); $('soundBtn').setAttribute('aria-pressed', String(!!on)); $('soundTxt').textContent = on ? '音樂 開' : '音樂'; });
}
let composingUntil = 0;

boot();
