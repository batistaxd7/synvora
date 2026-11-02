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
