import type { PdfDoCartaoDto } from "@/modules/rh/application/dtos/documento-do-cartao.dto";
import { documentoDoCartao } from "@/modules/rh/application/mappers/documento-do-cartao.mapper";
import type {
  BaixarPdfDoCartaoInput,
  BaixarPdfDoCartaoPort,
} from "@/modules/rh/application/ports/in/baixar-pdf-do-cartao.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { GeradorDePdfDoCartaoPort } from "@/modules/rh/application/ports/out/gerador-de-pdf-do-cartao.provider";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import type { ApuradorDeCartoes } from "@/modules/rh/application/services/apurador-de-cartoes.service";
import { decidirAcesso } from "@/modules/rh/domain/services/acesso-rh.service";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { GeracaoDeDocumentoError } from "@/shared/errors/geracao-de-documento.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const ACAO = "rh.ponto.baixar-pdf";

// O PDF individual do Cartão de ponto de um empregado num mês: horários, Totalização em destaque e as linhas de
// assinatura do responsável e do empregado do Cliente. Quem lê a Folha de ponto (Admin, Líder e o Responsável do
// RH do Cliente) baixa, com o mesmo acesso e recorte da leitura da Folha. Empregado desligado, sem movimento
// no mês ou sem apontamento não tem PDF (o motivoSemPdf do cartão apurado). A geração é no
// servidor e cada download é auditado (a recusa e a falha também).
export class BaixarPdfDoCartao implements BaixarPdfDoCartaoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: FolhaDePontoRepository,
    private readonly apurador: Pick<ApuradorDeCartoes, "apurar">,
    private readonly relogio: RelogioPort,
    private readonly gerador: GeradorDePdfDoCartaoPort,
    private readonly auditoria: AuditoriaPort,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async execute(input: BaixarPdfDoCartaoInput): Promise<Result<PdfDoCartaoDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Sessão inválida. Entre novamente."));
    // O alvo segue o dos registros do banco para o ponto: "<CNPJ> <empregado> <mês>". Cliente não achado: o id do
    // Cliente no lugar do CNPJ. O empregado é o nome; só a falha da leitura da Folha (que ainda não trouxe o nome)
    // grava o id. Toda tentativa de usuário logado deixa registro, inclusive a recusada na leitura: o rastro é
    // deliberado (ruído só de falha, sem dado do Cliente).
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

    const acesso = decidirAcesso({
      finalidade: "leitura",
      ator,
      agora: this.relogio.agora(),
      competencia: input.competencia,
      mensagens: {
        semAcesso: "Sem acesso à Folha de ponto do RH.",
        mesFuturo: "Não há cartão de um mês que ainda não começou.",
      },
    });
    if (!acesso.ok) return recusar(acesso.error);
    if (!cliente.ok) return recusar(cliente.error);
    if (!cliente.value) return recusar(new NotFoundError("Cliente não encontrado."));

    // Só o empregado pedido: o PDF não carrega o Quadro inteiro do Cliente.
    const [empregado, semMovimento] = await Promise.all([
      this.repositorio.buscarEmpregado(input.clienteId, input.empregadoId),
      this.repositorio.listarSemMovimento(input.clienteId, acesso.value.competencia.primeiroDia),
    ]);
    if (!empregado.ok) return recusar(empregado.error);
    if (!semMovimento.ok) return recusar(semMovimento.error);
    if (!empregado.value) return recusar(new NotFoundError("Empregado não encontrado."));
    const escolhido = {
      ...empregado.value,
      semMovimento: semMovimento.value.includes(empregado.value.id),
    };
    const apurados = await this.apurador.apurar(
      input.clienteId,
      [escolhido],
      acesso.value.competencia,
    );
    if (!apurados.ok) return recusar(apurados.error);
    const cartao = apurados.value[0];
    const nome = cartao.empregado.nome;
    if (cartao.motivoSemPdf) return recusar(new ValidationError(cartao.motivoSemPdf), nome);

    let bytes: Uint8Array;
    try {
      bytes = await this.gerador.gerar(
        documentoDoCartao(
          { empresa: cliente.value.empresa, competencia: acesso.value.competencia.valor },
          cartao,
        ),
      );
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

// "cartao-de-ponto-maria-da-silva-2026-11.pdf": sem acento nem símbolo, seguro para o sistema de arquivos.
function nomeSeguroDoArquivo(empregado: string, competencia: string): string {
  const slug = empregado
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `cartao-de-ponto-${slug || "empregado"}-${competencia}.pdf`;
}
