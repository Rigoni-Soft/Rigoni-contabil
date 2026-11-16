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
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "rh.ponto.baixar-pdf";

// O PDF individual do Cartão de ponto de um empregado num mês: horários, Totalização em destaque e as linhas de
// assinatura do responsável e do empregado do Cliente. Quem lê a Folha de ponto (Admin, Líder e o Responsável do
// RH do Cliente) baixa; a leitura e o recorte da vista são do ObterFolhaDePonto. A geração é no servidor e cada
// download é auditado (a recusa e a falha também).
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
    // O alvo segue o dos registros do banco para o ponto: "<CNPJ> <empregado> <mês>".
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

    const lida = await this.folha.execute(input);
    if (!lida.ok) {
      await auditar("falha");
      return lida;
    }
    const cartao = lida.value.selecionado;
    if (!cartao) {
      await auditar("falha");
      return err(new NotFoundError("Empregado não encontrado."));
    }
    const nome = cartao.empregado.nome;

    let bytes: Uint8Array;
    try {
      bytes = await this.gerador.gerar(documentoDoCartao(lida.value, cartao));
    } catch (e) {
      this.erros.registrar("Falha ao gerar o PDF do cartão de ponto:", (e as Error).message);
      await auditar("falha", nome);
      return err(
        new GeracaoDeDocumentoError("Não foi possível gerar o PDF do cartão. Tente de novo."),
      );
    }

    await auditar("sucesso", nome);
    return ok({ nomeDoArquivo: nomeDoArquivo(nome, input.competencia), bytes });
  }
}

// "cartao-de-ponto-maria-da-silva-2026-11.pdf": sem acento nem símbolo, seguro para o sistema de arquivos.
function nomeDoArquivo(empregado: string, competencia: string): string {
  const slug = empregado
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cartao-de-ponto-${slug || "empregado"}-${competencia}.pdf`;
}
