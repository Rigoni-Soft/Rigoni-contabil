import { z } from "zod";

import type {
  ContatoEditavel,
  ContatoProps,
} from "@/modules/clientes/domain/value-objects/contato.vo";

export const EMBED_CONTATOS = "cliente_contatos(*, cliente_contato_setores(setor))";

export const contatoRowSchema = z.object({
  id: z.string(),
  nome: z.string(),
  telefone: z.string().nullable(),
  email: z.string().nullable(),
  dono_setor: z.string().nullable(),
  cliente_contato_setores: z
    .array(z.object({ setor: z.string() }))
    .nullable()
    .optional(),
});
export type ContatoRow = z.infer<typeof contatoRowSchema>;

export function contatoDoRow(row: ContatoRow): ContatoProps {
  return {
    id: row.id,
    nome: row.nome,
    telefone: row.telefone ?? "",
    email: row.email ?? "",
    donoSetor: row.dono_setor,
    setores: (row.cliente_contato_setores ?? []).map((v) => v.setor),
    telefoneOriginal: row.telefone ?? "",
  };
}

export function contatoParaRpc(contato: ContatoEditavel) {
  return {
    id: contato.id ?? null,
    nome: contato.nome,
    telefone: contato.telefone,
    email: contato.email,
  };
}
