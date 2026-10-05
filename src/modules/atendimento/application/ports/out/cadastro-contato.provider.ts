import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type ClienteEncontrado = { clienteId: string; empresa: string; temPadrao: boolean };

export interface CadastroContatoPort {
  // `cnpj` normalizado (só [0-9A-Z]). null = nenhum Cliente com esse CNPJ.
  buscarCliente(cnpj: string): Promise<Result<ClienteEncontrado | null, AppError>>;
  // `telefone` só com dígitos, sem DDI. O adapter decide, atomicamente, se o Contato nasce como
  // padrão (Cliente sem padrão) ou como outro Contato.
  cadastrar(contato: {
    clienteId: string;
    nome: string;
    telefone: string;
  }): Promise<Result<{ empresa: string; padrao: boolean }, AppError>>;
}
