import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type {
  ClienteAcompanhamentoDto,
  EscopoDoAplica,
  ServicoAcompanhamentoDto,
} from "@/modules/rh/application/dtos/acompanhamento.dto";
import type {
  AcompanhamentoRepository,
  ClienteDoAcompanhamentoDto,
} from "@/modules/rh/application/ports/out/acompanhamento.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ConflictError } from "@/shared/errors/conflict.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { mesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_RH } from "@/shared/kernel/setores";

const TAMANHO_PAGINA = 1000;
const FALHA_GRAVAR = "Não foi possível salvar. Tente novamente.";

type Pagina = PromiseLike<{ data: unknown[] | null; error: PostgrestError | null }>;

// O PostgREST corta a resposta em 1000 linhas: lê página a página até acabar.
async function lerTudo<T>(pagina: (de: number, ate: number) => Pagina): Promise<T[]> {
  const linhas: T[] = [];
  for (let de = 0; ; de += TAMANHO_PAGINA) {
    const { data, error } = await pagina(de, de + TAMANHO_PAGINA - 1);
    if (error) throw new Error(error.message);
    linhas.push(...((data ?? []) as T[]));
    if ((data?.length ?? 0) < TAMANHO_PAGINA) return linhas;
  }
}

// O banco (RLS + gatilhos) é a última barreira: quem não é o Responsável do RH do Cliente, ou o Líder do
// RH nos serviços, recebe 42501; as regras de dado levantam exceções nomeadas.
export class SupabaseAcompanhamentoRepository implements AcompanhamentoRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async listarServicos(competencia: string): Promise<Result<ServicoAcompanhamentoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_servicos_acompanhamento")
      .select("id, nome, sistema, ativo_desde, desativado_em")
      .lte("ativo_desde", competencia)
      .order("ordem");
    if (error) return this.falhaDeLeitura(error);

    // Desativar vale do mês da desativação em diante; os meses anteriores seguem com o serviço.
    const mes = competencia.slice(0, 7);
    return ok(
      data
        .filter((s) => s.desativado_em === null || mes < mesAtual(new Date(s.desativado_em)))
        .map((s) => ({ id: s.id, nome: s.nome, sistema: s.sistema })),
    );
  }

  async listarClientes(
    competencia: string,
    responsavelId: string | null,
    incluirSemResponsavel = false,
  ): Promise<Result<ClienteAcompanhamentoDto[], AppError>> {
    try {
      const responsaveis = await lerTudo<{
        cliente_id: string;
        responsavel_id: string;
        responsavel: { nome: string } | null;
      }>((de, ate) => {
        const consulta = this.supabase
          .from("cliente_responsaveis")
          .select("cliente_id, responsavel_id, responsavel:perfis!responsavel_id(nome)")
          .eq("setor", SETOR_RH)
          .order("cliente_id")
          .range(de, ate);
        return responsavelId ? consulta.eq("responsavel_id", responsavelId) : consulta;
      });
      if (responsaveis.length === 0 && !incluirSemResponsavel) return ok([]);

      // A view `clientes_basico` só devolve o que o ator enxerga; o RH não lê o cadastro do SN.
      const [clientes, naoAplica, marcacoes, cartoes] = await Promise.all([
        lerTudo<{ id: string; empresa: string; cnpj: string }>((de, ate) =>
          this.supabase
            .from("clientes_basico")
            .select("id, empresa, cnpj")
            .order("id")
            .range(de, ate),
        ),
        // "Não se aplica" vale no mês pedido (renova-se todo mês) ou sempre (competência nula).
        lerTudo<{ cliente_id: string; servico_id: string; competencia: string | null }>((de, ate) =>
          this.supabase
            .from("rh_cliente_servico_aplica")
            .select("cliente_id, servico_id, competencia")
            .eq("aplica", false)
            .or(`competencia.is.null,competencia.eq.${competencia}`)
            .order("cliente_id")
            .order("servico_id")
            .order("competencia", { nullsFirst: true })
            .range(de, ate),
        ),
        lerTudo<{ cliente_id: string; servico_id: string }>((de, ate) =>
          this.supabase
            .from("rh_acompanhamento_marcacoes")
            .select("cliente_id, servico_id")
            .eq("competencia", competencia)
            .order("cliente_id")
            .order("servico_id")
            .range(de, ate),
        ),
        // Contagem do Holerite (cadastrados, sem movimento e cartões feitos); a RLS recorta por Cliente.
        lerTudo<{
          cliente_id: string;
          cadastrados: number;
          sem_movimento: number;
          cartoes: number;
        }>((de, ate) =>
          this.supabase
            .rpc("rh_cartoes_do_mes", { p_competencia: competencia })
            .order("cliente_id")
            .range(de, ate),
        ),
      ]);

      const porCliente = (linhas: { cliente_id: string; servico_id: string }[]) => {
        const mapa = new Map<string, string[]>();
        for (const l of linhas)
          mapa.set(l.cliente_id, [...(mapa.get(l.cliente_id) ?? []), l.servico_id]);
        return mapa;
      };
      const naoAplicaDe = porCliente(naoAplica);
      const naoAplicaSempreDe = porCliente(naoAplica.filter((l) => l.competencia === null));
      const concluidosDe = porCliente(marcacoes);
      const responsavelDe = new Map(responsaveis.map((r) => [r.cliente_id, r]));
      const cartoesDe = new Map(cartoes.map((c) => [c.cliente_id, c]));

      return ok(
        clientes
          .filter((c) => incluirSemResponsavel || responsavelDe.has(c.id))
          .sort((a, b) => a.empresa.localeCompare(b.empresa, "pt-BR"))
          .map((c) => {
            const r = responsavelDe.get(c.id);
            const h = cartoesDe.get(c.id);
            return {
              clienteId: c.id,
              empresa: c.empresa,
              cnpj: c.cnpj,
              naoAplica: [...new Set(naoAplicaDe.get(c.id) ?? [])],
              naoAplicaSempre: naoAplicaSempreDe.get(c.id) ?? [],
              concluidos: concluidosDe.get(c.id) ?? [],
              responsavel: r
                ? { id: r.responsavel_id, nome: r.responsavel?.nome ?? "Sem nome" }
                : null,
              holerite: {
                cadastrados: h?.cadastrados ?? 0,
                semMovimento: h?.sem_movimento ?? 0,
                cartoes: h?.cartoes ?? 0,
              },
            };
          }),
      );
    } catch (e) {
      this.erros.registrar("Falha ao ler o acompanhamento do RH:", (e as Error).message);
      return err(new PersistenciaError("Não foi possível carregar o acompanhamento."));
    }
  }

  async buscarCliente(
    clienteId: string,
  ): Promise<Result<ClienteDoAcompanhamentoDto | null, AppError>> {
    const [cliente, responsavel] = await Promise.all([
      this.supabase.from("clientes_basico").select("cnpj").eq("id", clienteId).maybeSingle(),
      this.supabase
        .from("cliente_responsaveis")
        .select("responsavel_id")
        .eq("cliente_id", clienteId)
        .eq("setor", SETOR_RH)
        .maybeSingle(),
    ]);
    if (cliente.error) return this.falhaDeLeitura(cliente.error);
    if (responsavel.error) return this.falhaDeLeitura(responsavel.error);
    if (!cliente.data) return ok(null);
    return ok({ cnpj: cliente.data.cnpj, responsavelId: responsavel.data?.responsavel_id ?? null });
  }

  async criarServico(nome: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("rh_servicos_acompanhamento").insert({ nome });
    return this.resultado(error);
  }

  async renomearServico(id: string, nome: string): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_servicos_acompanhamento")
      .update({ nome })
      .eq("id", id)
      .select("id");
    return this.resultadoComLinhas(error, data);
  }

  async desativarServico(id: string): Promise<Result<void, AppError>> {
    // O gatilho carimba o instante; o valor enviado só liga a desativação.
    const { data, error } = await this.supabase
      .from("rh_servicos_acompanhamento")
      .update({ desativado_em: new Date().toISOString() })
      .eq("id", id)
      .is("desativado_em", null)
      .select("id");
    return this.resultadoComLinhas(error, data);
  }

  async definirAplica(
    clienteId: string,
    servicoId: string,
    competencia: string,
    escopo: EscopoDoAplica,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.rpc("definir_aplica_rh", {
      p_cliente_id: clienteId,
      p_servico_id: servicoId,
      p_competencia: competencia,
      p_escopo: escopo,
    });
    return this.resultado(error);
  }

  async marcar(
    clienteId: string,
    servicoId: string,
    competencia: string,
    concluido: boolean,
    atorId: string,
  ): Promise<Result<void, AppError>> {
    const { error } = concluido
      ? await this.supabase
          .from("rh_acompanhamento_marcacoes")
          .upsert(
            { cliente_id: clienteId, servico_id: servicoId, competencia, marcado_por: atorId },
            { onConflict: "cliente_id,servico_id,competencia", ignoreDuplicates: true },
          )
      : await this.supabase
          .from("rh_acompanhamento_marcacoes")
          .delete()
          .eq("cliente_id", clienteId)
          .eq("servico_id", servicoId)
          .eq("competencia", competencia);
    return this.resultado(error);
  }

  // A RLS esconde a linha de quem não pode: o UPDATE não dá erro, só não afeta nada.
  private resultadoComLinhas(
    error: PostgrestError | null,
    linhas: unknown[] | null,
  ): Result<void, AppError> {
    if (!error && (linhas?.length ?? 0) === 0) {
      return err(new ForbiddenError("Este serviço não pode ser alterado."));
    }
    return this.resultado(error);
  }

  private resultado(error: PostgrestError | null): Result<void, AppError> {
    if (!error) return ok(undefined);
    if (error.code === "42501") {
      return err(new ForbiddenError("Você não pode alterar este acompanhamento."));
    }
    if (error.code === "23505") {
      return err(new ConflictError("Já existe um serviço ativo com esse nome."));
    }
    if (error.message.includes("servico_rh_do_sistema")) {
      return err(new ValidationError("O Holerite é preenchido pelo sistema, não à mão."));
    }
    if (
      error.message.includes("servico_rh_imutavel") ||
      error.message.includes("servico_rh_desativado")
    ) {
      return err(new ValidationError("Este serviço não pode ser alterado."));
    }
    if (error.message.includes("servico_rh_fora_da_competencia")) {
      return err(new ValidationError("Este serviço não está no acompanhamento do mês."));
    }
    if (error.message.includes("servico_rh_nao_se_aplica")) {
      return err(new ValidationError("Este serviço não se aplica ao cliente neste mês."));
    }
    if (error.message.includes("competencia_futura")) {
      return err(new ValidationError("Não dá para marcar um mês que ainda não começou."));
    }
    this.erros.registrar("Falha ao gravar o acompanhamento do RH:", error.message);
    return err(new PersistenciaError(FALHA_GRAVAR));
  }

  private falhaDeLeitura(error: PostgrestError): Result<never, AppError> {
    this.erros.registrar("Falha ao ler o acompanhamento do RH:", error.message);
    return err(new PersistenciaError("Não foi possível carregar o acompanhamento."));
  }
}
