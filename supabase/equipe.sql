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
