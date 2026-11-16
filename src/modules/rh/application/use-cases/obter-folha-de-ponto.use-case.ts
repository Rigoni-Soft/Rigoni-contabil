import type {
  EmpregadoDaFolhaDto,
  FolhaDePontoDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type {
  ObterFolhaDePontoInput,
  ObterFolhaDePontoPort,
} from "@/modules/rh/application/ports/in/obter-folha-de-ponto.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { AtorSessaoDto, SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import type { ApuradorDeCartoes } from "@/modules/rh/application/services/apurador-de-cartoes.service";
import { decidirAcesso } from "@/modules/rh/domain/services/acesso-rh.service";
import type { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ehResponsavelRhDoCliente } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// A Folha de ponto de um Cliente: o quadro, o cartão do mês do empregado escolhido e a Totalização
// dele pela convenção vigente em cada dia do cartão (a legislação onde nenhuma vale). O Admin e o Líder do
// RH leem; o Funcionário, só os Clientes de que é Responsável (a RLS repete o recorte: cliente fora da vista
// do ator some).
export class ObterFolhaDePonto implements ObterFolhaDePontoPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: FolhaDePontoRepository,
    private readonly apurador: Pick<ApuradorDeCartoes, "apurar">,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(input: ObterFolhaDePontoInput): Promise<Result<FolhaDePontoDto, AppError>> {
    const acesso = decidirAcesso({
      finalidade: "leitura",
      ator: await this.sessao.usuarioAtual(),
      agora: this.relogio.agora(),
      competencia: input.competencia,
      mensagens: {
        semAcesso: "Sem acesso à Folha de ponto do RH.",
        mesFuturo: "Não há cartão de um mês que ainda não começou.",
      },
    });
    if (!acesso.ok) return acesso;
    const { ator, competencia } = acesso.value;

    const quadro = await this.carregarQuadro(input.clienteId, ator, competencia);
    if (!quadro.ok) return quadro;
    const { base, empregados } = quadro.value;

    // Sem empregado pedido o quadro abre no formulário "Novo empregado": nada é escolhido por padrão.
    if (!input.empregadoId) return ok({ ...base, selecionado: null });
    const escolhido = empregados.find((e) => e.id === input.empregadoId);
    if (!escolhido) return err(new NotFoundError("Empregado não encontrado."));

    const cartoes = await this.apurador.apurar(input.clienteId, [escolhido], competencia);
    return cartoes.ok ? ok({ ...base, selecionado: cartoes.value[0] }) : cartoes;
  }

  private async carregarQuadro(
    clienteId: string,
    ator: AtorSessaoDto,
    competencia: Competencia,
  ): Promise<
    Result<
      { base: Omit<FolhaDePontoDto, "selecionado">; empregados: EmpregadoDaFolhaDto[] },
      AppError
    >
  > {
    const cliente = await this.repositorio.buscarCliente(clienteId);
    if (!cliente.ok) return cliente;
    if (!cliente.value) return err(new NotFoundError("Cliente não encontrado."));

    const [empregados, semMovimento, padrao] = await Promise.all([
      this.repositorio.listarEmpregados(clienteId),
      this.repositorio.listarSemMovimento(clienteId, competencia.primeiroDia),
      this.repositorio.buscarPadraoComissionados(clienteId),
    ]);
    if (!empregados.ok) return empregados;
    if (!semMovimento.ok) return semMovimento;
    if (!padrao.ok) return padrao;

    const sem = new Set(semMovimento.value);
    const quadro = empregados.value.map((e) => ({ ...e, semMovimento: sem.has(e.id) }));
    const base = {
      clienteId,
      empresa: cliente.value.empresa,
      competencia: competencia.valor,
      padraoComissionados: padrao.value,
      empregados: quadro,
      podeEditar: ehResponsavelRhDoCliente(ator, cliente.value.responsavelId),
    };
    return ok({ base, empregados: quadro });
  }
}
