import { criarAdminLocal } from "../../test-support/admin-supabase-local";
import { removerClientesDeTeste } from "../../test-support/clientes-de-teste";
import { limparClientesDoE2E } from "../../test-support/limpeza-e2e";
import { clientesRegistradosDoE2E, esquecerClientesDoE2E } from "./manifesto-de-clientes";

// Chave de serviço do Supabase local (a mesma de demonstração das suítes de integração).
const CHAVE_DE_SERVICO_LOCAL =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU";

// Os e2e cadastram Clientes "… E2E …" e nunca os apagam: na rodada seguinte os CNPJs fixos colidem
// e a busca devolve nomes repetidos. Limpa só os que as execuções anteriores registraram, e só no
// Supabase local (ver `limparClientesDoE2E`).
export default async function globalSetup() {
  await limparClientesDoE2E({
    baseUrl: process.env.BASE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    cnpjs: clientesRegistradosDoE2E(),
    remover: removerClientesDeTeste,
    // Avisos de cadastro de rodadas passadas passam de 99 e o selo do sino vira "99+".
    zerarAvisos: async () => {
      const admin = criarAdminLocal(
        process.env.SUPABASE_SERVICE_ROLE_KEY ?? CHAVE_DE_SERVICO_LOCAL,
        process.env.NEXT_PUBLIC_SUPABASE_URL,
      );
      const { error } = await admin
        .from("avisos_cadastro")
        .update({ visto_em: new Date().toISOString() })
        .is("visto_em", null);
      if (error) throw new Error(`Falha ao zerar os Avisos de cadastro: ${error.message}`);
    },
  });
  esquecerClientesDoE2E();
}
