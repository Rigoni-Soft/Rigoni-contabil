import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { InterruptoresDoClienteDto } from "@/modules/rh/application/dtos/convencao.dto";
import type {
  DiaDoPontoDto,
  EmpregadoDto,
  ParDto,
} from "@/modules/rh/application/dtos/folha-de-ponto.dto";
import type {
  ClienteDoPontoDto,
  DadosDoEmpregado,
  FolhaDePontoRepository,
} from "@/modules/rh/application/ports/out/folha-de-ponto.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import {
  clienteBasicoRowSchema,
  diaDoPontoRowSchema,
  empregadoClienteRowSchema,
  empregadoConvencaoRowSchema,
  empregadoIdRowSchema,
  empregadoRowSchema,
  feriadoRowSchema,
  interruptoresRowSchema,
  padraoRowSchema,
  responsavelRowSchema,
} from "@/modules/rh/infra/dtos/folha-de-ponto-row.dto";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_RH } from "@/shared/kernel/setores";

const FALHA_GRAVAR = "Não foi possível salvar. Tente novamente.";
const FALHA_LER = "Não foi possível carregar a Folha de ponto.";

// O banco (RLS + gatilhos) é a última barreira: quem não é o Responsável do RH do Cliente recebe 42501 (ou
// nenhuma linha afetada); as regras de dado levantam exceções nomeadas.
export class SupabaseFolhaDePontoRepository implements FolhaDePontoRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async buscarCliente(clienteId: string): Promise<Result<ClienteDoPontoDto | null, AppError>> {
    const [cliente, responsavel] = await Promise.all([
      this.supabase
        .from("clientes_basico")
        .select("cnpj, empresa")
        .eq("id", clienteId)
        .maybeSingle(),
      this.supabase
        .from("cliente_responsaveis")
        .select("responsavel_id")
        .eq("cliente_id", clienteId)
        .eq("setor", SETOR_RH)
        .maybeSingle(),
    ]);
    if (cliente.error) return this.falhaDeLeitura(cliente.error);
    if (responsavel.error) return this.falhaDeLeitura(responsavel.error);
    const lido = this.ler(clienteBasicoRowSchema.nullable(), cliente.data);
    const dono = this.ler(responsavelRowSchema.nullable(), responsavel.data);
    if (!lido.ok) return lido;
    if (!dono.ok) return dono;
    if (!lido.value) return ok(null);
    return ok({ ...lido.value, responsavelId: dono.value?.responsavel_id ?? null });
  }

  async buscarClienteDoEmpregado(empregadoId: string): Promise<Result<string | null, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .select("cliente_id")
      .eq("id", empregadoId)
      .maybeSingle();
    if (error) return this.falhaDeLeitura(error);
    const lido = this.ler(empregadoClienteRowSchema.nullable(), data);
    return lido.ok ? ok(lido.value?.cliente_id ?? null) : lido;
  }

  async listarEmpregados(clienteId: string): Promise<Result<EmpregadoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .select("id, nome, jornada, comissionado, ativo")
      .eq("cliente_id", clienteId);
    if (error) return this.falhaDeLeitura(error);
    const lidos = this.ler(z.array(empregadoRowSchema), data);
    return lidos.ok ? ok(lidos.value.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))) : lidos;
  }

  async listarSemMovimento(
    clienteId: string,
    competencia: string,
  ): Promise<Result<string[], AppError>> {
    // A RLS recorta pelo Cliente do empregado; o filtro por competência é do mês pedido.
    const { data, error } = await this.supabase
      .from("rh_empregado_sem_movimento")
      .select("empregado_id, rh_empregados!inner(cliente_id)")
      .eq("competencia", competencia)
      .eq("rh_empregados.cliente_id", clienteId);
    if (error) return this.falhaDeLeitura(error);
    const lidos = this.ler(z.array(empregadoIdRowSchema), data);
    return lidos.ok ? ok(lidos.value.map((l) => l.empregado_id)) : lidos;
  }

  async cartaoIniciado(
    empregadoId: string,
    competencia: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_cartoes_iniciados")
      .select("empregado_id")
      .eq("empregado_id", empregadoId)
      .eq("competencia", competencia)
      .maybeSingle();
    if (error) return this.falhaDeLeitura(error);
    return ok(!!data);
  }

  async iniciarCartao(empregadoId: string, competencia: string): Promise<Result<void, AppError>> {
    const { error } = await this.supabase
      .from("rh_cartoes_iniciados")
      .upsert(
        { empregado_id: empregadoId, competencia },
        { onConflict: "empregado_id,competencia", ignoreDuplicates: true },
      );
    return this.resultado(error);
  }

  async buscarPadraoComissionados(clienteId: string): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_ponto_padroes")
      .select("comissionados")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) return this.falhaDeLeitura(error);
    const lido = this.ler(padraoRowSchema.nullable(), data);
    return lido.ok ? ok(lido.value?.comissionados ?? false) : lido;
  }

  async definirPadraoComissionados(
    clienteId: string,
    valor: boolean,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase
      .from("rh_ponto_padroes")
      .upsert({ cliente_id: clienteId, comissionados: valor }, { onConflict: "cliente_id" });
    return this.resultado(error);
  }

  async cadastrarEmpregado(
    clienteId: string,
    dados: DadosDoEmpregado,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase
      .from("rh_empregados")
      .insert({ cliente_id: clienteId, ...dados });
    return this.resultado(error);
  }

  async corrigirEmpregado(id: string, dados: DadosDoEmpregado): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .update(dados)
      .eq("id", id)
      .select("id");
    return this.resultadoComLinhas(error, data);
  }

  async definirAtivo(id: string, ativo: boolean): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .update({ ativo })
      .eq("id", id)
      .select("id");
    return this.resultadoComLinhas(error, data);
  }

  async definirSemMovimento(
    empregadoId: string,
    competencia: string,
    sem: boolean,
  ): Promise<Result<void, AppError>> {
    const { error } = sem
      ? await this.supabase
          .from("rh_empregado_sem_movimento")
          .upsert(
            { empregado_id: empregadoId, competencia },
            { onConflict: "empregado_id,competencia", ignoreDuplicates: true },
          )
      : await this.supabase
          .from("rh_empregado_sem_movimento")
          .delete()
          .eq("empregado_id", empregadoId)
          .eq("competencia", competencia);
    return this.resultado(error);
  }

  async listarDias(
    empregadoId: string,
    de: string,
    ate: string,
  ): Promise<Result<DiaDoPontoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_ponto_dias")
      .select("data, batidas, extra, abono")
      .eq("empregado_id", empregadoId)
      .gte("data", de)
      .lte("data", ate)
      .order("data");
    if (error) return this.falhaDeLeitura(error);
    return this.ler(z.array(diaDoPontoRowSchema), data);
  }

  async salvarDia(
    empregadoId: string,
    dia: { data: string; batidas: ParDto[]; extra: ParDto | null; abono: boolean },
  ): Promise<Result<void, AppError>> {
    const vazio = dia.batidas.length === 0 && dia.extra === null && !dia.abono;
    const { error } = vazio
      ? await this.supabase
          .from("rh_ponto_dias")
          .delete()
          .eq("empregado_id", empregadoId)
          .eq("data", dia.data)
      : await this.supabase.from("rh_ponto_dias").upsert(
          {
            empregado_id: empregadoId,
            data: dia.data,
            batidas: dia.batidas,
            extra: dia.extra,
            abono: dia.abono,
          },
          { onConflict: "empregado_id,data" },
        );
    return this.resultado(error);
  }

  async listarFeriados(de: string, ate: string): Promise<Result<string[], AppError>> {
    const { data, error } = await this.supabase
      .from("feriados")
      .select("data")
      .gte("data", de)
      .lte("data", ate);
    if (error) return this.falhaDeLeitura(error);
    const lidos = this.ler(z.array(feriadoRowSchema), data);
    return lidos.ok ? ok(lidos.value.map((f) => f.data)) : lidos;
  }

  async buscarInterruptores(
    clienteId: string,
  ): Promise<Result<InterruptoresDoClienteDto, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_cliente_interruptores")
      .select("banco_de_horas, trabalho_aos_domingos")
      .eq("cliente_id", clienteId)
      .maybeSingle();
    if (error) return this.falhaDeLeitura(error);
    const lido = this.ler(interruptoresRowSchema.nullable(), data);
    if (!lido.ok) return lido;
    return ok({
      bancoDeHoras: lido.value?.banco_de_horas ?? false,
      trabalhoAosDomingos: lido.value?.trabalho_aos_domingos ?? false,
    });
  }

  async definirInterruptores(
    clienteId: string,
    interruptores: InterruptoresDoClienteDto,
  ): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("rh_cliente_interruptores").upsert(
      {
        cliente_id: clienteId,
        banco_de_horas: interruptores.bancoDeHoras,
        trabalho_aos_domingos: interruptores.trabalhoAosDomingos,
      },
      { onConflict: "cliente_id" },
    );
    return this.resultado(error);
  }

  async listarConvencaoDosEmpregados(
    clienteId: string,
  ): Promise<Result<{ empregadoId: string; sindicato: string | null }[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .select("id, convencao_sindicato")
      .eq("cliente_id", clienteId);
    if (error) return this.falhaDeLeitura(error);
    const lidos = this.ler(z.array(empregadoConvencaoRowSchema), data);
    return lidos.ok
      ? ok(lidos.value.map((e) => ({ empregadoId: e.id, sindicato: e.convencao_sindicato })))
      : lidos;
  }

  async definirConvencaoDoEmpregado(
    empregadoId: string,
    sindicato: string | null,
  ): Promise<Result<void, AppError>> {
    const { data, error } = await this.supabase
      .from("rh_empregados")
      .update({ convencao_sindicato: sindicato })
      .eq("id", empregadoId)
      .select("id");
    return this.resultadoComLinhas(error, data);
  }

  // A RLS esconde a linha de quem não pode: o UPDATE não dá erro, só não afeta nada.
  private resultadoComLinhas(
    error: PostgrestError | null,
    linhas: unknown[] | null,
  ): Result<void, AppError> {
    if (!error && (linhas?.length ?? 0) === 0) {
      return err(new ForbiddenError("Você não pode alterar este empregado."));
    }
    return this.resultado(error);
  }

  private resultado(error: PostgrestError | null): Result<void, AppError> {
    if (!error) return ok(undefined);
    if (error.code === "42501") {
      return err(new ForbiddenError("Você não pode alterar a Folha de ponto deste cliente."));
    }
    if (error.message.includes("rh_convencao_inexistente")) {
      return err(new ValidationError("O Cliente não tem convenção deste sindicato."));
    }
    if (error.message.includes("rh_empregado_inativo")) {
      return err(new ValidationError("Este empregado está inativo."));
    }
    if (error.code === "23514" || error.code === "22P02") {
      return err(new ValidationError("Dados inválidos."));
    }
    this.erros.registrar("Falha ao gravar a Folha de ponto do RH:", error.message);
    return err(new PersistenciaError(FALHA_GRAVAR));
  }

  private ler<S extends z.ZodType>(schema: S, data: unknown): Result<z.output<S>, AppError> {
    const lido = schema.safeParse(data);
    return lido.success
      ? ok(lido.data)
      : this.falhaDeLeitura({ message: z.prettifyError(lido.error) });
  }

  private falhaDeLeitura(error: { message: string }): Result<never, AppError> {
    this.erros.registrar("Falha ao ler a Folha de ponto do RH:", error.message);
    return err(new PersistenciaError(FALHA_LER));
  }
}
