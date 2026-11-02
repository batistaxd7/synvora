-- Synvora: emissão de nota fiscal (NFC-e e NF-e) pela Focus NFe
-- Rode no Supabase (SQL Editor > New query > Run). Pode rodar mais de uma vez.

-- Dados fiscais de cada produto
alter table public.produtos add column if not exists ncm text;
alter table public.produtos add column if not exists cfop text;
alter table public.produtos add column if not exists icms_situacao text;
alter table public.produtos add column if not exists origem text;
alter table public.produtos add column if not exists unidade text;

-- Configuração fiscal da loja. O token fica só no servidor: nenhum usuário lê esta tabela direto.
create table if not exists public.fiscal_config (
  loja_id uuid primary key references public.lojas(id) on delete cascade,
  ambiente text not null default 'homologacao' check (ambiente in ('homologacao','producao')),
  token text,
  cnpj text,
  uf text,
  ncm_padrao text,
  cfop_padrao text not null default '5102',
  icms_padrao text not null default '102',
  origem_padrao text not null default '0',
  pis_cofins_padrao text not null default '49',
  atualizado_em timestamptz not null default now()
);
alter table public.fiscal_config enable row level security;
revoke all on public.fiscal_config from authenticated, anon;

-- Notas emitidas
create table if not exists public.notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  pedido_id uuid references public.pedidos(id) on delete set null,
  tipo text not null check (tipo in ('nfce','nfe')),
  ref text not null unique,
  ambiente text not null,
  status text not null default 'enviando',
  numero text,
  serie text,
  chave text,
  danfe_url text,
  xml_url text,
  mensagem text,
  emitida_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists notas_pedido on public.notas_fiscais (pedido_id, criado_em);
alter table public.notas_fiscais enable row level security;
drop policy if exists "notas: ver da loja" on public.notas_fiscais;
create policy "notas: ver da loja" on public.notas_fiscais for select using (loja_id = public.minha_loja());
revoke insert, update, delete on public.notas_fiscais from authenticated, anon;
grant select on public.notas_fiscais to authenticated;
