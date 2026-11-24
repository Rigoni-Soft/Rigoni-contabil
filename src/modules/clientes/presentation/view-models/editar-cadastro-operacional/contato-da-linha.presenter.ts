import { chaveDoTelefone, soDigitos } from "@/shared/kernel/telefone";

import {
  contatoSchema,
  type EditarCadastroOperacionalFormValues,
} from "./editar-cadastro-operacional.schema";

export type ContatoDaLinha = {
  id?: string;
  nome: string;
  telefone: string;
  email: string;
  donoSetor?: string | null;
  setores?: readonly string[];
  canal?: string;
};

const CAMPOS_DO_CONTATO = ["nome", "telefone", "email"] as const;

export function problemasDosCampos(contato: ValoresDaLinha) {
  const valido = contatoSchema.safeParse(contato);
  if (valido.success) return [];
  return valido.error.issues.map((problema) => ({
    campo: CAMPOS_DO_CONTATO.find((c) => c === problema.path[0]) ?? "nome",
    mensagem: problema.message,
  }));
}

export type ValoresDaLinha = EditarCadastroOperacionalFormValues["contatos"][number];

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

const mesmosTipos = (a: string[], b: string[]) =>
  a.length === b.length && a.every((tipo) => b.includes(tipo));

export function camposMudaram(antes: Instantaneo | undefined, contato: ValoresDaLinha): boolean {
  if (!contato.id || !antes) return true;
  return (
    antes.nome.trim() !== contato.nome.trim() ||
    soDigitos(antes.telefone) !== soDigitos(contato.telefone) ||
    antes.email.trim().toLowerCase() !== contato.email.trim().toLowerCase()
  );
}

export function enviosMudaram(
  antes: Instantaneo | undefined,
  contato: ValoresDaLinha,
  tipos: string[],
  exigeCanal: boolean,
): boolean {
  if (!antes) return tipos.length > 0;
  return !mesmosTipos(antes.tipos, tipos) || (exigeCanal && antes.canal !== (contato.canal ?? ""));
}

type AtorDoContato = { admin: boolean; setorDoCadastro: string };

export function contatoEditavel(
  contato: Pick<ContatoDaLinha, "id" | "donoSetor">,
  ator: AtorDoContato,
): boolean {
  if (!contato.id || ator.admin || contato.donoSetor === undefined) return true;
  return contato.donoSetor === ator.setorDoCadastro;
}

export function contatoDoSetor(
  contato: Pick<ContatoDaLinha, "donoSetor" | "setores">,
  setor: string,
): boolean {
  return contato.donoSetor === setor || (contato.setores ?? []).includes(setor);
}

export function contatoDoMesmoNumero<T extends ContatoDaLinha>(
  contatos: readonly T[],
  indiceDaLinha: number,
  telefone: string,
): { indice: number; contato: T } | undefined {
  const chave = chaveDoTelefone(telefone);
  if (!chave) return undefined;
  const indice = contatos.findIndex(
    (c, i) => i !== indiceDaLinha && Boolean(c.id) && chaveDoTelefone(c.telefone) === chave,
  );
  return indice < 0 ? undefined : { indice, contato: contatos[indice] };
}

export function textoDoNumeroRepetido(nome: string, naLista: boolean, porSetor: boolean): string {
  if (!naLista) return `Este número já é do contato ${nome}.`;
  return `Este número já é do contato ${nome}, que já está na lista${porSetor ? " deste Setor" : ""}.`;
}
