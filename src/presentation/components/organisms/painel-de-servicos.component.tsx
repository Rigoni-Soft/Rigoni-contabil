import { FileText } from "lucide-react";

import { TituloDoGrupo } from "@/presentation/components/atoms/titulo-de-grupo.component";
import { AvisoDeStatus } from "@/presentation/components/molecules/aviso-de-status.component";
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
// (#42 e os adapters do Serpro, #66-#68) e passam a disparar quando existirem.
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
    <div className="space-y-2">
      <TituloDoGrupo>Serviços do cliente</TituloDoGrupo>
      {semCliente ? (
        <p className="text-xs text-muted-foreground">
          Sem Cliente vinculado a este número não há serviços para disparar.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-start"
              disabled={enviando || !contrato}
              title={contrato ? undefined : "Contrato social não cadastrado"}
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
                className="justify-start"
                disabled
                title="Em construção"
              >
                {rotulo}
              </Button>
            ))}
          </div>
          <form
            className="flex items-end gap-2"
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
              <option value="" disabled>
                {alteracoes.length === 0 ? "Nenhuma cadastrada" : "Escolha a alteração"}
              </option>
              {alteracoes.map((alteracao) => (
                <option key={alteracao.valor} value={alteracao.valor}>
                  {alteracao.rotulo}
                </option>
              ))}
            </CampoSelect>
            <Button
              type="submit"
              size="sm"
              aria-label="Enviar alteração"
              disabled={enviando || alteracoes.length === 0}
            >
              Enviar
            </Button>
          </form>
        </>
      )}
      {enviando && (
        <p role="status" className="text-xs text-muted-foreground">
          Enviando...
        </p>
      )}
      {aviso && <AvisoDeStatus {...aviso} />}
    </div>
  );
}
