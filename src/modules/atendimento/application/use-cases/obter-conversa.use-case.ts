import type {
  ConversaVista,
  DocumentoOferecido,
  ObterConversaPort,
} from "@/modules/atendimento/application/ports/in/obter-conversa.provider";
import type {
  AtendimentoRepositoryPort,
  ConversaLida,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { DocumentosContratuaisPort } from "@/modules/atendimento/application/ports/out/documentos-contratuais.provider";
import type { SessaoPort } from "@/modules/atendimento/application/ports/out/sessao.provider";
import { descreverDocumento } from "@/modules/atendimento/domain/services/documento-contratual.service";
import {
  podeTransferir,
  setoresDeDestino,
} from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// O aviso ao cliente não aparece aqui; e a Mensagem do Funcionário depois do aviso já o cancela,
// mesmo antes de o job limpar a marca.
function avisoAoFuncionario({ status, aviso, mensagens }: ConversaLida): boolean {
  if (status === "encerrado" || aviso?.de !== "funcionario") return false;
  const avisoEm = new Date(aviso.em).getTime();
  return !mensagens.some(
    (m) => m.autor === "funcionario" && new Date(m.criadoEm).getTime() > avisoEm,
  );
}

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
    const destinos = encerrado ? ok([]) : await this.destinos(conversa.setor, conversa.clienteId);
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
      mensagens: conversa.mensagens,
      ultimaTransferencia: conversa.ultimaTransferencia,
      ura: conversa.ura,
      avisoInatividade: avisoAoFuncionario(conversa),
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
