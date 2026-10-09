import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import { ItemDaFila } from "@/presentation/components/molecules/item-da-fila.component";

type ItemView = React.ComponentProps<typeof ItemDaFila> & { id: string };

type FilaDoSetorProps = {
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
  itens,
  escolhaDeSetor,
  carregando = false,
  indisponivel = false,
}: FilaDoSetorProps) {
  return (
    <section aria-label="Fila do Setor" className="space-y-4">
      {escolhaDeSetor && (
        <div className="max-w-xs">
          <CampoSelect
            id="fila-setor"
            rotulo="Setor"
            value={escolhaDeSetor.setor}
            onChange={(e) => escolhaDeSetor.onChange(e.target.value)}
          >
            {escolhaDeSetor.opcoes.map(({ valor, rotulo }) => (
              <option key={valor} value={valor}>
                {rotulo}
              </option>
            ))}
          </CampoSelect>
        </div>
      )}
      {indisponivel && (
        <p role="alert" className="text-sm text-destructive">
          Não foi possível atualizar a Fila agora. Tentando de novo.
        </p>
      )}
      {carregando ? (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando a Fila…
        </p>
      ) : itens.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cliente na Fila.</p>
      ) : (
        <ol className="space-y-2">
          {itens.map(({ id, ...item }) => (
            <ItemDaFila key={id} {...item} />
          ))}
        </ol>
      )}
    </section>
  );
}
