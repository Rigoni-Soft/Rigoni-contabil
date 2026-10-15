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
  // Todos os Clientes do Cadastro operacional (leitura paginada por cursor, completa ou erro).
  listar(): Promise<Result<ClienteParaLembrete[], AppError>>;
  // Reserva a entrega do DAS: devolve o token da tentativa, ou null se o DAS já não está pronto
  // (outro job ou o Funcionário mexeu antes) ou outra tentativa vigente o reservou. Não muda o
  // estado do DAS: ele só vira enviado ao concluir.
  reservarDas(clienteId: string): Promise<Result<string | null, AppError>>;
  // A entrega foi aceita: DAS pronto → enviado com a data de envio, auditado com a URA como ator,
  // só com a posse da reserva (token). false: sem a posse ou o Funcionário já havia mexido.
  concluirDas(
    clienteId: string,
    token: string,
    dataIso: string,
  ): Promise<Result<boolean, AppError>>;
  // A entrega falhou sem aceite: libera a reserva (token antigo não libera a de outra tentativa).
  liberarDas(clienteId: string, token: string): Promise<Result<void, AppError>>;
}
