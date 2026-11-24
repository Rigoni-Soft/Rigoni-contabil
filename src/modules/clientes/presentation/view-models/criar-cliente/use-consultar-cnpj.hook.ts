import { useCallback } from "react";

import type { RegimeValor } from "@/shared/kernel/regimes";

export type DadosCnpjPublico = { empresa?: string; regime?: RegimeValor };

type RespostaDaBrasilApi = {
  razao_social?: string;
  opcao_pelo_simples?: boolean;
  opcao_pelo_mei?: boolean;
};

const TIMEOUT_MS = 5000;
const QUANTIDADE_DE_DIGITOS_DO_CNPJ = 14;
const SEM_DADOS_PUBLICOS = null;

const urlDaConsulta = (cnpjDigitos: string) =>
  `https://brasilapi.com.br/api/cnpj/v1/${cnpjDigitos}`;

function regimeConfirmadoPelaApi(dados: RespostaDaBrasilApi): RegimeValor | undefined {
  if (dados.opcao_pelo_mei) return "mei";
  if (dados.opcao_pelo_simples) return "simples_nacional";
  return undefined;
}

export function useConsultarCnpj() {
  const consultar = useCallback(async (cnpjDigitos: string): Promise<DadosCnpjPublico | null> => {
    if (cnpjDigitos.length !== QUANTIDADE_DE_DIGITOS_DO_CNPJ) return SEM_DADOS_PUBLICOS;

    try {
      const resposta = await fetch(urlDaConsulta(cnpjDigitos), {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) return SEM_DADOS_PUBLICOS;

      const dados = (await resposta.json()) as RespostaDaBrasilApi;
      return { empresa: dados.razao_social || undefined, regime: regimeConfirmadoPelaApi(dados) };
    } catch {
      return SEM_DADOS_PUBLICOS;
    }
  }, []);

  return { consultar };
}
