import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";

type Props = {
  arquivo?: File;
  // Muda quando o envio dá certo: o formulário é remontado e o que foi digitado some.
  chave: number;
  pendente: boolean;
  erro?: string;
  onArquivo: (arquivo?: File) => void;
  onEnviar: (campos: FormData) => void;
};

// Sobe ou renova a Convenção coletiva do Cliente: o sindicato que a identifica, a vigência e o PDF. A
// leitura roda uma vez, ao enviar, e as regras valem sem aprovação.
export function EnvioDeConvencao({ arquivo, chave, pendente, erro, onArquivo, onEnviar }: Props) {
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
            <Input name="sindicato" required maxLength={120} className="w-full sm:w-72" />
          </Caixa>
          <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
            Início da vigência
            <Input type="date" name="vigenciaInicio" required className="w-44" />
          </Caixa>
          <Caixa como="label" className="flex flex-col gap-1 text-sm font-semibold">
            Fim da vigência
            <Input type="date" name="vigenciaFim" required className="w-44" />
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
        />
        {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
        <Button type="submit" size="sm" disabled={pendente} className="self-start">
          {pendente ? "Lendo a convenção…" : "Enviar convenção"}
        </Button>
      </Pilha>
    </Caixa>
  );
}
