import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { CaixaDeMarcacao } from "@/presentation/components/atoms/caixa-de-marcacao.component";
import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { TIPO_TODOS_OS_ENVIOS } from "@/shared/kernel/tipo-de-envio";

export type EnviosDaLinha = {
  opcoes: { valor: string; rotulo: string }[];
  marcados: string[];
  aviso?: string;
  canal?: {
    opcoes: readonly { valor: string; rotulo: string }[];
    valor: string;
    erro?: string;
    onMudar: (valor: string) => void;
  };
  onAlternar: (valor: string) => void;
};

type EnviosDoContatoProps = {
  indice: number;
  numero: number;
  envios: EnviosDaLinha;
  editando: boolean;
};

function rotuloDoCanal({ opcoes, valor }: NonNullable<EnviosDaLinha["canal"]>): string {
  const escolhida = opcoes.find((opcao) => opcao.valor === valor);
  return escolhida ? escolhida.rotulo : "não escolhido";
}

function enviosEmTexto({ opcoes, marcados }: EnviosDaLinha): string {
  if (marcados.length === 0) return "nenhum envio";
  const rotulos = opcoes.filter((opcao) => marcados.includes(opcao.valor));
  const todos = rotulos.find((r) => r.valor === TIPO_TODOS_OS_ENVIOS);
  return todos ? todos.rotulo : rotulos.map((r) => r.rotulo).join(", ");
}

export function EnviosDoContato({ indice, numero, envios, editando }: EnviosDoContatoProps) {
  const idDoRotulo = `contatos.${indice}.envios-rotulo`;
  const idDoAviso = envios.aviso ? `contatos.${indice}.envios-aviso` : undefined;
  return (
    <Caixa
      como="fieldset"
      aria-labelledby={idDoRotulo}
      aria-describedby={idDoAviso}
      className="flex basis-full flex-wrap items-center gap-x-4 gap-y-1 border-t border-border pt-2"
    >
      <Texto variante="somenteLeitor" como="span" id={idDoRotulo}>
        Envios do contato {numero}
      </Texto>
      <Texto variante="rotulo" como="span" aria-hidden="true">
        Recebe
      </Texto>
      {editando ? (
        envios.opcoes.map((opcao) => (
          <CaixaDeMarcacao
            key={opcao.valor}
            id={`contatos.${indice}.tipo-${opcao.valor}`}
            rotulo={opcao.rotulo}
            className="pointer-coarse:min-h-11"
            checked={envios.marcados.includes(opcao.valor)}
            onChange={() => envios.onAlternar(opcao.valor)}
          />
        ))
      ) : (
        <Texto variante="corpo" como="span">
          {enviosEmTexto(envios)}
        </Texto>
      )}
      {envios.canal &&
        (editando ? (
          <CampoDeOpcoes
            id={`contatos.${indice}.canal`}
            rotulo="Enviar por"
            obrigatorio
            opcoes={envios.canal.opcoes}
            placeholder="Escolher"
            placeholderDesabilitado
            erro={envios.canal.erro}
            aria-describedby={idDoAviso}
            className="min-w-[12rem] gap-1"
            value={envios.canal.valor}
            onChange={(evento) => envios.canal?.onMudar(evento.target.value)}
          />
        ) : (
          <Texto variante="apoio" como="span">
            Enviar por: {rotuloDoCanal(envios.canal)}
          </Texto>
        ))}
      {envios.aviso && <AvisoDeStatus tipo="atencao" legivel id={idDoAviso} texto={envios.aviso} />}
    </Caixa>
  );
}
