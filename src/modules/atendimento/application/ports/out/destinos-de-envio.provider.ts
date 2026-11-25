import type { AppError } from "@/shared/errors/app.error";
import type { FormaEnvioValor } from "@/shared/kernel/forma-envio";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";
import type { TipoDeEnvio } from "@/shared/kernel/tipo-de-envio";

export const MOTIVOS_DE_DESTINO_INVALIDO = ["sem_whatsapp", "sem_email"] as const;
export type MotivoDeDestinoInvalido = (typeof MOTIVOS_DE_DESTINO_INVALIDO)[number];

export type DestinoDeEnvio = {
  contatoNome: string;
  telefone: string | null;
  email: string | null;
  canal: FormaEnvioValor;
  ultimaMensagemDoContatoEm: Date | null;
  motivoInvalido: MotivoDeDestinoInvalido | null;
};

export const haDestinoValido = (destinos: DestinoDeEnvio[]) =>
  destinos.some((destino) => destino.motivoInvalido === null);

export interface DestinosDeEnvioPort {
  resolver(
    clienteId: string,
    setor: SetorSlug,
    tipo: TipoDeEnvio,
  ): Promise<Result<DestinoDeEnvio[], AppError>>;
}
