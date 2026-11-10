import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { ListaComDivisores } from "@/presentation/components/atoms/lista-com-divisores.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { ConfirmacaoEmLinha } from "@/presentation/components/molecules/confirmacao-em-linha.component";
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
  // Desativar pede um segundo clique: tira a coluna do mês atual em diante.
  onDesativar: (servicoId: string) => void;
  desativando?: string;
  onConfirmarDesativar: (servicoId: string) => void;
  onCancelarDesativar: () => void;
  pendente: boolean;
  erro?: string;
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
  desativando,
  onDesativar,
  onConfirmarDesativar,
  onCancelarDesativar,
  pendente,
  erro,
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
      <ListaComDivisores cartao>
        {servicos.map((s) => (
          <Linha
            como="li"
            key={s.id}
            alinhar="centro"
            justificar="entre"
            espaco={3}
            className="flex-wrap px-4 py-2"
          >
            {edicao?.id === s.id ? (
              <Linha
                como="form"
                alinhar="centro"
                espaco={2}
                className="min-w-0 flex-wrap"
                onSubmit={(e: React.FormEvent) => {
                  e.preventDefault();
                  onSalvarEdicao();
                }}
              >
                <Input
                  className="min-w-0 flex-1"
                  aria-label={`Novo nome de ${s.nome}`}
                  value={edicao.nome}
                  maxLength={40}
                  autoFocus
                  onChange={(e) => onNomeEdicao(e.target.value)}
                />
                <Button type="submit" size="sm" disabled={pendente || edicao.nome.trim() === ""}>
                  {pendente ? "Salvando…" : "Salvar"}
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
              <Linha espaco={2} className="flex-wrap">
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
                {desativando === s.id ? (
                  <ConfirmacaoEmLinha
                    texto={`Desativar ${s.nome}? Ele sai dos meses a partir do atual.`}
                    rotuloDoConfirmar="Confirmar"
                    rotuloEmCurso="Desativando…"
                    nomeDoConfirmar={`Confirmar desativação de ${s.nome}`}
                    nomeDoCancelar={`Cancelar desativação de ${s.nome}`}
                    destrutiva
                    emCurso={pendente}
                    ocupado={pendente}
                    onConfirmar={() => onConfirmarDesativar(s.id)}
                    onCancelar={onCancelarDesativar}
                  />
                ) : (
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
                )}
              </Linha>
            )}
          </Linha>
        ))}
      </ListaComDivisores>
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
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
    </Pilha>
  );
}
