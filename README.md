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

## Banco de dados (um arquivo só)

No Supabase, *SQL Editor > New query*, cole **todo** o conteúdo de `supabase/tudo.sql` e clique em *Run*.
Pode rodar quantas vezes quiser: ele só cria ou atualiza o que falta, sem apagar dados.
Quando o banco estiver desatualizado, o próprio Synvora mostra um aviso no topo para o dono.

(Os arquivos separados continuam na pasta `supabase/`; o `tudo.sql` é gerado juntando todos com `supabase/gerar-tudo.sh`.)

### Virar atendente do suporte

Para responder os lojistas na tela **Atendimento**, rode uma vez no SQL Editor (troque pelo seu usuário):

```sql
insert into public.atendentes (user_id) select id from public.perfis where usuario = 'seu.usuario';
```

### Virar CEO (Painel do CEO)

Para ver a tela **Painel do CEO** (todas as lojas, planos, receita, vagas do vitalício e suporte aberto), rode uma vez no SQL Editor (troque pelo seu usuário):

```sql
insert into public.ceos (user_id) select id from public.perfis where usuario = 'seu.usuario';
```

## Estado atual (etapa 3)

- Login por usuário e senha; dados separados por loja (RLS)
- Painel, Estoque, Equipe
- Frente de caixa com pagamento dividido, troco e sugestão de clientes
- Pedidos com selo de status, etapas, cancelamento com devolução ao estoque e recibo
- Clientes (cadastro, busca e total comprado)
- Gastos da empresa por mês, com categorias, pago/a pagar e fornecedores
- Financeiro: faturamento, gastos, lucro, ticket médio, vendas por dia, por forma de pagamento, vendedor, canal e categoria de gasto
- Tarefas: dono cria para a equipe com prazo e prioridade; funcionário conclui com musiquinha e o dono recebe aviso
- Avisos no sininho: estoque baixo, pedido novo, tarefa concluída, resposta do suporte
- Perfil da loja: logo, dados, meu login, troca de senha e permissão de cada pessoa
- Conta e plano: mensal, anual e vitalício (contratação pelo suporte)
- Suporte por chat (lojista) e Atendimento (equipe Synvora)
- Funcionário vê só caixa, pedidos, clientes, tarefas e suporte

Ainda não feito: abertura/fechamento de caixa, fotos e importação de estoque por planilha, registro de atividades, cobrança automática dos planos, backup/exportação, ajuda/primeiros passos.
