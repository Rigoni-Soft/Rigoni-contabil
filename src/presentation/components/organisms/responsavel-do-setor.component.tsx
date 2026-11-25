import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { FieldError } from "@/presentation/components/atoms/field-error.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { CampoResponsavel } from "@/presentation/components/molecules/campo-responsavel.component";
import { Button } from "@/presentation/components/ui/button";
import { SEM_RESPONSAVEL_LABEL } from "@/shared/kernel/papeis";

type ResponsavelDoSetorProps = {
  setor: string;
  valor: string;
  opcoes: { id: string; nome: string }[];
  onMudar: (id: string) => void;
  onAbrir: () => void;
  estadoLista: "ok" | "carregando" | "erro";
  onTentarNovamente: () => void;
  onSalvar: () => void;
  alterado: boolean;
  pendente: boolean;
  erro?: string;
  salvo?: boolean;
  embutido?: boolean;
};

export function ResponsavelDoSetor({
  setor,
  valor,
  opcoes,
  onMudar,
  onAbrir,
  estadoLista,
  onTentarNovamente,
  onSalvar,
  alterado,
  pendente,
  erro,
  salvo,
  embutido = false,
}: ResponsavelDoSetorProps) {
  return (
    <Pilha espaco={3}>
      {!embutido && (
        <Texto variante="apoio">
          Quem responde por este Cliente no Setor {setor}. Os Atendimentos dele vão a essa pessoa;
          sem Responsável, vão ao Líder.
        </Texto>
      )}
      <CampoResponsavel
        editavel
        nomeAtual=""
        opcoes={opcoes}
        semResponsavel={SEM_RESPONSAVEL_LABEL}
        estadoLista={estadoLista}
        onAbrir={onAbrir}
        onTentarNovamente={onTentarNovamente}
        select={{ value: valor, onChange: (evento) => onMudar(evento.target.value) }}
        desabilitado={pendente}
      />
      {erro && <FieldError>{erro}</FieldError>}
      {salvo && <AvisoDeStatus tipo="sucesso" legivel texto="Responsável atualizado." />}
      <Caixa>
        <Button type="button" onClick={onSalvar} disabled={!alterado || pendente}>
          {pendente ? "Salvando…" : "Salvar Responsável"}
        </Button>
      </Caixa>
    </Pilha>
  );
}
