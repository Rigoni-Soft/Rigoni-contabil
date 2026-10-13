import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import {
  ItemDaFila,
  type ItemDaFilaProps,
} from "@/presentation/components/molecules/item-da-fila.component";

type ItemView = ItemDaFilaProps & { id: string };

type FilaDoSetorProps = {
  titulo: string;
  // h1 quando a Fila é a tela; h2 quando é a barra lateral da conversa.
  nivelDoTitulo?: 1 | 2;
  itens: ItemView[];
  // Só o Admin escolhe o Setor; para os demais a Fila é a do próprio Setor.
  escolhaDeSetor?: {
    setor: string;
    opcoes: { valor: string; rotulo: string }[];
    onChange: (setor: string) => void;
  };
  carregando?: boolean;
  indisponivel?: boolean;
};

export function FilaDoSetor({
  titulo,
  nivelDoTitulo = 2,
  itens,
  escolhaDeSetor,
  carregando = false,
  indisponivel = false,
}: FilaDoSetorProps) {
  const Titulo = nivelDoTitulo === 1 ? "h1" : "h2";
  return (
    <Caixa como="section" aria-label="Fila do Setor" className="space-y-4">
      <Titulo className="text-lg font-bold tracking-tight text-primary">{titulo}</Titulo>
      {escolhaDeSetor && (
        <Caixa className="max-w-xs">
          <CampoSelect
            id="fila-setor"
            rotulo="Setor"
            value={escolhaDeSetor.setor}
            onChange={(e) => escolhaDeSetor.onChange(e.target.value)}
          >
            {escolhaDeSetor.opcoes.map(({ valor, rotulo }) => (
              <Opcao key={valor} value={valor}>
                {rotulo}
              </Opcao>
            ))}
          </CampoSelect>
        </Caixa>
      )}
      {indisponivel && (
        <Texto variante="livre" role="alert" className="text-sm text-destructive">
          Não foi possível atualizar a Fila agora. Tentando de novo.
        </Texto>
      )}
      {carregando ? (
        <Texto variante="livre" role="status" className="text-sm text-muted-foreground">
          Carregando a Fila…
        </Texto>
      ) : itens.length === 0 ? (
        <Texto variante="livre" className="text-sm text-muted-foreground">
          Nenhum cliente na Fila.
        </Texto>
      ) : (
        <Caixa como="ol" className="space-y-2">
          {itens.map(({ id, ...item }) => (
            <ItemDaFila key={id} {...item} />
          ))}
        </Caixa>
      )}
    </Caixa>
  );
}
