import { FieldError } from "@/presentation/components/ui/field-error";

type CabecalhoDaConversaProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  // A URA avisou que o Atendimento será encerrado por falta de resposta do Funcionário (#73).
  avisoInatividade?: boolean;
  contexto?: { origem: string; resumo: string } | null;
  // Resumo longo vem recolhido em 3 linhas, com botão para ler inteiro.
  resumoLongo?: boolean;
  resumoAberto?: boolean;
  onAlternarResumo?: () => void;
};

export function CabecalhoDaConversa({
  titulo,
  subtitulo,
  encerrado,
  avisoInatividade = false,
  contexto,
  resumoLongo = false,
  resumoAberto = false,
  onAlternarResumo,
}: CabecalhoDaConversaProps) {
  return (
    <header className="shrink-0">
      <h1 className="text-lg font-bold tracking-tight text-primary">{titulo}</h1>
      <p className="text-sm text-muted-foreground">{subtitulo}</p>
      {contexto && (
        <section aria-label="Contexto do Atendimento" className="mt-1 text-sm">
          <p className="font-medium text-muted-foreground">{contexto.origem}</p>
          <p
            id="resumo-do-contexto"
            className={`font-semibold break-words text-foreground ${resumoLongo && !resumoAberto ? "line-clamp-3" : ""}`}
          >
            {contexto.resumo}
          </p>
          {resumoLongo && (
            <button
              type="button"
              aria-expanded={resumoAberto}
              aria-controls="resumo-do-contexto"
              onClick={onAlternarResumo}
              className="-ml-2 min-h-11 rounded-md px-2 font-medium text-primary underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {resumoAberto ? "Mostrar menos" : "Ler resumo completo"}
            </button>
          )}
        </section>
      )}
      {avisoInatividade && (
        <FieldError className="mt-1 font-medium">
          Sem resposta sua há um tempo. Responda ou finalize: sem ação em 10 minutos de expediente a
          URA encerra o Atendimento.
        </FieldError>
      )}
      {encerrado && (
        <p className="mt-1 text-sm font-medium text-muted-foreground">Atendimento encerrado.</p>
      )}
    </header>
  );
}
