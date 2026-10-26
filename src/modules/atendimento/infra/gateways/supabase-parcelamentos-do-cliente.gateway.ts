import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  EnvioRegistrado,
  GuiaEntregue,
  ParcelamentoDoCliente,
  ParcelamentosDoClientePort,
} from "@/modules/atendimento/application/ports/out/parcelamentos-do-cliente.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

const linhaSchema = z.array(
  z.object({
    id: z.string(),
    codigo: z.string(),
    interno: z.boolean(),
    valor_parcela_centavos: z.number().nullable(),
    parcelas_restantes: z.number(),
    cliente_parcelamento_envios: z.array(z.object({ parcela: z.string() })),
  }),
);

const entreguesSchema = z.array(
  z.object({ parcelamento_id: z.string(), parcela: z.string(), identidade: z.string().nullable() }),
);
const registroSchema = z.enum(["registrado", "ja_registrado", "nao_elegivel"]);

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseParcelamentosDoClienteGateway implements ParcelamentosDoClientePort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listarEmAberto(clienteId: string): Promise<Result<ParcelamentoDoCliente[], AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("cliente_parcelamentos")
      .select(
        "id, codigo, interno, valor_parcela_centavos, parcelas_restantes, cliente_parcelamento_envios(parcela)",
      )
      .eq("cliente_id", clienteId)
      .eq("situacao", "em_aberto")
      .gt("parcelas_restantes", 0)
      // PGFN tem outro caminho (o PDF do escritório, #173): nunca vai ao provedor fiscal. Origem nula
      // (digitado à mão) é tratada como Receita.
      .or("origem.is.null,origem.eq.receita_federal")
      .order("criado_em");
    const lidas = linhaSchema.safeParse(data);
    if (error || !lidas.success) {
      return err(new ServicoExternoError("Falha ao ler os parcelamentos do Cliente."));
    }
    return ok(
      lidas.data.map((linha) => ({
        id: linha.id,
        codigo: linha.codigo,
        interno: linha.interno,
        valorParcelaCentavos: linha.valor_parcela_centavos,
        parcelasRestantes: linha.parcelas_restantes,
        parcelasEnviadas: linha.cliente_parcelamento_envios.map((envio) => envio.parcela),
      })),
    );
  }

  async contarComuns(clienteId: string): Promise<Result<number, AppError>> {
    const { count, error } = await this.supabaseAdmin
      .from("cliente_parcelamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", clienteId)
      .eq("interno", false)
      .or("origem.is.null,origem.eq.receita_federal");
    if (error || count === null) {
      return err(new ServicoExternoError("Falha ao ler os parcelamentos do Cliente."));
    }
    return ok(count);
  }

  async guiasEntregues(clienteId: string): Promise<Result<GuiaEntregue[], AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("cliente_parcelamento_envios")
      .select("parcelamento_id, parcela, identidade, cliente_parcelamentos!inner(cliente_id)")
      .eq("cliente_parcelamentos.cliente_id", clienteId);
    const lidas = entreguesSchema.safeParse(data);
    if (error || !lidas.success) {
      return err(new ServicoExternoError("Falha ao ler as guias já entregues do Cliente."));
    }
    return ok(
      lidas.data.map((e) => ({
        parcelamentoId: e.parcelamento_id,
        parcela: e.parcela,
        identidade: e.identidade,
      })),
    );
  }

  async registrarEnvio(
    parcelamentoId: string,
    parcela: string,
    identidade: string,
  ): Promise<Result<EnvioRegistrado, AppError>> {
    const { data, error } = await this.supabaseAdmin.rpc("registrar_envio_parcelamento", {
      p_parcelamento_id: parcelamentoId,
      p_parcela: parcela,
      p_identidade: identidade,
    });
    const status = registroSchema.safeParse(data);
    if (error || !status.success) {
      return err(new ServicoExternoError("Falha ao registrar o envio do parcelamento."));
    }
    return ok(status.data);
  }
}
