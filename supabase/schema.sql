-- 那家不能說的店：Supabase 資料庫結構
-- 用法：在 Supabase 後台「SQL Editor」貼上整份執行一次即可。重複執行也安全。

-- ============ 設定：每天的時段 ============
create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  vote_start   time not null default '11:00',
  lobby_start  time not null default '11:30',
  revote_start time not null default '11:40',
  result_at    time not null default '11:50',
  weekdays_only boolean not null default true
);
insert into public.settings (id) values (1) on conflict do nothing;
alter table public.settings enable row level security;
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);

-- 台北時間
create or replace function public.tw_now() returns timestamp
  language sql stable as $$ select now() at time zone 'Asia/Taipei' $$;
create or replace function public.tw_today() returns date
  language sql stable as $$ select (now() at time zone 'Asia/Taipei')::date $$;

-- 現在是哪個階段：closed / wait / vote / lobby / revote / result
create or replace function public.current_phase() returns text
  language sql stable security definer set search_path = public as $$
  select case
    when s.weekdays_only and extract(isodow from tw_now()) > 5 then 'closed'
    when tw_now()::time < s.vote_start   then 'wait'
    when tw_now()::time < s.lobby_start  then 'vote'
    when tw_now()::time < s.revote_start then 'lobby'
    when tw_now()::time < s.result_at    then 'revote'
    else 'result' end
  from settings s where s.id = 1
$$;

-- ============ 匿名暱稱 ============
create table if not exists public.players (
  day date not null default public.tw_today(),
  user_id uuid not null,
  nickname text not null,
  created_at timestamptz not null default now(),
  primary key (day, user_id),
  unique (day, nickname)
);
alter table public.players enable row level security;   -- 不開放直接讀取，只能透過下面的函式

create or replace function public.join_today() returns text
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  n text;
  tries int := 0;
  adj text[] := array['暴躁的','想睡的','很餓的','沉默的','愛吃辣的','選擇困難的','減肥中的','嘴很刁的','只想吃飯的','迷路的','偷吃的','熱血的','害羞的','佛系的','精打細算的','剛睡醒的','怕燙的','吃很慢的','愛排隊的','不挑食的'];
  noun text[] := array['滷蛋','鍋貼','珍奶','雞排','肉圓','蔥油餅','小籠包','鹹酥雞','豆花','地瓜球','米糕','蘿蔔糕','貢丸','飯糰','甜不辣','蛋塔','麻糬','鬆餅','水煎包','車輪餅'];
begin
  if uid is null then raise exception '尚未登入'; end if;
  select nickname into n from players where day = tw_today() and user_id = uid;
  if n is not null then return n; end if;
  loop
    tries := tries + 1;
    n := adj[1 + floor(random() * array_length(adj, 1))::int] || noun[1 + floor(random() * array_length(noun, 1))::int];
    if tries > 40 then n := n || (floor(random() * 90) + 10)::int::text; end if;
    begin
      insert into players (day, user_id, nickname) values (tw_today(), uid, n);
      return n;
    exception when unique_violation then
      -- 同一天暱稱重複，換一個再試
    end;
  end loop;
end $$;

-- ============ 投票（只能看到自己的票，大家只看得到統計） ============
create table if not exists public.votes (
  day date not null default public.tw_today(),
  user_id uuid not null,
  price text check (price in ('p1','p2','p3','p4')),
  dist  text check (dist  in ('d1','d2','d3')),
  cat   text check (cat   in ('c0','c1','c2')),
  updated_at timestamptz not null default now(),
  primary key (day, user_id)
);
alter table public.votes enable row level security;
drop policy if exists votes_read_own on public.votes;
create policy votes_read_own on public.votes for select using (user_id = auth.uid());

create or replace function public.cast_vote(p_price text, p_dist text, p_cat text) returns void
  language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception '尚未登入'; end if;
  if current_phase() not in ('vote', 'revote') then raise exception '現在不是投票時間'; end if;
  perform join_today();
  insert into votes (day, user_id, price, dist, cat, updated_at)
  values (tw_today(), uid, p_price, p_dist, p_cat, now())
  on conflict (day, user_id) do update
    set price = excluded.price, dist = excluded.dist, cat = excluded.cat, updated_at = now();
end $$;

-- 今天的票數統計（不含任何人的身分）
create or replace function public.get_tally() returns jsonb
  language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'price', coalesce((select jsonb_object_agg(price, n) from (select price, count(*) n from votes where day = tw_today() and price is not null group by price) x), '{}'::jsonb),
    'dist',  coalesce((select jsonb_object_agg(dist, n)  from (select dist,  count(*) n from votes where day = tw_today() and dist  is not null group by dist)  x), '{}'::jsonb),
    'cat',   coalesce((select jsonb_object_agg(cat, n)   from (select cat,   count(*) n from votes where day = tw_today() and cat   is not null group by cat)   x), '{}'::jsonb),
    'voters',  (select count(*) from votes where day = tw_today()),
    'players', (select count(*) from players where day = tw_today()),
    'phase', current_phase()
  )
$$;

-- ============ 店名禁用字（由選店程式每天更新） ============
create table if not exists public.banned_terms (
  term text not null,
  kind text not null check (kind in ('char', 'bigram')),
  primary key (term, kind)
);
alter table public.banned_terms enable row level security;   -- 不開放讀取，避免有人查出店名

create or replace function public.mask_text(t text, out masked text, out hits int)
  language plpgsql stable security definer set search_path = public as $$
declare
  chars text[] := regexp_split_to_array(coalesce(t, ''), '');
  n int := coalesce(array_length(chars, 1), 0);
  hit boolean[];
  han int[] := '{}';
  i int; a int; b int;
begin
  hit := array_fill(false, array[greatest(n, 1)]);
  for i in 1..n loop
    if chars[i] ~ '[一-鿿㐀-䶿]' then
      han := han || i;
      if exists (select 1 from banned_terms where kind = 'char' and term = chars[i]) then hit[i] := true; end if;
    end if;
  end loop;
  for i in 1..coalesce(array_length(han, 1), 0) - 1 loop
    a := han[i]; b := han[i + 1];
    if exists (select 1 from banned_terms where kind = 'bigram' and term = chars[a] || chars[b]) then
      hit[a] := true; hit[b] := true;
    end if;
  end loop;
  masked := ''; hits := 0;
  for i in 1..n loop
    if hit[i] then masked := masked || '█'; hits := hits + 1; else masked := masked || chars[i]; end if;
  end loop;
end $$;

-- ============ 遊說聊天 ============
create table if not exists public.messages (
  id bigint generated always as identity primary key,
  day date not null default public.tw_today(),
  nickname text not null,
  body text not null,
  hits int not null default 0,
  created_at timestamptz not null default now(),
  author uuid not null
);
alter table public.messages enable row level security;
drop policy if exists messages_read_today on public.messages;
create policy messages_read_today on public.messages for select using (day = public.tw_today());

create or replace function public.post_message(p_body text) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  nick text;
  m record;
  body text := btrim(coalesce(p_body, ''));
begin
  if uid is null then raise exception '尚未登入'; end if;
  if current_phase() <> 'lobby' then raise exception '現在不是遊說時間'; end if;
  if char_length(body) = 0 then raise exception '訊息是空的'; end if;
  if char_length(body) > 120 then raise exception '訊息太長了，請在 120 字以內'; end if;
  if exists (select 1 from messages where author = uid and created_at > now() - interval '2 seconds') then
    raise exception '講太快了，等一下再送';
  end if;
  nick := join_today();
  select * into m from mask_text(body);
  insert into messages (day, nickname, body, hits, author) values (tw_today(), nick, m.masked, m.hits, uid);
  return jsonb_build_object('nickname', nick, 'body', m.masked, 'hits', m.hits);
end $$;

-- ============ 每天的結果 ============
create table if not exists public.results (
  day date primary key,
  decided jsonb not null,
  place jsonb,
  steps jsonb,
  created_at timestamptz not null default now()
);
alter table public.results enable row level security;
drop policy if exists results_read on public.results;
create policy results_read on public.results for select using (true);

-- ============ 權限：網頁只能呼叫這些函式 ============
revoke all on function public.join_today()                    from public, anon;
revoke all on function public.cast_vote(text, text, text)    from public, anon;
revoke all on function public.post_message(text)             from public, anon;
revoke all on function public.mask_text(text)                from public, anon, authenticated;
grant execute on function public.join_today()                 to authenticated;
grant execute on function public.cast_vote(text, text, text) to authenticated;
grant execute on function public.post_message(text)          to authenticated;
grant execute on function public.get_tally()                 to anon, authenticated;
grant execute on function public.current_phase()             to anon, authenticated;

-- 聊天與結果即時推送
do $$ begin
  begin alter publication supabase_realtime add table public.messages; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.results;  exception when duplicate_object then null; end;
end $$;
