import { useEffect, useRef, useState } from "react";
import type { UseFormSetValue } from "react-hook-form";

import type { EditarCadastroOperacionalFormValues } from "@/modules/clientes/presentation/view-models/editar-cadastro-operacional/editar-cadastro-operacional.schema";

import type { EstadoDaLeitura } from "./editar-cadastro-operacional.presenter";
import { lerPdfDeParcelamentoAction } from "./ler-pdf-de-parcelamento.actions";

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

export function useLeituraDoPdf(
  clienteId: string,
  setValue: UseFormSetValue<EditarCadastroOperacionalFormValues>,
  campos: { id: string }[],
) {
  const camposAtuais = useRef(campos);
  useEffect(() => {
    camposAtuais.current = campos;
  });
  const indiceDe = (id: string) => camposAtuais.current.findIndex((campo) => campo.id === id);
  const [leituras, setLeituras] = useState<Record<string, EstadoDaLeitura>>({});
  const vigente = useRef<Record<string, File | undefined>>({});

  const definir = (id: string, leitura: EstadoDaLeitura | undefined) =>
    setLeituras((atual) => {
      const proximo = { ...atual };
      if (leitura) proximo[id] = leitura;
      else delete proximo[id];
      return proximo;
    });

  const ler = async (id: string, arquivo: File | undefined) => {
    vigente.current[id] = arquivo;
    const atual = indiceDe(id);
    if (atual >= 0) setValue(`parcelamentos.${atual}.acordo`, undefined);
    if (!arquivo) return definir(id, undefined);
    definir(id, { estado: "lendo" });

    let leitura: EstadoDaLeitura = { estado: "falhou" };
    try {
      const resultado = await comLimite(lerPdfDeParcelamentoAction({ clienteId, arquivo }));
      const indice = indiceDe(id);
      if (resultado.ok && resultado.data.lido && vigente.current[id] === arquivo && indice >= 0) {
        const { codigo, quantidadeDeParcelas, acordo, codigoGerado, cnpjConfere } = resultado.data;
        setValue(`parcelamentos.${indice}.codigo`, codigo);
        setValue(`parcelamentos.${indice}.parcelasRestantes`, quantidadeDeParcelas);
        setValue(`parcelamentos.${indice}.acordo`, acordo);
        leitura = { estado: "sugerido", codigoGerado, cnpjConfere };
      }
    } catch {}
    if (vigente.current[id] === arquivo) definir(id, leitura);
  };

  const esquecerTodas = () => {
    vigente.current = {};
    setLeituras({});
  };

  return { leituras, ler, esquecerTodas };
}
