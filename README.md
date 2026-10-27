# 那家不能說的店

午餐投票小遊戲：每天 11:00 投票決定吃什麼，想翻盤就靠一張嘴說服大家，但不准說出店名。11:50 系統自動從 Google 地圖選出一家店。

## 每天的流程（台北時間，可在資料庫的 `settings` 表調整）

| 時間 | 階段 | 內容 |
|---|---|---|
| 11:00–11:30 | 投票 | 選價格、距離、類型（飯類、麵類、今日限定食物） |
| 11:30–11:40 | 遊說 | 匿名聊天說服大家，提到附近店名會被塗黑 |
| 11:40–11:50 | 改票 | 被說服的人可以改票 |
| 11:50 | 定案 | 開票，平手擲骰，從 Google 地圖選店 |

## 架構

- **網頁**：`index.html`、`app.js`、`style.css`，放在 GitHub Pages。
- **資料庫**：Supabase（`supabase/schema.sql`）。匿名登入、暱稱、投票、聊天、店名遮蔽、時段限制都在資料庫端處理，網頁無法繞過。
- **自動排程**：`.github/workflows/lunch.yml`，週一到週五自動執行 `picker/pick.mjs`：
  - 10:40 `prepare`：查公司附近的店名，更新聊天室禁用字。
  - 11:50 `pick`：開票並查 Google 地圖選店。
- **共用規則**：`shared/rules.js`，網頁和伺服器用同一套開票與擲骰規則，結果一定一致。

## 需要的設定

GitHub repository → Settings → Secrets and variables → Actions：

| 種類 | 名稱 | 內容 |
|---|---|---|
| Secret | `GOOGLE_MAPS_API_KEY` | Google 地圖金鑰（Places API (New)、Routes API） |
| Secret | `SUPABASE_URL` | Supabase 專案網址 |
| Secret | `SUPABASE_SERVICE_ROLE_KEY` | Supabase 的 service_role 金鑰（不能放進網頁） |
| Variable | `OFFICE_LAT` / `OFFICE_LNG` | 公司座標 |

`config.js` 填 Supabase 網址和 **anon（公開）金鑰**，這兩個可以公開。

## 測試

用模擬資料測試選店，不需要任何金鑰：

```bash
node picker/pick.mjs prepare --mock
node picker/pick.mjs pick --mock --date 2026-10-28 --force
```

想在非午餐時間試玩，到 Supabase SQL Editor 執行（記得測完改回來）：

```sql
-- 從現在開始：投票 5 分鐘、遊說 3 分鐘、改票 2 分鐘
update settings set weekdays_only = false,
  vote_start = (now() at time zone 'Asia/Taipei')::time,
  lobby_start = (now() at time zone 'Asia/Taipei')::time + interval '5 min',
  revote_start = (now() at time zone 'Asia/Taipei')::time + interval '8 min',
  result_at = (now() at time zone 'Asia/Taipei')::time + interval '10 min';

-- 改回正式時段
update settings set weekdays_only = true, vote_start = '11:00', lobby_start = '11:30', revote_start = '11:40', result_at = '11:50';
```

測試時段結束後，到 GitHub 的 Actions 頁籤手動執行「午餐自動排程」，選 `pick`（勾選 force 可覆蓋當天結果）。
