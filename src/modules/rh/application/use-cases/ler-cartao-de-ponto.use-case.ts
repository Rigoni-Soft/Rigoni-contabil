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
import { EscreverPonto } from "@/modules/rh/application/use-cases/gerir-quadro-de-funcionarios.use-case";
import {
  acharEmpregadoPeloNome,
  deduzirJornada,
  validarLeitura,
  type LeituraValida,
} from "@/modules/rh/domain/services/leitura-do-cartao.service";
import { Competencia } from "@/modules/rh/domain/value-objects/competencia.vo";
import type { AppError } from "@/shared/errors/app.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Limite do corpo de uma Server Action na Vercel (ADR 0007).
export const MAXIMO_DA_FOTO_BYTES = 4 * 1024 * 1024;
const MANUAL = "Não foi possível ler o cartão. Digite os horários à mão.";

function ehImagem({ bytes, tipo }: LerCartaoDePontoInput["imagem"]): boolean {
  if (bytes.length === 0 || bytes.length > MAXIMO_DA_FOTO_BYTES) return false;
  return tipo === "image/png"
    ? bytes[0] === 0x89 && bytes[1] === 0x50
    : bytes[0] === 0xff && bytes[1] === 0xd8;
}

// Lê a foto do cartão de uma quinzena pelo leitor (visão atrás da porta neutra) e valida a leitura no
// domínio; leitor ausente, falha ou leitura reprovada = digitação manual, sem gravar nada. Quem não está no
// Quadro é cadastrado pelo nome do cartão, com a Jornada deduzida do padrão das batidas; o empregado já
// cadastrado mantém a sua. Dia em branco não apaga o que já foi digitado. A imagem só passa por aqui: não é
// guardada.
export class LerCartaoDePonto extends EscreverPonto implements LerCartaoDePontoPort {
  constructor(
    sessao: SessaoPort,
    repositorio: FolhaDePontoRepository,
    auditoria: AuditoriaPort,
    private readonly relogio: RelogioPort,
    private readonly leitor: LeitorDeCartaoPort | null,
    private readonly erros: RegistroDeErrosPort,
  ) {
    super(sessao, repositorio, auditoria, "rh.ponto.ler-cartao");
  }

  async execute(input: LerCartaoDePontoInput): Promise<Result<CartaoLidoDto, AppError>> {
    const competencia = Competencia.criar(input.competencia);
    if (!competencia.ok) return competencia;
    if (competencia.value.ehFutura(this.relogio.agora())) {
      return err(new ValidationError("Não há cartão de um mês que ainda não começou."));
    }
    if (!ehImagem(input.imagem)) {
      return err(new ValidationError("Envie a foto do cartão em JPEG ou PNG de até 4 MB."));
    }
    const autorizado = await this.autorizar(input.clienteId);
    if (!autorizado.ok) return autorizado;

    const valida = await this.ler(input, competencia.value.valor);
    if (!valida) return err(new ValidationError(MANUAL));

    const empregado = await this.empregadoDoCartao(input.clienteId, valida);
    if (!empregado.ok) return empregado;

    const iniciado = await this.repositorio.iniciarCartao(
      empregado.value.id,
      competencia.value.primeiroDia,
    );
    if (!iniciado.ok) return iniciado;
    for (const dia of valida.dias) {
      const salvo = await this.repositorio.salvarDia(empregado.value.id, dia);
      if (!salvo.ok) return salvo;
    }
    return ok({
      empregadoId: empregado.value.id,
      nome: valida.nome,
      cadastrado: empregado.value.cadastrado,
      dias: valida.dias.length,
      faltas: valida.faltas.length,
      abonos: valida.dias.filter((d) => d.abono).length,
    });
  }

  private async ler(
    input: LerCartaoDePontoInput,
    competencia: string,
  ): Promise<LeituraValida | null> {
    if (!this.leitor) return null;
    let bruta: Awaited<ReturnType<LeitorDeCartaoPort["ler"]>>;
    try {
      bruta = await this.leitor.ler(input.imagem);
    } catch (e) {
      this.erros.registrar("rh.cartao.leitor_falhou", String(e));
      return null;
    }
    if (!bruta.lido) return null;
    const valida = validarLeitura(bruta.leitura, { competencia, quinzena: input.quinzena });
    if (valida.ok) return valida.value;
    // Só o motivo: a leitura tem nome e horários de uma pessoa.
    this.erros.registrar("rh.cartao.leitura_reprovada", valida.error.message);
    return null;
  }

  private async empregadoDoCartao(
    clienteId: string,
    valida: LeituraValida,
  ): Promise<Result<{ id: string; cadastrado: boolean }, AppError>> {
    const quadro = await this.repositorio.listarEmpregados(clienteId);
    if (!quadro.ok) return quadro;
    const ativos = quadro.value.filter((e) => e.ativo);
    const achado = acharEmpregadoPeloNome(valida.nome, ativos);
    if (achado.tipo === "um") return ok({ id: achado.id, cadastrado: false });
    if (achado.tipo === "varios") {
      return err(new ValidationError("Mais de um empregado com esse nome. Digite à mão."));
    }

    const padrao = await this.repositorio.buscarPadraoComissionados(clienteId);
    if (!padrao.ok) return padrao;
    const criado = await this.repositorio.cadastrarEmpregado(clienteId, {
      nome: valida.nome,
      jornada: [...deduzirJornada(valida.dias)],
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
      ? ok({ id: novo.id, cadastrado: true })
      : err(new ValidationError(MANUAL));
  }
}
