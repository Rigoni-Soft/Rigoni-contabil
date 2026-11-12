import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { NotaDeObrigatorio } from "@/presentation/components/atoms/nota-de-obrigatorio.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoDeArquivo } from "@/presentation/components/molecules/campo-de-arquivo.component";
import { CampoDeOpcoes } from "@/presentation/components/molecules/campo-de-opcoes.component";
import { Button } from "@/presentation/components/ui/button";

const QUINZENAS = [
  { valor: "1", rotulo: "1ª quinzena (dias 1 a 15)" },
  { valor: "2", rotulo: "2ª quinzena (dia 16 ao fim)" },
] as const;

type Props = {
  rotuloMes: string;
  arquivo?: File;
  pendente: boolean;
  erro?: string;
  // O erro é da foto escolhida (falta ou tamanho): vai no próprio campo; senão é da leitura.
  erroNoCampo?: boolean;
  // O que a leitura fez, em uma frase (empregado, dias, faltas, abonos).
  resultado?: string;
  onArquivo: (arquivo?: File) => void;
  onLer: (campos: FormData) => void;
};

// "Ler foto do cartão": a foto de uma quinzena vira o cartão do empregado, sem tela de confirmação (o
// Funcionário corrige à mão depois). Leitura que falha não bloqueia: o erro manda digitar.
export function LeituraDeCartao({
  rotuloMes,
  arquivo,
  pendente,
  erro,
  erroNoCampo,
  resultado,
  onArquivo,
  onLer,
}: Props) {
  return (
    <Caixa
      como="form"
      aria-label="Ler foto do cartão"
      aria-busy={pendente}
      onSubmit={(e) => {
        e.preventDefault();
        onLer(new FormData(e.currentTarget));
      }}
    >
      <Pilha espaco="formulario">
        <NotaDeObrigatorio />
        <Texto como="h2" variante="subtitulo">
          Ler foto do cartão de ponto
        </Texto>
        <Texto variante="apoio">
          A foto vira o cartão da quinzena de {rotuloMes}: o empregado que não está no quadro é
          cadastrado pelo nome do cartão. A foto não é guardada. Confira os horários depois; se a
          leitura falhar, digite à mão.
        </Texto>
        <Grade colunas="1>2>4" espaco={4}>
          <CampoDeOpcoes
            id="leitura-quinzena"
            rotulo="Quinzena"
            name="quinzena"
            defaultValue="1"
            opcoes={QUINZENAS}
          />
        </Grade>
        <CampoDeArquivo
          id="leitura-foto"
          name="imagem"
          rotulo="Foto do cartão (JPEG ou PNG)"
          accept="image/jpeg,image/png"
          dica="JPEG ou PNG de até 4 MB"
          file={arquivo}
          onChange={onArquivo}
          erro={erroNoCampo ? erro : undefined}
        />
        {erro && !erroNoCampo && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
        {resultado && <AvisoDeStatus tipo="sucesso" legivel texto={resultado} />}
        <Button type="submit" aria-disabled={pendente} className="self-start">
          {pendente ? "Lendo o cartão…" : "Ler cartão"}
        </Button>
      </Pilha>
    </Caixa>
  );
}
