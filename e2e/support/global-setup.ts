import { removerClientesDeTeste } from "../../test-support/clientes-de-teste";
import { limparClientesDoE2E } from "../../test-support/limpeza-e2e";
import { clientesRegistradosDoE2E, esquecerClientesDoE2E } from "./manifesto-de-clientes";

// Os e2e cadastram Clientes "… E2E …" e nunca os apagam: na rodada seguinte os CNPJs fixos colidem
// e a busca devolve nomes repetidos. Limpa só os que as execuções anteriores registraram, e só no
// Supabase local (ver `limparClientesDoE2E`).
export default async function globalSetup() {
  await limparClientesDoE2E({
    baseUrl: process.env.BASE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    cnpjs: clientesRegistradosDoE2E(),
    remover: removerClientesDeTeste,
  });
  esquecerClientesDoE2E();
}
