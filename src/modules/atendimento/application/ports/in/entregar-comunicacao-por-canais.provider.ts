import type { ComunicacaoProativa } from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type { TipoAlertaSetor } from "@/modules/atendimento/application/ports/out/alerta-setor.provider";
import type { ClienteParaLembrete } from "@/modules/atendimento/application/ports/out/clientes-para-lembrete.provider";

// O que a entrega precisa da rodada do job: levantar alertas do setor e registrar falhas.
export interface AlertasDaRodada {
  alertar(cliente: ClienteParaLembrete, tipo: TipoAlertaSetor, mensagem: string): Promise<void>;
  falhou(cliente: ClienteParaLembrete, mensagem: string): Promise<void>;
}

export type EntregarComunicacaoInput = {
  cliente: ClienteParaLembrete;
  comunicacao: ComunicacaoProativa;
  agora: Date;
  rodada: AlertasDaRodada;
};

// `true` se ao menos um canal da forma de envio do Cliente entregou.
export interface EntregarComunicacaoPorCanaisPort {
  execute(entrada: EntregarComunicacaoInput): Promise<boolean>;
}
