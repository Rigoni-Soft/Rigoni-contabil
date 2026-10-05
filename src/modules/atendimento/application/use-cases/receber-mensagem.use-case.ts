import type {
  MensagemRecebida,
  ReceberMensagemPort,
} from "@/modules/atendimento/application/ports/in/receber-mensagem.provider";
import type {
  DocumentoContratual,
  DocumentosContratuaisPort,
} from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  ContatoIdentificado,
  IdentificacaoContatoPort,
} from "@/modules/atendimento/application/ports/out/identificacao-contato.provider";
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

function formatarData(iso: string): string {
  const [ano, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${ano}`;
}

function descrever(documento: DocumentoContratual): string {
  return documento.data ? `Alteração de ${formatarData(documento.data)}` : "Contrato social";
}

// Sem estado de Atendimento ainda (#42+): "1".."5" é escolha de menu, "1.N" escolhe o
// N-ésimo documento da lista da opção 1 (a lista é recalculada a cada mensagem), qualquer
// outro texto reabre a saudação com o menu.
// ponytail: se um documento entrar/sair entre a lista e a escolha, "1.N" aponta para outro;
// guardar a lista na sessão do Atendimento quando ela existir.
export class ReceberMensagem implements ReceberMensagemPort {
  constructor(
    private readonly contatos: IdentificacaoContatoPort,
    private readonly envio: EnvioMensagemPort,
    private readonly documentos: DocumentosContratuaisPort,
  ) {}

  async execute(mensagem: MensagemRecebida): Promise<Result<void, AppError>> {
    const nacional = soDigitosNacionais(mensagem.telefone);
    if (!nacional) return err(new ValidationError("Telefone da mensagem é obrigatório"));

    const contato = await this.contatos.identificar(nacional);
    if (!contato.ok) return contato;
    if (!contato.value) return this.enviar(mensagem.telefone, NAO_IDENTIFICADO);

    return this.responderContato(contato.value, mensagem);
  }

  private async responderContato(
    contato: ContatoIdentificado,
    { telefone, texto }: MensagemRecebida,
  ): Promise<Result<void, AppError>> {
    const escolhaDocumento = /^1\.(\d+)$/.exec(texto.trim());
    if (texto.trim() === "1" || escolhaDocumento) {
      return this.responderDocumentos(contato, telefone, Number(escolhaDocumento?.[1]));
    }

    const escolha = Number(texto.trim());
    if (Number.isInteger(escolha) && escolha >= 1 && escolha <= OPCOES_MENU.length) {
      return this.enviar(
        telefone,
        `${OPCOES_MENU[escolha - 1]}: em construção. Envie qualquer mensagem para ver o menu.`,
      );
    }
    const menu = OPCOES_MENU.map((opcao, i) => `${i + 1} - ${opcao}`).join("\n");
    return this.enviar(
      telefone,
      `Olá, ${contato.nome} (${contato.empresa})! Como podemos ajudar?\n${menu}`,
    );
  }

  // `indice` é a escolha "1.N" (1-based); NaN quando o cliente só digitou "1".
  private async responderDocumentos(
    contato: ContatoIdentificado,
    telefone: string,
    indice: number,
  ): Promise<Result<void, AppError>> {
    const lista = await this.documentos.listar(contato.clienteId);
    if (!lista.ok) return lista;
    const documentos = lista.value;

    if (documentos.length === 0) {
      return this.enviar(
        telefone,
        "Não encontramos contrato social ou alterações cadastrados. Fale com o escritório.",
      );
    }
    const escolhido =
      documentos.length === 1 && Number.isNaN(indice) ? documentos[0] : documentos[indice - 1];
    if (escolhido) return this.enviarDocumento(telefone, escolhido);

    const opcoes = documentos.map((d, i) => `1.${i + 1} - ${descrever(d)}`).join("\n");
    return this.enviar(telefone, `Qual documento você deseja?\n${opcoes}`);
  }

  private async enviarDocumento(
    telefone: string,
    documento: DocumentoContratual,
  ): Promise<Result<void, AppError>> {
    const link = await this.documentos.linkTemporario(documento.caminho);
    if (!link.ok) return link;
    const extensao = /\.[A-Za-z0-9]+$/.exec(documento.caminho)?.[0] ?? "";
    try {
      return await this.envio.enviarDocumento({
        telefone,
        url: link.value,
        nomeArquivo: `${descrever(documento)}${extensao}`,
      });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar o documento."));
    }
  }

  private async enviar(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
