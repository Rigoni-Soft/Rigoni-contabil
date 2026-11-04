import type {
  AcompanhamentoFuncionariosDto,
  ClienteAcompanhamentoDto,
  DetalheDoFuncionarioDto,
  FuncionarioAcompanhamentoDto,
  ServicoAcompanhamentoDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import type {
  ObterAcompanhamentoFuncionariosInput,
  ObterAcompanhamentoFuncionariosPort,
} from "@/modules/rh/application/ports/in/obter-acompanhamento-funcionarios.provider";
import type { AcompanhamentoRepository } from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { podeVerAcompanhamentoDosFuncionariosRh } from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";

// Meses da evolução, contando o consultado.
const MESES_DA_EVOLUCAO = 6;

type Mes = { competencia: string; servicos: ServicoAcompanhamentoDto[]; clientes: ClienteAcompanhamentoDto[] };

// Serviços que ainda faltam no cliente: os que se aplicam e não estão concluídos (o Holerite entra).
function faltantes(cliente: ClienteAcompanhamentoDto, servicos: ServicoAcompanhamentoDto[]) {
  const naoAplica = new Set(cliente.naoAplica);
  const concluidos = new Set(cliente.concluidos);
  return servicos.filter((s) => !naoAplica.has(s.id) && !concluidos.has(s.id));
}

function resumir(
  funcionario: { id: string; nome: string },
  clientes: ClienteAcompanhamentoDto[],
  servicos: ServicoAcompanhamentoDto[],
): FuncionarioAcompanhamentoDto {
  const pendentes = clientes.map((c) => new Set(faltantes(c, servicos).map((s) => s.id)));
  return {
    ...funcionario,
    atribuidos: clientes.length,
    pontos: pendentes.filter((p) => p.size === 0).length,
    faltam: servicos.map((s) => ({
      servicoId: s.id,
      nome: s.nome,
      clientes: pendentes.filter((p) => p.has(s.id)).length,
    })),
  };
}

// O gráfico do RH: pontos x clientes atribuídos por Funcionário, quem falta em cada serviço e, para um
// Funcionário, o detalhe do mês. Só Líder e Admin; a RLS já deixa o Funcionário ver só os seus.
export class ObterAcompanhamentoFuncionarios implements ObterAcompanhamentoFuncionariosPort {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly repositorio: AcompanhamentoRepository,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(
    input: ObterAcompanhamentoFuncionariosInput,
  ): Promise<Result<AcompanhamentoFuncionariosDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator || !podeVerAcompanhamentoDosFuncionariosRh(ator.papel, ator.setor)) {
      return err(new ForbiddenError("Sem acesso ao acompanhamento dos funcionários."));
    }

    const agora = this.relogio.agora();
    const competencia = input.competencia
      ? Competencia.criar(input.competencia)
      : ok(Competencia.atual(agora));
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(agora)) {
      return err(new ValidationError("Não há acompanhamento de um mês que ainda não começou."));
    }

    // ponytail: 2 leituras por mês da janela, só para a evolução; materializar por mês se pesar.
    const meses = await Promise.all(
      competencia.value.ultimosMeses(MESES_DA_EVOLUCAO).map(async (mes, i, todos): Promise<Result<Mes, AppError>> => {
        const dia = `${mes}-01`;
        const [servicos, clientes] = await Promise.all([
          this.repositorio.listarServicos(dia),
          this.repositorio.listarClientes(dia, null, i === todos.length - 1),
        ]);
        if (!servicos.ok) return servicos;
        if (!clientes.ok) return clientes;
        return ok({ competencia: mes, servicos: servicos.value, clientes: clientes.value });
      }),
    );
    const falha = meses.find((m) => !m.ok);
    if (falha && !falha.ok) return falha;
    const janela = meses.flatMap((m) => (m.ok ? [m.value] : []));
    const atual = janela[janela.length - 1];

    const porFuncionario = new Map<string, { nome: string; clientes: ClienteAcompanhamentoDto[] }>();
    for (const c of atual.clientes) {
      if (!c.responsavel) continue;
      const entrada = porFuncionario.get(c.responsavel.id) ?? { nome: c.responsavel.nome, clientes: [] };
      entrada.clientes.push(c);
      porFuncionario.set(c.responsavel.id, entrada);
    }
    const funcionarios = [...porFuncionario]
      .map(([id, f]) => resumir({ id, nome: f.nome }, f.clientes, atual.servicos))
      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

    return ok({
      competencia: competencia.value.valor,
      funcionarios,
      semResponsavel: atual.clientes
        .filter((c) => !c.responsavel)
        .map((c) => ({ clienteId: c.clienteId, empresa: c.empresa })),
      detalhe: input.funcionarioId
        ? detalharFuncionario(input.funcionarioId, funcionarios, janela)
        : undefined,
    });
  }
}

function detalharFuncionario(
  id: string,
  funcionarios: FuncionarioAcompanhamentoDto[],
  janela: Mes[],
): DetalheDoFuncionarioDto | undefined {
  const funcionario = funcionarios.find((f) => f.id === id);
  if (!funcionario) return undefined;

  const doFuncionario = (mes: Mes) => mes.clientes.filter((c) => c.responsavel?.id === id);
  const atual = janela[janela.length - 1];
  const clientesAtuais = doFuncionario(atual);

  const pendencias = atual.servicos
    .map((s) => ({
      servicoId: s.id,
      nome: s.nome,
      clientes: clientesAtuais
        .filter((c) => faltantes(c, atual.servicos).some((f) => f.id === s.id))
        .map((c) => ({ clienteId: c.clienteId, empresa: c.empresa })),
    }))
    .filter((p) => p.clientes.length > 0);

  const evolucao = janela.map((mes) => {
    const { pontos, atribuidos } = resumir({ id, nome: funcionario.nome }, doFuncionario(mes), mes.servicos);
    return { competencia: mes.competencia, pontos, atribuidos };
  });

  // Meses seguidos de pendência, contados para trás a partir do mês consultado.
  const maisAtrasados = clientesAtuais
    .map((c) => {
      let meses = 0;
      for (const mes of [...janela].reverse()) {
        const doMes = doFuncionario(mes).find((x) => x.clienteId === c.clienteId);
        if (!doMes || faltantes(doMes, mes.servicos).length === 0) break;
        meses++;
      }
      return { clienteId: c.clienteId, empresa: c.empresa, meses };
    })
    .filter((c) => c.meses > 0)
    .sort((a, b) => b.meses - a.meses || a.empresa.localeCompare(b.empresa, "pt-BR"));

  return { funcionario, pendencias, evolucao, maisAtrasados };
}
