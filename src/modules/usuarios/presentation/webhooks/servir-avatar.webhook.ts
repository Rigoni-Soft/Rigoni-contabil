import { makeObterAvatar } from "@/main/usuarios.factory";

const STATUS_POR_CODIGO: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 401,
};

// `/api/avatar`: a foto do próprio usuário da sessão (ADR 0012). Não recebe id: não há como pedir a de
// outro. `private` mantém a imagem fora de cache compartilhado (proxy/CDN); o `?v=` do avatar renova o
// cache do navegador a cada troca ou remoção.
export async function GET(): Promise<Response> {
  const obterAvatar = await makeObterAvatar();
  const resultado = await obterAvatar.execute();

  if (!resultado.ok) {
    return new Response(null, {
      status: STATUS_POR_CODIGO[resultado.error.code] ?? 500,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return new Response(Buffer.from(resultado.value), {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
