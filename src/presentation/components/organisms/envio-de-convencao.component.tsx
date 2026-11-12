import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { Button } from "@/presentation/components/ui/button";

export type CampoDoEnvio = "arquivo";

const ID_DO_ERRO = "erro-envio-convencao";

type Props = {
  arquivo?: File;
  // Muda quando o envio dá certo: o formulário é remontado e o que foi escolhido some.
  chave: number;
  pendente: boolean;
  erro?: string;
  // O campo que o erro aponta; sem campo, o erro é do envio.
  campoComErro?: CampoDoEnvio;
  onArquivo: (arquivo?: File) => void;
  onEnviar: () => void;
};

// Sobe ou renova a Convenção coletiva do Cliente: só o PDF. O sindicato, a vigência e as regras saem dele, na
// leitura que roda uma vez, ao enviar; as regras valem sem aprovação.
export function EnvioDeConvencao({
  arquivo,
  chave,
  pendente,
  erro,
  campoComErro,
  onArquivo,
  onEnviar,
}: Props) {
  return (
    <Caixa
      como="form"
      key={chave}
      aria-label="Enviar convenção"
      onSubmit={(e) => {
        e.preventDefault();
        onEnviar();
      }}
    >
      <Pilha espaco="formulario">
        <Texto como="h2" variante="subtitulo">
          Enviar ou renovar a convenção
        </Texto>
        <Texto variante="apoio">
          O sindicato, a vigência e as regras são lidos do PDF uma única vez, ao enviar, e passam a
          valer sem aprovação. A convenção anterior fica no histórico.
        </Texto>
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
