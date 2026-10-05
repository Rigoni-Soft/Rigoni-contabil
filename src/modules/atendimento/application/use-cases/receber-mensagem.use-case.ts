import type {
  MensagemRecebida,
  ReceberMensagemPort,
} from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type { IdentificacaoContatoPort } from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, type Result } from "@/shared/kernel/result";

const OPCOES_MENU = [
  "Contrato social e alterações",
  "Guia de imposto",
  "Guia de parcelamento",
  "CND",
  "Falar com atendente",
];

const NAO_IDENTIFICADO =
  "Olá! Não identificamos este número entre os contatos dos nossos clientes. Fale com o escritório para atualizar o cadastro.";

// DDI 55 é descartado: o telefone do Contato é cadastrado só com DDD + número.
function soDigitosNacionais(telefone: string): string {
  const digitos = telefone.replace(/\D/g, "");
  return digitos.length > 11 && digitos.startsWith("55") ? digitos.slice(2) : digitos;
}

// Sem estado de Atendimento ainda (#41+): "1".."5" é escolha de menu, qualquer
// outro texto reabre a saudação com o menu.
export class ReceberMensagem implements ReceberMensagemPort {
  constructor(
    private readonly contatos: IdentificacaoContatoPort,
    private readonly envio: EnvioMensagemPort,
  ) {}

  async execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>> {
    const nacional = soDigitosNacionais(mensagem.telefone);
    if (!nacional) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    const contato = await this.contatos.identificar(nacional);
    if (!contato.ok) return contato;

    const texto = contato.value
      ? this.responderContato(contato.value, mensagem.texto)
      : NAO_IDENTIFICADO;
    return this.enviar(mensagem.telefone, texto);
  }

  private responderContato(contato: { nome: string; empresa: string }, texto: string): string {
    const escolha = Number(texto.trim());
    if (Number.isInteger(escolha) && escolha >= 1 && escolha <= OPCOES_MENU.length) {
      return `${OPCOES_MENU[escolha - 1]}: em construção. Envie qualquer mensagem para ver o menu.`;
    }
    const menu = OPCOES_MENU.map((opcao, i) => `${i + 1} - ${opcao}`).join("\n");
    return `Olá, ${contato.nome} (${contato.empresa})! Como podemos ajudar?\n${menu}`;
  }

  private async enviar(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
