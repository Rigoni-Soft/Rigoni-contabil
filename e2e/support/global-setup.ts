import {
  marcarAvisosComoVistos,
  removerClientesDeTeste,
} from "../../test-support/clientes-de-teste";
import { limparClientesDoE2E } from "../../test-support/limpeza-e2e";
import { clientesRegistradosDoE2E, esquecerClientesDoE2E } from "./manifesto-de-clientes";

export default async function globalSetup() {
  await limparClientesDoE2E({
    baseUrl: process.env.BASE_URL,
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321",
    cnpjs: clientesRegistradosDoE2E(),
    remover: removerClientesDeTeste,
    zerarAvisos: marcarAvisosComoVistos,
  });
  esquecerClientesDoE2E();
}
