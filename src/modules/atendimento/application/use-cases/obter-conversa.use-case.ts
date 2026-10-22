import type {
  ConversaVista,
  DocumentoOferecido,
  MensagemVista,
  MensagensAnterioresVista,
  ObterConversaPort,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type {
  AnexosAtendimentoPort,
  LinkTemporario,
} from "@/modules/atendimento/application/ports/out/anexos-atendimento.provider";
import type {
  AtendimentoRepositoryPort,
  ConversaLida,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { descreverDocumento } from "@/modules/atendimento/domain/services/documento-contratual.service";
import { avisoPendenteAoFuncionario } from "@/modules/atendimento/domain/services/inatividade.service";
import {
  CONVERSA_JANELA_MENSAGENS,
  RENOVACAO_LINKS_MAXIMO,
  type CursorDaConversa,
} from "@/modules/atendimento/domain/services/janela-da-conversa.service";
import {
  podeTransferir,
  setoresDeDestino,
} from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Mesma regra de quem pode agir sobre o Atendimento que a Transferência (dono, Líder do Setor ou
// Admin). Os serviços que o Funcionário pode disparar vêm junto: uma leitura só por interação.
export class ObterConversa implements ObterConversaPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly documentos: DocumentosContratuaisPort,
    private readonly anexos: AnexosAtendimentoPort,
  ) {}

  async execute({
    atendimentoId,
  }: {
    atendimentoId: string;
  }): Promise<Result<ConversaVista, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver o Atendimento."));

    const lida = await this.repositorio.conversa(atendimentoId);
    if (!lida.ok) return lida;
    const conversa = lida.value;
    if (!conversa) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, conversa)) {
      return err(new ForbiddenError("Você não pode ver este Atendimento."));
    }

    const encerrado = conversa.status === "encerrado";
    // Em aviso de inatividade a Transferência é recusada pelo backend: não a oferece.
    const semDestinos = encerrado || conversa.aviso !== null;
    const destinos = semDestinos ? ok([]) : await this.destinos(conversa.setor, conversa.clienteId);
    if (!destinos.ok) return destinos;
    const disponiveis =
      encerrado || !conversa.clienteId ? ok([]) : await this.servicos(conversa.clienteId);
    if (!disponiveis.ok) return disponiveis;
    return ok({
      atendimentoId: conversa.id,
      encerrado,
      telefone: conversa.telefone,
      contato: conversa.contato,
      clienteVinculado: conversa.clienteId !== null,
      mensagens: await this.vistas(conversa.mensagens),
      temMaisAnteriores: conversa.temMaisAntigas,
      ultimaTransferencia: conversa.ultimaTransferencia,
      ura: conversa.ura,
      // Só o dono é o "inativo"; Líder e Admin que abrem a conversa não são avisados.
      avisoInatividade:
        !encerrado &&
        conversa.funcionarioId === ator.id &&
        avisoPendenteAoFuncionario(
          conversa.aviso,
          // A janela pode não alcançar a última Mensagem do Funcionário: ela vem à parte.
          conversa.ultimaDoFuncionarioEm
            ? [{ autor: "funcionario", criadoEm: conversa.ultimaDoFuncionarioEm }]
            : [],
        ),
      documentos: disponiveis.value,
      setoresDestino: destinos.value,
    });
  }

  // Mesma regra de quem pode ver que a leitura da conversa; o cursor é a Mensagem mais antiga que
  // a tela já tem.
  async mensagensAnteriores({
    atendimentoId,
    antes,
  }: {
    atendimentoId: string;
    antes: CursorDaConversa;
  }): Promise<Result<MensagensAnterioresVista, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver o Atendimento."));

    const lida = await this.repositorio.mensagensAnteriores(
      atendimentoId,
      antes,
      CONVERSA_JANELA_MENSAGENS,
    );
    if (!lida.ok) return lida;
    if (!lida.value) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, lida.value)) {
      return err(new ForbiddenError("Você não pode ver este Atendimento."));
    }
    return ok({
      mensagens: await this.vistas(lida.value.mensagens),
      temMaisAnteriores: lida.value.temMaisAntigas,
    });
  }

  // Mesma regra de quem pode ver que a leitura da conversa. Pedido além do limite é cortado.
  async renovarLinks({
    atendimentoId,
    mensagemIds,
  }: {
    atendimentoId: string;
    mensagemIds: string[];
  }): Promise<Result<MensagemVista[], AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver o Atendimento."));

    const lida = await this.repositorio.mensagensPorId(
      atendimentoId,
      mensagemIds.slice(0, RENOVACAO_LINKS_MAXIMO),
    );
    if (!lida.ok) return lida;
    if (!lida.value) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, lida.value)) {
      return err(new ForbiddenError("Você não pode ver este Atendimento."));
    }
    const comAnexo = lida.value.mensagens.filter((m) => m.anexo);
    return ok(await this.vistas(comAnexo));
  }

  // Sem os links os anexos aparecem sem arquivo, mas o texto da conversa continua legível.
  private async vistas(mensagens: ConversaLida["mensagens"]): Promise<MensagemVista[]> {
    const buscados = await this.links(mensagens);
    const links = buscados.ok ? buscados.value : {};
    return mensagens.map(({ idExterno, anexo, ...m }) => {
      const link = anexo && links[anexo.caminho];
      const miniatura = anexo?.miniaturaCaminho ? links[anexo.miniaturaCaminho] : undefined;
      return {
        ...m,
        reagivel: m.autor === "contato" && idExterno !== null,
        anexo:
          anexo && link
            ? {
                tipo: anexo.tipo,
                nome: anexo.nome,
                tamanho: anexo.tamanho,
                ...link,
                miniaturaUrl: miniatura?.url ?? null,
              }
            : null,
      };
    });
  }

  private async destinos(
    setor: SetorSlug,
    clienteId: string | null,
  ): Promise<Result<SetorSlug[], AppError>> {
    const roteamento = clienteId ? await this.repositorio.roteamentoDoCliente(clienteId) : ok(null);
    if (!roteamento.ok) return roteamento;
    return ok(setoresDeDestino(setor, roteamento.value?.regime ?? null));
  }

  // Um pedido só para todos os anexos da conversa.
  private async links(
    mensagens: ConversaLida["mensagens"],
  ): Promise<Result<Record<string, LinkTemporario>, AppError>> {
    const caminhos = mensagens.flatMap((m) =>
      m.anexo
        ? [m.anexo.caminho, ...(m.anexo.miniaturaCaminho ? [m.anexo.miniaturaCaminho] : [])]
        : [],
    );
    return caminhos.length ? this.anexos.linksTemporarios(caminhos) : ok({});
  }

  private async servicos(clienteId: string): Promise<Result<DocumentoOferecido[], AppError>> {
    const lista = await this.documentos.listar(clienteId);
    if (!lista.ok) return lista;
    return ok(
      lista.value.map(({ tipo, numero, data }) => ({
        tipo,
        numero,
        descricao: descreverDocumento({ numero, data }),
      })),
    );
  }
}
