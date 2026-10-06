import type {
  TransferenciaConcluida,
  TransferirAtendimentoInput,
  TransferirAtendimentoPort,
} from "@/modules/atendimento/application/ports/in/transferir-atendimento.provider";
import type {
  AtendimentoEmAndamento,
  AtendimentoRepositoryPort,
  ResultadoTransferencia,
} from "@/modules/atendimento/application/ports/out/atendimento.repository";
import type { AuditoriaPort } from "@/modules/atendimento/application/ports/out/auditoria.provider";
import type { EnvioMensagemPort } from "@/modules/atendimento/application/ports/out/envio-mensagem.provider";
import type {
  AtorSessaoDto,
  SessaoPort,
} from "@/modules/atendimento/application/ports/out/sessao.provider";
import { menosCarregado } from "@/modules/atendimento/domain/services/balanceamento.service";
import type { AppError } from "@/shared/errors/app.error";
import { EstadoInconsistenteError } from "@/shared/errors/estado-inconsistente.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_LABEL, type SetorSlug } from "@/shared/kernel/setores";

const TENTATIVAS = 3;

type Transferido = Extract<ResultadoTransferencia, { status: "transferido" }>;

// Quem transfere: o Funcionário dono do Atendimento, o Líder do Setor onde ele está, ou o Admin.
function podeTransferir(ator: AtorSessaoDto, atendimento: AtendimentoEmAndamento): boolean {
  return (
    ator.papel === "admin" ||
    (ator.papel === "lider_setor" && ator.setor === atendimento.setor) ||
    ator.id === atendimento.funcionarioId
  );
}

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

  async execute({
    atendimentoId,
    setorDestino,
    resumo,
  }: TransferirAtendimentoInput): Promise<Result<TransferenciaConcluida, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para transferir o Atendimento."));

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
    const textoResumo = resumo.trim();
    if (!textoResumo) {
      return err(new ValidationError("Informe o resumo do assunto.", { resumo: ["Obrigatório"] }));
    }

    const feita = await this.gravar(ator, atendimento, setorDestino, textoResumo);
    if (!feita.ok) {
      await this.auditoria.registrar({
        ator: ator.id,
        setor: ator.setor,
        acao: "atendimento.transferir",
        alvo: atendimentoId,
        resultado: "falha",
      });
      return feita;
    }
    const { destinatarioNome, origemNome, contatoNome, empresa, cnpj } = feita.value;

    // Transferido: falhar daqui em diante não desfaz nada; o erro diz que o Atendimento já está
    // com o destino e o cliente não foi avisado.
    const aviso = await this.avisarCliente(
      atendimento,
      avisoAoCliente(setorDestino, destinatarioNome),
    );
    if (!aviso.ok) {
      return err(
        new EstadoInconsistenteError(
          "Atendimento transferido, mas o aviso ao cliente falhou.",
          atendimentoId,
        ),
      );
    }
    return ok({
      destinatarioNome,
      contatoNome,
      empresa,
      cnpj,
      origemSetor: atendimento.setor,
      origemNome,
      resumo: textoResumo,
    });
  }

  // O repositório recusa ("conflito") se outro Atendimento ocupou o escolhido entre a listagem e a
  // gravação; relista e escolhe de novo. Esgotadas as tentativas, transfere sem atribuição.
  private async gravar(
    ator: AtorSessaoDto,
    atendimento: AtendimentoEmAndamento,
    setorDestino: SetorSlug,
    resumo: string,
  ): Promise<Result<Transferido, AppError>> {
    const base = {
      atendimentoId: atendimento.id,
      origemFuncionarioId: atendimento.funcionarioId,
      setorDestino,
      resumo,
      ator: { id: ator.id, setor: ator.setor as SetorSlug },
    };
    for (let tentativa = 0; tentativa < TENTATIVAS; tentativa++) {
      const funcionarios = await this.repositorio.funcionariosDoSetor(setorDestino);
      if (!funcionarios.ok) return funcionarios;
      const feita = await this.repositorio.transferir({
        ...base,
        funcionarioDestinoId: menosCarregado(funcionarios.value)?.id ?? null,
      });
      if (!feita.ok) return feita;
      if (feita.value.status !== "conflito") return this.transferido(feita.value);
    }
    const semAtribuicao = await this.repositorio.transferir({
      ...base,
      funcionarioDestinoId: null,
    });
    if (!semAtribuicao.ok) return semAtribuicao;
    return this.transferido(semAtribuicao.value);
  }

  // "conflito" sem Funcionário não existe: quebra o contrato do repositório.
  private transferido(resultado: ResultadoTransferencia): Result<Transferido, AppError> {
    if (resultado.status === "transferido") return ok(resultado);
    if (resultado.status === "inexistente") {
      return err(
        new NotFoundError("O Atendimento mudou ou foi encerrado. Atualize e tente novamente."),
      );
    }
    return err(new ServicoExternoError("Não foi possível escolher o Funcionário de destino."));
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
    try {
      return await this.envio.enviar({ telefone: atendimento.telefone, texto });
    } catch {
      return err(new ServicoExternoError("Falha ao enviar a mensagem."));
    }
  }
}
