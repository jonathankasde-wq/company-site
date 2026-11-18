# 免費正式上線（$0／月）：Render + GitHub 資料分支

最後你會得到：`https://你的服務.onrender.com`（可綁自己域名）、可收查詢、可登入後台改內容，**重啟唔會唔見資料**。

```
客人 ─► Render（免費網站，會休眠）
              │ 讀寫
              ▼
        GitHub repo 的 data 分支（site-data.json，免費、永久、有版本紀錄）
              ▲
      GitHub Actions 每 10 分鐘 ping（叫醒網站）
```

> 為何唔用「免費主機 + 本機檔案」？Render／Koyeb 免費方案磁碟係**臨時**的，任何重啟或重新部署都會清空——查詢會全部消失。
> 為何唔用 Supabase？可以，但要多開一個帳號；而 GitHub 本身已經有，用同一個 repo 的 `data` 分支存資料就唔需要額外服務，而且每次修改都有 commit 可回溯。

---

## 你需要

| 項目 | 狀態 |
|---|---|
| GitHub 帳號 + `company-site` repo | ✅ 已完成 |
| Render 帳號（免費、不用信用卡） | ⬜ 用 GitHub 登入即可 |
| 一個 GitHub token（只俾 Render 用） | ⬜ 3 分鐘產生 |

---

## 步驟 1：產生 Render 用的 token

1. 開 <https://github.com/settings/personal-access-tokens/new>
2. 填：
   - **Token name**：`render-data`
   - **Expiration**：**Custom → 1 年**（過期前換新）
   - **Repository access**：Only select repositories → `company-site`
   - **Permissions → Contents**：**Read and write**
3. **Generate token** → 複製 `github_pat_...`（只顯示一次）

> 呢個 token 只可以改 `company-site` 一個 repo；只會貼入 Render 的環境變數，唔會出現在網站前端。

---

## 步驟 2：Render 部署（約 5 分鐘）

1. 開 <https://render.com> → **Get Started** → **GitHub** 登入（唔需要信用卡）
2. **New → Blueprint**
3. 第一次會要你安裝 Render GitHub App → 揀 `company-site` → Install
4. 揀 `company-site` repo → Render 會自動讀 `render.yaml`
5. 在環境變數表格填：
   - `GH_DATA_TOKEN` = 步驟 1 的 token
   - `ADMIN_PASSWORD` 已經自動生成（部署後在 Environment 按 reveal 抄低）
6. 按 **Apply / Deploy**，等 3–5 分鐘

完成後：
- 官網：`https://company-site-xxxx.onrender.com`
- 後台：同一個網址加 `/admin`，帳號 `admin` + 上面密碼

第一次開啟會順便建立 `data` 分支同 `site-data.json`。

---

## 步驟 3：確認資料真係持久

1. 在官網送一張測試查詢
2. Render → 你的服務 → **Manual Deploy → Deploy latest commit**（或等它休眠後再開）
3. 重新整理 `/admin/inquiries`，測試查詢應該仍然在

如果唔見咗：檢查 Render Logs 有冇 `[store]` 錯誤，多數係 `GH_DATA_TOKEN` 權限或過期。

---

## 步驟 4（可選）：綁自己的域名

Render → 服務 → **Settings → Custom Domain** → 填 `www.你的公司.com` → 照指示在域名商加 CNAME。HTTPS 自動。

之後在後台「設定 → 網站網址」填 `https://你的網址`。

---

## 步驟 5（可選）：自動喚醒

Render 免費方案 15 分鐘無流量會休眠（約 1 分鐘喚醒）。想減少冷啟動：

1. GitHub repo → **Add file → Create new file**
2. 檔名打 `.github/workflows/warmup.yml`
3. 貼上 repo 內同一路徑檔案的內容（若未上傳過，內容如下）

```yaml
name: Keep site awake
on:
  schedule:
    - cron: '*/10 * * * *'
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: curl -fsS -o /dev/null --max-time 90 "${{ vars.SITE_URL }}/" || true
```

4. repo → Settings → Secrets and variables → Actions → Variables → 新增 `SITE_URL` = `https://你的服務.onrender.com`

> GitHub 免費 repo 若 60 日完全冇 commit，排程會自動停用，屆時手動 Run 一次。

---

## 成本與限制

| 項目 | 免費額度 | 影響 |
|---|---|---|
| Render 免費網站 | 750 小時／月、512MB RAM、休眠 | 冷啟動約 30–60 秒（可用 cron 減少） |
| GitHub 資料分支 | 免費、無限私人 commit | 每次查詢／改內容 = 1 個 commit |
| 頻寬 | Render 免費約 5GB／月 | 一般公司站足夠 |
| 自訂域名 | Render 免費支援 | ✅ |
| Token | 1 年後需更新 | 過期後表單會寫入失敗，換新 token 即可 |

**接受不了冷啟動**：Oracle Cloud Always Free（永久免費 VM，要信用卡驗證）或 Render 付費 US$7/月。

---

## 疑難排解

| 症狀 | 原因／解法 |
|---|---|
| 送表單失敗、後台儲存失敗 | `GH_DATA_TOKEN` 未填／過期／權限不足；睇 Render Logs 的 `[store]` |
| 後台顯示「資料連線異常」 | 同上；或 token 沒有 `Contents: Read and write` |
| 忘記管理員密碼 | Render → Environment 改 `ADMIN_PASSWORD` → Manual Deploy |
| 網站開得慢 | 免費方案休眠中，正在喚醒 |
| 想睇資料 | GitHub repo → 分支切去 `data` → `site-data.json` |
