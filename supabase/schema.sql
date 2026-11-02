-- Synvora: estrutura inicial do banco (Supabase / PostgreSQL)
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.

create extension if not exists "pgcrypto";

-- Lojas (cada cliente do Synvora é uma loja)
create table if not exists public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criado_em timestamptz not null default now()
);

-- Perfis: uma linha por usuário, ligada ao login do Supabase
create table if not exists public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  usuario text not null unique,
  email_recuperacao text,
  papel text not null default 'dono' check (papel in ('dono','vendedor','caixa')),
  criado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  sku text not null,
  nome text not null,
  categoria text,
  preco numeric(12,2) not null default 0,
  saldo integer not null default 0,
  foto_url text,
  criado_em timestamptz not null default now(),
  unique (loja_id, sku)
);

create table if not exists public.clientes (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  telefone text,
  criado_em timestamptz not null default now()
);

create table if not exists public.pedidos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  numero integer not null,
  cliente_id uuid references public.clientes(id) on delete set null,
  cliente_nome text,
  canal text not null default 'Loja física',
  etapa integer not null default 0 check (etapa between 0 and 4),
  saiu_do_estoque boolean not null default false,
  cancelado boolean not null default false,
  devolvido_ao_estoque boolean not null default false,
  criado_em timestamptz not null default now(),
  unique (loja_id, numero)
);

create table if not exists public.pedido_itens (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  produto_id uuid references public.produtos(id) on delete set null,
  nome text not null,
  quantidade integer not null check (quantidade > 0),
  preco numeric(12,2) not null
);

-- Função auxiliar: qual é a loja do usuário logado
create or replace function public.minha_loja()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select loja_id from public.perfis where id = auth.uid()
$$;

-- Segurança por loja: cada usuário só enxerga e altera os dados da própria loja
alter table public.lojas enable row level security;
alter table public.perfis enable row level security;
alter table public.produtos enable row level security;
alter table public.clientes enable row level security;
alter table public.pedidos enable row level security;
alter table public.pedido_itens enable row level security;

drop policy if exists "loja: ver a propria" on public.lojas;
create policy "loja: ver a propria" on public.lojas for select using (id = public.minha_loja());
drop policy if exists "loja: dono edita" on public.lojas;
create policy "loja: dono edita" on public.lojas for update
  using (id = public.minha_loja() and exists (select 1 from public.perfis p where p.id = auth.uid() and p.papel = 'dono'));

drop policy if exists "perfis: ver da loja" on public.perfis;
create policy "perfis: ver da loja" on public.perfis for select using (loja_id = public.minha_loja());
drop policy if exists "perfis: editar o proprio" on public.perfis;
create policy "perfis: editar o proprio" on public.perfis for update using (id = auth.uid());

drop policy if exists "produtos: tudo da loja" on public.produtos;
create policy "produtos: tudo da loja" on public.produtos for all
  using (loja_id = public.minha_loja()) with check (loja_id = public.minha_loja());
drop policy if exists "clientes: tudo da loja" on public.clientes;
create policy "clientes: tudo da loja" on public.clientes for all
  using (loja_id = public.minha_loja()) with check (loja_id = public.minha_loja());
drop policy if exists "pedidos: tudo da loja" on public.pedidos;
create policy "pedidos: tudo da loja" on public.pedidos for all
  using (loja_id = public.minha_loja()) with check (loja_id = public.minha_loja());
drop policy if exists "itens: tudo da loja" on public.pedido_itens;
create policy "itens: tudo da loja" on public.pedido_itens for all
  using (loja_id = public.minha_loja()) with check (loja_id = public.minha_loja());

-- Ao criar um usuário novo pelo cadastro, cria a loja e o perfil de dono automaticamente
create or replace function public.novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_loja uuid;
begin
  insert into public.lojas (nome)
  values (coalesce(new.raw_user_meta_data->>'loja_nome', 'Minha loja'))
  returning id into nova_loja;

  insert into public.perfis (id, loja_id, nome, usuario, email_recuperacao, papel)
  values (
    new.id,
    nova_loja,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'usuario'),
    lower(new.raw_user_meta_data->>'usuario'),
    new.raw_user_meta_data->>'email_recuperacao',
    'dono'
  );
  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.novo_usuario();
