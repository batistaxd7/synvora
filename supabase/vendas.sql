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
