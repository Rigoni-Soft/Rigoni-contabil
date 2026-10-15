// A conversa é lida e atualizada por janela: as Mensagens mais recentes, e o histórico anterior sob
// demanda, a partir de um cursor estável (data da Mensagem e, no empate, o id). Sem isso, o limite
// de linhas da API (`max_rows`) cortaria as Mensagens novas de uma conversa longa.
export const CONVERSA_JANELA_MENSAGENS = 100;

// Quantas Mensagens um pedido de renovação de links aceita (o cliente manda só as que estão
// vencendo, em lote).
export const RENOVACAO_LINKS_MAXIMO = 50;

export type CursorDaConversa = { criadoEm: string; id: string };
