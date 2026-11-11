import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { Button } from "@/presentation/components/ui/button";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";

export type EstadoDoServico = "pendente" | "concluido" | "nao_aplica" | "nunca_aplica";
// `bloqueio` é o motivo de o serviço não aceitar troca (ausente = editável).
export type Servico = {
  servicoId: string;
  nome: string;
  estado: EstadoDoServico;
  bloqueio?: string;
};

const APAGADO = "border-dashed bg-muted text-muted-foreground";
const CLASSE_DO_ESTADO: Record<EstadoDoServico, string> = {
  pendente: "",
  concluido: "border-success/50 bg-success/15",
  nao_aplica: APAGADO,
  nunca_aplica: APAGADO,
};

type Props = {
  servicos: Servico[];
  // Motivo que vale para o cartão todo (ex.: sem Responsável): aparece visível, além do leitor de tela.
  aviso?: string;
  // Empregados cadastrados x cartões feitos no mês: o que falta para o Holerite concluir.
  resumoDoHolerite?: string;
  pendente: boolean;
  erro?: string;
  onTrocar: (servicoId: string, de: EstadoDoServico, para: EstadoDoServico) => void;
};

// O acompanhamento do mês de um Cliente no painel dele: um serviço por linha, como o DAS no painel do SN.
export function AcompanhamentoDoClienteRh({
  servicos,
  aviso,
  resumoDoHolerite,
  pendente,
  erro,
  onTrocar,
}: Props) {
  return (
    <>
      {aviso && <Texto variante="apoio">{aviso}</Texto>}
      {erro && <AvisoDeStatus tipo="erro" legivel texto={erro} />}
      <Grade colunas="1>2>4" espaco={4} como="ul" aria-label="Acompanhamento do mês">
        {servicos.map((s) => (
          <Pilha como="li" key={s.servicoId} espaco={1}>
            <Label htmlFor={`servico-${s.servicoId}`}>{s.nome}</Label>
            <Select
              id={`servico-${s.servicoId}`}
              value={s.estado}
              className={cn(CLASSE_DO_ESTADO[s.estado], pendente && "cursor-wait opacity-70")}
              disabled={!!s.bloqueio || s.estado === "nunca_aplica"}
              aria-describedby={s.bloqueio ? `bloqueio-${s.servicoId}` : undefined}
              aria-busy={pendente}
              onChange={(e) =>
                !pendente && onTrocar(s.servicoId, s.estado, e.target.value as EstadoDoServico)
              }
            >
              <Opcao value="pendente">Pendente</Opcao>
              <Opcao value="concluido">Concluído</Opcao>
              <Opcao value="nao_aplica">Não se aplica</Opcao>
              <Opcao value="nunca_aplica">Nunca se aplica</Opcao>
            </Select>
            {s.estado === "nunca_aplica" && !s.bloqueio && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="self-start"
                disabled={pendente}
                aria-label={`Reativar ${s.nome}`}
                onClick={() => onTrocar(s.servicoId, "nunca_aplica", "pendente")}
              >
                Reativar
              </Button>
            )}
            {s.bloqueio && (
              <Texto como="span" variante="somenteLeitor" id={`bloqueio-${s.servicoId}`}>
                {s.bloqueio}
              </Texto>
            )}
          </Pilha>
        ))}
      </Grade>
      {resumoDoHolerite && <Texto variante="apoio">{resumoDoHolerite}</Texto>}
    </>
  );
}
