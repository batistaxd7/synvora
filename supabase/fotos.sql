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
