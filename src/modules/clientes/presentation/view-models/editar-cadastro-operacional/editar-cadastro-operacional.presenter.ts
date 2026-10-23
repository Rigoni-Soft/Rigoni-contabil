import type { LeituraDaLinha } from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";
import type { CadastroOperacionalClienteDto } from "@/modules/clientes/application/ports/out/cliente-query.provider";
import type { ParcelamentoFormValues } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema";
import { rotuloResponsavel } from "@/shared/kernel/papeis";

type Opcao = { id: string; nome: string };

// Antes de abrir o Select só o Responsável atual é conhecido; depois soma a lista carregada.
export function opcoesResponsavel(dados: CadastroOperacionalClienteDto, carregadas: Opcao[]) {
  const atual =
    dados.responsavelId && dados.responsavelNome
      ? [{ id: dados.responsavelId, nome: dados.responsavelNome }]
      : [];
  return [...atual.filter((a) => !carregadas.some((c) => c.id === a.id)), ...carregadas];
}

export const nomeResponsavelAtual = (dados: CadastroOperacionalClienteDto) =>
  rotuloResponsavel(dados.responsavelId, dados.responsavelNome);

// Estado da leitura do PDF numa linha nova, como o hook o guarda.
export type EstadoDaLeitura =
  | { estado: "lendo" }
  | { estado: "sugerido"; codigoGerado: boolean; cnpjConfere: boolean | null }
  | { estado: "falhou" };

// O que a linha exibe do estado: o texto já pronto (a View não formata) e se o CNPJ do PDF divergiu.
export function leituraDaLinha(leitura: EstadoDaLeitura): LeituraDaLinha {
  switch (leitura.estado) {
    case "lendo":
      return { estado: "lendo", texto: "Lendo o PDF…" };
    case "sugerido":
      return {
        estado: "sugerido",
        texto: leitura.codigoGerado
          ? "Sugerido pelo PDF: confira. O PDF não traz código: gerei um, você pode trocar."
          : "Sugerido pelo PDF: confira",
        cnpjDivergente: leitura.cnpjConfere === false,
      };
    case "falhou":
      return { estado: "falhou", texto: "não consegui ler: digite à mão" };
  }
}

const ORIGEM_ROTULO: Record<
  NonNullable<NonNullable<ParcelamentoFormValues["acordo"]>["origem"]>,
  string
> = {
  receita_federal: "Receita Federal",
  pgfn: "PGFN",
};

// Uma linha com o que o PDF trouxe do acordo ("PGFN · 5 parcelas · R$ 262,89 · adesão 27/01/2026");
// vazia quando não há nada a mostrar (Parcelamento digitado à mão).
export function resumoDoAcordo(acordo: ParcelamentoFormValues["acordo"]): string {
  if (!acordo) return "";
  const [ano, mes, dia] = acordo.dataDeAdesao?.split("-") ?? [];
  return [
    acordo.origem && ORIGEM_ROTULO[acordo.origem],
    acordo.totalDeParcelas &&
      `${acordo.totalDeParcelas} ${acordo.totalDeParcelas === 1 ? "parcela" : "parcelas"}`,
    acordo.valorDaParcelaCentavos &&
      (acordo.valorDaParcelaCentavos / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      }),
    acordo.dataDeAdesao && `adesão ${dia}/${mes}/${ano}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

// Só o que o Funcionário digita conta como mudança (selo e nome do PDF são da tela). Parcelamento
// novo ou removido é mudança; quitado não se edita, então nunca é.
export function mudouParcelamentos(
  atuais: ParcelamentoFormValues[],
  salvos: CadastroOperacionalClienteDto["parcelamentos"],
): boolean {
  if (atuais.length !== salvos.length) return true;
  return atuais.some((atual) => {
    const salvo = salvos.find((p) => p.id === atual.id);
    if (!salvo || salvo.quitado) return !salvo;
    return (
      atual.codigo !== salvo.codigo ||
      atual.parcelasRestantes !== salvo.parcelasRestantes ||
      atual.interno !== salvo.interno
    );
  });
}
