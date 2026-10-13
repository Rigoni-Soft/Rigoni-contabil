import type {
  ConversaVista,
  DocumentoOferecido,
  ObterConversaPort,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type { AtendimentoRepositoryPort } from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { descreverDocumento } from "@/modules/atendimento/domain/services/documento-contratual.service";
import { avisoPendenteAoFuncionario } from "@/modules/atendimento/domain/services/inatividade.service";
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
      mensagens: conversa.mensagens.map(({ idExterno, ...m }) => ({
        ...m,
        reagivel: m.autor === "contato" && idExterno !== null,
      })),
      ultimaTransferencia: conversa.ultimaTransferencia,
      ura: conversa.ura,
      // Só o dono é o "inativo"; Líder e Admin que abrem a conversa não são avisados.
      avisoInatividade:
        !encerrado &&
        conversa.funcionarioId === ator.id &&
        avisoPendenteAoFuncionario(conversa.aviso, conversa.mensagens),
      documentos: disponiveis.value,
      setoresDestino: destinos.value,
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

  private async servicos(clienteId: string): Promise<Result<DocumentoOferecido[], AppError>> {
    const lista = await this.documentos.listar(clienteId);
    if (!lista.ok) return lista;
    return ok(
      lista.value.map(({ tipo, data }) => ({
        tipo,
        data,
        descricao: descreverDocumento({ data }),
      })),
    );
  }
}
