import type { ComunicacaoSemContato } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { TipoAlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { DestinoDeEnvio } from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type EntregarComunicacaoInput = {
  cliente: { empresa: string };
  destinos: DestinoDeEnvio[];
  comunicacao: ComunicacaoSemContato;
  agora: Date;
};

export type OcorrenciaDeEntrega = { tipo: TipoAlertaSetor; mensagem: string; setor?: SetorSlug };

export type ComunicacaoEntregue = {
  entregues: number;
  ocorrencias: OcorrenciaDeEntrega[];
};

export interface EntregarComunicacaoPorCanaisPort {
  execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>>;
}
