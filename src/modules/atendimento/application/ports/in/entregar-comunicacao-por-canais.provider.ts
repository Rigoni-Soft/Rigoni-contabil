import type { ComunicacaoSemContato } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { TipoAlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { DestinoDeEnvio } from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

export type EntregarComunicacaoInput = {
  // O que a entrega precisa saber do Cliente: o nome, para as mensagens. Quem recebe vem dos Destinos.
  cliente: { empresa: string };
  // Os Destinos já resolvidos pelo chamador (que decide antes se há para quem enviar).
  destinos: DestinoDeEnvio[];
  comunicacao: ComunicacaoSemContato;
  agora: Date;
};

// Algo que o setor precisa saber depois da entrega (falha, entrega por um canal só). Quem chama
// decide o que fazer com isso; o caso de uso não grava alerta.
// `setor`: o setor dono do alerta; ausente, é o Simples Nacional.
export type OcorrenciaDeEntrega = { tipo: TipoAlertaSetor; mensagem: string; setor?: SetorSlug };

export type ComunicacaoEntregue = {
  // Canais dos Destinos que entregaram (0 = nenhum).
  entregues: number;
  ocorrencias: OcorrenciaDeEntrega[];
};

export interface EntregarComunicacaoPorCanaisPort {
  execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>>;
}
