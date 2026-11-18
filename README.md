# 公司網站 + 後台管理系統

一個「零依賴」的公司官網：展示業務、收集客戶查詢／合作提案，並附後台讓你**自己改網站內容、回覆查詢**。只用 Node.js 內建模組，不用 `npm install`，不需要資料庫服務，也不需要任何瀏覽器插件。

```
客人 ──► 官網（首頁 / 服務 / 案例 / 查詢表單）
                     │ 送出
                     ▼
            資料儲存（本機 JSON / GitHub data 分支 / Supabase）
                     ▲
你 ──► /admin 登入 ──┘ 同時可改「網站內容」→ 即時生效
```

---

## 1. 兩分鐘啟動

```powershell
cd company-site
node server.js
```

或雙擊 `start.cmd`。

- 官網：<http://127.0.0.1:4321>
- 後台：<http://127.0.0.1:4321/admin>

第一次啟動會自動產生管理員密碼，**印在終端機**，同時寫入 `data/管理員密碼.txt`。
登入後請立即到「設定 → 帳戶安全」改密碼。

想自訂初始密碼：

```powershell
$env:ADMIN_PASSWORD="你的密碼"; node server.js
```

忘記密碼：

```powershell
node scripts/reset-password.js
```

---

## 2. 你會用到的功能

### 後台「網站內容」：像填表一樣改官網
所有對外文字（品牌名、標語、服務、案例、關於、FAQ、聯絡方式、頁尾、私隱政策、Google 標題描述）都在這裡。
改完按**儲存並發佈**（或 `Ctrl+S`），重新整理官網即時見到，不需要重新部署。

- 清單（服務、案例、FAQ…）：可新增、上移／下移、刪除
- 「每行一項」的欄位（服務要點、案例標籤、表單類型、預算選項）：一行一個
- 「主題色」在「設定」改，全站按鈕與重點色跟著變

### 後台「客戶查詢」
- 列表可依 **未處理 / 已回覆 / 已結案** 篩選、搜尋姓名／電郵／編號
- 點進詳情：看到客戶資料與留言 → 寫回覆 → 客戶可在 `/track` 用「編號 + 電郵」查看
- 可一鍵開電郵 / 開 WhatsApp / 匯出 CSV（Excel 可直接開，含 BOM 不亂碼）

### 電腦版 / 手機版
同一個網址、同一份程式碼，按闊度自動切換（≥1000px 雙欄、≤760px 手機單欄、≤420px 細機）。不需要 `m.` 子網域。
截圖：`node scripts/screenshot.mjs` → `shots/desktop.png`、`shots/mobile.png`

### 新查詢通知
在「設定」填 Webhook（Slack、飛書、Discord、n8n、Zapier 都可以），有新查詢會即時 POST 一段 JSON。

---

## 3. 放上網（四條路線）

> 💡 **想 $0 上線**：照 [DEPLOY-FREE.md](DEPLOY-FREE.md) 做（Render 免費網站 + GitHub `data` 分支存資料），不用信用卡。

| 路線 | 適合 | 成本 | 你要做的 |
|---|---|---|---|
| **Render + GitHub 資料分支**（免費） | 想 $0、可接受偶爾冷啟動 | $0 | 見 [DEPLOY-FREE.md](DEPLOY-FREE.md) |
| **Render**（付費） | 不想休眠、要磁碟 | US$7/月起 | 推上 GitHub → Blueprint → 填域名 |
| **Fly.io**（附 `fly.toml`） | 想要香港節點、按用量收費 | 約 US$3–10/月 | `fly launch` → 建 volume → `fly deploy` |
| **VPS + Caddy**（阿里雲香港／騰訊雲／DigitalOcean） | 想完全控制 | 約 HK$40–90/月 | systemd + Caddy 設定照抄 |

> ⚠️ 免費主機（Render／Koyeb）的磁碟是**臨時**的，重啟會清空。所以一定要用雲端資料：
> 本專案支援兩種（設定環境變數即可，程式會自動選）：
> - `GH_DATA_REPO` + `GH_DATA_TOKEN` → 存到你 repo 的 `data` 分支（不需要額外帳號）
> - `SUPABASE_URL` + `SUPABASE_SERVICE_KEY` → 存到 Supabase Postgres
> 兩者都無 → 用本機 `data/` JSON（僅適合本機或 VPS）。

瀏覽器**不需要裝任何插件**：後台就是同一個網站的 `/admin` 頁。

### VPS（Ubuntu）+ Caddy

```bash
scp -r company-site user@server:/srv/company-site

sudo tee /etc/systemd/system/company-site.service <<'EOF'
[Unit]
Description=Company Site
After=network.target
[Service]
WorkingDirectory=/srv/company-site
ExecStart=/usr/bin/node server.js
Environment=PORT=4321
Environment=HOST=127.0.0.1
Environment=ADMIN_PASSWORD=換成強密碼
Restart=always
[Install]
WantedBy=multi-user.target
EOF
sudo systemctl enable --now company-site

# /etc/caddy/Caddyfile
# yourcompany.com {
#   reverse_proxy 127.0.0.1:4321
# }
```

### 臨時公開預覽（電腦要保持開機）

```powershell
$env:HOST="::"; node server.js
# 另一個終端
ssh -T -o StrictHostKeyChecking=no -R 80:localhost:4321 nokey@localhost.run
```

---

## 4. 目錄結構

```
company-site/
├── server.js               # HTTP 伺服器：路由、驗證、查詢 API、內容儲存
├── lib/
│   ├── content.js          # 網站內容預設值 + 白名單清洗
│   ├── store.js            # 三種儲存後端：本機 JSON / GitHub data 分支 / Supabase
│   ├── session.js          # scrypt 密碼、HMAC 簽名 Cookie、限流
│   └── views/              # 伺服器端渲染：官網 / 後台 / HTML 轉義
├── public/                 # 前端資源（CSS / JS，零框架）
├── scripts/                # 測試、截圖、重設密碼、上傳工具
├── deploy/supabase.sql     # 用 Supabase 時建表
├── Dockerfile              # 上雲用
├── render.yaml / fly.toml  # 部署設定
├── data/                   # 本機模式：內容、查詢、登入、密鑰
└── DEPLOY-FREE.md          # 免費上線逐步指引
```

---

## 5. 安全性

- 密碼用 `scrypt` 加鹽雜湊，不存明碼
- 登入態是 HMAC-SHA256 簽名 Cookie（HttpOnly、SameSite=Lax、12 小時過期）
- 所有輸出都做 HTML 轉義；內容寫入只接受白名單結構
- CSP、`X-Frame-Options`、`nosniff` 等安全標頭
- 登入限流 8 次／10 分鐘；公開表單 5 次／10 分鐘
- 表單蜜罐、跨站來源檢查；管理 API 未登入一律 401

尚未做：SMTP 寄信、圖形驗證碼、雙因素登入、圖片上傳。

---

## 6. 測試

```powershell
node server.js                  # 另一個終端
node scripts/smoke.mjs          # 33 項端到端
node scripts/store-test.mjs     # 16 項 Supabase 儲存層
node scripts/github-store-test.mjs  # 13 項 GitHub 資料分支
```

---

## 7. 想再加什麼

1. **SMTP 自動寄信**：客戶送出後收到確認信
2. **預約系統**：時段選擇 + 日曆同步
3. **多語版本**：中／英切換
4. **圖片上傳**：後台直接換橫幅
5. **CRM 串接**：把查詢寫進 HubSpot / Notion / Google Sheet
6. **WhatsApp 自動回覆**：與工作區的 `whatsapp-bot` 共用查詢紀錄
