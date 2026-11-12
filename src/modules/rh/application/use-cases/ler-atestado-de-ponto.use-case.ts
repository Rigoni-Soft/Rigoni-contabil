import type {
  AtestadoLidoDto,
  LerAtestadoDePontoInput,
  LerAtestadoDePontoPort,
} from "@/modules/rh/application/ports/in/ler-atestado-de-ponto.provider";
import type { AuditoriaPort } from "@/modules/rh/application/ports/out/auditoria.provider";
import type { FolhaDePontoRepository } from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { LeitorDeAtestadoPort } from "@/modules/rh/application/ports/out/leitor-de-cartao.provider";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { RelogioPort } from "@/modules/rh/application/ports/out/relogio.provider";
import type { SessaoPort } from "@/modules/rh/application/ports/out/sessao.provider";
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import { ehImagem } from "@/modules/rh/application/use-cases/ler-cartao-de-ponto.use-case";
import { abonosDoAtestado, validarAtestado } from "@/modules/rh/domain/services/atestado.service";
import { acharEmpregadoPeloNome } from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const MANUAL = "Não foi possível ler o atestado. Abone os dias à mão.";

// Lê a foto de um atestado ou declaração de comparecimento e marca Abono nos dias do cartão do empregado
// (achado pelo nome no Quadro; nunca cadastra). Só o Abono é guardado: nome, datas, CID, documento e imagem
// ficam no leitor e morrem aqui. Leitura que falha ou reprova = abono à mão, sem gravar.
export class LerAtestadoDePonto extends EscreverPonto implements LerAtestadoDePontoPort {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
    private readonly leitor: LeitorDeAtestadoPort,
    private readonly erros: RegistroDeErrosPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.ponto.ler-atestado");
  }

  async execute(input: LerAtestadoDePontoInput): Promise<Result<AtestadoLidoDto, AppError>> {
    if (!ehImagem(input.imagem)) {
      return err(new ValidationError("Envie a foto do atestado em JPEG ou PNG de até 4 MB."));
    }
    const autorizado = await this.autorizar(input.clienteId);
    if (!autorizado.ok) return autorizado;

    const atestado = await this.ler(input);
    if (!atestado) return err(new ValidationError(MANUAL));

    const quadro = await this.repositorio.listarEmpregados(input.clienteId);
    if (!quadro.ok) return quadro;
    const ativos = quadro.value.filter((e) => e.ativo);
    const achado = acharEmpregadoPeloNome(atestado.nome, ativos);
    const empregado = achado.tipo === "um" ? ativos.find((e) => e.id === achado.id) : undefined;
    if (!empregado) {
      return err(
        new ValidationError(
          "Nenhum empregado do quadro com esse nome (ou mais de um). Abone os dias à mão.",
        ),
      );
    }

    const dias = await this.repositorio.listarDias(empregado.id, atestado.de, atestado.ate);
    if (!dias.ok) return dias;
    const porData = new Map(dias.value.map((d) => [d.data, d]));
    const comBatida = new Set(dias.value.filter((d) => d.batidas.length > 0).map((d) => d.data));
    const abonos = abonosDoAtestado(atestado, empregado.jornada, comBatida);
    for (const data of abonos) {
      const atual = porData.get(data);
      const salvo = await this.repositorio.salvarDia(empregado.id, {
        data,
        batidas: atual?.batidas ?? [],
        extra: atual?.extra ?? null,
        abono: true,
      });
      if (!salvo.ok) return salvo;
    }
    return ok({ nome: atestado.nome, tipo: atestado.tipo, abonados: abonos.length });
  }

  // null = leitor falhou, não leu ou a validação reprovou (inclusive mês que ainda não começou).
  private async ler(input: LerAtestadoDePontoInput) {
    let bruta: Awaited<ReturnType<LeitorDeAtestadoPort["lerAtestado"]>>;
    try {
      bruta = await this.leitor.lerAtestado(input.imagem);
    } catch (e) {
      this.erros.registrar("rh.atestado.leitor_falhou", String(e));
      return null;
    }
    if (!bruta.lido) return null;
    const valido = validarAtestado(bruta.atestado);
    if (!valido.ok) {
      // Só o motivo: a leitura tem nome e datas de uma pessoa.
      this.erros.registrar("rh.atestado.leitura_reprovada", valido.error.message);
      return null;
    }
    const meses = [valido.value.de, valido.value.ate].map((d) => Competencia.criar(d.slice(0, 7)));
    const agora = this.relogio.agora();
    if (meses.some((m) => !m.ok || m.value.ehFutura(agora))) {
      this.erros.registrar("rh.atestado.leitura_reprovada", "Mês que ainda não começou.");
      return null;
    }
    return valido.value;
  }
}
