import type { ContatoProps } from "@/modules/clientes/domain/value-objects/contato.vo";

// Embed de `cliente_contatos` com os Setores do Contato, para todo select que traz Contatos.
export const EMBED_CONTATOS = "cliente_contatos(*, cliente_contato_setores(setor))";

export type ContatoRow = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  dono_setor: string | null;
  cliente_contato_setores?: { setor: string }[] | null;
};

export function contatoDoRow(row: ContatoRow): ContatoProps {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone ?? "",
    email: row.email ?? "",
    donoSetor: row.dono_setor,
    setores: (row.cliente_contato_setores ?? []).map((v) => v.setor),
  };
}

// O que vai ao banco: só o que o dono edita. Sem `id` o contato é novo (`salvar_contato_do_cliente`).
export function contatoParaRpc(contato: Pick<ContatoProps, "id" | "nome" | "telefone" | "email">) {
  return {
    id: contato.id ?? null,
    nome: contato.nome,
    telefone: contato.telefone,
    email: contato.email,
  };
}

// Na lista (`salvar_contatos_do_cliente`) todo contato leva id.
export function contatoParaSalvar(contato: ContatoProps) {
  return { ...contatoParaRpc(contato), id: contato.id ?? crypto.randomUUID() };
}
