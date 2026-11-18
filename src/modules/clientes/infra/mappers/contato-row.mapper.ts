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

// O que vai ao banco (`salvar_contatos_do_cliente`): só o que o dono edita, sempre com id.
export function contatoParaSalvar(contato: ContatoProps) {
  return {
    id: contato.id ?? crypto.randomUUID(),
    nome: contato.nome,
    telefone: contato.telefone,
    email: contato.email,
  };
}
