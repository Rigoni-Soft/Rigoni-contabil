import { useRef, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";

import type { EstadoDaLeitura } from "./editar-cadastro-operacional.presenter";
import { lerPdfDeParcelamentoAction } from "./ler-pdf-de-parcelamento.actions";

// Sem resposta nesse tempo, a leitura vira "digite à mão": a Server Action não se cancela, mas a
// tela não fica presa nem o Salvar travado.
const TEMPO_LIMITE_MS = 20_000;

async function comLimite<T>(promessa: Promise<T>): Promise<T> {
  let relogio: ReturnType<typeof setTimeout> | undefined;
  const estouro = new Promise<never>((_, rejeitar) => {
    relogio = setTimeout(() => rejeitar(new Error("tempo esgotado")), TEMPO_LIMITE_MS);
  });
  try {
    return await Promise.race([promessa, estouro]);
  } finally {
    clearTimeout(relogio);
  }
}

// Lê o PDF escolhido numa linha nova e a preenche como sugestão editável. Falha de leitura (ou da
// própria Server Action) nunca bloqueia: a linha volta a ficar livre para digitar à mão.
// `indiceDe` resolve o índice atual da linha pelo id do campo (a lista pode mudar durante a leitura).
export function useLeituraDoPdf(
  clienteId: string,
  setValue: UseFormSetValue<EditarCadastroOperacionalFormValues>,
  indiceDe: (id: string) => number,
) {
  const [leituras, setLeituras] = useState<Record<string, EstadoDaLeitura>>({});
  // O PDF mais recente de cada linha: resposta de um PDF já trocado ou de uma linha removida é
  // descartada.
  const vigente = useRef<Record<string, File | undefined>>({});

  const definir = (id: string, leitura: EstadoDaLeitura | undefined) =>
    setLeituras((atual) => {
      const proximo = { ...atual };
      if (leitura) proximo[id] = leitura;
      else delete proximo[id];
      return proximo;
    });

  // Os dados do acordo pertencem ao PDF que os trouxe: trocar, remover ou falhar a leitura não pode
  // deixar os do PDF anterior gravados junto do arquivo novo.
  const limparAcordo = (id: string) => {
    const indice = indiceDe(id);
    if (indice >= 0) setValue(`parcelamentos.${indice}.acordo`, undefined);
  };

  const ler = async (id: string, arquivo: File | undefined) => {
    vigente.current[id] = arquivo;
    limparAcordo(id);
    if (!arquivo) return definir(id, undefined);
    definir(id, { estado: "lendo" });

    let leitura: EstadoDaLeitura = { estado: "falhou" };
    try {
      const resultado = await comLimite(lerPdfDeParcelamentoAction({ clienteId, arquivo }));
      if (resultado.ok && resultado.data.lido) {
        const indice = indiceDe(id);
        if (vigente.current[id] === arquivo && indice >= 0) {
          setValue(`parcelamentos.${indice}.codigo`, resultado.data.codigo);
          setValue(
            `parcelamentos.${indice}.parcelasRestantes`,
            resultado.data.quantidadeDeParcelas,
          );
          setValue(`parcelamentos.${indice}.acordo`, resultado.data.acordo);
          leitura = {
            estado: "sugerido",
            codigoGerado: resultado.data.codigoGerado,
            cnpjConfere: resultado.data.cnpjConfere,
          };
        }
      }
    } catch {
      // Sem alerta: cai no "digite à mão".
    }
    if (vigente.current[id] === arquivo) definir(id, leitura);
  };

  // Linha removida: some o estado dela (nenhum "lendo" órfão trava o Salvar) e a resposta tardia
  // é descartada.
  const esquecer = (id: string) => {
    vigente.current[id] = undefined;
    definir(id, undefined);
  };

  const lendo = Object.values(leituras).some((l) => l.estado === "lendo");

  return { leituras, lendo, ler, esquecer };
}
