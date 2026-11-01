# Synvora

Sistema de gestão para lojistas (loja física + e-commerce).

Stack: Next.js 14 (App Router) + Supabase (banco e login) + Vercel (hospedagem).

## Como colocar no ar (primeira vez)

1. **Supabase**: crie um projeto. Em *SQL Editor > New query*, cole o conteúdo de `supabase/schema.sql` e clique em *Run*.
2. **Supabase > Authentication > Providers > Email**: desligue **Confirm email** (o login é por nome de usuário; o e-mail real só serve para recuperar a senha).
3. **Supabase > Project Settings > API**: copie a *Project URL* e a chave **anon public**. Nunca use a `service_role`.
4. **Vercel**: *Add New > Project*, escolha este repositório e, em *Environment Variables*, crie:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
5. Clique em *Deploy*.

## Estado atual (etapa 1)

- Cadastro da loja e login por nome de usuário e senha
- Dados separados por loja (RLS no banco)
- Painel simples e Estoque (cadastro e lista de produtos)

Ainda não feito: caixa, pedidos, gastos, financeiro, clientes, tarefas, suporte, planos, importação de planilha, fotos.
