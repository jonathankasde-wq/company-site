# 免費正式上線（$0／月）：Render + Supabase + 自動喚醒

最後你會得到：`https://公司名.onrender.com`（可之後綁自己的域名）、可以收查詢、可以登入後台改內容，**重啟唔會唔見資料**。

```
客人 ─► Render（免費網站，會休眠） ─► Supabase（免費 Postgres，永久存資料）
                    ▲
GitHub Actions 每 10 分鐘 ping 一次（叫醒網站、順便令 Supabase 唔會因閒置暫停）
```

> 為什麼唔用「免費主機 + 本機檔案」？Render／Koyeb 免費方案的磁碟係**臨時**的，任何重啟或重新部署都會清空——查詢與後台改動會全部消失。所以資料一定要放 Supabase（免費 500MB，足夠存幾萬筆查詢）。

---

## 你需要 3 個免費帳號（都不用信用卡）

| 帳號 | 用途 | 註冊 |
|---|---|---|
| GitHub | 存程式碼，Render 由 repo 部署；Actions 做喚醒 | github.com |
| Supabase | 免費 Postgres 存資料 | supabase.com |
| Render | 免費網站主機 | render.com |

---

## 步驟 1：上傳專案到 GitHub（約 3 分鐘）

1. GitHub → **New repository** → 名稱例如 `company-site` → Public（或 Private 也可）→ Create
2. 解壓 `company-site.zip`
3. 在 repo 頁面 → **Add file → Upload files** → 把解壓出來的**所有檔案與資料夾**拖進去
   （要包括 `server.js`、`lib/`、`public/`、`scripts/`、`deploy/`、`.github/`、`Dockerfile`、`render.yaml`、`package.json`）
4. **Commit changes**

> 唔好上傳 `data/`、`node_modules/`、`tools/`（已在 `.gitignore`／`.dockerignore` 排除）。

---

## 步驟 2：Supabase 建表（約 3 分鐘）

1. supabase.com → **New project**（免費）→ 記住資料庫密碼 → 建立
2. 左邊 **SQL Editor** → 貼上 `deploy/supabase.sql` 的內容 → **Run**
3. 左邊 **Project Settings → API**，抄低兩樣：
   - **Project URL**（`https://xxxx.supabase.co`）
   - **service_role** secret key（**唔好**用 anon key；呢條只會放喺伺服器環境變數）

---

## 步驟 3：Render 部署（約 5 分鐘）

1. render.com → **New → Blueprint** → 連接 GitHub → 選 `company-site` repo
2. Render 會自動讀 `render.yaml`（免費方案、Docker、health check）
3. 在 **Environment** 填：
   - `SUPABASE_URL` = 步驟 2 的 Project URL
   - `SUPABASE_SERVICE_KEY` = 步驟 2 的 service_role key
   - `ADMIN_PASSWORD`：Render 已自動生成，部署後在 Environment 按「reveal」抄低
4. **Apply / Deploy**，等 2–5 分鐘
5. 開 `https://你的服務.onrender.com` 應該見到網站；`/admin` 用 `admin` + 上面密碼登入

---

## 步驟 4：設定自動喚醒（2 分鐘，可選但建議）

1. GitHub repo → **Settings → Secrets and variables → Actions → Variables**
2. **New repository variable**：Name `SITE_URL`，Value `https://你的服務.onrender.com`（結尾唔要 `/`）
3. 完成。`.github/workflows/warmup.yml` 會每 10 分鐘 ping 一次。

> 免費方案 15 分鐘無流量會休眠，第一次開約 1 分鐘。cron 喚醒可以把大部分情況避開；GitHub 免費 repo 若 60 日完全冇 commit，排程會暫停，屆時手動 Run 一次即可。

---

## 步驟 5：綁自己的域名（可選）

Render → 你的服務 → **Settings → Custom Domain** → 填 `www.你的公司.com` → 照指示在域名商加 CNAME。HTTPS 自動簽發。

最後在後台「設定 → 網站網址」填 `https://你的網址`（用於 sitemap 與分享連結）。

---

## 成本與限制（老實講）

| 項目 | 免費額度 | 會唔會影響你 |
|---|---|---|
| Render 免費網站 | 750 小時／月、512MB RAM、會休眠 | 已用 cron 喚醒；仍可能偶爾有 30–60 秒冷啟動 |
| Supabase 免費 | 500MB 資料庫、2 個專案、一週閒置會暫停 | 網站有 ping 就唔會暫停 |
| 頻寬 | Render 免費約 5GB／月 | 一般公司站足夠 |
| 自訂域名 | Render 免費支援 | ✅ |
| 資料備份 | Supabase 免費有每日備份（7 日） | 建議每月手動匯出一次 |

**如果連 1 分鐘冷啟動都接受不了**：Oracle Cloud **Always Free**（ARM VM，永久免費、唔休眠、有自己磁碟）係唯一真正 always-on 的免費選擇，但要信用卡驗證＋一次性裝機（我可以逐步帶你做，或用我附的 systemd + Caddy 設定）。另一條路是把 Render 升級到 US$7/月（唔會休眠 + 磁碟）。

---

## 疑難排解

| 症狀 | 原因／解法 |
|---|---|
| 送表單失敗、後台儲存失敗 | `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` 未填或填錯；見 Render Logs 的 `[store]` 訊息 |
| 後台顯示「資料庫連線異常」 | 同上；或 Supabase 專案被暫停（去 dashboard Resume） |
| 忘記管理員密碼 | Render → Environment 改 `ADMIN_PASSWORD` 後重新部署；或在 Supabase 刪 `site_kv` 的 `auth` 那行，重啟即會用新密碼 |
| 網站開得慢（30–60 秒） | 免費方案休眠中，正在喚醒；設定 cron 可減少 |
| 想睇資料 | Supabase → Table Editor → `site_kv` |
