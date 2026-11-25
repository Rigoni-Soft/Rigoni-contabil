export type TipoAvisoCadastro = "novo_cliente" | "nova_alteracao" | "sem_meio_de_envio";

export type AvisoCadastroDto = {
  id: string;
  tipo: TipoAvisoCadastro;
  clienteId: string;
  alteracaoId: string | null;
  alteracaoNumero: number | null;
  mensagem: string | null;
  criadoEm: string;
  vistoEm: string | null;
};

export type CursorAvisoCadastro = { visto: boolean; criadoEm: string; id: string };

export type PaginaAvisosCadastro = {
  itens: AvisoCadastroDto[];
  proximoCursor: CursorAvisoCadastro | null;
};
