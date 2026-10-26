import type { SupabaseClient } from "@supabase/supabase-js";

import type {
  GuiaDaParcela,
  GuiaParcelaPgfnRepository,
  ParcelamentoDaGuia,
} from "@/modules/clientes/application/ports/out/guia-parcela-pgfn.repository";
import type { GuiaParcelaPgfnProps } from "@/modules/clientes/domain/value-objects/guia-parcela-pgfn.vo";
import { AppError } from "@/shared/errors/app.error";
import { NotFoundError } from "@/shared/errors/not-found.error";
import { ResultadoIncertoError } from "@/shared/errors/resultado-incerto.error";
import { err, ok, type Result } from "@/shared/kernel/result";

class PersistenciaError extends AppError {
  readonly code = "PERSISTENCIA_ERROR";
}

// Sem resposta (status 0) ou gateway/timeout (502-504): o banco pode ter confirmado a gravação.
const semDesfechoConhecido = (status: number) => status === 0 || status >= 502;

type GuiaRow = {
  competencia: string;
  conta_negociacao: string;
  estado: GuiaDaParcela["estado"];
  motivo: string | null;
};

// Limite do CHECK da coluna `motivo`: o motivo traz a conta lida do PDF, que não tem tamanho certo.
const MOTIVO_MAX = 300;

export class SupabaseGuiaParcelaPgfnRepository implements GuiaParcelaPgfnRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async parcelamento(parcelamentoId: string): Promise<Result<ParcelamentoDaGuia | null, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamentos")
      .select("cliente_id, origem, codigo")
      .eq("id", parcelamentoId)
      .maybeSingle();
    if (error) {
      console.error("Falha ao buscar o Parcelamento da guia:", error.message);
      return err(new PersistenciaError("Não foi possível carregar o Parcelamento."));
    }
    if (!data) return ok(null);
    // O CNPJ vem da view que quem edita o cadastro operacional pode ler (a tabela é só do Admin).
    const cliente = await this.supabase
      .from("clientes_basico")
      .select("cnpj")
      .eq("id", data.cliente_id)
      .maybeSingle();
    if (cliente.error || !cliente.data) {
      console.error("Falha ao buscar o Cliente da guia:", cliente.error?.message);
      return err(new PersistenciaError("Não foi possível carregar o Cliente do Parcelamento."));
    }
    return ok({
      clienteId: data.cliente_id,
      origem: data.origem,
      codigo: data.codigo,
      cnpj: cliente.data.cnpj,
    });
  }

  async listar(parcelamentoId: string): Promise<Result<GuiaDaParcela[], AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .select("competencia, conta_negociacao, estado, motivo")
      .eq("parcelamento_id", parcelamentoId)
      .order("competencia", { ascending: false });
    if (error) {
      console.error("Falha ao listar guias da parcela:", error.message);
      return err(new PersistenciaError("Não foi possível carregar as guias anexadas."));
    }
    return ok(
      (data as GuiaRow[]).map((g) => ({
        competencia: g.competencia,
        contaNegociacao: g.conta_negociacao,
        estado: g.estado,
        ...(g.motivo ? { motivo: g.motivo } : {}),
      })),
    );
  }

  async anexar(
    parcelamentoId: string,
    guia: GuiaParcelaPgfnProps,
    motivo: string | null,
  ): Promise<Result<void, AppError>> {
    const { error, status } = await this.supabase.from("cliente_parcelamento_guias").insert({
      parcelamento_id: parcelamentoId,
      competencia: guia.competencia,
      conta_negociacao: guia.contaNegociacao,
      arquivo_caminho: guia.arquivoCaminho,
      motivo: motivo?.slice(0, MOTIVO_MAX) ?? null,
    });
    if (!error) return ok(undefined);

    console.error("Falha ao anexar guia da parcela:", error.message);
    if (semDesfechoConhecido(status)) {
      return err(new ResultadoIncertoError("Não foi possível confirmar o anexo da guia."));
    }
    if (error.code === "23505") {
      return err(new PersistenciaError("Já existe guia anexada para esta competência."));
    }
    // Gatilhos do banco recusam com 23514 e mensagem em português, própria para o usuário.
    return err(
      new PersistenciaError(
        error.code === "23514" ? error.message : "Não foi possível anexar a guia. Tente novamente.",
      ),
    );
  }

  async confirmar(parcelamentoId: string, competencia: string): Promise<Result<void, AppError>> {
    // `.select()` devolve as linhas atualizadas: RLS que esconde a guia não dá erro, dá zero linhas.
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .update({ estado: "confirmada" })
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .select("competencia");
    if (error) {
      console.error("Falha ao confirmar guia da parcela:", error.message);
      return err(
        new PersistenciaError(
          error.code === "23514"
            ? error.message
            : "Não foi possível confirmar a guia. Tente novamente.",
        ),
      );
    }
    if (data.length === 0) {
      return err(new NotFoundError("Não encontramos esta guia. Atualize a página."));
    }
    return ok(undefined);
  }

  async gravada(
    parcelamentoId: string,
    competencia: string,
    arquivoCaminho: string,
  ): Promise<Result<boolean, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_parcelamento_guias")
      .select("arquivo_caminho")
      .eq("parcelamento_id", parcelamentoId)
      .eq("competencia", competencia)
      .maybeSingle();
    if (error) return err(new PersistenciaError("Não foi possível conferir a guia anexada."));
    return ok(data?.arquivo_caminho === arquivoCaminho);
  }
}
