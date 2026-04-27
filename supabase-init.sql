-- WMS 仓库管理系统 - Supabase 建表 SQL
-- 请在 Supabase 控制台 → SQL Editor 中执行此文件

-- 1. 用户表
create table if not exists users (
  id bigint generated always as identity primary key,
  username text unique not null,
  password text not null,
  operator_name text not null,
  created_at timestamptz default now()
);

-- 2. 物料库存表
create table if not exists material_inventory (
  id bigint generated always as identity primary key,
  material_name text not null,
  unit text not null default '',
  quantity int not null default 0,
  location text not null default '',
  updated_at text not null default ''
);

-- 3. 多余库存(SKU)表
create table if not exists surplus_inventory (
  id bigint generated always as identity primary key,
  surplus_code text not null,
  quantity int not null default 0,
  location text not null default '',
  updated_at text not null default ''
);

-- 4. 最近库存变动表
create table if not exists recent_records (
  id bigint generated always as identity primary key,
  time text not null,
  type text not null,
  name text not null,
  quantity int not null default 0,
  created_at timestamptz default now()
);

-- 5. 开启 RLS 并设置公开读写策略（简化版）
alter table users enable row level security;
alter table material_inventory enable row level security;
alter table surplus_inventory enable row level security;
alter table recent_records enable row level security;

create policy "Allow all for users" on users for all using (true) with check (true);
create policy "Allow all for material_inventory" on material_inventory for all using (true) with check (true);
create policy "Allow all for surplus_inventory" on surplus_inventory for all using (true) with check (true);
create policy "Allow all for recent_records" on recent_records for all using (true) with check (true);

-- 6. 照片表
create table if not exists photos (
  id bigint generated always as identity primary key,
  operator text not null,
  photo_url text not null,
  taken_at text not null,
  location_text text not null default '',
  category text not null default '其他',
  created_at timestamptz default now()
);

alter table photos enable row level security;
create policy "Allow all for photos" on photos for all using (true) with check (true);

-- 7. 开启 photos 表的 Realtime
alter publication supabase_realtime add table photos;
