import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type { ConvencaoDto } from "@/modules/rh/application/dtos/convencao.dto";
import type {
  ConvencaoRepository,
  NovaConvencao,
} from "@/modules/rh/application/ports/out/convencao.repository";
import type { RegistroDeErrosPort } from "@/modules/rh/application/ports/out/registro-de-erros.provider";
import { convencaoRowSchema } from "@/modules/rh/infra/dtos/convencao-row.dto";
import {
  falhaDeLeitura,
  lerLinhas,
  type FalhaDeLeitura,
} from "@/modules/rh/infra/mappers/falha-de-leitura.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ForbiddenError } from "@/shared/errors/forbidden.error";
import { PersistenciaError } from "@/shared/errors/persistencia.error";
import { ValidationError } from "@/shared/errors/validation.error";
import { hojeIso } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";

// O banco (RLS) é a última barreira: só o Líder do RH e o Admin inserem (42501 para os demais).
export class SupabaseConvencaoRepository implements ConvencaoRepository {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly erros: RegistroDeErrosPort,
  ) {}

  async listar(clienteId: string): Promise<Result<ConvencaoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("rh_convencoes")
      .select("id, sindicato, vigencia_inicio, vigencia_fim, arquivo_nome, criado_em, regras")
      .eq("cliente_id", clienteId)
      .order("vigencia_inicio", { ascending: false })
      .order("criado_em", { ascending: false });
    if (error) return this.falhaDeLeitura(error);
    const linhas = lerLinhas(this.leitura, z.array(convencaoRowSchema), data);
    if (!linhas.ok) return linhas;
    return ok(
      // O instante vira o dia de São Paulo, não o de UTC (21h-24h já é o dia seguinte lá).
      linhas.value.map((l) => ({
        id: l.id,
        sindicato: l.sindicato,
        vigenciaInicio: l.vigencia_inicio,
        vigenciaFim: l.vigencia_fim,
        arquivoNome: l.arquivo_nome,
        enviadaEm: hojeIso(new Date(l.criado_em)),
        regras: l.regras,
      })),
    );
  }

  async inserir(nova: NovaConvencao): Promise<Result<void, AppError>> {
    const { error } = await this.supabase.from("rh_convencoes").insert({
      cliente_id: nova.clienteId,
      sindicato: nova.sindicato,
      vigencia_inicio: nova.vigenciaInicio,
      vigencia_fim: nova.vigenciaFim,
      arquivo_caminho: nova.arquivoCaminho,
      arquivo_nome: nova.arquivoNome,
      regras: nova.regras,
    });
    if (!error) return ok(undefined);
    if (error.code === "42501") {
      return err(new ForbiddenError("Só o Líder do RH e o Admin enviam a convenção."));
    }
    if (error.code === "23514" || error.code === "22P02") {
      return err(new ValidationError("Dados da convenção inválidos."));
    }
    this.erros.registrar("Falha ao gravar a convenção do RH:", error.message);
    return err(new PersistenciaError("Não foi possível salvar a convenção. Tente novamente."));
  }

  private get leitura(): FalhaDeLeitura {
    return {
      registro: "Falha ao ler as convenções do RH:",
      mensagem: "Não foi possível carregar as convenções.",
      erros: this.erros,
    };
  }

  private falhaDeLeitura(error: { message: string }): Result<never, AppError> {
    return falhaDeLeitura(this.leitura, error);
  }
}
