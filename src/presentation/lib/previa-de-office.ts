import mammoth from "mammoth";
import readXlsxFile from "read-excel-file/universal";

export const PREVIA_LINHAS_MAXIMAS = 500;

export type PreviaCarregada =
  | { tipo: "documento"; html: string }
  | { tipo: "planilha"; nome: string; linhas: string[][]; truncada: boolean };

export type PlanilhaPrevia = {
  nome: string;
  linhas: string[][];
  truncada: boolean;
};

export async function docxParaHtml(conteudo: ArrayBuffer): Promise<string> {
  const { value } = await mammoth.convertToHtml({ arrayBuffer: conteudo });
  return value;
}

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
