-- Limita o que cada usuário logado pode alterar (impede virar dono ou trocar de loja).
revoke insert, update, delete on public.perfis from authenticated;
grant update (nome, email_recuperacao) on public.perfis to authenticated;

revoke insert, update, delete on public.lojas from authenticated;
grant update (nome) on public.lojas to authenticated;

alter table public.produtos drop constraint if exists produtos_saldo_nao_negativo;
alter table public.produtos add constraint produtos_saldo_nao_negativo check (saldo >= 0);
alter table public.produtos drop constraint if exists produtos_preco_nao_negativo;
alter table public.produtos add constraint produtos_preco_nao_negativo check (preco >= 0);
