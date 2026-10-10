-- Wholesale (B2B) additions: company details + business licence review,
-- purchase-order numbers on orders, and a small settings table for the
-- wholesale minimum order / pay-first rule.
--
-- Everything here is reached only through the server's admin and account
-- routes (service role): customers have no direct table rights.

create table if not exists public.company_details (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  tax_id text check (tax_id is null or char_length(tax_id) <= 60),
  address text check (address is null or char_length(address) <= 400),
  billing_name text check (billing_name is null or char_length(billing_name) <= 160),
  billing_phone text check (billing_phone is null or char_length(billing_phone) <= 40),
  billing_email text check (billing_email is null or char_length(billing_email) <= 200),
  licence_status text not null default 'none'
    check (licence_status in ('none', 'pending', 'verified', 'rejected')),
  licence_path text,
  licence_file_name text,
  licence_content_type text,
  licence_submitted_at timestamptz,
  licence_reviewed_at timestamptz,
  licence_reviewed_by uuid references public.profiles(id) on delete set null,
  licence_review_note text check (licence_review_note is null or char_length(licence_review_note) <= 500),
  updated_at timestamptz not null default now()
);

alter table public.company_details enable row level security;
revoke all on table public.company_details from anon, authenticated;
grant select, insert, update, delete on table public.company_details to service_role;

alter table public.orders
  add column if not exists po_number text
  check (po_number is null or char_length(po_number) between 1 and 60);

create table if not exists public.shop_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

alter table public.shop_settings enable row level security;
revoke all on table public.shop_settings from anon, authenticated;
grant select, insert, update, delete on table public.shop_settings to service_role;

-- Private bucket for business licence scans (reads are signed server-side).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'business-licences',
  'business-licences',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

notify pgrst, 'reload schema';
