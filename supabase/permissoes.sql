-- Permissões de acesso às tabelas para usuários logados.
-- A segurança por loja continua garantida pelas regras (RLS) do schema.sql.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.minha_loja() to authenticated;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
