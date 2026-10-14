import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

// Os e2e cadastram Clientes pela interface e nunca os apagam. Cada CNPJ criado é anotado aqui, e a
// limpeza da rodada seguinte apaga SÓ eles (nunca um filtro por nome). O arquivo vive em
// `test-results/` (fora do versionamento).
const ARQUIVO = "test-results/e2e-clientes-criados.txt";

// CNPJs literais que `cadastro-cliente.e2e.ts` digita no formulário.
export const CNPJS_FIXOS_DO_E2E = ["11444777000161", "11222333000181", "12345678000195"] as const;

export function registrarClienteDoE2E(cnpj: string): void {
  mkdirSync(dirname(ARQUIVO), { recursive: true });
  appendFileSync(ARQUIVO, `${cnpj}\n`);
}

export function clientesRegistradosDoE2E(): string[] {
  const anotados = existsSync(ARQUIVO)
    ? readFileSync(ARQUIVO, "utf8").split("\n").filter(Boolean)
    : [];
  return [...new Set([...CNPJS_FIXOS_DO_E2E, ...anotados])];
}

export function esquecerClientesDoE2E(): void {
  if (existsSync(ARQUIVO)) writeFileSync(ARQUIVO, "");
}
