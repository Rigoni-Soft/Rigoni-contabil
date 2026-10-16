import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/universal";

// Visualização de Word (.docx) e Excel (.xlsx) feita no navegador, sem enviar o arquivo a nenhum
// serviço externo. O resultado é só dado (HTML do documento, células da planilha): quem desenha o
// HTML o isola (iframe sem script) porque o arquivo vem do cliente.
export const PREVIA_LINHAS_MAXIMAS = 500;

// O que o painel mostra depois de ler o arquivo.
export type PreviaCarregada =
  | { tipo: "documento"; html: string }
  | { tipo: "planilha"; nome: string; linhas: string[][]; truncada: boolean };

export type PlanilhaPrevia = {
  nome: string;
  linhas: string[][];
  // A planilha tinha mais linhas do que `PREVIA_LINHAS_MAXIMAS`.
  truncada: boolean;
};

export async function docxParaHtml(conteudo: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: conteudo });
  return value;
}

// A primeira planilha do arquivo; célula vazia vira "", data e número viram texto.
export async function xlsxParaTabela(conteudo: ArrayBuffer): Promise<PlanilhaPrevia> {
  const planilhas = await readXlsxFile(conteudo);
  const primeira = planilhas[0];
  if (!primeira) return { nome: "", linhas: [], truncada: false };
  const linhas = primeira.data.slice(0, PREVIA_LINHAS_MAXIMAS).map((linha) =>
    linha.map((celula) => {
      if (celula === null || celula === undefined) return "";
      return celula instanceof Date ? celula.toLocaleDateString("pt-BR") : String(celula);
    }),
  );
  return {
    nome: primeira.sheet,
    linhas,
    truncada: primeira.data.length > PREVIA_LINHAS_MAXIMAS,
  };
}
