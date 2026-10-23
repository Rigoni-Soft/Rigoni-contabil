import { useRef, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type {
  EditarCadastroOperacionalFormValues,
  LeituraDaLinha,
} from "@/presentation/components/organisms/editar-cadastro-operacional-form.component";

import { lerPdfDeParcelamentoAction } from "./ler-pdf-de-parcelamento.actions";

// Lê o PDF escolhido numa linha nova e a preenche como sugestão editável. Falha de leitura (ou da
// própria Server Action) nunca bloqueia: a linha volta a ficar livre para digitar à mão.
// `indiceDe` resolve o índice atual da linha pelo id do campo (a lista pode mudar durante a leitura).
export function useLeituraDoPdf(
  clienteId: string,
  setValue: UseFormSetValue<EditarCadastroOperacionalFormValues>,
  indiceDe: (id: string) => number,
) {
  const [leituras, setLeituras] = useState<Record<string, LeituraDaLinha>>({});
  // O PDF mais recente de cada linha: resposta de um PDF já trocado é descartada.
  const vigente = useRef<Record<string, File | undefined>>({});

  const definir = (id: string, leitura: LeituraDaLinha | undefined) =>
    setLeituras((atual) => {
      const proximo = { ...atual };
      if (leitura) proximo[id] = leitura;
      else delete proximo[id];
      return proximo;
    });

  const ler = async (id: string, arquivo: File | undefined) => {
    vigente.current[id] = arquivo;
    if (!arquivo) return definir(id, undefined);
    definir(id, { estado: "lendo" });

    let leitura: LeituraDaLinha = { estado: "falhou" };
    try {
      const resultado = await lerPdfDeParcelamentoAction({ clienteId, arquivo });
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
      // Sem alerta (spec #121): cai no "digite à mão".
    }
    if (vigente.current[id] === arquivo) definir(id, leitura);
  };

  return { leituras, ler };
}
