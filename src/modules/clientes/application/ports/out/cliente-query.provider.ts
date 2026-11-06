import type { ParcelamentoSalvo } from "@/modules/clientes/application/ports/out/cliente-parcelamento.repository";
import type { AppError } from "@/shared/errors/app.error";
import type { Result } from "@/shared/kernel/result";
import type { SetorSlug } from "@/shared/kernel/setores";

// Read model puro (arquitetura.md, seção 3.6): nunca passa pelo builder/entidade
// Cliente. Deliberadamente SEM contratoSocialCaminho/alteracoesContratuais —
// a confidencialidade destes campos nesta tela é garantida pelo shape do DTO,
// não por lógica condicional na View (RLS é por linha, não por coluna).
// Read model do Parcelamento: o nome do PDF no lugar do caminho no Storage.
export type ParcelamentoDto = Omit<ParcelamentoSalvo, "arquivoCaminho"> & { arquivoNome: string };

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
  parcelamentos: ParcelamentoDto[];
  observacoesGerais: string;
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  // Responsável: null = "Sem responsável". Nome vem null quando o RLS
  // esconde o perfil (leitor de outro Setor) — o id continua conhecido.
  responsavelId: string | null;
  responsavelNome: string | null;
};

export type ResponsavelOpcaoDto = { id: string; nome: string };

// Resultado leve da busca — não é o cadastro operacional completo, só
// o necessário pra listar sugestões (empresa + CNPJ) antes de escolher um cliente.
export type SugestaoClienteDto = { id: string; empresa: string; cnpj: string };

// Read model pro resumo do setor — só os campos usados pra classificar um Cliente nos 11 cards, mais
// empresa/cnpj pra exibir no drill-down. Mesmo raciocínio de confidencialidade do DTO acima.
export type ResumoOperacionalRow = {
  clienteId: string;
  empresa: string;
  cnpj: string;
  documentoObrigatorio: string | null;
  dasStatus: string | null;
  // Um item por Parcelamento cadastrado (em aberto ou quitado); enviadoNoMes = há registro de envio
  // da parcela do mês corrente (fuso de São Paulo).
  parcelamentos: { codigo: string; interno: boolean; quitado: boolean; enviadoNoMes: boolean }[];
  // Atividade do mês corrente; tudo false quando ainda não há registro.
  atividadeMes: { industria: boolean; comercio: boolean; servico: boolean };
  responsavelId: string | null;
  responsavelNome: string | null;
};

export interface ClienteQueryPort {
  buscarCadastroOperacional(
    clienteId: string,
  ): Promise<Result<CadastroOperacionalClienteDto | null, AppError>>;

  // apenasSnMei: a busca embutida no dashboard do Simples Nacional só mostra Cliente com cadastro
  // operacional (regime simples_nacional/mei); a busca geral do Admin/qualquer setor não tem essa
  // restrição — Admin precisa achar cliente de qualquer Regime.
  buscarPorTermo(
    termo: string,
    apenasSnMei: boolean,
  ): Promise<Result<SugestaoClienteDto[], AppError>>;

  listarResumoOperacional(): Promise<Result<ResumoOperacionalRow[], AppError>>;

  // Funcionários ativos do Setor, candidatos a Responsável.
  listarResponsaveisElegiveis(setor: SetorSlug): Promise<Result<ResponsavelOpcaoDto[], AppError>>;

  // Responsável do Cliente num Setor fora do Simples Nacional (este vive no cadastro operacional).
  buscarResponsavelDoSetor(
    clienteId: string,
    setor: SetorSlug,
  ): Promise<Result<ResponsavelOpcaoDto | null, AppError>>;
}
