import { BotaoDeLink } from "@/presentation/components/atoms/botao-de-link.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { cn } from "@/presentation/lib/utils";

type CabecalhoDaConversaProps = {
  titulo: string;
  subtitulo: string;
  encerrado: boolean;
  // A URA avisou que o Atendimento será encerrado por falta de resposta do Funcionário.
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
    <Caixa como="header" className="shrink-0">
      <Texto variante="subtela" como="h1">
        {titulo}
      </Texto>
      <Texto variante="apoio">{subtitulo}</Texto>
      {contexto && (
        <Caixa como="section" aria-label="Contexto do Atendimento" className="mt-1 text-sm">
          <Texto variante="apoio" className="font-medium">
            {contexto.origem}
          </Texto>
          <Texto
            variante="titulo"
            id="resumo-do-contexto"
            className={cn("break-words", resumoLongo && !resumoAberto && "line-clamp-3")}
          >
            {contexto.resumo}
          </Texto>
          {resumoLongo && (
            <BotaoDeLink
              aria-expanded={resumoAberto}
              aria-controls="resumo-do-contexto"
              onClick={onAlternarResumo}
            >
              {resumoAberto ? "Mostrar menos" : "Ler resumo completo"}
            </BotaoDeLink>
          )}
        </Caixa>
      )}
      {avisoInatividade && (
        <FieldError className="mt-1 font-medium">
          Sem resposta sua há um tempo. Responda ou finalize: sem ação em 10 minutos de expediente a
          URA encerra o Atendimento.
        </FieldError>
      )}
      {encerrado && (
        <Texto variante="apoio" className="mt-1 font-medium">
          Atendimento encerrado.
        </Texto>
      )}
    </Caixa>
  );
}
