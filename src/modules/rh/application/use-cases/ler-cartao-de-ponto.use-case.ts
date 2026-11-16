import type {
  CartaoLidoDto,
  LerCartaoDePontoInput,
  LerCartaoDePontoPort,
} from "@/modules/rh/application/ports/in/ler-cartao-de-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { LeitorDeCartaoPort } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { LerDeFoto } from "@/modules/rh/application/use-cases/ler-de-foto.use-case";
import {
  acharEmpregadoPeloNome,
  deduzirJornada,
  diasAGravar,
  validarLeitura,
  type LeituraValida,
} from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { diaTemDados, type Jornada } from "@/modules/rh/domain/services/totalizacao.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { ehFotoValida } from "@/shared/kernel/foto-do-ponto";
import { err, ok, type Result } from "@/shared/kernel/result";

const MANUAL = "Não foi possível ler o cartão. Digite os horários à mão.";

// Lê a foto do cartão de uma quinzena pelo leitor (visão atrás da porta neutra) e valida a leitura no
// domínio; falha ou leitura reprovada = digitação manual, sem gravar nada. Quem não está no
// Quadro é cadastrado pelo nome do cartão, com a Jornada deduzida do padrão das batidas; o empregado já
// cadastrado mantém a sua. Ler só preenche: o dia que já tem batida, extra ou abono (digitado ou vindo de
// atestado) não é tocado, e o dia em branco não apaga nada. A quinzena entra numa transação só. A imagem só
// passa por aqui: não é guardada.
export class LerCartaoDePonto extends LerDeFoto implements LerCartaoDePontoPort {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
    private readonly leitor: LeitorDeCartaoPort,
    erros: RegistroDeErrosPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.ponto.ler-cartao", erros);
  }

  async execute(input: LerCartaoDePontoInput): Promise<Result<CartaoLidoDto, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não há cartão de um mês que ainda não começou."));
    }
    if (!ehFotoValida(input.imagem)) {
      return err(new ValidationError("Envie a foto do cartão em JPEG ou PNG de até 4 MB."));
    }
    const autorizado = await this.autorizar(input.clienteId);
    if (!autorizado.ok) return autorizado;

    const valida = await this.ler(input, competencia.value.valor);
    if (!valida) return err(new ValidationError(MANUAL));

    const empregado = await this.empregadoDoCartao(input.clienteId, valida);
    if (!empregado.ok) return empregado;

    const datas = valida.dias.map((d) => d.data).sort();
    const primeira = datas[0] ?? competencia.value.primeiroDia;
    const ultima = datas.at(-1) ?? primeira;
    const feriados = await this.repositorio.listarFeriados(primeira, ultima);
    if (!feriados.ok) return feriados;
    const existentes = await this.repositorio.listarDias(empregado.value.id, primeira, ultima);
    if (!existentes.ok) return existentes;
    const datasComDado = new Set(existentes.value.filter(diaTemDados).map((d) => d.data));
    const { gravar, mantidos } = diasAGravar(
      valida.dias,
      empregado.value.jornada,
      new Set(feriados.value),
      datasComDado,
    );

    const gravado = await this.repositorio.gravarCartao(
      empregado.value.id,
      competencia.value.primeiroDia,
      gravar,
    );
    if (!gravado.ok) return gravado;
    return ok({
      empregadoId: empregado.value.id,
      nome: valida.nome,
      cadastrado: empregado.value.cadastrado,
      dias: gravar.length,
      mantidos,
      // Falta em dia que o RH já preencheu é mantida e não conta: o resumo só fala do que a leitura anotou.
      faltas: valida.faltas.filter((data) => !datasComDado.has(data)).length,
      abonos: gravar.filter((d) => d.abono).length,
    });
  }

  private async ler(
    input: LerCartaoDePontoInput,
    competencia: string,
  ): Promise<LeituraValida | null> {
    const bruta = await this.chamarLeitor("rh.cartao.leitor_falhou", () =>
      this.leitor.ler(input.imagem),
    );
    if (!bruta?.lido) return null;
    const valida = validarLeitura(bruta.leitura, { competencia, quinzena: input.quinzena });
    if (valida.ok) return valida.value;
    this.registrarReprovacao("rh.cartao.leitura_reprovada", valida.error.message);
    return null;
  }

  private async empregadoDoCartao(
    clienteId: string,
    valida: LeituraValida,
  ): Promise<Result<{ id: string; cadastrado: boolean; jornada: Jornada }, AppError>> {
    const quadro = await this.repositorio.listarEmpregados(clienteId);
    if (!quadro.ok) return quadro;
    const ativos = quadro.value.filter((e) => e.ativo);
    const achado = acharEmpregadoPeloNome(valida.nome, ativos);
    if (achado.tipo === "um") {
      const existente = ativos.find((e) => e.id === achado.id);
      if (existente) return ok({ id: achado.id, cadastrado: false, jornada: existente.jornada });
    }
    if (achado.tipo === "varios") {
      return err(new ValidationError("Mais de um empregado com esse nome. Digite à mão."));
    }

    const jornada = deduzirJornada(valida.dias);
    const padrao = await this.repositorio.buscarPadraoComissionados(clienteId);
    if (!padrao.ok) return padrao;
    const criado = await this.repositorio.cadastrarEmpregado(clienteId, {
      nome: valida.nome,
      jornada: [...jornada],
      comissionado: padrao.value,
    });
    if (!criado.ok) return criado;
    const depois = await this.repositorio.listarEmpregados(clienteId);
    if (!depois.ok) return depois;
    const novo = acharEmpregadoPeloNome(
      valida.nome,
      depois.value.filter((e) => e.ativo),
    );
    return novo.tipo === "um"
      ? ok({ id: novo.id, cadastrado: true, jornada })
      : err(new ValidationError(MANUAL));
  }
}
