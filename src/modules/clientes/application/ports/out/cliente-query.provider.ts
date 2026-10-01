import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";

// Read model puro (arquitetura.md, seção 3.6): nunca passa pelo builder/entidade
// Cliente. Deliberadamente SEM contratoSocialCaminho/alteracoesContratuais —
// a confidencialidade destes campos nesta tela é garantida pelo shape do DTO,
// não por lógica condicional na View (RLS é por linha, não por coluna).
export type CadastroOperacionalClienteDto = {
  id: string;
  empresa: string;
  cnpj: string;
  regime: string;
  formaEnvio: string;
  contatos: { id?: string; nome: string; telefone: string; padrao: boolean }[];
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  dataEnvioDas: string | null;
  temParcelamento: boolean;
  parcelamentoStatus: string | null;
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
};

// Resultado leve da busca (#35) — não é o cadastro operacional completo, só
// o necessário pra listar sugestões (empresa + CNPJ) antes de escolher um cliente.
export type SugestaoClienteDto = { id: string; empresa: string; cnpj: string };

// Read model pro resumo do setor (#36) — só os campos usados pra classificar
// um Cliente nos 9 cards da spec #24, mais empresa/cnpj pra exibir no
// drill-down. Mesmo raciocínio de confidencialidade do DTO acima.
export type ResumoOperacionalRow = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  temParcelamento: boolean;
  parcelamentoStatus: string | null;
};

export interface ClienteQueryPort {
  buscarCadastroOperacional(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>>;

  // apenasSnMei: a busca embutida no dashboard do Simples Nacional (#36) só
  // mostra Cliente com cadastro operacional (regime simples_nacional/mei,
  // #34); a busca geral do Admin/qualquer setor (ponto 3 do feedback do #36)
  // não tem essa restrição — Admin precisa achar cliente de qualquer Regime.
  buscarPorTermo(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>>;

  listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>>;
}
