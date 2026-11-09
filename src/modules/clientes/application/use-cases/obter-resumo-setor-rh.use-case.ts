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

// ponytail: `doBucket` repete o molde de obter-resumo-setor-sn; extrair no 3º Setor com resumo.
const doBucket = ({ clienteId, empresa, cnpj }: ClienteDaCarteiraRow) => ({
  clienteId,
  empresa,
  cnpj,
});

// Um grupo por Responsável presente na carteira (mais "Sem responsável" quando há Cliente sem
// atribuição), contando os Clientes de cada um.
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

// Resumo do Setor RH: Admin (suporte), Líder e Funcionário do RH. O Funcionário vê só os Clientes de
// que é Responsável; Líder e Admin, a carteira inteira e o comparativo por Responsável.
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

    // O grupo Parcelamento é o do SN; o RH o alimenta com os parcelamentos que cadastrar.
    // ponytail: TODO(#216) até lá nenhum parcelamento é do RH, então os 6 cards saem zerados.
    const semParcelamento = linhas.map((l) => ({ ...doBucket(l), parcelamentos: [] }));
    const agora = this.relogio.agora();
    const parcelamentos = classificarParcelamento(semParcelamento, agora);

    return ok({
      totalClientes: linhas.length,
      cards: parcelamentos,
      grupos: gruposDeParcelamento(),
      comparativos: {
        parcelamento: comparativoDeParcelamento(semParcelamento, agora),
        responsaveis: podeVerAcompanhamentoDosFuncionariosRh(ator.papel, ator.setor)
          ? porResponsavel(linhas)
          : undefined,
      },
    });
  }
}
