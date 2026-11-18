-- 在 Supabase → SQL Editor 貼上並執行（一次就夠）
-- 建立一個 key/value 表，存網站內容、查詢紀錄、管理員密碼與 session secret。
-- 只有伺服器用 service_role key 存取；RLS 開啟且不設 policy = 匿名金鑰讀唔到。

create table if not exists public.site_kv (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_kv enable row level security;

-- 可選：保留 90 日內每次更新的歷史（方便回溯誤改）
create table if not exists public.site_kv_history (
  id bigint generated always as identity primary key,
  key text not null,
  value jsonb not null,
  saved_at timestamptz not null default now()
);

alter table public.site_kv_history enable row level security;

-- 確認
select key, jsonb_typeof(value) as type, updated_at
from public.site_kv
order by updated_at desc;
