import { Grade, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { NavegacaoDeMes } from "@/presentation/components/molecules/navegacao-de-mes.component";
import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";

export type EstadoDoServico = "pendente" | "concluido" | "nao_aplica";
// `bloqueio` é o motivo de o serviço não aceitar troca (ausente = editável).
export type Servico = {
  servicoId: string;
  nome: string;
  estado: EstadoDoServico;
  bloqueio?: string;
};

const CLASSE_DO_ESTADO: Record<EstadoDoServico, string> = {
  pendente: "",
  concluido: "border-success/50 bg-success/15",
  nao_aplica: "border-dashed bg-muted text-muted-foreground",
};

type Props = {
  rotuloCompetencia: string;
  anteriorHref: string;
  // Sem próximo no mês corrente.
  proximoHref?: string;
  servicos: Servico[];
  pendente: boolean;
  erro?: string;
  onTrocar: (servicoId: string, de: EstadoDoServico, para: EstadoDoServico) => void;
};

// O acompanhamento do mês de um Cliente no painel dele: um serviço por linha, como o DAS no painel do SN.
export function AcompanhamentoDoClienteRh({
  rotuloCompetencia,
  anteriorHref,
  proximoHref,
  servicos,
  pendente,
  erro,
  onTrocar,
}: Props) {
  return (
    <Pilha espaco={3} como="section" aria-labelledby="acompanhamento-do-mes">
      <Texto variante="rotulo" como="h2" id="acompanhamento-do-mes">
        Acompanhamento do mês
      </Texto>
      <NavegacaoDeMes
        rotuloMes={rotuloCompetencia}
        anteriorHref={anteriorHref}
        proximoHref={proximoHref}
      />
      {erro && (
        <Texto variante="alerta" role="alert">
          {erro}
        </Texto>
      )}
      <Grade colunas="1>2>4" espaco={4} como="ul">
        {servicos.map((s) => (
          <Pilha como="li" key={s.servicoId} espaco={1}>
            <Label htmlFor={`servico-${s.servicoId}`}>{s.nome}</Label>
            <Select
              id={`servico-${s.servicoId}`}
              value={s.estado}
              className={cn(CLASSE_DO_ESTADO[s.estado], pendente && "cursor-wait opacity-70")}
              disabled={!!s.bloqueio}
              aria-describedby={s.bloqueio ? `bloqueio-${s.servicoId}` : undefined}
              aria-busy={pendente}
              onChange={(e) =>
                !pendente && onTrocar(s.servicoId, s.estado, e.target.value as EstadoDoServico)
              }
            >
              <Opcao value="pendente">Pendente</Opcao>
              <Opcao value="concluido">Concluído</Opcao>
              <Opcao value="nao_aplica">Não se aplica</Opcao>
            </Select>
            {s.bloqueio && (
              <Texto como="span" variante="somenteLeitor" id={`bloqueio-${s.servicoId}`}>
                {s.bloqueio}
              </Texto>
            )}
          </Pilha>
        ))}
      </Grade>
    </Pilha>
  );
}
