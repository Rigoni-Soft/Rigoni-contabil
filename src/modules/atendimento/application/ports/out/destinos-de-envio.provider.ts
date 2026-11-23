import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";
import type { TipoDeEnvio } from "@/shared/kernel/tipo-de-envio";

export const MOTIVOS_DE_DESTINO_INVALIDO = ["sem_whatsapp", "sem_email"] as const;
export type MotivoDeDestinoInvalido = (typeof MOTIVOS_DE_DESTINO_INVALIDO)[number];

// Um Destino de envio já resolvido: o Contato que recebe, o canal que o Setor escolheu e o que a
// entrega precisa dele. `telefone` já vem com o DDI; ele e o e-mail existem sempre que o canal os usa.
export type DestinoDeEnvio = {
  contatoNome: string;
  telefone: string | null;
  email: string | null;
  canal: FormaEnvioValor;
  // Última Mensagem do Contato em qualquer Atendimento do telefone (abre/fecha a janela de 24h).
  ultimaMensagemDoContatoEm: Date | null;
  // Por que o Destino não vale (o canal gravado sumiu do Contato); null = válido.
  motivoInvalido: MotivoDeDestinoInvalido | null;
};

// Sem nenhum Destino válido não há para quem enviar.
export const haDestinoValido = (destinos: DestinoDeEnvio[]) =>
  destinos.some((destino) => destino.motivoInvalido === null);

export interface DestinosDeEnvioPort {
  // Quem recebe o envio do `tipo` do Setor para o Cliente: os Destinos do tipo e, sem nenhum, os de
  // "todos os envios". Traz também os inválidos (o canal sumiu do Contato), com o motivo: o chamador
  // entrega os válidos e reporta os inválidos. Sem nenhum válido = sem para quem enviar.
  resolver(
    clienteId: string,
    setor: SetorSlug,
    tipo: TipoDeEnvio,
  ): Promise<Result<DestinoDeEnvio[], AppError>>;
}
