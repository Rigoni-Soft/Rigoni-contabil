import { comparativoDeParcelamento } from "@/modules/clientes/application/mappers/comparativos-sn.mapper";
import {
  classificarParcelamento,
  gruposDeParcelamento,
} from "@/modules/clientes/application/mappers/resumo-setor-sn.mapper";
import type { ResumoSetorRhDto } from "@/modules/clientes/application/ports/in/obter-resumo-setor-rh.provider";
import type { FatiaComparativoDto } from "@/modules/clientes/application/ports/in/resumo-setor.provider";
import type {
  CarteiraDoSetorQueryPort,
  ClienteDaCarteiraRow,
} from "@/modules/clientes/application/ports/out/carteira-do-setor.provider";
import type { RelogioPort } from "@/modules/clientes/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/clientes/application/ports/out/sessao.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import {
  podeVerAcompanhamentoDosFuncionariosRh,
  podeVerDashboardDoSetor,
  rotuloResponsavel,
  SEM_RESPONSAVEL_ID,
  veCarteiraInteira,
} from "@/shared/kernel/papeis";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_RH } from "@/shared/kernel/setores";

const comoLinhaDeParcelamento = ({
  clienteId,
  empresa,
  cnpj,
  parcelamentos,
}: ClienteDaCarteiraRow) => ({
  clienteId,
  empresa,
  cnpj,
  parcelamentos,
});

function porResponsavel(linhas: ClienteDaCarteiraRow[]): FatiaComparativoDto[] {
  const grupos = new Map<string, FatiaComparativoDto>();
  for (const l of linhas) {
    const id = l.responsavelId ?? SEM_RESPONSAVEL_ID;
    const grupo = grupos.get(id) ?? {
      id,
      rotulo: rotuloResponsavel(l.responsavelId, l.responsavelNome),
      cor: l.responsavelId ? "em_dia" : "informativo",
      quantidade: 0,
    };
    grupo.quantidade += 1;
    grupos.set(id, grupo);
  }
  return [...grupos.values()].sort(
    (a, b) => b.quantidade - a.quantidade || a.rotulo.localeCompare(b.rotulo),
  );
}

export class ObterResumoSetorRh {
  constructor(
    private readonly sessao: SessaoPort,
    private readonly carteira: CarteiraDoSetorQueryPort,
    private readonly relogio: RelogioPort,
  ) {}

  async execute(): Promise<Result<ResumoSetorRhDto, AppError>> {
    const ator = await this.sessao.usuarioAtual();
    if (!ator) return err(new ForbiddenError("Faça login para ver o resumo do setor."));
    if (!podeVerDashboardDoSetor(ator.papel, ator.setor, SETOR_RH)) {
      return err(new ForbiddenError("Só o RH (e o Admin) vê o resumo do setor."));
    }

    const lidas = await this.carteira.listar(SETOR_RH);
    if (!lidas.ok) return lidas;

    const veTudo = veCarteiraInteira(ator.papel);
    const linhas = veTudo ? lidas.value : lidas.value.filter((l) => l.responsavelId === ator.id);

    const doRh = linhas.map(comoLinhaDeParcelamento);
    const agora = this.relogio.agora();
    const parcelamentos = classificarParcelamento(doRh, agora);

    return ok({
      totalClientes: linhas.length,
      cards: parcelamentos,
      grupos: gruposDeParcelamento(),
      comparativos: {
        parcelamento: comparativoDeParcelamento(doRh, agora),
        responsaveis: podeVerAcompanhamentoDosFuncionariosRh(ator.papel, ator.setor)
          ? porResponsavel(linhas)
          : undefined,
      },
    });
  }
}
