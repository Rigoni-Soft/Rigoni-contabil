import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { TipoAlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

export type EntregarComunicacaoInput = {
  cliente: ClienteParaLembrete;
  comunicacao: ComunicacaoProativa;
  agora: Date;
};

// Algo que o setor precisa saber depois da entrega (canal sem destinatário, falha, entrega por um
// canal só). Quem chama decide o que fazer com isso; o caso de uso não grava alerta.
export type OcorrenciaDeEntrega = { tipo: TipoAlertaSetor; mensagem: string };

export type ComunicacaoEntregue = {
  // Canais da forma de envio do Cliente que entregaram (0 = nenhum).
  entregues: number;
  ocorrencias: OcorrenciaDeEntrega[];
};

export interface EntregarComunicacaoPorCanaisPort {
  execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>>;
}
