import type { EmpregadoDosAjustes } from "@/presentation/components/organisms/ajustes-do-cliente-na-convencao.component";
import type { CampoDoEnvio } from "@/presentation/components/organisms/envio-de-convencao.component";
import type { ConvencaoDoHistorico } from "@/presentation/components/organisms/historico-de-convencoes.component";
import type { LinhaDeRegra } from "@/presentation/components/organisms/regras-aplicadas.component";
import type {
  ConvencaoDto,
  ConvencoesDoClienteDto,
} from "@/modules/rh/application/dtos/convencao.dto";
import { formatarDataIso } from "@/shared/kernel/data-iso";
import {
  CHAVES_DE_REGRA,
  CHAVES_NO_CALCULO,
  REFERENCIA_DA_LEGISLACAO,
  type ChaveDeRegra,
  type DataEspecial,
  type ExcecaoDeFeriado,
  type MotivoDeRejeicao,
  type RegraAplicada,
} from "@/shared/kernel/regras-da-convencao";
import { NOME_DO_ARQUIVO_MAXIMO } from "@/shared/kernel/texto";

import { LIMITE_DO_PDF, MENSAGEM_NOME_LONGO, MENSAGEM_PDF_GRANDE } from "./convencao.schema";

const MOTIVOS: Record<MotivoDeRejeicao, string> = {
  chave_desconhecida: "Parâmetro fora do esquema",
  sem_citacao: "Sem cláusula ou trecho citado",
  valor_invalido: "Valor inválido",
  fora_do_trecho: "O número não aparece no trecho citado",
  abaixo_da_legislacao: "Abaixo do piso da legislação",
  duplicada: "Parâmetro repetido",
};

const IGUAL = "igual à legislação";

const numero = (n: number) => String(n).replace(".", ",");

// 480 vira "8h", 440 "7h20", 30 "30 min".
export function duracao(minutos: number): string {
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  return resto === 0 ? `${horas}h` : `${horas}h${String(resto).padStart(2, "0")}`;
}

function textoDaLegislacao(chave: ChaveDeRegra): string {
  const { unidade, legislacao } = REFERENCIA_DA_LEGISLACAO[chave];
  if (legislacao === null) return "Sem exceção";
  return unidade === "minutos" ? duracao(legislacao) : `${numero(legislacao)}%`;
}

function descreverDatas(datas: DataEspecial[]): string {
  return datas
    .map((d) => {
      const comissionado =
        d.percentualComissionado === undefined
          ? ""
          : ` (comissionado ${numero(d.percentualComissionado)}%)`;
      return `${d.data ? `${d.data} ` : ""}${d.descricao}: ${numero(d.percentual)}%${comissionado}`;
    })
    .join("; ");
}

function descreverRegra(regra: RegraAplicada): { valor: string; diferenca: string } {
  const referencia = REFERENCIA_DA_LEGISLACAO[regra.chave];
  const legislacao = referencia.legislacao ?? 0;

  if (regra.chave === "datas_especiais") {
    const maior = Math.max(...regra.valor.map((d) => d.percentual)) - legislacao;
    return {
      valor: descreverDatas(regra.valor),
      diferenca: maior > 0 ? `+${numero(maior)} pontos na maior` : IGUAL,
    };
  }
  if (regra.chave === "excecoes_de_feriado") {
    const lista: ExcecaoDeFeriado[] = regra.valor;
    return {
      valor: lista.map((e) => e.descricao).join(", "),
      diferenca: `${lista.length} ${lista.length === 1 ? "feriado dispensado" : "feriados dispensados"}`,
    };
  }

  const delta = regra.valor - legislacao;
  if (referencia.unidade === "percentual") {
    return {
      valor: `${numero(regra.valor)}%`,
      diferenca: delta === 0 ? IGUAL : `${delta > 0 ? "+" : "−"}${numero(Math.abs(delta))} pontos`,
    };
  }
  return {
    valor: duracao(regra.valor),
    diferenca:
      delta === 0 ? IGUAL : `${duracao(Math.abs(delta))} a ${delta > 0 ? "mais" : "menos"}`,
  };
}

// Uma linha por parâmetro do esquema fechado, na ordem fixa: o que a convenção aplicou (com a cláusula) e o
// que ficou "não aplicada" (vale a legislação), com o motivo quando o modelo chegou a propor e foi recusado.
export function linhasDeRegras(convencao: ConvencaoDto): LinhaDeRegra[] {
  const { aplicadas, rejeitadas } = convencao.regras;
  return CHAVES_DE_REGRA.map((chave) => {
    const base = {
      chave,
      rotulo: REFERENCIA_DA_LEGISLACAO[chave].rotulo,
      noCalculo: CHAVES_NO_CALCULO.includes(chave),
    };
    const regra = aplicadas.find((r) => r.chave === chave);
    if (regra) {
      return {
        ...base,
        aplicada: true,
        ...descreverRegra(regra),
        legislacao: textoDaLegislacao(chave),
        clausula: regra.clausula,
        trecho: regra.trecho,
        motivo: undefined,
      };
    }
    const recusada = rejeitadas.find((r) => r.chave === chave);
    return {
      ...base,
      aplicada: false,
      valor: "Não aplicada",
      legislacao: textoDaLegislacao(chave),
      diferenca: "vale a legislação",
      clausula: "",
      trecho: "",
      motivo: recusada ? MOTIVOS[recusada.motivo] : undefined,
    };
  });
}

// Sem pedido, ou com id que o Cliente não tem, abre a de vigência mais recente (a lista já vem nessa ordem).
export function convencaoEscolhida(
  convencoes: ConvencaoDto[],
  id?: string,
): ConvencaoDto | undefined {
  return convencoes.find((c) => c.id === id) ?? convencoes[0];
}

const vigenciaDe = (c: ConvencaoDto) =>
  `${formatarDataIso(c.vigenciaInicio)} a ${formatarDataIso(c.vigenciaFim)}`;

// "Comércio · 01/05/2026 a 30/04/2027".
export const tituloDaConvencao = (c: ConvencaoDto) => `${c.sindicato} · ${vigenciaDe(c)}`;

export function historicoDeConvencoes(
  convencoes: ConvencaoDto[],
  escolhidaId: string | undefined,
  rota: string,
): ConvencaoDoHistorico[] {
  return convencoes.map((c) => ({
    id: c.id,
    sindicato: c.sindicato,
    vigencia: vigenciaDe(c),
    arquivoNome: c.arquivoNome,
    enviadaEm: formatarDataIso(c.enviadaEm),
    href: `${rota}?convencao=${encodeURIComponent(c.id)}`,
    selecionada: c.id === escolhidaId,
  }));
}

// Sindicatos distintos das convenções do Cliente, em ordem alfabética.
export function sindicatosDoCliente(convencoes: ConvencaoDto[]): string[] {
  return [...new Set(convencoes.map((c) => c.sindicato))].sort((a, b) =>
    a.localeCompare(b, "pt-BR"),
  );
}

export function empregadosDosAjustes(dto: ConvencoesDoClienteDto): EmpregadoDosAjustes[] {
  return dto.empregados.map((e) => ({
    id: e.id,
    nome: e.nome,
    sindicato: e.convencaoSindicato ?? "",
  }));
}

const CAMPOS_DO_ENVIO: readonly string[] = [
  "sindicato",
  "vigenciaInicio",
  "vigenciaFim",
  "arquivo",
];

// O primeiro campo que o servidor recusou, se for um do formulário.
export function campoDoServidor(fields?: Record<string, string[]>): CampoDoEnvio | undefined {
  return Object.keys(fields ?? {}).find((c): c is CampoDoEnvio => CAMPOS_DO_ENVIO.includes(c));
}

export type EnvioLido =
  { ok: true; formData: FormData } | { ok: false; erro: string; campo: CampoDoEnvio };

// Confere no navegador o que dá para conferir (PDF escolhido, tamanho, vigência) e monta o FormData da
// Server Action; o servidor repete a conferência.
export function lerEnvioDoFormulario(
  clienteId: string,
  campos: FormData,
  arquivo: File | undefined,
): EnvioLido {
  if (!arquivo) return { ok: false, erro: "Escolha o PDF da convenção.", campo: "arquivo" };
  const ehPdf = arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf");
  if (!ehPdf) return { ok: false, erro: "Envie a convenção em PDF.", campo: "arquivo" };
  if (arquivo.size > LIMITE_DO_PDF)
    return { ok: false, erro: MENSAGEM_PDF_GRANDE, campo: "arquivo" };
  if (arquivo.name.trim().length > NOME_DO_ARQUIVO_MAXIMO)
    return { ok: false, erro: MENSAGEM_NOME_LONGO, campo: "arquivo" };

  const inicio = String(campos.get("vigenciaInicio") ?? "");
  const fim = String(campos.get("vigenciaFim") ?? "");
  if (fim < inicio)
    return { ok: false, erro: "A vigência termina antes de começar.", campo: "vigenciaFim" };

  const formData = new FormData();
  formData.set("clienteId", clienteId);
  formData.set("sindicato", String(campos.get("sindicato") ?? ""));
  formData.set("vigenciaInicio", inicio);
  formData.set("vigenciaFim", fim);
  formData.set("arquivo", arquivo);
  return { ok: true, formData };
}
