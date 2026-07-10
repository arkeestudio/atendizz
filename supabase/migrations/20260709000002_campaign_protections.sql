-- Proteções de campanha (anti-ban).

-- 1) Opt-out: números que responderam "SAIR" (etc.) não recebem mais campanhas.
create table if not exists public.campaign_optout (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.company(id) on delete cascade,
  numero text not null,
  created_at timestamptz not null default now(),
  unique (company_id, numero)
);
grant select, insert, update, delete on public.campaign_optout to authenticated;
grant all on public.campaign_optout to service_role;
alter table public.campaign_optout enable row level security;
drop policy if exists campaign_optout_access on public.campaign_optout;
create policy campaign_optout_access on public.campaign_optout for all to authenticated
  using (public.has_company_access(company_id))
  with check (public.has_company_access(company_id));
create index if not exists idx_campaign_optout_company on public.campaign_optout(company_id);

-- 2) Modo aquecimento (warm-up): limite de envios de campanha por dia, por número.
alter table public.whatsapp_instances
  add column if not exists aquecimento_ativo boolean not null default false,
  add column if not exists aquecimento_limite_dia integer not null default 50;
