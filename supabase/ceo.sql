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
