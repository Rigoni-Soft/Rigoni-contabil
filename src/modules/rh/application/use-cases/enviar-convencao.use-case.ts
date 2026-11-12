import type {
  EnviarConvencaoInput,
  EnviarConvencaoPort,
} from "@/modules/rh/application/ports/in/gerir-convencao.provider";
import type { ArmazenamentoDeConvencaoPort } from "@/modules/rh/application/ports/out/armazenamento-de-convencao.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { ConvencaoRepository } from "@/modules/rh/application/ports/out/convencao.repository";
import type { ExtratorDeRegrasPort } from "@/modules/rh/application/ports/out/extrator-de-regras.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { validarSindicato } from "@/modules/rh/domain/services/validar-ponto.service";
import { validarRegrasDaConvencao } from "@/modules/rh/domain/services/validar-regras-da-convencao.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { dataIsoValida } from "@/shared/kernel/data-iso";
import { podeGerirConvencaoRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";
import { NOME_DO_ARQUIVO_MAXIMO } from "@/shared/kernel/texto";

const ACAO = "rh.convencao.enviar";
// O limite do bucket: o servidor barra antes de gastar armazenamento e extração.
const MAXIMO_BYTES = 10 * 1024 * 1024;
const ASSINATURA_PDF = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

// Sobe a convenção do Cliente: guarda o PDF, extrai uma vez as regras (modelo atrás da porta neutra),
// valida cada parâmetro no domínio e grava o conjunto versionado. Sem aprovação manual: o que passa vale
// e o que não passa fica "não aplicada" (vale a legislação). Só o Líder do RH e o Admin; o banco repete
// a regra (RLS) e audita o sucesso na mesma transação; aqui, a auditoria da tentativa recusada.
export class EnviarConvencao implements EnviarConvencaoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly folha: FolhaDePontoRepository,
    private readonly convencoes: ConvencaoRepository,
    private readonly armazenamento: ArmazenamentoDeConvencaoPort,
    private readonly extrator: ExtratorDeRegrasPort,
    private readonly auditoria: AuditoriaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(input: EnviarConvencaoInput): Promise<Result<void, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));

    const cliente = await this.folha.buscarCliente(input.clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Cliente não encontrado."));
    if (!podeGerirConvencaoRh(ator.papel, ator.setor)) {
      await this.auditoria.registrar({
        ator: ator.id,
        setor: ator.setor,
        acao: ACAO,
        alvo: cliente.value.cnpj,
        resultado: "falha",
      });
      return err(new ForbiddenError("Só o Líder do RH e o Admin enviam a convenção."));
    }

    const dados = validar(input);
    if (!dados.ok) return dados;

    const caminho = `${input.clienteId}/${crypto.randomUUID()}.pdf`;
    const guardado = await this.armazenamento.enviar(caminho, input.arquivo.bytes);
    if (!guardado.ok) return guardado;

    // O extrator real chama um modelo de linguagem (rede, tempo esgotado): se lançar, o PDF não fica órfão.
    let extracao: Awaited<ReturnType<ExtratorDeRegrasPort["extrair"]>>;
    try {
      extracao = await this.extrator.extrair(input.arquivo.bytes);
    } catch (e) {
      await this.removerOrfao(caminho);
      this.erros.registrar("rh.convencao.extracao_falhou", caminho, String(e));
      return err(new PersistenciaError("Não foi possível ler a convenção. Tente novamente."));
    }
    if (!extracao.lido) {
      await this.removerOrfao(caminho);
      return err(
        new ValidationError("Não foi possível ler a convenção. Confira o PDF e tente de novo."),
      );
    }

    const gravada = await this.convencoes.inserir({
      clienteId: input.clienteId,
      ...dados.value,
      arquivoCaminho: caminho,
      arquivoNome: input.arquivo.nome.trim(),
      regras: validarRegrasDaConvencao(extracao.candidatas),
    });
    if (!gravada.ok) {
      await this.removerOrfao(caminho);
      return gravada;
    }
    return ok(undefined);
  }

  // O PDF solto não tem convenção: se a remoção falha, fica órfão no bucket e vira registro para o suporte.
  private async removerOrfao(caminho: string): Promise<void> {
    const removido = await this.armazenamento.remover(caminho);
    if (!removido.ok)
      this.erros.registrar("rh.convencao.arquivo_orfao", caminho, removido.error.message);
  }
}

function validar(
  input: EnviarConvencaoInput,
): Result<{ sindicato: string; vigenciaInicio: string; vigenciaFim: string }, ValidationError> {
  const sindicato = validarSindicato(input.sindicato);
  if (!sindicato.ok) return sindicato;
  if (!dataIsoValida(input.vigenciaInicio) || !dataIsoValida(input.vigenciaFim)) {
    return err(
      new ValidationError("Informe a vigência com início e fim.", {
        vigenciaInicio: ["Data inválida"],
      }),
    );
  }
  if (input.vigenciaFim < input.vigenciaInicio) {
    return err(
      new ValidationError("A vigência termina antes de começar.", {
        vigenciaFim: ["Fim antes do início"],
      }),
    );
  }
  const { bytes, nome } = input.arquivo;
  if (
    nome.trim() === "" ||
    nome.trim().length > NOME_DO_ARQUIVO_MAXIMO ||
    bytes.length === 0 ||
    bytes.length > MAXIMO_BYTES ||
    !ehPdf(bytes)
  ) {
    return err(
      new ValidationError("Envie a convenção em PDF de até 10 MB.", { arquivo: ["PDF inválido"] }),
    );
  }
  return ok({
    sindicato: sindicato.value,
    vigenciaInicio: input.vigenciaInicio,
    vigenciaFim: input.vigenciaFim,
  });
}

function ehPdf(bytes: Uint8Array): boolean {
  return ASSINATURA_PDF.every((b, i) => bytes[i] === b);
}
