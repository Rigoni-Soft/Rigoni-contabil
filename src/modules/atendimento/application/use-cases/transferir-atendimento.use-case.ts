import type {
  TransferenciaConcluida,
  TransferirAtendimentoInput,
  TransferirAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  NovaTransferencia,
  ResultadoTransferencia,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import {
  menosCarregado,
  TENTATIVAS_DE_ATRIBUICAO,
} from "@/modules/atendimento/domain/services/balanceamento.service";
import { podeTransferir } from "@/modules/atendimento/domain/services/transferencia.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_LABEL, type SetorSlug } from "@/shared/kernel/setores";

type Transferido = Extract<ResultadoTransferencia, { status: "transferido" }>;

function avisoAoCliente(setor: SetorSlug, atendente: string | null): string {
  const destino = atendente
    ? `o setor ${SETOR_LABEL[setor]}, com ${atendente}`
    : `o setor ${SETOR_LABEL[setor]}`;
  return `Estamos transferindo você para ${destino}. Aguarde um instante, por favor.`;
}

// Setores que recebem já são só os cliente-facing (SETORES exclui Patriki, Expedição e T.I.),
// então o tipo do destino basta. O Funcionário de destino sai do Balanceamento mensal; sem
// ninguém livre o Atendimento fica sem atribuição (a Fila é do #46).
export class TransferirAtendimento implements TransferirAtendimentoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AtendimentoRepositoryPort,
    private readonly envio: EnvioMensagemPort,
    private readonly auditoria: AuditoriaPort,
  ) {}

  async execute(
    input: TransferirAtendimentoInput,
  ): Promise<Result<TransferenciaConcluida, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para transferir o Atendimento."));

    const atendimento = await this.validar(ator, input);
    if (!atendimento.ok) return atendimento;
    const resumo = input.resumo.trim();

    const gravada = await this.gravar(
      {
        atendimentoId: input.atendimentoId,
        origemFuncionarioId: atendimento.value.funcionarioId,
        setorDestino: input.setorDestino,
        resumo,
        ator: { id: ator.id, setor: ator.setor },
      },
      TENTATIVAS_DE_ATRIBUICAO,
    );
    if (!gravada.ok) {
      await this.auditarFalha(ator, input.atendimentoId);
      return gravada;
    }

    // Transferido: falhar daqui em diante não desfaz nada; o erro diz que o Atendimento já está
    // com o destino e o cliente não foi avisado.
    const { destinatarioNome, origemNome, contato } = gravada.value;
    const aviso = await this.avisarCliente(
      atendimento.value,
      avisoAoCliente(input.setorDestino, destinatarioNome),
    );
    if (!aviso.ok) {
      await this.auditarFalha(ator, input.atendimentoId);
      return err(
        new EstadoInconsistenteError(
          "Atendimento transferido, mas o aviso ao cliente falhou.",
          input.atendimentoId,
        ),
      );
    }
    return ok({
      destinatarioNome,
      contato,
      origemSetor: atendimento.value.setor,
      origemNome,
      resumo,
    });
  }

  private async validar(
    ator: AtorSessaoDto,
    { atendimentoId, setorDestino, resumo }: TransferirAtendimentoInput,
  ): Promise<Result<AtendimentoEmAndamento, AppError>> {
    const encontrado = await this.repositorio.buscarEmAndamento(atendimentoId);
    if (!encontrado.ok) return encontrado;
    const atendimento = encontrado.value;
    if (!atendimento) return err(new NotFoundError("Atendimento não encontrado."));
    if (!podeTransferir(ator, atendimento)) {
      return err(new ForbiddenError("Você não pode transferir este Atendimento."));
    }
    if (setorDestino === atendimento.setor) {
      return err(
        new ValidationError("Escolha outro Setor.", { setorDestino: ["Setor de origem"] }),
      );
    }
    if (!resumo.trim()) {
      return err(new ValidationError("Informe o resumo do assunto.", { resumo: ["Obrigatório"] }));
    }
    return ok(atendimento);
  }

  // O repositório recusa ("conflito") se outro Atendimento ocupou o escolhido entre a listagem e a
  // gravação; relista e escolhe de novo. Esgotadas as tentativas, transfere sem atribuição.
  private async gravar(
    dados: Omit<NovaTransferencia, "funcionarioDestinoId">,
    tentativas: number,
  ): Promise<Result<Transferido, AppError>> {
    const escolhido =
      tentativas > 0 ? await this.escolherDestino(dados.setorDestino) : ok<string | null>(null);
    if (!escolhido.ok) return escolhido;
    const resultado = await this.repositorio.transferir({
      ...dados,
      funcionarioDestinoId: escolhido.value,
    });
    if (resultado.ok && resultado.value.status === "conflito" && tentativas > 0) {
      return this.gravar(dados, tentativas - 1);
    }
    return this.exigirTransferido(resultado);
  }

  private async escolherDestino(setor: SetorSlug): Promise<Result<string | null, AppError>> {
    const funcionarios = await this.repositorio.funcionariosDoSetor(setor);
    if (!funcionarios.ok) return funcionarios;
    return ok(menosCarregado(funcionarios.value)?.id ?? null);
  }

  // "conflito" sem Funcionário não existe: quebra o contrato do repositório.
  private exigirTransferido(
    resultado: Result<ResultadoTransferencia, AppError>,
  ): Result<Transferido, AppError> {
    if (!resultado.ok) return resultado;
    if (resultado.value.status === "transferido") return ok(resultado.value);
    if (resultado.value.status === "inexistente") {
      return err(
        new NotFoundError("O Atendimento mudou ou foi encerrado. Atualize e tente novamente."),
      );
    }
    return err(new ServicoExternoError("Não foi possível escolher o Funcionário de destino."));
  }

  private async auditarFalha(ator: AtorSessaoDto, atendimentoId: string): Promise<void> {
    await this.auditoria.registrar({
      ator: ator.id,
      setor: ator.setor,
      acao: "atendimento.transferir",
      alvo: atendimentoId,
      resultado: "falha",
    });
  }

  private async avisarCliente(
    atendimento: AtendimentoEmAndamento,
    texto: string,
  ): Promise<Result<void, AppError>> {
    const registrada = await this.repositorio.anexarMensagem(atendimento.chave, {
      autor: "ura",
      texto,
    });
    if (!registrada.ok) return registrada;
    return this.enviarAviso(atendimento.telefone, texto);
  }

  private async enviarAviso(telefone: string, texto: string): Promise<Result<void, AppError>> {
    try {
      return await this.envio.enviar({ telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
