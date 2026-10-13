import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import type { RegistroAcaoView } from "@/presentation/components/molecules/linha-de-registro.component";
import { AuditoriaFeed } from "@/presentation/components/organisms/auditoria-feed.component";

type ResultadoDoFeedProps = {
  registros: RegistroAcaoView[];
  carregando: boolean;
  erro?: string;
};

// Feed de auditoria com o erro de leitura acima e a lista esmaecida enquanto recarrega.
export function ResultadoDoFeed({ registros, carregando, erro }: ResultadoDoFeedProps) {
  return (
    <>
      {erro && (
        <Caixa className="mb-4">
          <FieldError>{erro}</FieldError>
        </Caixa>
      )}
      <Caixa aria-busy={carregando} className={carregando ? "opacity-60" : undefined}>
        <AuditoriaFeed registros={registros} />
      </Caixa>
    </>
  );
}
