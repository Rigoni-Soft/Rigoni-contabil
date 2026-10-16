import { FileText } from "lucide-react";

import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Grade, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { TituloDoGrupo } from "@/presentation/components/atoms/titulo-de-grupo.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import { Button } from "@/presentation/components/ui/button";

const SERVICOS_EM_CONSTRUCAO = ["Guia de imposto", "Guia de parcelamento", "CND"];

type PainelDeServicosProps = {
  semCliente: boolean;
  servicos: { valor: string; rotulo: string; grupo: "contrato" | "alteracao" }[];
  onEnviarServico: (valor: string) => void;
  enviando: boolean;
  aviso?: { tipo: "erro" | "sucesso"; texto: string };
};

// Os mesmos serviços do menu da URA, a um clique. Guias e CND ainda respondem "em construção" lá
// e passam a disparar quando existirem.
export function PainelDeServicos({
  semCliente,
  servicos,
  onEnviarServico,
  enviando,
  aviso,
}: PainelDeServicosProps) {
  const contrato = servicos.find((servico) => servico.grupo === "contrato");
  const alteracoes = servicos.filter((servico) => servico.grupo === "alteracao");

  return (
    <Pilha espaco={2}>
      <TituloDoGrupo>Serviços do cliente</TituloDoGrupo>
      {semCliente ? (
        <Texto variante="nota">Sem Cliente vinculado a este número.</Texto>
      ) : (
        <>
          <Grade colunas="duas" espaco={2}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-auto min-h-10 justify-start py-1.5 text-left leading-tight whitespace-normal pointer-coarse:min-h-11"
              disabled={enviando || !contrato}
              onClick={() => contrato && onEnviarServico(contrato.valor)}
            >
              <FileText aria-hidden="true" />
              Contrato social
            </Button>
            {SERVICOS_EM_CONSTRUCAO.map((rotulo) => (
              <Button
                key={rotulo}
                type="button"
                variant="outline"
                size="sm"
                className="h-auto min-h-10 justify-start py-1.5 text-left leading-tight whitespace-normal pointer-coarse:min-h-11"
                disabled
                title="Em construção"
              >
                {rotulo}
              </Button>
            ))}
          </Grade>
          <Texto variante="nota">Guias e CND: em construção.</Texto>
          {!contrato && <Texto variante="nota">Contrato social não cadastrado.</Texto>}
          <Linha
            alinhar="fim"
            espaco={2}
            como="form"
            onSubmit={(evento) => {
              evento.preventDefault();
              onEnviarServico(String(new FormData(evento.currentTarget).get("alteracao")));
            }}
          >
            <CampoSelect
              id="servico-alteracao"
              rotulo="Alteração contratual"
              name="alteracao"
              required
              defaultValue=""
              disabled={alteracoes.length === 0}
            >
              <Opcao value="" disabled>
                {alteracoes.length === 0 ? "Nenhuma cadastrada" : "Escolha a alteração"}
              </Opcao>
              {alteracoes.map((alteracao) => (
                <Opcao key={alteracao.valor} value={alteracao.valor}>
                  {alteracao.rotulo}
                </Opcao>
              ))}
            </CampoSelect>
            <Button
              type="submit"
              size="sm"
              className="pointer-coarse:h-11"
              aria-label="Enviar alteração"
              disabled={enviando || alteracoes.length === 0}
            >
              Enviar
            </Button>
          </Linha>
        </>
      )}
      {enviando && (
        <Texto variante="nota" role="status">
          Enviando...
        </Texto>
      )}
      {aviso && <AvisoDeStatus {...aviso} />}
    </Pilha>
  );
}
