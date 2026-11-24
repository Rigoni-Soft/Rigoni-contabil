import { useCallback } from "react";

import type { RegimeValor } from "@/shared/kernel/regimes";

export type DadosCnpjPublico = { empresa?: string; regime?: RegimeValor };

const TIMEOUT_MS = 5000;

export function useConsultarCnpj() {
  const consultar = useCallback(async (cnpjDigitos: string): Promise<DadosCnpjPublico | null> => {
    if (cnpjDigitos.length !== 14) return null;

    try {
      const resposta = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigitos}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resposta.ok) return null;

      const dados = (await resposta.json()) as {
        razao_social?: string;
        opcao_pelo_simples?: boolean;
        opcao_pelo_mei?: boolean;
      };

      const regime: RegimeValor | undefined = dados.opcao_pelo_mei
        ? "mei"
        : dados.opcao_pelo_simples
          ? "simples_nacional"
          : undefined;

      return { empresa: dados.razao_social || undefined, regime };
    } catch {
      return null;
    }
  }, []);

  return { consultar };
}
