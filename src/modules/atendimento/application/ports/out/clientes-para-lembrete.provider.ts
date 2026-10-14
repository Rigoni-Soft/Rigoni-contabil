import type { AppError } from "@/shared/errors/app.error";
import type { DasStatusValor } from "@/shared/kernel/das-status";
import type { DocumentoObrigatorioStatusValor } from "@/shared/kernel/documento-obrigatorio-status";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";

// Cliente do Simples Nacional com o que o job de lembrete/DAS precisa saber dele.
export type ClienteParaLembrete = {
  clienteId: string;
  empresa: string;
  formaEnvio: FormaEnvioValor;
  documentoObrigatorio: DocumentoObrigatorioStatusValor | null;
  dasStatus: DasStatusValor | null;
  dataEnvioDas: string | null; // AAAA-MM-DD
  contato: { nome: string; telefone: string } | null;
  email: string | null;
  // Última Mensagem do contato em qualquer Atendimento do telefone (abre/fecha a janela de 24h).
  ultimaMensagemDoContatoEm: Date | null;
};

export interface ClientesParaLembretePort {
  listar(): Promise<Result<ClienteParaLembrete[], AppError>>;
  // DAS pronto → enviado com a data de envio, auditado com a URA como ator. `false` se o DAS já
  // não estava pronto (outro job ou o Funcionário mexeu antes): quem não reivindicou não envia.
  reivindicarDas(clienteId: string, dataIso: string): Promise<Result<boolean, AppError>>;
  // A entrega falhou: devolve o DAS a pronto, com a data de envio que tinha antes.
  desfazerDas(clienteId: string, dataAnterior: string | null): Promise<Result<void, AppError>>;
}
