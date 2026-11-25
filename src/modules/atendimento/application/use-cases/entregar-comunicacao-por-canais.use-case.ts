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
import type {
  DestinoDeEnvio,
  MotivoDeDestinoInvalido,
} from "@/modules/atendimento/application/ports/out/destinos-de-envio.provider";
import type { EnvioEmailPort } from "@/modules/atendimento/application/ports/out/envio-email.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { comTentativas, ESPERA_MS, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { formaEnvioUsaEmail, formaEnvioUsaWhatsapp } from "@/shared/kernel/forma-envio";
import { err, ok, type Result } from "@/shared/kernel/result";

type ResultadoDaEntrega = { entregue: boolean; ocorrencias: OcorrenciaDeEntrega[] };

const falhou = (mensagem: string): ResultadoDaEntrega => ({
  entregue: false,
  ocorrencias: [{ tipo: "falha_envio", mensagem }],
});

const MOTIVO_DE_DESTINO_INVALIDO: Record<MotivoDeDestinoInvalido, string> = {
  sem_whatsapp: "Destino inválido, o Contato não tem mais WhatsApp.",
  sem_email: "Destino inválido, o Contato não tem mais e-mail.",
};

export class EntregarComunicacaoPorCanais implements EntregarComunicacaoPorCanaisPort {
  constructor(
    private readonly proativa: EnviarComunicacaoProativaPort,
    private readonly email: EnvioEmailPort,
    private readonly esperaEntreTentativasMs = ESPERA_MS,
  ) {}

  async execute(entrada: EntregarComunicacaoInput): Promise<Result<ComunicacaoEntregue, AppError>> {
    const { cliente, comunicacao, destinos } = entrada;
    if (destinos.length === 0) return err(new ValidationError("Sem Destino de envio."));
    const canais: ResultadoDaEntrega[] = [];
    for (const destino of destinos) canais.push(...(await this.porDestino(entrada, destino)));

    const entregues = canais.filter((canal) => canal.entregue).length;
    const ocorrencias = canais.flatMap((canal) => canal.ocorrencias);
    if (guiaDe(comunicacao) && entregues > 0 && entregues < canais.length) {
      ocorrencias.push({
        tipo: "entrega_parcial",
        mensagem: `${cliente.empresa}: entregue a apenas parte dos Destinos; reenviar aos demais.`,
      });
    }
    return ok({ entregues, ocorrencias });
  }

  private async porDestino(
    entrada: EntregarComunicacaoInput,
    destino: DestinoDeEnvio,
  ): Promise<ResultadoDaEntrega[]> {
    if (destino.motivoInvalido) {
      return [
        falhou(`${destino.contatoNome}: ${MOTIVO_DE_DESTINO_INVALIDO[destino.motivoInvalido]}`),
      ];
    }
    const canais: ResultadoDaEntrega[] = [];
    if (formaEnvioUsaWhatsapp(destino.canal)) canais.push(await this.porWhatsapp(entrada, destino));
    if (formaEnvioUsaEmail(destino.canal)) canais.push(await this.porEmail(entrada, destino));
    return canais;
  }

  private async porWhatsapp(
    { cliente, comunicacao, agora }: EntregarComunicacaoInput,
    destino: DestinoDeEnvio,
  ): Promise<ResultadoDaEntrega> {
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
  ): Promise<ResultadoDaEntrega> {
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
