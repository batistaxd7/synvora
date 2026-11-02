import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const ROTAS_PRIVADAS = ["/painel", "/estoque", "/equipe", "/caixa", "/pedidos", "/recibo", "/clientes", "/gastos", "/financeiro", "/tarefas", "/perfil-da-loja", "/conta-e-plano", "/suporte", "/atendimento", "/ceo"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getSession lê o login do cookie (e renova se venceu) sem consultar o Supabase a cada clique.
  // A conferência de verdade continua no layout (getUser) e nas regras do banco (RLS).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const caminho = request.nextUrl.pathname;
  const privada = ROTAS_PRIVADAS.some((r) => caminho.startsWith(r));

  if (!user && privada) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (user && (caminho === "/login" || caminho === "/cadastro" || caminho === "/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/painel";
    return NextResponse.redirect(url);
  }
  if (!user && caminho === "/") {
    // Visitante sem login vê a página de venda do Synvora.
    const url = request.nextUrl.clone();
    url.pathname = "/inicio.html";
    return NextResponse.rewrite(url);
  }
  return response;
}
