import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import type {
  CadastroOperacionalClienteDto,
  CadastroRhClienteDto,
  DestinosDoSetorDto,
  ClienteQueryPort,
  ResponsavelOpcaoDto,
  ResumoOperacionalRow,
  SugestaoClienteDto,
} from "@/modules/clientes/application/ports/out/cliente-query.provider";
import {
  operacionalUnico,
  type CadastroOperacionalRow,
  type ResponsavelRow,
} from "@/modules/clientes/infra/mappers/cadastro-operacional-row.mapper";
import {
  contatoDoRow,
  contatoRowSchema,
  EMBED_CONTATOS,
  type ContatoRow,
} from "@/modules/clientes/infra/mappers/contato-row.mapper";
import {
  EMBED_PARCELAMENTOS,
  estaQuitado,
  parcelaDoMesAtual,
  parcelamentoDoRow,
  type ParcelamentoRow,
} from "@/modules/clientes/infra/mappers/parcelamento-row.mapper";
import type { AppError } from "@/shared/errors/app.error";
import { ConsultaError } from "@/shared/errors/consulta.error";
import { primeiroDiaDoMesAtual } from "@/shared/kernel/mes-atual";
import { err, ok, type Result } from "@/shared/kernel/result";
import { SETOR_RH, SETOR_SN, type SetorSlug } from "@/shared/kernel/setores";

// Row da view `clientes_basico`: falha alto se o banco divergir (arquitetura.md §3.9).
const cadastroRhSchema = z.object({
  id: z.string(),
  empresa: z.string(),
  cnpj: z.string(),
  cliente_contatos: z.array(contatoRowSchema),
  cliente_observacoes_setor: z.array(z.object({ observacoes: z.string() })),
});

const destinosRowsSchema = z.array(
  z.object({
    id: z.string(),
    contato_id: z.string(),
    tipo: z.string().nullable(),
    canal: z.string(),
  }),
);
const tiposRowsSchema = z.array(
  z.object({ tipo: z.string(), tipos_de_envio: z.object({ rotulo: z.string() }) }),
);

type AtividadeMensalRow = { industria: boolean; comercio: boolean; servico: boolean };

type ClienteBasicoRow = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  cliente_cadastro_operacional_sn: CadastroOperacionalRow | CadastroOperacionalRow[] | null;
  cliente_responsaveis: ResponsavelRow[] | null;
  cliente_contatos: ContatoRow[] | null;
  cliente_atividades_mensais: AtividadeMensalRow[] | null;
  cliente_parcelamentos: ParcelamentoRow[] | null;
};

const EMBED_OPERACIONAL = "cliente_cadastro_operacional_sn(*)";
const EMBED_RESPONSAVEL =
  "cliente_responsaveis(responsavel_id, responsavel:perfis!responsavel_id(nome))";

const responsavelDe = (responsaveis: ResponsavelRow[] | null) => ({
  responsavelId: responsaveis?.[0]?.responsavel_id ?? null,
  responsavelNome: responsaveis?.[0]?.responsavel?.nome ?? null,
});

// Lê da view `clientes_basico`, que não tem contrato_social_caminho: a confidencialidade é
// garantida no banco, não só pelo select ou pelo shape do DTO de saída.
const SELECT_CADASTRO_BASICO = `
  id, empresa, cnpj, regime,
  ${EMBED_OPERACIONAL},
  ${EMBED_RESPONSAVEL},
  ${EMBED_CONTATOS},
  cliente_atividades_mensais(*),
  ${EMBED_PARCELAMENTOS}
`;

// Caminho no Storage: `{clienteId}/{parcelamentoId}-{nome}`; a tela mostra só o nome.
const nomeDoArquivo = (caminho: string) => caminho.replace(/^[^/]*\/[0-9a-f-]{36}-/, "");

// Resumo do setor: só o que os cards e comparativos leem. O embed de envios é filtrado pela parcela
// do mês (sem isso volta uma linha por mês de vida de cada Parcelamento) e as colunas são listadas
// (sem `*`, que traria observações gerais e o caminho do PDF).
const SELECT_RESUMO = `
  id, empresa, cnpj,
  cliente_cadastro_operacional_sn(documento_obrigatorio, das_status),
  ${EMBED_RESPONSAVEL},
  cliente_atividades_mensais(industria, comercio, servico),
  cliente_parcelamentos(codigo, interno, situacao, parcelas_restantes, cliente_parcelamento_envios(parcela))
`;

type OperacionalDoResumo = Pick<CadastroOperacionalRow, "documento_obrigatorio" | "das_status">;

type ResumoOperacionalRowDb = {
  id: string;
  empresa: string;
  cnpj: string;
  cliente_cadastro_operacional_sn: OperacionalDoResumo | OperacionalDoResumo[] | null;
  cliente_responsaveis: ResponsavelRow[] | null;
  cliente_atividades_mensais: AtividadeMensalRow[] | null;
  cliente_parcelamentos:
    | (Pick<ParcelamentoRow, "codigo" | "interno" | "situacao" | "parcelas_restantes"> & {
        cliente_parcelamento_envios: { parcela: string }[];
      })[]
    | null;
};

export class SupabaseClienteQueryGateway implements ClienteQueryPort {
  constructor(private readonly supabase: SupabaseClient) {}

  async buscarCadastroOperacional(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>> {
    const anoMesAtual = primeiroDiaDoMesAtual();

    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(SELECT_CADASTRO_BASICO)
      .eq("id", clienteId)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      .eq("cliente_responsaveis.setor", "simples_nacional")
      .eq("cliente_parcelamentos.setor", "simples_nacional")
      // Mesma ordem do repositório; sem isso o embed volta em ordem arbitrária entre leituras.
      .order("criado_em", { referencedTable: "cliente_parcelamentos" })
      .order("codigo", { referencedTable: "cliente_parcelamentos" })
      .maybeSingle();

    if (error)
      return err(new ConsultaError(`Erro ao buscar cadastro operacional: ${error.message}`));
    if (!data) return ok(null);

    const destinos = await this.destinosDoSetor(clienteId, SETOR_SN);
    if (!destinos.ok) return destinos;

    const row = data as unknown as ClienteBasicoRow;
    const operacional = operacionalUnico(row.cliente_cadastro_operacional_sn);
    const atividade = (row.cliente_atividades_mensais ?? [])[0] ?? null;

    return ok({
      ...destinos.value,
      id: row.id,
      empresa: row.empresa,
      cnpj: row.cnpj,
      regime: row.regime,
      formaEnvio: operacional?.forma_envio ?? "whatsapp",
      contatos: (row.cliente_contatos ?? []).map(contatoDoRow),
      documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
      dasStatus: operacional?.das_status ?? null,
      dataEnvioDas: operacional?.data_envio_das ?? null,
      parcelamentos: (row.cliente_parcelamentos ?? [])
        .map(parcelamentoDoRow)
        .map(({ arquivoCaminho, ...p }) => ({ ...p, arquivoNome: nomeDoArquivo(arquivoCaminho) })),
      observacoesGerais: operacional?.observacoes_gerais ?? "",
      atividadeMes: {
        industria: atividade?.industria ?? false,
        comercio: atividade?.comercio ?? false,
        servico: atividade?.servico ?? false,
      },
      ...responsavelDe(row.cliente_responsaveis),
    });
  }

  // Os Destinos do Setor no Cliente (a RLS só entrega os do Setor de quem lê, e o Admin lê todos) e os
  // tipos de envio que o Setor faz.
  private async destinosDoSetor(
    clienteId: string,
    setor: SetorSlug,
  ): Promise<Result<DestinosDoSetorDto, AppError>> {
    const [destinos, tipos] = await Promise.all([
      this.supabase
        .from("destinos_de_envio")
        .select("id, contato_id, tipo, canal")
        .eq("cliente_id", clienteId)
        .eq("setor", setor)
        .order("criado_em"),
      this.supabase
        .from("tipos_de_envio_do_setor")
        .select("tipo, tipos_de_envio(rotulo)")
        .eq("setor", setor),
    ]);
    const falha = destinos.error ?? tipos.error;
    if (falha) return err(new ConsultaError(`Erro ao buscar os destinos de envio: ${falha.message}`));

    const lidos = destinosRowsSchema.safeParse(destinos.data);
    const catalogo = tiposRowsSchema.safeParse(tipos.data);
    if (!lidos.success || !catalogo.success) {
      return err(new ConsultaError("Erro ao buscar os destinos de envio: formato inesperado."));
    }
    return ok({
      destinos: lidos.data.map((d) => ({
        id: d.id,
        contatoId: d.contato_id,
        tipo: d.tipo,
        canal: d.canal,
      })),
      tiposDeEnvio: catalogo.data.map((t) => ({ slug: t.tipo, rotulo: t.tipos_de_envio.rotulo })),
    });
  }

  async buscarCadastroRh(
    clienteId: string,
  ): Promise<Result<CadastroRhClienteDto | null, AppError>> {
    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(
        `id, empresa, cnpj, ${EMBED_CONTATOS}, cliente_observacoes_setor(observacoes), ${EMBED_PARCELAMENTOS}`,
      )
      .eq("id", clienteId)
      .eq("cliente_observacoes_setor.setor", "rh")
      .eq("cliente_parcelamentos.setor", "rh")
      .order("criado_em", { referencedTable: "cliente_contatos" })
      .order("criado_em", { referencedTable: "cliente_parcelamentos" })
      .order("codigo", { referencedTable: "cliente_parcelamentos" })
      .maybeSingle();
    if (error) return err(new ConsultaError(`Erro ao buscar o cadastro do RH: ${error.message}`));
    if (!data) return ok(null);
    const lido = cadastroRhSchema.safeParse(data);
    if (!lido.success)
      return err(new ConsultaError("Erro ao buscar o cadastro do RH: formato inesperado."));
    const {
      cliente_contatos: contatos,
      cliente_observacoes_setor: observacoes,
      ...basicos
    } = lido.data;
    // O embed de Parcelamentos é lido com o tipo da linha (como no cadastro do SN), fora do zod.
    const { cliente_parcelamentos: linhas } = data as unknown as {
      cliente_parcelamentos: ParcelamentoRow[] | null;
    };
    const destinos = await this.destinosDoSetor(clienteId, SETOR_RH);
    if (!destinos.ok) return destinos;
    return ok({
      ...basicos,
      ...destinos.value,
      contatos: contatos.map(contatoDoRow),
      observacoes: observacoes[0]?.observacoes ?? "",
      parcelamentos: (linhas ?? [])
        .map(parcelamentoDoRow)
        .map(({ arquivoCaminho, ...p }) => ({ ...p, arquivoNome: nomeDoArquivo(arquivoCaminho) })),
    });
  }

  async listarResponsaveisElegiveis(
    setor: SetorSlug,
  ): Promise<Result<ResponsavelOpcaoDto[], AppError>> {
    const { data, error } = await this.supabase
      .from("perfis")
      .select("id, nome")
      .eq("papel", "funcionario")
      .eq("setor", setor)
      .is("desativado_em", null)
      .order("nome");
    if (error) return err(new ConsultaError(`Erro ao listar Responsáveis: ${error.message}`));
    return ok((data as ResponsavelOpcaoDto[]) ?? []);
  }

  async buscarResponsavelDoSetor(
    clienteId: string,
    setor: SetorSlug,
  ): Promise<Result<ResponsavelOpcaoDto | null, AppError>> {
    const { data, error } = await this.supabase
      .from("cliente_responsaveis")
      .select("responsavel:perfis!responsavel_id(id, nome)")
      .eq("cliente_id", clienteId)
      .eq("setor", setor)
      .maybeSingle();
    if (error) return err(new ConsultaError(`Erro ao buscar o Responsável: ${error.message}`));
    const responsavel = (data as { responsavel: ResponsavelOpcaoDto | null } | null)?.responsavel;
    return ok(responsavel ?? null);
  }

  async buscarPorTermo(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>> {
    // `,`/`()` têm significado especial na sintaxe de filtro `.or()` do
    // PostgREST — sem escapar, um termo com vírgula (ex. "Pão, Quente Ltda")
    // vira duas condições em vez de texto literal. Envolver em aspas duplas
    // (com `"`/`\` escapados) trata o valor inteiro como literal.
    const valor = `%${termo}%`.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    // View `clientes_basico`, não `clientes`: o dashboard é de qualquer Funcionário
    // do setor, e só Admin lê a tabela (contrato social).
    let query = this.supabase.from("clientes_basico").select("id, empresa, cnpj");
    // Só a busca embutida no dashboard do Simples Nacional restringe o Regime — Admin/qualquer
    // setor fora dessa tela busca em qualquer Cliente.
    if (apenasSnMei) query = query.in("regime", ["simples_nacional", "mei"]);
    const { data, error } = await query
      .or(`cnpj.ilike."${valor}",empresa.ilike."${valor}"`)
      .order("empresa")
      .limit(10);

    if (error) return err(new ConsultaError(`Erro ao buscar clientes: ${error.message}`));
    return ok((data as SugestaoClienteDto[]) ?? []);
  }

  async listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>> {
    // View `clientes_basico`: o dashboard é de qualquer Funcionário do setor.
    const anoMesAtual = primeiroDiaDoMesAtual();
    const { data, error } = await this.supabase
      .from("clientes_basico")
      .select(SELECT_RESUMO)
      .eq("cliente_atividades_mensais.ano_mes", anoMesAtual)
      .eq("cliente_responsaveis.setor", "simples_nacional")
      .eq("cliente_parcelamentos.setor", "simples_nacional")
      .eq("cliente_parcelamentos.cliente_parcelamento_envios.parcela", parcelaDoMesAtual())
      // Mesmo escopo da busca: só Regime com cadastro operacional de
      // verdade (nasce automático só pra Simples Nacional/MEI).
      .in("regime", ["simples_nacional", "mei"]);

    if (error) return err(new ConsultaError(`Erro ao listar resumo operacional: ${error.message}`));

    const linhas = (data ?? []) as unknown as ResumoOperacionalRowDb[];
    return ok(
      linhas.map((linha) => {
        const operacional = operacionalUnico(linha.cliente_cadastro_operacional_sn);
        const atividade = (linha.cliente_atividades_mensais ?? [])[0];
        return {
          clienteId: linha.id,
          empresa: linha.empresa,
          cnpj: linha.cnpj,
          documentoObrigatorio: operacional?.documento_obrigatorio ?? null,
          dasStatus: operacional?.das_status ?? null,
          // O filtro do select deixa nos envios só a parcela do mês corrente.
          parcelamentos: (linha.cliente_parcelamentos ?? []).map((p) => ({
            codigo: p.codigo,
            interno: p.interno,
            quitado: estaQuitado(p.situacao, p.parcelas_restantes),
            enviadoNoMes: p.cliente_parcelamento_envios.length > 0,
          })),
          atividadeMes: {
            industria: atividade?.industria ?? false,
            comercio: atividade?.comercio ?? false,
            servico: atividade?.servico ?? false,
          },
          ...responsavelDe(linha.cliente_responsaveis),
        };
      }),
    );
  }
}
