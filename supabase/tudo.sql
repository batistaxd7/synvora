-- Synvora: banco completo. Rode este arquivo inteiro no Supabase (SQL Editor > New query > Run).
-- Pode rodar quantas vezes quiser: ele só cria ou atualiza o que falta e não apaga nenhum dado.

-- ================================================================
-- schema.sql
-- ================================================================
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

-- ================================================================
-- permissoes.sql
-- ================================================================
-- Permissões de acesso às tabelas para usuários logados.
-- A segurança por loja continua garantida pelas regras (RLS) do schema.sql.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.minha_loja() to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- ================================================================
-- equipe.sql
-- ================================================================
-- Equipe: permite criar usuários que entram na loja do dono (e não viram donos).
-- Quem define loja_id e papel é o servidor (chave de administrador), guardado em app_metadata,
-- que um cadastro público NÃO consegue preencher.
create or replace function public.novo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  nova_loja uuid;
  loja_membro uuid;
  papel_membro text;
begin
  loja_membro := nullif(new.raw_app_meta_data->>'loja_id', '')::uuid;
  papel_membro := new.raw_app_meta_data->>'papel';

  if loja_membro is not null and papel_membro in ('vendedor','caixa') then
    insert into public.perfis (id, loja_id, nome, usuario, email_recuperacao, papel)
    values (
      new.id, loja_membro,
      coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'usuario'),
      lower(new.raw_user_meta_data->>'usuario'),
      nullif(new.raw_user_meta_data->>'email_recuperacao', ''),
      papel_membro
    );
    return new;
  end if;

  insert into public.lojas (nome)
  values (coalesce(new.raw_user_meta_data->>'loja_nome', 'Minha loja'))
  returning id into nova_loja;

  insert into public.perfis (id, loja_id, nome, usuario, email_recuperacao, papel)
  values (
    new.id, nova_loja,
    coalesce(new.raw_user_meta_data->>'nome', new.raw_user_meta_data->>'usuario'),
    lower(new.raw_user_meta_data->>'usuario'),
    new.raw_user_meta_data->>'email_recuperacao',
    'dono'
  );
  return new;
end;
$$;

-- ================================================================
-- seguranca.sql
-- ================================================================
-- Limita o que cada usuário logado pode alterar (impede virar dono ou trocar de loja).
revoke insert, update, delete on public.perfis from authenticated;
grant update (nome, email_recuperacao) on public.perfis to authenticated;

revoke insert, update, delete on public.lojas from authenticated;
grant update (nome) on public.lojas to authenticated;

alter table public.produtos drop constraint if exists produtos_saldo_nao_negativo;
alter table public.produtos add constraint produtos_saldo_nao_negativo check (saldo >= 0);
alter table public.produtos drop constraint if exists produtos_preco_nao_negativo;
alter table public.produtos add constraint produtos_preco_nao_negativo check (preco >= 0);

-- ================================================================
-- vendas.sql
-- ================================================================
-- Synvora etapa 2: Frente de caixa, Pedidos e Recibo.
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar mais de uma vez sem problema.

-- Colunas novas nos pedidos
alter table public.pedidos add column if not exists total numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists desconto numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists troco numeric(12,2) not null default 0;
alter table public.pedidos add column if not exists vendedor_id uuid references public.perfis(id) on delete set null;
alter table public.pedidos add column if not exists vendedor_nome text;
alter table public.pedidos add column if not exists observacao text;
alter table public.pedidos add column if not exists atualizado_em timestamptz not null default now();
alter table public.pedidos add column if not exists cancelado_em timestamptz;
alter table public.pedidos add column if not exists cancelado_por text;

-- Formas de pagamento de cada venda (permite dividir, ex.: parte no Pix e parte no dinheiro)
create table if not exists public.pedido_pagamentos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos(id) on delete cascade,
  loja_id uuid not null references public.lojas(id) on delete cascade,
  forma text not null check (forma in ('dinheiro','pix','credito','debito','outro')),
  valor numeric(12,2) not null check (valor > 0)
);

alter table public.pedido_pagamentos enable row level security;
drop policy if exists "pagamentos: ver da loja" on public.pedido_pagamentos;
create policy "pagamentos: ver da loja" on public.pedido_pagamentos for select
  using (loja_id = public.minha_loja());

create index if not exists pedidos_loja_data on public.pedidos (loja_id, criado_em desc);
create index if not exists itens_pedido on public.pedido_itens (pedido_id);
create index if not exists pagamentos_pedido on public.pedido_pagamentos (pedido_id);

-- Pedidos, itens e pagamentos só mudam pelas funções abaixo, que conferem
-- estoque, preço e total no servidor. Ninguém altera o histórico direto.
revoke insert, update, delete on public.pedidos from authenticated;
revoke insert, update, delete on public.pedido_itens from authenticated;
revoke insert, update, delete on public.pedido_pagamentos from authenticated;
grant select on public.pedidos, public.pedido_itens, public.pedido_pagamentos to authenticated;

-- Registrar uma venda.
-- itens: [{"produto_id": "...", "quantidade": 2}]
-- pagamentos: [{"forma": "pix", "valor": 50}, {"forma": "dinheiro", "valor": 100}]
create or replace function public.registrar_venda(
  itens jsonb,
  pagamentos jsonb,
  cliente text default null,
  canal_venda text default 'Loja física',
  desconto_venda numeric default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  eu record;
  item jsonb;
  pg jsonb;
  prod record;
  qtd integer;
  novo_id uuid;
  novo_numero integer;
  soma numeric(12,2) := 0;
  pago numeric(12,2) := 0;
  pago_dinheiro numeric(12,2) := 0;
  valor_pg numeric(12,2);
  total_final numeric(12,2);
  troco_final numeric(12,2) := 0;
begin
  select p.id, p.loja_id, p.nome into eu from public.perfis p where p.id = auth.uid();
  if eu.id is null then raise exception 'Faça login novamente.'; end if;

  if itens is null or jsonb_array_length(itens) = 0 then
    raise exception 'Adicione pelo menos um produto.';
  end if;
  if pagamentos is null or jsonb_array_length(pagamentos) = 0 then
    raise exception 'Informe a forma de pagamento.';
  end if;
  if coalesce(desconto_venda, 0) < 0 then raise exception 'Desconto inválido.'; end if;

  -- Trava a loja para gerar o número do pedido sem repetir
  perform 1 from public.lojas where id = eu.loja_id for update;
  select coalesce(max(numero), 1000) + 1 into novo_numero from public.pedidos where loja_id = eu.loja_id;

  insert into public.pedidos (loja_id, numero, cliente_nome, canal, etapa, saiu_do_estoque, vendedor_id, vendedor_nome)
  -- Venda no balcão (Loja física) já sai entregue; vendas online começam como "Novo"
  values (eu.loja_id, novo_numero, nullif(trim(cliente), ''), coalesce(nullif(trim(canal_venda), ''), 'Loja física'),
          case when coalesce(nullif(trim(canal_venda), ''), 'Loja física') = 'Loja física' then 4 else 0 end,
          true, eu.id, eu.nome)
  returning id into novo_id;

  for item in select * from jsonb_array_elements(itens) loop
    qtd := (item->>'quantidade')::integer;
    if qtd is null or qtd <= 0 then raise exception 'Quantidade inválida.'; end if;

    select id, nome, preco, saldo into prod from public.produtos
      where id = (item->>'produto_id')::uuid and loja_id = eu.loja_id
      for update;
    if prod.id is null then raise exception 'Produto não encontrado.'; end if;
    if prod.saldo < qtd then
      raise exception 'Estoque insuficiente de "%": restam % un.', prod.nome, prod.saldo;
    end if;

    update public.produtos set saldo = saldo - qtd where id = prod.id;
    insert into public.pedido_itens (pedido_id, loja_id, produto_id, nome, quantidade, preco)
    values (novo_id, eu.loja_id, prod.id, prod.nome, qtd, prod.preco);
    soma := soma + prod.preco * qtd;
  end loop;

  if desconto_venda > soma then raise exception 'O desconto é maior que o valor da venda.'; end if;
  total_final := soma - coalesce(desconto_venda, 0);

  for pg in select * from jsonb_array_elements(pagamentos) loop
    valor_pg := round((pg->>'valor')::numeric, 2);
    if valor_pg is null or valor_pg <= 0 then continue; end if;
    if (pg->>'forma') not in ('dinheiro','pix','credito','debito','outro') then
      raise exception 'Forma de pagamento inválida.';
    end if;
    insert into public.pedido_pagamentos (pedido_id, loja_id, forma, valor)
    values (novo_id, eu.loja_id, pg->>'forma', valor_pg);
    pago := pago + valor_pg;
    if pg->>'forma' = 'dinheiro' then pago_dinheiro := pago_dinheiro + valor_pg; end if;
  end loop;

  if pago < total_final then
    raise exception 'Falta receber R$ %.', replace(to_char(total_final - pago, 'FM999999990.00'), '.', ',');
  end if;
  troco_final := pago - total_final;
  -- Troco só existe se o excesso foi pago em dinheiro
  if troco_final > pago_dinheiro then
    raise exception 'O valor pago passou do total. Só dá para dar troco de dinheiro.';
  end if;

  update public.pedidos set total = total_final, desconto = coalesce(desconto_venda, 0), troco = troco_final
  where id = novo_id;

  return jsonb_build_object('id', novo_id, 'numero', novo_numero, 'total', total_final, 'troco', troco_final);
end;
$$;

-- Avançar a etapa do pedido (novo → separando → pronto pra enviar → enviado → entregue)
create or replace function public.avancar_pedido(pedido uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  minha uuid := public.minha_loja();
  ped record;
begin
  select id, etapa, cancelado into ped from public.pedidos where id = pedido and loja_id = minha for update;
  if ped.id is null then raise exception 'Pedido não encontrado.'; end if;
  if ped.cancelado then raise exception 'Este pedido está cancelado.'; end if;
  if ped.etapa >= 4 then return ped.etapa; end if;
  update public.pedidos set etapa = etapa + 1, atualizado_em = now() where id = pedido;
  return ped.etapa + 1;
end;
$$;

-- Cancelar a venda, escolhendo se os produtos voltam para o estoque
create or replace function public.cancelar_pedido(pedido uuid, devolver boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  minha uuid := public.minha_loja();
  ped record;
  quem text;
begin
  select id, cancelado, saiu_do_estoque into ped from public.pedidos where id = pedido and loja_id = minha for update;
  if ped.id is null then raise exception 'Pedido não encontrado.'; end if;
  if ped.cancelado then raise exception 'Este pedido já foi cancelado.'; end if;
  select nome into quem from public.perfis where id = auth.uid();

  if devolver and ped.saiu_do_estoque then
    update public.produtos pr set saldo = pr.saldo + i.qtd
    from (select produto_id, sum(quantidade) as qtd from public.pedido_itens
          where pedido_id = pedido and produto_id is not null group by produto_id) i
    where pr.id = i.produto_id and pr.loja_id = minha;
  end if;

  update public.pedidos
  set cancelado = true, devolvido_ao_estoque = (devolver and ped.saiu_do_estoque),
      cancelado_em = now(), cancelado_por = quem, atualizado_em = now()
  where id = pedido;
end;
$$;

revoke execute on function public.registrar_venda(jsonb, jsonb, text, text, numeric) from public, anon;
revoke execute on function public.avancar_pedido(uuid) from public, anon;
revoke execute on function public.cancelar_pedido(uuid, boolean) from public, anon;
grant execute on function public.registrar_venda(jsonb, jsonb, text, text, numeric) to authenticated;
grant execute on function public.avancar_pedido(uuid) to authenticated;
grant execute on function public.cancelar_pedido(uuid, boolean) to authenticated;

-- ================================================================
-- modulos.sql
-- ================================================================
-- Synvora etapa 3: Clientes, Fornecedores, Gastos, Tarefas, Avisos, Suporte e Perfil da loja.
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar mais de uma vez sem problema. Rode depois do vendas.sql.

-- ===== Ajudantes =====
create or replace function public.sou_dono()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'dono')
$$;

-- Atendentes do suporte Synvora (a sua equipe, não os lojistas).
-- Para virar atendente: insert into public.atendentes (user_id) select id from public.perfis where usuario = 'seu.usuario';
create table if not exists public.atendentes (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.atendentes enable row level security;
revoke all on public.atendentes from authenticated, anon;

create or replace function public.sou_atendente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.atendentes where user_id = auth.uid())
$$;
grant execute on function public.sou_dono() to authenticated;
grant execute on function public.sou_atendente() to authenticated;

-- ===== Perfil da loja =====
alter table public.lojas add column if not exists logo_url text;
alter table public.lojas add column if not exists telefone text;
alter table public.lojas add column if not exists email text;
alter table public.lojas add column if not exists endereco text;
alter table public.lojas add column if not exists documento text;
alter table public.lojas add column if not exists instagram text;
revoke update on public.lojas from authenticated;
grant update (nome, logo_url, telefone, email, endereco, documento, instagram) on public.lojas to authenticated;

-- Logo da loja (arquivos públicos, cada loja só grava na própria pasta)
insert into storage.buckets (id, name, public)
values ('logos', 'logos', true)
on conflict (id) do update set public = true;

drop policy if exists "logos: ver" on storage.objects;
create policy "logos: ver" on storage.objects for select using (bucket_id = 'logos');
drop policy if exists "logos: dono envia" on storage.objects;
create policy "logos: dono envia" on storage.objects for insert to authenticated
  with check (bucket_id = 'logos' and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono());
drop policy if exists "logos: dono troca" on storage.objects;
create policy "logos: dono troca" on storage.objects for update to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono());
drop policy if exists "logos: dono apaga" on storage.objects;
create policy "logos: dono apaga" on storage.objects for delete to authenticated
  using (bucket_id = 'logos' and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono());

-- ===== Clientes =====
alter table public.clientes add column if not exists email text;
alter table public.clientes add column if not exists documento text;
alter table public.clientes add column if not exists endereco text;
alter table public.clientes add column if not exists aniversario date;
alter table public.clientes add column if not exists observacao text;

-- ===== Fornecedores e Gastos (só o dono) =====
create table if not exists public.fornecedores (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  nome text not null,
  telefone text,
  email text,
  observacao text,
  criado_em timestamptz not null default now()
);

create table if not exists public.gastos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  descricao text not null,
  categoria text not null default 'Outros',
  valor numeric(12,2) not null check (valor > 0),
  data date not null default current_date,
  fornecedor_id uuid references public.fornecedores(id) on delete set null,
  pago boolean not null default true,
  criado_em timestamptz not null default now()
);
create index if not exists gastos_loja_data on public.gastos (loja_id, data desc);

alter table public.fornecedores enable row level security;
alter table public.gastos enable row level security;
drop policy if exists "fornecedores: dono" on public.fornecedores;
create policy "fornecedores: dono" on public.fornecedores for all
  using (loja_id = public.minha_loja() and public.sou_dono())
  with check (loja_id = public.minha_loja() and public.sou_dono());
drop policy if exists "gastos: dono" on public.gastos;
create policy "gastos: dono" on public.gastos for all
  using (loja_id = public.minha_loja() and public.sou_dono())
  with check (loja_id = public.minha_loja() and public.sou_dono());
grant select, insert, update, delete on public.fornecedores, public.gastos to authenticated;

-- ===== Tarefas =====
create table if not exists public.tarefas (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  titulo text not null,
  descricao text,
  responsavel_id uuid references public.perfis(id) on delete set null,
  responsavel_nome text,
  prazo date,
  prioridade text not null default 'normal' check (prioridade in ('normal','urgente')),
  concluida boolean not null default false,
  concluida_em timestamptz,
  criado_em timestamptz not null default now()
);
create index if not exists tarefas_loja on public.tarefas (loja_id, concluida, prazo);

alter table public.tarefas enable row level security;
drop policy if exists "tarefas: dono tudo" on public.tarefas;
create policy "tarefas: dono tudo" on public.tarefas for all
  using (loja_id = public.minha_loja() and public.sou_dono())
  with check (loja_id = public.minha_loja() and public.sou_dono());
drop policy if exists "tarefas: funcionario ve as dele" on public.tarefas;
create policy "tarefas: funcionario ve as dele" on public.tarefas for select
  using (loja_id = public.minha_loja() and responsavel_id = auth.uid());
grant select, insert, update, delete on public.tarefas to authenticated;

-- ===== Avisos (notificações) =====
create table if not exists public.avisos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  para_id uuid references public.perfis(id) on delete cascade,
  texto text not null,
  link text,
  lido boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists avisos_para on public.avisos (para_id, lido, criado_em desc);
alter table public.avisos enable row level security;
drop policy if exists "avisos: os meus" on public.avisos;
create policy "avisos: os meus" on public.avisos for select using (para_id = auth.uid());
drop policy if exists "avisos: marcar lido" on public.avisos;
create policy "avisos: marcar lido" on public.avisos for update using (para_id = auth.uid());
revoke insert, update, delete on public.avisos from authenticated;
grant select on public.avisos to authenticated;
grant update (lido) on public.avisos to authenticated;

-- Funcionário conclui a tarefa: marca e avisa o(s) dono(s)
create or replace function public.concluir_tarefa(tarefa uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  t record;
  quem text;
begin
  select * into t from public.tarefas where id = tarefa and loja_id = public.minha_loja() for update;
  if t.id is null then raise exception 'Tarefa não encontrada.'; end if;
  if t.responsavel_id is distinct from auth.uid() and not public.sou_dono() then
    raise exception 'Esta tarefa não é sua.';
  end if;
  if t.concluida then return; end if;
  update public.tarefas set concluida = true, concluida_em = now() where id = tarefa;
  select nome into quem from public.perfis where id = auth.uid();
  insert into public.avisos (loja_id, para_id, texto, link)
  select t.loja_id, p.id, coalesce(quem, 'Alguém') || ' concluiu a tarefa: ' || t.titulo, '/tarefas'
  from public.perfis p where p.loja_id = t.loja_id and p.papel = 'dono' and p.id <> auth.uid();
end;
$$;
revoke execute on function public.concluir_tarefa(uuid) from public, anon;
grant execute on function public.concluir_tarefa(uuid) to authenticated;

-- Aviso de pedido novo para o dono (vendas online)
create or replace function public.avisar_pedido_novo()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.etapa = 0 then
    insert into public.avisos (loja_id, para_id, texto, link)
    select new.loja_id, p.id, 'Pedido novo #' || new.numero || ' (' || new.canal || ')', '/pedidos/' || new.id
    from public.perfis p where p.loja_id = new.loja_id and p.papel = 'dono';
  end if;
  return new;
end;
$$;
drop trigger if exists ao_criar_pedido on public.pedidos;
create trigger ao_criar_pedido after insert on public.pedidos
  for each row execute function public.avisar_pedido_novo();

-- ===== Suporte por chat =====
create table if not exists public.suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null references public.lojas(id) on delete cascade,
  autor_id uuid references auth.users(id) on delete set null,
  autor_nome text not null,
  da_equipe boolean not null default false,
  texto text not null check (length(texto) between 1 and 4000),
  lida boolean not null default false,
  criado_em timestamptz not null default now()
);
create index if not exists suporte_loja on public.suporte_mensagens (loja_id, criado_em);
alter table public.suporte_mensagens enable row level security;
drop policy if exists "suporte: ver" on public.suporte_mensagens;
create policy "suporte: ver" on public.suporte_mensagens for select
  using (loja_id = public.minha_loja() or public.sou_atendente());
revoke insert, update, delete on public.suporte_mensagens from authenticated;
grant select on public.suporte_mensagens to authenticated;

-- Enviar mensagem: lojista manda para a própria loja; atendente responde a qualquer loja
create or replace function public.enviar_suporte(texto_msg text, para_loja uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  eu record;
  atendente boolean := public.sou_atendente();
  destino uuid;
begin
  select id, loja_id, nome into eu from public.perfis where id = auth.uid();
  if eu.id is null then raise exception 'Faça login novamente.'; end if;
  if coalesce(trim(texto_msg), '') = '' then raise exception 'Escreva a mensagem.'; end if;
  if para_loja is not null and para_loja <> eu.loja_id then
    if not atendente then raise exception 'Sem permissão.'; end if;
    destino := para_loja;
    insert into public.suporte_mensagens (loja_id, autor_id, autor_nome, da_equipe, texto)
    values (destino, eu.id, 'Suporte Synvora', true, trim(texto_msg));
    -- a resposta chegou: avisa o dono da loja
    insert into public.avisos (loja_id, para_id, texto, link)
    select destino, p.id, 'O suporte Synvora respondeu sua mensagem', '/suporte'
    from public.perfis p where p.loja_id = destino and p.papel = 'dono';
    update public.suporte_mensagens set lida = true where loja_id = destino and not da_equipe;
  else
    insert into public.suporte_mensagens (loja_id, autor_id, autor_nome, da_equipe, texto)
    values (eu.loja_id, eu.id, eu.nome, false, trim(texto_msg));
  end if;
end;
$$;
revoke execute on function public.enviar_suporte(text, uuid) from public, anon;
grant execute on function public.enviar_suporte(text, uuid) to authenticated;

-- Atendente lista as conversas de todas as lojas
create or replace function public.conversas_suporte()
returns table (loja_id uuid, loja_nome text, ultima text, ultima_em timestamptz, nao_lidas bigint)
language sql stable security definer set search_path = public as $$
  select m.loja_id, l.nome,
         (array_agg(m.texto order by m.criado_em desc))[1],
         max(m.criado_em),
         count(*) filter (where not m.da_equipe and not m.lida)
  from public.suporte_mensagens m join public.lojas l on l.id = m.loja_id
  where public.sou_atendente()
  group by m.loja_id, l.nome
  order by count(*) filter (where not m.da_equipe and not m.lida) desc, max(m.criado_em) desc
$$;
revoke execute on function public.conversas_suporte() from public, anon;
grant execute on function public.conversas_suporte() to authenticated;

-- ================================================================
-- fotos.sql
-- ================================================================
-- Synvora: fotos da loja (logo) e dos produtos.
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run. Pode rodar mais de uma vez.

create or replace function public.minha_loja()
returns uuid language sql stable security definer set search_path = public as $$
  select loja_id from public.perfis where id = auth.uid()
$$;
create or replace function public.sou_dono()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where id = auth.uid() and papel = 'dono')
$$;
grant execute on function public.minha_loja() to authenticated;
grant execute on function public.sou_dono() to authenticated;

alter table public.lojas add column if not exists logo_url text;
grant update (logo_url) on public.lojas to authenticated;

-- Pastas de fotos públicas (qualquer um vê; só o dono da loja envia para a pasta da própria loja)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('logos', 'logos', true, 5242880, array['image/jpeg','image/png','image/webp']),
       ('produtos', 'produtos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$
declare b text;
begin
  foreach b in array array['logos','produtos'] loop
    execute format('drop policy if exists %I on storage.objects', b || ': ver');
    execute format('drop policy if exists %I on storage.objects', b || ': dono envia');
    execute format('drop policy if exists %I on storage.objects', b || ': dono troca');
    execute format('drop policy if exists %I on storage.objects', b || ': dono apaga');
    execute format('create policy %I on storage.objects for select using (bucket_id = %L)', b || ': ver', b);
    execute format('create policy %I on storage.objects for insert to authenticated with check (bucket_id = %L and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono())', b || ': dono envia', b);
    execute format('create policy %I on storage.objects for update to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono())', b || ': dono troca', b);
    execute format('create policy %I on storage.objects for delete to authenticated using (bucket_id = %L and (storage.foldername(name))[1] = public.minha_loja()::text and public.sou_dono())', b || ': dono apaga', b);
  end loop;
end $$;

-- ================================================================
-- ceo.sql
-- ================================================================
-- Synvora: página do CEO (só o dono do Synvora vê; lojistas e equipe não).
-- Para virar CEO, rode uma vez (troque pelo seu usuário):
--   insert into public.ceos (user_id) select id from public.perfis where usuario = 'seu.usuario';

create table if not exists public.ceos (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.ceos enable row level security;
revoke all on public.ceos from authenticated, anon;

create or replace function public.sou_ceo()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.ceos where user_id = auth.uid())
$$;
revoke execute on function public.sou_ceo() from public, anon;
grant execute on function public.sou_ceo() to authenticated;

-- Plano e situação de cada loja (por enquanto você marca à mão; depois ligamos ao pagamento)
alter table public.lojas add column if not exists plano text not null default 'mensal';
alter table public.lojas add column if not exists situacao text not null default 'ativa';
alter table public.lojas add column if not exists plano_desde timestamptz not null default now();
alter table public.lojas add column if not exists cancelada_em timestamptz;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'lojas_plano_ok') then
    alter table public.lojas add constraint lojas_plano_ok check (plano in ('mensal','anual','vitalicio'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'lojas_situacao_ok') then
    alter table public.lojas add constraint lojas_situacao_ok check (situacao in ('ativa','cancelada'));
  end if;
end $$;

-- Lista de todas as lojas com os números de cada uma
create or replace function public.ceo_lojas()
returns table (
  id uuid, nome text, criado_em timestamptz, plano text, situacao text, plano_desde timestamptz,
  dono_nome text, dono_usuario text, usuarios bigint, pedidos bigint, ultimo_pedido timestamptz,
  chamados_abertos bigint, atendente text
)
language sql stable security definer set search_path = public as $$
  select l.id, l.nome, l.criado_em, l.plano, l.situacao, l.plano_desde,
    (select p.nome from public.perfis p where p.loja_id = l.id and p.papel = 'dono' order by p.criado_em limit 1),
    (select p.usuario from public.perfis p where p.loja_id = l.id and p.papel = 'dono' order by p.criado_em limit 1),
    (select count(*) from public.perfis p where p.loja_id = l.id),
    (select count(*) from public.pedidos o where o.loja_id = l.id and not o.cancelado),
    (select max(o.criado_em) from public.pedidos o where o.loja_id = l.id),
    (select count(*) from public.suporte_mensagens m where m.loja_id = l.id and not m.da_equipe and not m.lida),
    (select p.nome from public.suporte_mensagens m join public.perfis p on p.id = m.autor_id
      where m.loja_id = l.id and m.da_equipe order by m.criado_em desc limit 1)
  from public.lojas l
  where public.sou_ceo()
  order by l.criado_em desc
$$;
revoke execute on function public.ceo_lojas() from public, anon;
grant execute on function public.ceo_lojas() to authenticated;

-- CEO muda o plano ou a situação de uma loja
create or replace function public.ceo_alterar_loja(loja uuid, novo_plano text, nova_situacao text)
returns void language plpgsql security definer set search_path = public as $$
declare atual record;
begin
  if not public.sou_ceo() then raise exception 'Sem permissão.'; end if;
  select plano, situacao into atual from public.lojas where id = loja;
  if not found then raise exception 'Loja não encontrada.'; end if;
  if novo_plano = 'vitalicio' and atual.plano <> 'vitalicio'
     and (select count(*) from public.lojas where plano = 'vitalicio') >= 10 then
    raise exception 'As 10 vagas do vitalício já foram usadas.';
  end if;
  update public.lojas set
    plano = novo_plano,
    situacao = nova_situacao,
    plano_desde = case when novo_plano <> atual.plano then now() else plano_desde end,
    cancelada_em = case when nova_situacao = 'cancelada' and atual.situacao <> 'cancelada' then now()
                        when nova_situacao = 'ativa' then null else cancelada_em end
  where id = loja;
end;
$$;
revoke execute on function public.ceo_alterar_loja(uuid, text, text) from public, anon;
grant execute on function public.ceo_alterar_loja(uuid, text, text) to authenticated;

-- Se ainda não há nenhum CEO, o primeiro dono cadastrado no Synvora (a conta mais antiga) vira CEO.
insert into public.ceos (user_id)
select p.id from public.perfis p
where p.papel = 'dono' and not exists (select 1 from public.ceos)
order by p.criado_em
limit 1
on conflict do nothing;

-- O CEO também atende o suporte (vê e responde as conversas de todas as lojas)
create or replace function public.sou_atendente()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.atendentes where user_id = auth.uid())
      or exists (select 1 from public.ceos where user_id = auth.uid())
$$;
grant execute on function public.sou_atendente() to authenticated;

-- Resposta da equipe sempre sai como "Suporte Synvora", mesmo quando a loja é a sua
create or replace function public.enviar_suporte(texto_msg text, para_loja uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  eu record;
  atendente boolean := public.sou_atendente();
begin
  select id, loja_id, nome into eu from public.perfis where id = auth.uid();
  if eu.id is null then raise exception 'Faça login novamente.'; end if;
  if coalesce(trim(texto_msg), '') = '' then raise exception 'Escreva a mensagem.'; end if;
  if para_loja is not null then
    if not atendente then raise exception 'Sem permissão.'; end if;
    insert into public.suporte_mensagens (loja_id, autor_id, autor_nome, da_equipe, texto)
    values (para_loja, eu.id, 'Suporte Synvora', true, trim(texto_msg));
    insert into public.avisos (loja_id, para_id, texto, link)
    select para_loja, p.id, 'O suporte Synvora respondeu sua mensagem', '/suporte'
    from public.perfis p where p.loja_id = para_loja and p.papel = 'dono';
    update public.suporte_mensagens set lida = true where loja_id = para_loja and not da_equipe;
  else
    insert into public.suporte_mensagens (loja_id, autor_id, autor_nome, da_equipe, texto)
    values (eu.loja_id, eu.id, eu.nome, false, trim(texto_msg));
  end if;
end;
$$;
revoke execute on function public.enviar_suporte(text, uuid) from public, anon;
grant execute on function public.enviar_suporte(text, uuid) to authenticated;

-- ================================================================
-- catalogo.sql
-- ================================================================
-- Synvora: catálogo para Facebook e Instagram (Gerenciador de Comércio da Meta)
-- Cada loja tem um link secreto do catálogo. A Meta lê esse link sozinha e mantém preço e estoque em dia.

alter table public.lojas add column if not exists catalogo_token uuid not null default gen_random_uuid();
create unique index if not exists lojas_catalogo_token on public.lojas (catalogo_token);

-- Dono gera um link novo (o antigo para de funcionar)
create or replace function public.novo_catalogo_token()
returns uuid language plpgsql security definer set search_path = public as $$
declare novo uuid := gen_random_uuid();
begin
  if not public.sou_dono() then raise exception 'Só o dono pode fazer isso.'; end if;
  update public.lojas set catalogo_token = novo where id = public.minha_loja();
  return novo;
end;
$$;
revoke execute on function public.novo_catalogo_token() from public, anon;
grant execute on function public.novo_catalogo_token() to authenticated;

-- Produtos do catálogo (lido pela Meta, sem login, só com o link secreto)
create or replace function public.catalogo_publico(token uuid)
returns table (id uuid, nome text, categoria text, preco numeric, saldo integer, foto_url text, loja_nome text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.categoria, p.preco, p.saldo, p.foto_url, l.nome
  from public.produtos p join public.lojas l on l.id = p.loja_id
  where l.catalogo_token = token and l.situacao = 'ativa'
  order by p.nome
$$;
revoke execute on function public.catalogo_publico(uuid) from public;
grant execute on function public.catalogo_publico(uuid) to anon, authenticated;

-- Página pública de um produto (para onde o Facebook/Instagram leva o cliente)
create or replace function public.produto_publico(pid uuid)
returns table (id uuid, nome text, categoria text, preco numeric, saldo integer, foto_url text,
               loja_nome text, loja_logo text, telefone text, instagram text, endereco text)
language sql stable security definer set search_path = public as $$
  select p.id, p.nome, p.categoria, p.preco, p.saldo, p.foto_url,
         l.nome, l.logo_url, l.telefone, l.instagram, l.endereco
  from public.produtos p join public.lojas l on l.id = p.loja_id
  where p.id = pid and l.situacao = 'ativa'
$$;
revoke execute on function public.produto_publico(uuid) from public;
grant execute on function public.produto_publico(uuid) to anon, authenticated;

-- Números gerais do Synvora para o site de apresentação (só totais, nada de nenhuma loja específica)
create or replace function public.numeros_publicos()
returns table (vendas bigint, produtos bigint, lojas bigint)
language sql stable security definer set search_path = public as $$
  select (select count(*) from public.pedidos where not cancelado),
         (select count(*) from public.produtos),
         (select count(*) from public.lojas where situacao = 'ativa')
$$;
revoke execute on function public.numeros_publicos() from public;
grant execute on function public.numeros_publicos() to anon, authenticated;

-- ================================================================
-- versao.sql
-- ================================================================
-- Marca a versão do banco. O sistema confere isto e avisa no Painel se faltar atualizar.
create or replace function public.versao_banco()
returns integer language sql stable as $$ select 9 $$;
grant execute on function public.versao_banco() to anon, authenticated;

-- Faz o Supabase enxergar na hora as tabelas e funções novas
notify pgrst, 'reload schema';
