export type TipoAvisoCadastro = "novo_cliente" | "nova_alteracao";

export type AvisoCadastroDto = {
  id: string;
  tipo: TipoAvisoCadastro;
  clienteId: string;
  alteracaoId: string | null;
  criadoEm: string;
  vistoEm: string | null;
};

// Posição do último item da página: a lista é ordenada por (visto, criado_em desc, id desc).
export type CursorAvisoCadastro = { visto: boolean; criadoEm: string; id: string };

export type PaginaAvisosCadastro = {
  itens: AvisoCadastroDto[];
  proximoCursor: CursorAvisoCadastro | null;
};
