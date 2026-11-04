import { Caixa, Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";

type ServicosDoAcompanhamentoProps = {
  servicos: { id: string; nome: string; sistema: boolean }[];
  novoNome: string;
  onNovoNome: (nome: string) => void;
  onCriar: () => void;
  // Serviço em edição (renomear na própria linha).
  edicao?: { id: string; nome: string };
  onEditar: (servicoId: string, nomeAtual: string) => void;
  onNomeEdicao: (nome: string) => void;
  onSalvarEdicao: () => void;
  onCancelarEdicao: () => void;
  onDesativar: (servicoId: string) => void;
  pendente: boolean;
};

// Lista dos serviços do mês, mantida pelo Líder do RH. O serviço do sistema (Holerite) não se edita.
export function ServicosDoAcompanhamento({
  servicos,
  novoNome,
  onNovoNome,
  onCriar,
  edicao,
  onEditar,
  onNomeEdicao,
  onSalvarEdicao,
  onCancelarEdicao,
  onDesativar,
  pendente,
}: ServicosDoAcompanhamentoProps) {
  return (
    <Pilha espaco={3}>
      <Texto variante="subtitulo" como="h2">
        Serviços do acompanhamento
      </Texto>
      <Texto variante="apoio">
        Desativar um serviço o tira dos meses a partir do atual; os meses anteriores continuam como
        estavam.
      </Texto>
      <Caixa como="ul" className="divide-y divide-border rounded-lg border border-border bg-card">
        {servicos.map((s) => (
          <Linha
            como="li"
            key={s.id}
            alinhar="centro"
            justificar="entre"
            espaco={3}
            className="px-4 py-2"
          >
            {edicao?.id === s.id ? (
              <Linha
                como="form"
                alinhar="centro"
                espaco={2}
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  onSalvarEdicao();
                }}
              >
                <Input
                  aria-label={`Novo nome de ${s.nome}`}
                  value={edicao.nome}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => onNomeEdicao(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={pendente || edicao.nome.trim() === ""}>
                  Salvar
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={onCancelarEdicao}>
                  Cancelar
                </Button>
              </Linha>
            ) : (
              <Texto variante="corpo" como="span">
                {s.nome}
                {s.sistema && " (do sistema)"}
              </Texto>
            )}
            {!s.sistema && edicao?.id !== s.id && (
              <Linha espaco={2}>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pendente}
                  aria-label={`Renomear ${s.nome}`}
                  onClick={() => onEditar(s.id, s.nome)}
                >
                  Renomear
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendente}
                  aria-label={`Desativar ${s.nome}`}
                  onClick={() => onDesativar(s.id)}
                >
                  Desativar
                </Button>
              </Linha>
            )}
          </Linha>
        ))}
      </Caixa>
      <Linha
        como="form"
        alinhar="fim"
        espaco={3}
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          onCriar();
        }}
      >
        <Pilha espaco="campo" className="flex-1">
          <Label htmlFor="novo-servico">Novo serviço</Label>
          <Input
            id="novo-servico"
            value={novoNome}
            maxLength={40}
            onChange={(e) => onNovoNome(e.target.value)}
          />
        </Pilha>
        <Button type="submit" disabled={pendente || novoNome.trim() === ""}>
          Cadastrar serviço
        </Button>
      </Linha>
    </Pilha>
  );
}
