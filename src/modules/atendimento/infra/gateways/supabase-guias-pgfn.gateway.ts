import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  GuiasPgfnPort,
  ParcelamentoPgfn,
} from "@/modules/atendimento/application/ports/out/guias-pgfn.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ServicoExternoError } from "@/shared/errors/servico-externo.error";
import { err, ok, type Result } from "@/shared/kernel/result";

// Bucket privado dos acordos, onde a guia anexada (#183) fica guardada.
const BUCKET = "parcelamentos-clientes";

const linhaSchema = z.array(
  z.object({
    id: z.string(),
    codigo: z.string(),
    interno: z.boolean(),
    valor_parcela_centavos: z.number().nullable(),
    parcelas_restantes: z.number(),
    cliente_parcelamento_envios: z.array(z.object({ parcela: z.string() })),
    cliente_parcelamento_guias: z.array(
      z.object({
        competencia: z.string(),
        arquivo_caminho: z.string(),
        estado: z.enum(["a_confirmar", "confirmada"]),
      }),
    ),
  }),
);

// Usa o client service_role (docs/adr/0001): o job não tem sessão de usuário.
export class SupabaseGuiasPgfnGateway implements GuiasPgfnPort {
  constructor(private readonly supabaseAdmin: SupabaseClient) {}

  async listarEmAberto(clienteId: string): Promise<Result<ParcelamentoPgfn[], AppError>> {
    const { data, error } = await this.supabaseAdmin
      .from("cliente_parcelamentos")
      .select(
        "id, codigo, interno, valor_parcela_centavos, parcelas_restantes, cliente_parcelamento_envios(parcela), cliente_parcelamento_guias(competencia, arquivo_caminho, estado)",
      )
      .eq("cliente_id", clienteId)
      .eq("origem", "pgfn")
      .eq("situacao", "em_aberto")
      .gt("parcelas_restantes", 0)
      .order("criado_em");
    const lidas = linhaSchema.safeParse(data);
    if (error || !lidas.success) {
      return err(new ServicoExternoError("Falha ao ler os parcelamentos PGFN do Cliente."));
    }
    return ok(
      lidas.data.map((linha) => ({
        id: linha.id,
        codigo: linha.codigo,
        interno: linha.interno,
        valorParcelaCentavos: linha.valor_parcela_centavos,
        parcelasRestantes: linha.parcelas_restantes,
        parcelasEnviadas: linha.cliente_parcelamento_envios.map((e) => e.parcela),
        guias: linha.cliente_parcelamento_guias
          .filter((g) => g.estado === "confirmada")
          .map((g) => ({ competencia: g.competencia, caminho: g.arquivo_caminho })),
      })),
    );
  }

  async ler(clienteId: string, caminho: string): Promise<Result<string, AppError>> {
    // A guia nasce em `${clienteId}/guias-pgfn/...`: a de outro Cliente nunca é lida.
    if (!caminho.startsWith(`${clienteId}/guias-pgfn/`) || caminho.includes("..")) {
      return err(new ServicoExternoError("Guia não pertence ao cliente."));
    }
    const { data, error } = await this.supabaseAdmin.storage.from(BUCKET).download(caminho);
    if (error || !data) return err(new ServicoExternoError("Falha ao ler a guia do parcelamento."));
    return ok(Buffer.from(await data.arrayBuffer()).toString("base64"));
  }
}
