import { soDigitos } from "@/shared/kernel/telefone";

import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";

const CAMPOS_DO_CONTATO = ["nome", "telefone", "email"] as const;

// O que a validação do contato recusou, campo a campo (problema fora dos três campos cai no Nome).
export function problemasDosCampos(contato: ValoresDaLinha) {
  const valido = contatoSchema.safeParse(contato);
  if (valido.success) return [];
  return valido.error.issues.map((problema) => ({
    campo: CAMPOS_DO_CONTATO.find((c) => c === problema.path[0]) ?? "nome",
    mensagem: problema.message,
  }));
}

export type ValoresDaLinha = EditarCadastroOperacionalFormValues["contatos"][number];

// O contato como estava quando a edição abriu: o Cancelar volta a ele e o Salvar só grava o que mudou.
export type Instantaneo = {
  nome: string;
  telefone: string;
  email: string;
  tipos: string[];
  canal: string;
};

export function instantaneoDe(
  contato: Pick<ValoresDaLinha, "nome" | "telefone" | "email" | "canal">,
  tipos: string[],
): Instantaneo {
  return {
    nome: contato.nome,
    telefone: contato.telefone,
    email: contato.email,
    tipos: [...tipos],
    canal: contato.canal ?? "",
  };
}

export const emBranco = (contato: ValoresDaLinha) =>
  !contato.nome.trim() &&
  !soDigitos(contato.telefone) &&
  !contato.email.trim() &&
  !contato.tipos?.length;

export const mesmosTipos = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tipo) => b.includes(tipo));

// Nome, WhatsApp ou e-mail diferentes do que estava gravado (o telefone compara só os dígitos).
export function camposMudaram(antes: Instantaneo | undefined, contato: ValoresDaLinha): boolean {
  if (!contato.id || !antes) return true;
  return (
    antes.nome.trim() !== contato.nome.trim() ||
    soDigitos(antes.telefone) !== soDigitos(contato.telefone) ||
    antes.email.trim().toLowerCase() !== contato.email.trim().toLowerCase()
  );
}

// O que o contato recebe (ou o canal do envio) mudou desde que a edição abriu; sem instantâneo, basta ter envio.
export function enviosMudaram(
  antes: Instantaneo | undefined,
  contato: ValoresDaLinha,
  tipos: string[],
  exigeCanal: boolean,
): boolean {
  if (!antes) return tipos.length > 0;
  return !mesmosTipos(antes.tipos, tipos) || (exigeCanal && antes.canal !== (contato.canal ?? ""));
}
