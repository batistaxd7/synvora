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

## Atualizações do banco (rode na ordem, uma vez cada)

No Supabase, *SQL Editor > New query*, cole e clique em *Run*:

1. `supabase/schema.sql`
2. `supabase/permissoes.sql`
3. `supabase/equipe.sql`
4. `supabase/seguranca.sql`
5. `supabase/vendas.sql` (etapa 2: caixa, pedidos e recibo)

## Estado atual (etapa 2)

- Cadastro da loja e login por nome de usuário e senha
- Dados separados por loja (RLS no banco)
- Equipe: o dono cria acessos de vendedor/afiliado e caixa
- Painel com vendido hoje, pedidos em andamento e estoque baixo
- Estoque (cadastro e lista de produtos)
- Frente de caixa: busca, carrinho, desconto, pagamento dividido (dinheiro, Pix, crédito, débito) e troco; o estoque baixa na hora
- Pedidos: lista limpa com selo (não atendido, atendido, concluída, cancelada), filtros e busca; ao abrir, etapas novo → separando → pronto pra enviar → enviado → entregue com botão de avançar
- Cancelamento pergunta se os produtos voltam ao estoque e registra quem cancelou
- Recibo para imprimir (formato de bobina 80 mm)
- Histórico de vendas guardado para sempre; pedidos só mudam pelas funções do banco

Ainda não feito: abertura/fechamento de caixa, clientes, gastos, financeiro, tarefas, suporte, planos, importação de planilha, fotos, registro de atividades.
