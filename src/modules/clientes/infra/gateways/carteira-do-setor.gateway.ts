import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  CarteiraDoSetorQueryPort,
  ClienteDaCarteiraRow,
} from "@/modules/clientes/application/ports/out/carteira-do-setor.provider";
import type { AppError } from "@/shared/errors/app.error";
import { ConsultaError } from "@/shared/errors/consulta.error";
import { TAMANHO_DA_PAGINA } from "@/shared/kernel/paginacao-por-cursor";
import { err, ok, type Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Row do select com relação embutida: falha alto se o banco divergir (arquitetura.md §3.9).
const linhasSchema = z.array(
  z.object({
    id: z.string(),
    empresa: z.string(),
    cnpj: z.string(),
    cliente_responsaveis: z
      .array(
        z.object({
          responsavel_id: z.string(),
          responsavel: z.object({ nome: z.string() }).nullable(),
        }),
      )
      .nullable(),
  }),
);
type ClienteComResponsavelRow = z.infer<typeof linhasSchema>[number];

// View `clientes_basico`: o Setor lê os dados básicos da carteira; o vínculo do Responsável vem pela
// RLS de `cliente_responsaveis` (o Funcionário enxerga só o próprio, o Líder e o Admin todos).
export class SupabaseCarteiraDoSetorGateway implements CarteiraDoSetorQueryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async listar(setor: SetorSlug): Promise<Result<ClienteDaCarteiraRow[], AppError>> {
    // O PostgREST corta cada resposta em `max_rows`: lê a carteira em páginas até vir uma vazia,
    // sem depender de o servidor honrar o tamanho pedido (por isso não usa `lerTodasAsPaginas`, que
    // toma página curta por última e pagina por cursor de id, não por `empresa`). Uma página que
    // repete a anterior (o servidor ignorou o `range`) aborta em vez de girar sem fim.
    // ponytail: `range` não é snapshot; Cliente criado ou removido entre páginas pode repetir ou
    // omitir uma linha. Paginar por keyset (empresa, id) se a carteira passar a mudar em lote.
    const linhas: ClienteComResponsavelRow[] = [];
    let primeiroDaAnterior: string | undefined;
    for (let de = 0; ; de = linhas.length) {
      const { data, error } = await this.supabase
        .from("clientes_basico")
        .select(
          "id, empresa, cnpj, cliente_responsaveis(responsavel_id, responsavel:perfis!responsavel_id(nome))",
        )
        .eq("cliente_responsaveis.setor", setor)
        .order("empresa")
        .order("id")
        .range(de, de + TAMANHO_DA_PAGINA - 1);
      if (error) return err(new ConsultaError(`Erro ao listar a carteira: ${error.message}`));
      const lida = linhasSchema.safeParse(data ?? []);
      if (!lida.success)
        return err(new ConsultaError("Erro ao listar a carteira: formato inesperado."));
      const pagina = lida.data;
      if (pagina.length === 0) break;
      if (pagina[0].id === primeiroDaAnterior) {
        return err(new ConsultaError("Erro ao listar a carteira: a paginação não avançou."));
      }
      primeiroDaAnterior = pagina[0].id;
      linhas.push(...pagina);
    }

    // `.eq("cliente_responsaveis.setor", setor)` deixa no máximo um vínculo por Cliente (um
    // Responsável por Setor), por isso basta o primeiro.
    return ok(
      linhas.map((linha) => ({
        clienteId: linha.id,
        empresa: linha.empresa,
        cnpj: linha.cnpj,
        responsavelId: linha.cliente_responsaveis?.[0]?.responsavel_id ?? null,
        responsavelNome: linha.cliente_responsaveis?.[0]?.responsavel?.nome ?? null,
      })),
    );
  }
}
