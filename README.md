# 公司網站 + 後台管理系統

一個「零依賴」的公司官網：展示業務、收集客戶查詢／合作提案，並附後台讓你**自己改網站內容、回覆查詢**。只用 Node.js 內建模組，不用 `npm install`，不需要資料庫，也不需要任何瀏覽器插件。

```
客戶 ──► 官網（首頁 / 服務 / 案例 / 查詢表單）
                     │ 送出
                     ▼
            data/inquiries.json  ◄── 後台：看查詢、回覆、改狀態、匯出 CSV
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
每次儲存前會自動備份上一版到 `data/content.backup.json`。

- 清單（服務、案例、FAQ…）：可新增、上移／下移、刪除
- 「每行一項」的欄位（服務要點、案例標籤、表單類型、預算選項）：一行一個
- 「主題色」在「設定」改，全站按鈕與重點色跟著變

### 後台「客戶查詢」
- 列表可依 **未處理 / 已回覆 / 已結案** 篩選、搜尋姓名／電郵／編號
- 點進詳情：看到客戶資料與留言 → 寫回覆 → 客戶可在 `/track` 用「編號 + 電郵」查看
- 可一鍵複製電郵 / 開 WhatsApp / 匯出 CSV（Excel 可直接開，含 BOM 不亂碼）

### 新查詢通知
在「設定」填 Webhook（Slack、飛書、Discord、n8n、Zapier 都可以），有新查詢會即時 POST 一段 JSON：

```json
{
  "text": "🔔 新查詢 INQ-XXXX\n陳大文（公司）\n報價需求 · HK$50,000-100,000\n...",
  "msg_type": "text",
  "content": { "text": "..." },
  "inquiry": { "ref": "…", "name": "…", "email": "…", "message": "…" }
}
```

Slack／飛書直接吃 `text`／`msg_type`；其他服務用 `inquiry` 欄位自己映射。

---

## 2.5 電腦版、手機版：同一個網址，自動切換

不需要 `m.` 子網域，也不是兩份網站。同一份 HTML/CSS，靠三個斷點自動變身（Google 也建議這樣做，維護與 SEO 都簡單）：

| 闊度 | 版面 |
|---|---|
| ≥ 1000px | 雙欄主視覺、4 欄統計、2×2 服務卡、4 欄流程 |
| ≤ 1000px（平板） | 主視覺單欄、流程 2 欄、關於並排變上下 |
| ≤ 760px（手機） | 漢堡選單、全部單欄、統計 2×2、WhatsApp 浮動鍵、表單單欄 |
| ≤ 420px（細機） | 標題再縮一級、表單內距收窄、資訊欄位加寬 |

另外已針對手機處理：輸入框 16px（避免 iOS Safari 聚焦時自動放大）、固定導航的錨點預留（`scroll-margin-top`）、底部安全距離。

想自己截圖給客人看：

```powershell
node scripts/screenshot.mjs
# 產出 shots/desktop.png（1440×900）與 shots/mobile.png（390×844，2x）
```

---

## 3. 點樣放上網（呢個係完整網站服務，唔係一個 HTML 檔）

專案有路由、表單 API、登入、資料持久化，所以「放上網」＝把這個 Node 服務放到主機，再指一個域名過去。四條路線，按「省事 → 可控」排：

> 💡 **想 $0 上線**：照 [DEPLOY-FREE.md](DEPLOY-FREE.md) 做（Render 免費網站 + Supabase 免費 Postgres + GitHub Actions 喚醒），約 15 分鐘、不用信用卡。資料存 Supabase，重啟／重新部署都唔會唔見。

| 路線 | 適合 | 成本 | 你要做的 |
|---|---|---|---|
| **Render + Supabase**（免費） | 想 $0、可接受偶爾冷啟動 | $0 | 見 [DEPLOY-FREE.md](DEPLOY-FREE.md) |
| **Render**（附 `render.yaml`） | 想最快上線、不想碰伺服器 | 免費（休眠）或 US$7/月起（磁碟） | 推上 GitHub → Blueprint → 填域名 |
| **Fly.io**（附 `fly.toml`） | 想要香港節點、按用量收費 | 約 US$3–10/月 | `fly launch` → 建 volume → `fly deploy` |
| **VPS + Caddy**（阿里雲香港／騰訊雲／DigitalOcean） | 想完全控制、之後加其他服務 | 約 HK$40–90/月 | 下面的 systemd + Caddy 設定照抄 |
| **臨時隧道**（localhost.run / Cloudflare Tunnel） | 先給客人看效果、內部驗收 | 免費 | 電腦要保持開機；網址會變 |

> ⚠️ 關鍵：`data/` 一定要放在**持久化磁碟**（本專案支援 `DATA_DIR`，Docker/Render/Fly 都指向 `/data`）。否則每次重新部署，查詢紀錄與後台改過的內容都會清空。

瀏覽器**不需要裝任何插件**：後台就是同一個網站的 `/admin` 頁，手機、平板、電腦的瀏覽器都能登入。

### VPS（Ubuntu）+ Caddy

```bash
# 1. 複製專案到伺服器
scp -r company-site user@server:/srv/company-site

# 2. systemd 長駐
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

# 3. Caddy 自動 HTTPS
# /etc/caddy/Caddyfile
# yourcompany.com {
#   reverse_proxy 127.0.0.1:4321
# }
```

### Render（最省事）

1. 把 `company-site` 推上 GitHub
2. Render → New → Blueprint → 選 repo（自動讀 `render.yaml`）
3. 部署完在 Environment 看自動產生的 `ADMIN_PASSWORD`
4. Settings → Custom Domain 填域名，照指示改 DNS

### Fly.io（香港節點）

```bash
fly launch --no-deploy
fly volumes create site_data --region hkg --size 1
fly secrets set ADMIN_PASSWORD=你的強密碼
fly deploy
fly certs add yourcompany.com
```

### 任何 Docker 主機

```bash
docker build -t company-site .
docker run -d --restart unless-stopped -p 4321:4321 \
  -v site-data:/data -e ADMIN_PASSWORD=你的強密碼 company-site
# 前面再放 Caddy / Nginx 做 HTTPS
```

### 想先給客人看效果（臨時、免費）

```powershell
# 先綁雙棧，隧道才連得入
$env:HOST="::"; node server.js

# 另一個終端（Windows 內建 SSH）
ssh -T -o StrictHostKeyChecking=no -R 80:localhost:4321 nokey@localhost.run
# 會印出 https://xxxx.app.lhr.life，任何人可開
```

限制：電腦要一直開機、網址會輪換、不要當正式網站用。

### 上線前檢查清單

- [ ] 用環境變數 `ADMIN_PASSWORD` 設定強密碼
- [ ] `DATA_DIR` 指向持久化磁碟，重啟後資料仍在
- [ ] 後台「設定 → 網站網址」填 `https://你的域名`
- [ ] `data/` 有定期備份（整個資料夾複製）
- [ ] 公開後加 Turnstile 或收緊限流

---

## 4. 目錄結構

```
company-site/
├── server.js               # HTTP 伺服器：路由、驗證、查詢 API、內容儲存
├── lib/
│   ├── content.js          # 網站內容預設值 + 白名單清洗（後台只能改這裡有的欄位）
│   ├── store.js            # JSON 原子寫入 + 序列化更新
│   ├── session.js          # scrypt 密碼、HMAC 簽名 Cookie、限流輔助
│   └── views/              # 伺服器端渲染：官網 / 後台 / HTML 轉義
├── public/                 # 前端資源（CSS / JS，零框架）
├── scripts/
│   ├── reset-password.js   # 重設管理員密碼
│   └── smoke.mjs           # 端到端測試（33 項）
├── Dockerfile              # 上雲用
├── render.yaml / fly.toml  # 一鍵部署設定
├── data/                   # 執行時自動建立：內容、查詢、登入、密鑰
└── package.json
```

`data/` 是唯一需要備份的資料夾。

---

## 5. 安全性做了什麼

- 密碼用 `scrypt` 加鹽雜湊，不存明碼
- 登入態是 HMAC-SHA256 簽名 Cookie（HttpOnly、SameSite=Lax、12 小時過期）
- 所有輸出都做 HTML 轉義；內容寫入只接受白名單結構，不能塞 `<script>`
- CSP、`X-Frame-Options`、`nosniff` 等安全標頭
- 登入限流 8 次／10 分鐘；公開查詢表單 5 次／10 分鐘
- 表單有蜜罐欄位、跨站來源檢查
- 管理 API 未登入一律 401

尚未做：SMTP 寄信、圖形驗證碼、雙因素登入、圖片上傳。

---

## 6. 測試

```powershell
node server.js            # 另一個終端
node scripts/smoke.mjs
```

驗證：首頁、CSS、送單成功／失敗、客戶查進度、登入成功／失敗、後台各頁、改內容即時生效、回覆流程、CSV、未登入保護，最後自動清掉測試查詢。

---

## 7. 想再加什麼（都可以做）

1. **SMTP 自動寄信**：客戶送出後收到確認信、你收到通知信
2. **預約系統**：時段選擇 + Google Calendar / Outlook 同步
3. **多語版本**：中／英切換（同一套內容管理）
4. **圖片上傳**：後台直接換橫幅、案例圖
5. **SEO 加強**：分頁 sitemap、OG 圖自動生成
6. **CRM 串接**：把查詢寫進 HubSpot / Notion / Google Sheet
7. **WhatsApp 自動回覆**：與工作區的 `whatsapp-bot` 專案共用查詢紀錄
