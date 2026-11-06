import {
  guiaDe,
  montarAssuntoEmail,
  montarTextoLivre,
} from "@/modules/atendimento/application/mensagens/comunicacao-proativa";
import type {
  ComunicacaoEntregue,
  EntregarComunicacaoInput,
  EntregarComunicacaoPorCanaisPort,
  OcorrenciaDeEntrega,
} from "@/modules/atendimento/application/ports/in/entregar-comunicacao-por-canais.provider";
import type { EnviarComunicacaoProativaPort } from "@/modules/atendimento/application/ports/in/enviar-comunicacao-proativa.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { ok, type Result } from "@/shared/kernel/result";

type Canal = { entregue: boolean; ocorrencias: OcorrenciaDeEntrega[] };

const falha = (mensagem: string): OcorrenciaDeEntrega => ({ tipo: "falha_envio", mensagem });
const indisponivel = (mensagem: string): Canal => ({
  entregue: false,
  ocorrencias: [{ tipo: "contato_ausente", mensagem }],
});

// Entrega a comunicação pelos canais da forma de envio do Cliente. O canal que não entrega vira
// ocorrência sem derrubar o outro; entregar por um canal só (forma de envio com os dois, na guia)
// acrescenta a ocorrência `entrega_parcial`.
export class EntregarComunicacaoPorCanais implements EntregarComunicacaoPorCanaisPort {
  constructor(
    private readonly proativa: EnviarComunicacaoProativaPort,
    private readonly email: EnvioEmailPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>> {
    const { cliente, comunicacao } = entrada;
    const canais: Canal[] = [];
    if (formaEnvioUsaWhatsapp(cliente.formaEnvio)) canais.push(await this.porWhatsapp(entrada));
    if (formaEnvioUsaEmail(cliente.formaEnvio)) canais.push(await this.porEmail(entrada));

    const entregues = canais.filter((canal) => canal.entregue).length;
    const ocorrencias = canais.flatMap((canal) => canal.ocorrencias);
    // Só a guia gera pendência: o lembrete é recorrente e volta a sair na próxima rodada.
    if (guiaDe(comunicacao) && entregues > 0 && entregues < canais.length) {
      ocorrencias.push({
        tipo: "entrega_parcial",
        mensagem: `${cliente.empresa}: entregue por apenas um canal; reenviar pelo outro.`,
      });
    }
    return ok({ entregues, ocorrencias });
  }

  private async porWhatsapp(entrada: EntregarComunicacaoInput): Promise<Canal> {
    const { cliente, comunicacao, agora } = entrada;
    if (!cliente.contato) return indisponivel(`${cliente.empresa} não tem contato padrão.`);
    const enviado = await this.proativa.execute({
      telefone: cliente.contato.telefone,
      comunicacao,
      ultimaMensagemDoContatoEm: cliente.ultimaMensagemDoContatoEm,
      agora,
    });
    if (enviado.ok) return { entregue: true, ocorrencias: [] };
    return {
      entregue: false,
      ocorrencias: [falha(`WhatsApp de ${cliente.empresa}: ${enviado.error.message}`)],
    };
  }

  private async porEmail(entrada: EntregarComunicacaoInput): Promise<Canal> {
    const { cliente, comunicacao } = entrada;
    const destinatario = cliente.email;
    if (!destinatario) return indisponivel(`${cliente.empresa} não tem e-mail.`);
    const enviado = await comTentativas(
      () =>
        this.email.enviar({
          para: destinatario,
          assunto: `${montarAssuntoEmail(comunicacao)} — ${cliente.empresa}`,
          texto: montarTextoLivre(comunicacao),
          anexo: guiaDe(comunicacao),
        }),
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (enviado.ok) return { entregue: true, ocorrencias: [] };
    return {
      entregue: false,
      ocorrencias: [falha(`E-mail de ${cliente.empresa}: ${enviado.error.message}`)],
    };
  }
}
