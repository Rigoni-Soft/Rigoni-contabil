import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
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
  onAssumir?: (id: string) => void;
  // O item cuja assunção está em curso; os demais ficam livres.
  assumindoId?: string | null;
  erroAoAssumir?: string | null;
};

export function FilaDoSetor({
  titulo,
  nivelDoTitulo = 2,
  itens,
  escolhaDeSetor,
  carregando = false,
  indisponivel = false,
  onAssumir,
  assumindoId = null,
  erroAoAssumir = null,
}: FilaDoSetorProps) {
  const Titulo = nivelDoTitulo === 1 ? "h1" : "h2";
  return (
    <Pilha espaco={4} como="section" aria-label="Fila do Setor">
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
        <Texto variante="alerta" role="alert">
          Não foi possível atualizar a Fila agora. Tentando de novo.
        </Texto>
      )}
      {erroAoAssumir && (
        <Texto variante="alerta" role="alert">
          {erroAoAssumir}
        </Texto>
      )}
      {carregando ? (
        <Texto variante="apoio" role="status">
          Carregando a Fila…
        </Texto>
      ) : itens.length === 0 ? (
        <Texto variante="apoio">Nenhum cliente na Fila.</Texto>
      ) : (
        <Pilha espaco={2} como="ol">
          {itens.map(({ id, ...item }) => (
            <Caixa como="li" key={id}>
              <ItemDaFila
                {...item}
                onAssumir={onAssumir && (() => onAssumir(id))}
                assumindo={assumindoId === id}
              />
            </Caixa>
          ))}
        </Pilha>
      )}
    </Pilha>
  );
}
