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
import type { DestinoDeEnvio } from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { ok, type Result } from "@/shared/kernel/result";

type Canal = { entregue: boolean; ocorrencias: OcorrenciaDeEntrega[] };

const falha = (mensagem: string): OcorrenciaDeEntrega => ({ tipo: "falha_envio", mensagem });
const falhou = (mensagem: string): Canal => ({ entregue: false, ocorrencias: [falha(mensagem)] });

// Entrega a comunicação pelos canais de cada Destino de envio. O canal que não entrega vira
// ocorrência sem derrubar o outro (nem o Destino seguinte); entregar por menos canais do que os
// Destinos pedem (na guia) acrescenta a ocorrência `entrega_parcial`. Sem Destino não há o que
// entregar: quem chama decide antes e alerta o Setor.
export class EntregarComunicacaoPorCanais implements EntregarComunicacaoPorCanaisPort {
  constructor(
    private readonly proativa: EnviarComunicacaoProativaPort,
    private readonly email: EnvioEmailPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>> {
    const { cliente, comunicacao, destinos } = entrada;
    const canais: Canal[] = [];
    for (const destino of destinos) {
      if (formaEnvioUsaWhatsapp(destino.canal))
        canais.push(await this.porWhatsapp(entrada, destino));
      if (formaEnvioUsaEmail(destino.canal)) canais.push(await this.porEmail(entrada, destino));
    }

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

  private async porWhatsapp(
    { cliente, comunicacao, agora }: EntregarComunicacaoInput,
    destino: DestinoDeEnvio,
  ): Promise<Canal> {
    if (!destino.telefone) return falhou(`${destino.contatoNome} não tem WhatsApp.`);
    const enviado = await this.proativa.execute({
      telefone: destino.telefone,
      comunicacao: { ...comunicacao, contato: destino.contatoNome },
      ultimaMensagemDoContatoEm: destino.ultimaMensagemDoContatoEm,
      agora,
    });
    if (enviado.ok) return { entregue: true, ocorrencias: [] };
    return falhou(
      `WhatsApp de ${cliente.empresa} (${destino.contatoNome}): ${enviado.error.message}`,
    );
  }

  private async porEmail(
    { cliente, comunicacao }: EntregarComunicacaoInput,
    destino: DestinoDeEnvio,
  ): Promise<Canal> {
    const destinatario = destino.email;
    if (!destinatario) return falhou(`${destino.contatoNome} não tem e-mail.`);
    const personalizada = { ...comunicacao, contato: destino.contatoNome };
    const enviado = await comTentativas(
      () =>
        this.email.enviar({
          para: destinatario,
          assunto: `${montarAssuntoEmail(personalizada)} — ${cliente.empresa}`,
          texto: montarTextoLivre(personalizada),
          anexo: guiaDe(personalizada),
        }),
      TENTATIVAS,
      this.esperaEntreTentativasMs,
    );
    if (enviado.ok) return { entregue: true, ocorrencias: [] };
    return falhou(
      `E-mail de ${cliente.empresa} (${destino.contatoNome}): ${enviado.error.message}`,
    );
  }
}
