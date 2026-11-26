-- ============================================================================
-- JITE AUTO DEALS — COMPLETE SUPABASE POSTGRESQL, RLS & STORAGE SCHEMA
-- ============================================================================
-- Idempotent migration schema. Run inside Supabase SQL Editor or psql before
-- running scripts/migrate-firebase-to-supabase.mjs.
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- 1. ADMINISTRATOR PROFILES, BOOTSTRAP LOCK, INVITES & AUDIT LOGS
-- ----------------------------------------------------------------------------

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  active boolean not null default true,
  inactivity_timeout_minutes integer not null default 30 check (inactivity_timeout_minutes between 5 and 180),
  auth_methods text[] not null default array['password']::text[],
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_admin_profiles_email_lower on public.admin_profiles (lower(email));
create index if not exists idx_admin_profiles_active_role on public.admin_profiles (active, role);

create table if not exists public.admin_bootstrap (
  id boolean primary key default true check (id = true),
  setup_completed boolean not null default false,
  primary_admin_id uuid references auth.users(id) on delete set null,
  dashboard_override boolean not null default false,
  setup_completed_at timestamptz,
  password_updated_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into public.admin_bootstrap (id, setup_completed)
values (true, false)
on conflict (id) do nothing;

create table if not exists public.admin_invites (
  email_lower text primary key,
  email text not null,
  display_name text,
  role text not null default 'admin' check (role = 'admin'),
  active boolean not null default true,
  invited_by_uid uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_uid text not null,
  actor_email text,
  status text not null default 'success' check (status in ('success', 'failure', 'warning')),
  details text not null default '',
  auth_method text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at on public.admin_audit_logs (created_at desc);

-- ----------------------------------------------------------------------------
-- 2. VEHICLES & NORMALIZED VEHICLE IMAGES
-- ----------------------------------------------------------------------------

create table if not exists public.vehicles (
  id text primary key,
  slug text,
  make text not null,
  model text not null,
  year integer not null check (year >= 1970 and year <= 2100),
  price numeric(14, 2) not null default 0 check (price >= 0),
  mileage integer check (mileage is null or mileage >= 0),
  transmission text,
  fuel_type text,
  body_type text,
  location text,
  dealership text,
  duty_status text,
  key_features jsonb not null default '[]'::jsonb,
  images jsonb not null default '[]'::jsonb,
  image_metadata jsonb not null default '[]'::jsonb,
  description text default '',
  engine text,
  color text default '',
  condition text default 'Foreign Used',
  is_featured boolean not null default true,
  in_slideshow boolean not null default false,
  slideshow_order integer not null default 0,
  status text not null default 'Available' check (status in ('Available', 'Reserved', 'Sold', 'Hidden', 'Active', 'Inactive')),
  model_3d_url text,
  frames_360 jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_vehicles_status_featured_year on public.vehicles (status, is_featured, year desc);
create index if not exists idx_vehicles_slug on public.vehicles (slug);
create index if not exists idx_vehicles_slideshow on public.vehicles (in_slideshow, slideshow_order);

create table if not exists public.vehicle_images (
  id uuid primary key default gen_random_uuid(),
  vehicle_id text not null references public.vehicles(id) on delete cascade,
  storage_bucket text,
  storage_path text,
  public_id text,
  secure_url text not null,
  position integer not null default 1 check (position >= 1),
  is_cover boolean not null default false,
  width integer,
  height integer,
  bytes bigint,
  format text,
  angle_tag text,
  uploaded_at timestamptz not null default now()
);

create index if not exists idx_vehicle_images_vehicle_pos on public.vehicle_images (vehicle_id, position asc);
create unique index if not exists idx_vehicle_images_vehicle_url_unique on public.vehicle_images (vehicle_id, secure_url);

-- ----------------------------------------------------------------------------
-- 3. CUSTOMER ENQUIRIES (SOURCING / FIND-CAR) & INSPECTION BOOKINGS
-- ----------------------------------------------------------------------------

create table if not exists public.customer_enquiries (
  id text primary key,
  name text not null,
  phone text not null,
  vehicle_type text default '',
  budget numeric(14, 2) default 0 check (budget is null or budget >= 0),
  brand text default '',
  model text,
  location text,
  payment_method text default 'Cash',
  requirements text,
  type text not null default 'find_car',
  source_url text,
  source_image text,
  status text not null default 'New' check (status in ('New', 'Contacted', 'In Progress', 'Completed', 'Closed')),
  notes text,
  source text,
  ai_summary text,
  whatsapp_handoff boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_customer_enquiries_created_status on public.customer_enquiries (created_at desc, status);

create table if not exists public.inspection_bookings (
  id text primary key,
  name text not null,
  phone text not null,
  vehicle_id text references public.vehicles(id) on delete set null,
  vehicle_name text default '',
  vehicle_price numeric(14, 2),
  vehicle_location text,
  budget numeric(14, 2),
  payment_method text,
  ready_to_buy text,
  preferred_contact text default 'WhatsApp',
  message text,
  preferred_date text,
  preferred_time text,
  type text not null default 'inspection',
  status text not null default 'New' check (status in ('New', 'Contacted', 'In Progress', 'Completed', 'Closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_inspection_bookings_created_status on public.inspection_bookings (created_at desc, status);

-- ----------------------------------------------------------------------------
-- 4. WEBSITE SETTINGS (BUSINESS PROFILE, EDITORIAL POSTS, ANALYTICS)
-- ----------------------------------------------------------------------------

create table if not exists public.website_settings (
  key text primary key check (key in ('business', 'editorial', 'analytics')),
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 5. SECURITY DEFINER ADMIN HELPER & TIMESTAMP TRIGGERS
-- ----------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_touch on public.admin_profiles;
create trigger trg_admin_profiles_touch before update on public.admin_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_admin_bootstrap_touch on public.admin_bootstrap;
create trigger trg_admin_bootstrap_touch before update on public.admin_bootstrap
for each row execute function public.touch_updated_at();

drop trigger if exists trg_admin_invites_touch on public.admin_invites;
create trigger trg_admin_invites_touch before update on public.admin_invites
for each row execute function public.touch_updated_at();

drop trigger if exists trg_vehicles_touch on public.vehicles;
create trigger trg_vehicles_touch before update on public.vehicles
for each row execute function public.touch_updated_at();

drop trigger if exists trg_customer_enquiries_touch on public.customer_enquiries;
create trigger trg_customer_enquiries_touch before update on public.customer_enquiries
for each row execute function public.touch_updated_at();

drop trigger if exists trg_inspection_bookings_touch on public.inspection_bookings;
create trigger trg_inspection_bookings_touch before update on public.inspection_bookings
for each row execute function public.touch_updated_at();

drop trigger if exists trg_website_settings_touch on public.website_settings;
create trigger trg_website_settings_touch before update on public.website_settings
for each row execute function public.touch_updated_at();

-- Checks strictly whether the authenticated Supabase Auth user is an active admin/owner
create or replace function public.is_active_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.active = true
      and ap.role in ('owner', 'admin')
  );
$$;

revoke all on function public.is_active_admin() from public;
grant execute on function public.is_active_admin() to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES ACROSS ALL TABLES
-- ----------------------------------------------------------------------------

alter table public.admin_profiles enable row level security;
alter table public.admin_bootstrap enable row level security;
alter table public.admin_invites enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.vehicles enable row level security;
alter table public.vehicle_images enable row level security;
alter table public.customer_enquiries enable row level security;
alter table public.inspection_bookings enable row level security;
alter table public.website_settings enable row level security;

-- vehicles: public read non-hidden inventory; active admins full access
drop policy if exists vehicles_public_select on public.vehicles;
create policy vehicles_public_select on public.vehicles
for select to anon, authenticated
using (status <> 'Hidden' or public.is_active_admin());

drop policy if exists vehicles_admin_insert on public.vehicles;
create policy vehicles_admin_insert on public.vehicles
for insert to authenticated
with check (public.is_active_admin());

drop policy if exists vehicles_admin_update on public.vehicles;
create policy vehicles_admin_update on public.vehicles
for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists vehicles_admin_delete on public.vehicles;
create policy vehicles_admin_delete on public.vehicles
for delete to authenticated
using (public.is_active_admin());

-- vehicle_images: public read for non-hidden vehicles; active admins full access
drop policy if exists vehicle_images_public_select on public.vehicle_images;
create policy vehicle_images_public_select on public.vehicle_images
for select to anon, authenticated
using (
  public.is_active_admin()
  or exists (
    select 1 from public.vehicles v
    where v.id = vehicle_images.vehicle_id and v.status <> 'Hidden'
  )
);

drop policy if exists vehicle_images_admin_insert on public.vehicle_images;
create policy vehicle_images_admin_insert on public.vehicle_images
for insert to authenticated
with check (public.is_active_admin());

drop policy if exists vehicle_images_admin_update on public.vehicle_images;
create policy vehicle_images_admin_update on public.vehicle_images
for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists vehicle_images_admin_delete on public.vehicle_images;
create policy vehicle_images_admin_delete on public.vehicle_images
for delete to authenticated
using (public.is_active_admin());

-- customer_enquiries: public validated insert; strictly admin-only read/update/delete
drop policy if exists customer_enquiries_public_insert on public.customer_enquiries;
create policy customer_enquiries_public_insert on public.customer_enquiries
for insert to anon, authenticated
with check (
  length(trim(name)) between 1 and 160
  and length(trim(phone)) between 6 and 40
  and status = 'New'
);

drop policy if exists customer_enquiries_admin_select on public.customer_enquiries;
create policy customer_enquiries_admin_select on public.customer_enquiries
for select to authenticated
using (public.is_active_admin());

drop policy if exists customer_enquiries_admin_update on public.customer_enquiries;
create policy customer_enquiries_admin_update on public.customer_enquiries
for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists customer_enquiries_admin_delete on public.customer_enquiries;
create policy customer_enquiries_admin_delete on public.customer_enquiries
for delete to authenticated
using (public.is_active_admin());

-- inspection_bookings: public validated insert; strictly admin-only read/update/delete
drop policy if exists inspection_bookings_public_insert on public.inspection_bookings;
create policy inspection_bookings_public_insert on public.inspection_bookings
for insert to anon, authenticated
with check (
  length(trim(name)) between 1 and 160
  and length(trim(phone)) between 6 and 40
  and status = 'New'
);

drop policy if exists inspection_bookings_admin_select on public.inspection_bookings;
create policy inspection_bookings_admin_select on public.inspection_bookings
for select to authenticated
using (public.is_active_admin());

drop policy if exists inspection_bookings_admin_update on public.inspection_bookings;
create policy inspection_bookings_admin_update on public.inspection_bookings
for update to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists inspection_bookings_admin_delete on public.inspection_bookings;
create policy inspection_bookings_admin_delete on public.inspection_bookings
for delete to authenticated
using (public.is_active_admin());

-- website_settings: public read strictly for business/editorial; admins full write/read
drop policy if exists website_settings_public_select on public.website_settings;
create policy website_settings_public_select on public.website_settings
for select to anon, authenticated
using (key in ('business', 'editorial') or public.is_active_admin());

drop policy if exists website_settings_admin_all on public.website_settings;
create policy website_settings_admin_all on public.website_settings
for all to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

-- admin_profiles: users cannot self-register as admins; only active admins or server service role manage profiles
drop policy if exists admin_profiles_self_or_admin_select on public.admin_profiles;
create policy admin_profiles_self_or_admin_select on public.admin_profiles
for select to authenticated
using (id = auth.uid() or public.is_active_admin());

drop policy if exists admin_profiles_admin_modify on public.admin_profiles;
create policy admin_profiles_admin_modify on public.admin_profiles
for all to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

-- admin_bootstrap & admin_invites & admin_audit_logs: strictly active admins / service role
drop policy if exists admin_bootstrap_admin_read on public.admin_bootstrap;
create policy admin_bootstrap_admin_read on public.admin_bootstrap
for select to authenticated
using (public.is_active_admin());

drop policy if exists admin_invites_admin_all on public.admin_invites;
create policy admin_invites_admin_all on public.admin_invites
for all to authenticated
using (public.is_active_admin())
with check (public.is_active_admin());

drop policy if exists admin_audit_logs_admin_select on public.admin_audit_logs;
create policy admin_audit_logs_admin_select on public.admin_audit_logs
for select to authenticated
using (public.is_active_admin());

drop policy if exists admin_audit_logs_admin_insert on public.admin_audit_logs;
create policy admin_audit_logs_admin_insert on public.admin_audit_logs
for insert to authenticated
with check (public.is_active_admin());

-- ----------------------------------------------------------------------------
-- 7. SUPABASE STORAGE BUCKET ('vehicle-images') & RLS POLICIES
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'vehicle-images',
  'vehicle-images',
  true,
  15728640,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set public = true,
    file_size_limit = 15728640,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

drop policy if exists storage_vehicle_images_public_read on storage.objects;
create policy storage_vehicle_images_public_read on storage.objects
for select to anon, authenticated
using (bucket_id = 'vehicle-images');

drop policy if exists storage_vehicle_images_admin_insert on storage.objects;
create policy storage_vehicle_images_admin_insert on storage.objects
for insert to authenticated
with check (bucket_id = 'vehicle-images' and public.is_active_admin());

drop policy if exists storage_vehicle_images_admin_update on storage.objects;
create policy storage_vehicle_images_admin_update on storage.objects
for update to authenticated
using (bucket_id = 'vehicle-images' and public.is_active_admin())
with check (bucket_id = 'vehicle-images' and public.is_active_admin());

drop policy if exists storage_vehicle_images_admin_delete on storage.objects;
create policy storage_vehicle_images_admin_delete on storage.objects
for delete to authenticated
using (bucket_id = 'vehicle-images' and public.is_active_admin());
