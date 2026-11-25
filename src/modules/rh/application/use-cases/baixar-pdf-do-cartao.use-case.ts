import type { PdfDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import { documentoDoCartao } from "@/modules/rh/application/mappers/documento-do-cartao.mapper";
import type {
  BaixarPdfDoCartaoInput,
  BaixarPdfDoCartaoPort,
} from "@/modules/rh/application/ports/in/baixar-pdf-do-cartao.provider";
import type { ObterFolhaDePontoPort } from "@/modules/rh/application/ports/in/obter-folha-de-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { GeradorDePdfDoCartaoPort } from "@/modules/rh/application/ports/out/gerador-de-pdf-do-cartao.provider";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { GeracaoDeDocumentoError } from "@/shared/errors/geracao-de-documento.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "rh.ponto.baixar-pdf";

export class BaixarPdfDoCartao implements BaixarPdfDoCartaoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly folha: ObterFolhaDePontoPort,
    private readonly repositorio: FolhaDePontoRepository,
    private readonly gerador: GeradorDePdfDoCartaoPort,
    private readonly auditoria: AuditoriaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(input: BaixarPdfDoCartaoInput): Promise<Result<PdfDoCartaoDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    const cliente = await this.repositorio.buscarCliente(input.clienteId);
    const cnpj = cliente.ok && cliente.value ? cliente.value.cnpj : input.clienteId;
    const auditar = (resultado: "sucesso" | "falha", empregado = input.empregadoId) =>
      this.auditoria.registrar({
        ator: ator.id,
        setor: ator.setor,
        acao: ACAO,
        alvo: `${cnpj} ${empregado} ${input.competencia}`,
        resultado,
      });
    const recusar = async <E extends AppError>(erro: E, empregado?: string) => {
      await auditar("falha", empregado);
      return err(erro);
    };

    const lida = await this.folha.execute(input);
    if (!lida.ok) return recusar(lida.error);
    const cartao = lida.value.selecionado;
    if (!cartao) return recusar(new NotFoundError("Empregado não encontrado."));
    const nome = cartao.empregado.nome;
    if (cartao.motivoSemPdf) return recusar(new ValidationError(cartao.motivoSemPdf), nome);

    let bytes: Uint8Array;
    try {
      bytes = await this.gerador.gerar(documentoDoCartao(lida.value, cartao));
    } catch (e) {
      this.erros.registrar(
        "Falha ao gerar o PDF do cartão de ponto:",
        e instanceof Error ? e.message : String(e),
      );
      return recusar(
        new GeracaoDeDocumentoError("Não foi possível gerar o PDF do cartão. Tente de novo."),
        nome,
      );
    }

    await auditar("sucesso", nome);
    return ok({ nomeDoArquivo: nomeSeguroDoArquivo(nome, input.competencia), bytes });
  }
}

function nomeSeguroDoArquivo(empregado: string, competencia: string): string {
  const slug = empregado
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cartao-de-ponto-${slug || "empregado"}-${competencia}.pdf`;
}
