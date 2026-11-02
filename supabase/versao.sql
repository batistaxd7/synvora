-- Marca a versão do banco. O sistema confere isto e avisa no Painel se faltar atualizar.
create or replace function public.versao_banco()
returns integer language sql stable as $$ select 5 $$;
grant execute on function public.versao_banco() to anon, authenticated;
