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
