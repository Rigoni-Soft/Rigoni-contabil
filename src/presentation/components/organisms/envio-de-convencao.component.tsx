import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeTexto } from "@/presentation/components/molecules/campo-de-texto.component";
import { Button } from "@/presentation/components/ui/button";
import { TEXTO_CURTO_MAXIMO } from "@/shared/kernel/texto";

export type CampoDoEnvio = "sindicato" | "vigenciaInicio" | "vigenciaFim" | "arquivo";

const ID_DO_ERRO = "erro-envio-convencao";

type Props = {
  arquivo?: File;
  // Muda quando o envio dá certo: o formulário é remontado e o que foi digitado some.
  chave: number;
  pendente: boolean;
  erro?: string;
  // O campo que o erro aponta: ganha aria-invalid e fica ligado à mensagem; sem campo, o erro é do envio.
  campoComErro?: CampoDoEnvio;
  onArquivo: (arquivo?: File) => void;
  onEnviar: (campos: FormData) => void;
};

// Sobe ou renova a Convenção coletiva do Cliente: o sindicato que a identifica, a vigência e o PDF. A
// leitura roda uma vez, ao enviar, e as regras valem sem aprovação.
export function EnvioDeConvencao({
  arquivo,
  chave,
  pendente,
  erro,
  campoComErro,
  onArquivo,
  onEnviar,
}: Props) {
  const ligacao = (campo: CampoDoEnvio) =>
    erro && campoComErro === campo ? { "aria-invalid": true, "aria-describedby": ID_DO_ERRO } : {};
  return (
    <Caixa
      como="form"
      key={chave}
      aria-label="Enviar convenção"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar(new FormData(e.currentTarget));
      }}
    >
      <Pilha espaco="formulario">
        <NotaDeObrigatorio />
        <Texto como="h2" variante="subtitulo">
          Enviar ou renovar a convenção
        </Texto>
        <Texto variante="apoio">
          As regras são lidas do PDF uma única vez, ao enviar, e passam a valer sem aprovação. A
          convenção anterior fica no histórico.
        </Texto>
        <Grade colunas="1>2>4" espaco={4}>
          <CampoDeTexto
            id="convencao-sindicato"
            rotulo="Sindicato"
            name="sindicato"
            obrigatorio
            required
            maxLength={TEXTO_CURTO_MAXIMO}
            className="gap-1 sm:col-span-2"
            {...ligacao("sindicato")}
          />
          <CampoDeTexto
            id="convencao-inicio"
            rotulo="Início da vigência"
            type="date"
            name="vigenciaInicio"
            obrigatorio
            required
            className="gap-1"
            {...ligacao("vigenciaInicio")}
          />
          <CampoDeTexto
            id="convencao-fim"
            rotulo="Fim da vigência"
            type="date"
            name="vigenciaFim"
            obrigatorio
            required
            className="gap-1"
            {...ligacao("vigenciaFim")}
          />
        </Grade>
        <CampoDeArquivo
          id="convencao-arquivo"
          name="arquivo"
          rotulo="Convenção (PDF)"
          accept="application/pdf"
          dica="PDF de até 4 MB"
          file={arquivo}
          onChange={onArquivo}
          erro={campoComErro === "arquivo" ? erro : undefined}
        />
        {erro && campoComErro !== "arquivo" && (
          <Caixa id={ID_DO_ERRO}>
            <AvisoDeStatus tipo="erro" legivel texto={erro} />
          </Caixa>
        )}
        <Button type="submit" disabled={pendente} className="self-start">
          {pendente ? "Lendo a convenção…" : "Enviar convenção"}
        </Button>
      </Pilha>
    </Caixa>
  );
}
