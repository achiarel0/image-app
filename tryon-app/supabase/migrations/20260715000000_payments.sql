-- Payments audit table: one row per completed Stripe checkout session.
-- Entitlement itself lives in auth.users.raw_app_meta_data (paid_until etc.);
-- this table is the purchase record. Only the service role writes to it
-- (no insert/update/delete policies on purpose — service role bypasses RLS).

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_session_id text not null unique,
  stripe_subscription_id text,
  stripe_customer_id text,
  amount integer,               -- cents (checkout session amount_total)
  currency text,
  email text,                   -- checkout session customer email
  created_at timestamptz not null default now()
);

alter table public.payments enable row level security;

create policy "Users can view own payments"
  on public.payments for select
  using ((select auth.uid()) = user_id);

create index payments_user_id_idx on public.payments (user_id);
