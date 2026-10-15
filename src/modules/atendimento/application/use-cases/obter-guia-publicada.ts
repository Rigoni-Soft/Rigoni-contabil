import type { GuiaPublicadaPort } from "@/modules/atendimento/application/ports/out/guia-publicada.provider";
import type {
  GuiaFiscal,
  GuiasFiscaisPort,
  TipoGuia,
} from "@/modules/atendimento/application/ports/out/guias-fiscais.provider";
import type { AppError } from "@/shared/errors/app.error";
import { comTentativas, TENTATIVAS } from "@/shared/kernel/com-tentativas";
import { ok, type Result } from "@/shared/kernel/result";

type Dependencias = {
  guias: GuiasFiscaisPort;
  publicadas: GuiaPublicadaPort;
  esperaEntreTentativasMs: number;
};

// Busca a guia no provedor fiscal, confere o que o template exige (`extrair`) e a publica. Falha
// do serviço externo repete antes de devolver o erro.
export function obterGuiaPublicada<T>(
  { guias, publicadas, esperaEntreTentativasMs }: Dependencias,
  clienteId: string,
  tipo: TipoGuia,
  extrair: (guia: GuiaFiscal) => Result<T, AppError>,
): Promise<Result<T & { guia: { url: string; nomeArquivo: string } }, AppError>> {
  return comTentativas(
    async () => {
      const buscada = await guias.buscar(clienteId, tipo);
      if (!buscada.ok) return buscada;
      const extraido = extrair(buscada.value);
      if (!extraido.ok) return extraido;
      const url = await publicadas.publicar(clienteId, buscada.value);
      if (!url.ok) return url;
      return ok({
        ...extraido.value,
        guia: { url: url.value, nomeArquivo: buscada.value.nomeArquivo },
      });
    },
    TENTATIVAS,
    esperaEntreTentativasMs,
  );
}
