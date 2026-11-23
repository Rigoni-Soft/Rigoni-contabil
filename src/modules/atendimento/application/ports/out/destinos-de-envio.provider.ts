import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";
import type { TipoDeEnvio } from "@/shared/kernel/tipo-de-envio";

// Um Destino de envio já resolvido: o Contato que recebe, o canal que o Setor escolheu e o que a
// entrega precisa dele. `telefone` já vem com o DDI; ele e o e-mail existem sempre que o canal os usa.
export type DestinoDeEnvio = {
  contatoNome: string;
  telefone: string | null;
  email: string | null;
  canal: FormaEnvioValor;
  // Última Mensagem do Contato em qualquer Atendimento do telefone (abre/fecha a janela de 24h).
  ultimaMensagemDoContatoEm: Date | null;
};

export interface DestinosDeEnvioPort {
  // Quem recebe o envio do `tipo` do Setor para o Cliente: os Destinos do tipo e, sem nenhum, os de
  // "todos os envios". Só os válidos: o Destino cujo canal sumiu do Contato não entra. Lista vazia =
  // sem para quem enviar.
  resolver(
    clienteId: string,
    setor: SetorSlug,
    tipo: TipoDeEnvio,
  ): Promise<Result<DestinoDeEnvio[], AppError>>;
}
