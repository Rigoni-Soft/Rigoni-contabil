import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

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
      <Pilha espaco={3}>
        <Texto como="h3" variante="rotuloDeSecao">
          Enviar ou renovar a convenção
        </Texto>
        <Texto variante="apoio">
          As regras são lidas do PDF uma única vez, ao enviar, e passam a valer sem aprovação. A
          convenção anterior fica no histórico.
        </Texto>
        <Linha alinhar="fim" espaco={3} quebra>
          <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
            Sindicato
            <Input
              name="sindicato"
              required
              maxLength={120}
              className="w-full sm:w-72"
              {...ligacao("sindicato")}
            />
          </Caixa>
          <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
            Início da vigência
            <Input
              type="date"
              name="vigenciaInicio"
              required
              className="w-44"
              {...ligacao("vigenciaInicio")}
            />
          </Caixa>
          <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
            Fim da vigência
            <Input
              type="date"
              name="vigenciaFim"
              required
              className="w-44"
              {...ligacao("vigenciaFim")}
            />
          </Caixa>
        </Linha>
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
        <Button type="submit" size="sm" disabled={pendente} className="self-start">
          {pendente ? "Lendo a convenção…" : "Enviar convenção"}
        </Button>
      </Pilha>
    </Caixa>
  );
}
