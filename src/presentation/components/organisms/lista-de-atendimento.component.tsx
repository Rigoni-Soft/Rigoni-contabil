import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AbasDeAtendimento } from "@/presentation/components/molecules/abas-de-atendimento.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import { cn } from "@/presentation/lib/utils";

export type AbaDoAtendimento = "espera" | "atendimento";

type ListaDeAtendimentoProps = {
  aba: AbaDoAtendimento;
  onEscolherAba: (aba: AbaDoAtendimento) => void;
  contadores: Record<AbaDoAtendimento, number>;
  aviso?: string;
  indisponivel?: boolean;
  // Só o Admin escolhe o Setor; para os demais a espera é a do próprio Setor.
  escolhaDeSetor?: {
    setor: string;
    opcoes: { valor: string; rotulo: string }[];
    onChange: (setor: string) => void;
  };
  // Em tela estreita o chat aberto ocupa o lugar da lista.
  escondidaNoCelular?: boolean;
  // O painel da aba ativa (`PainelDeEspera` ou `PainelDeEmAtendimento`).
  children: React.ReactNode;
};

// A coluna da lista: o Setor (Admin), as duas abas e o painel da aba ativa.
export function ListaDeAtendimento({
  aba,
  onEscolherAba,
  contadores,
  aviso,
  indisponivel = false,
  escolhaDeSetor,
  escondidaNoCelular = false,
  children,
}: ListaDeAtendimentoProps) {
  return (
    <Pilha
      espaco={3}
      como="section"
      aria-label="Atendimentos"
      className={cn(escondidaNoCelular && "hidden lg:block")}
    >
      {escolhaDeSetor && (
        <CampoSelect
          id="atendimento-setor"
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
      )}
      <AbasDeAtendimento
        abas={[
          { valor: "espera", rotulo: "Em espera", contador: contadores.espera },
          { valor: "atendimento", rotulo: "Em atendimento", contador: contadores.atendimento },
        ]}
        ativa={aba}
        onEscolher={onEscolherAba}
      />
      {aviso && (
        <Texto variante="alerta" role="alert">
          {aviso}
        </Texto>
      )}
      {indisponivel && (
        <Texto variante="alerta" role="alert">
          Não foi possível atualizar a lista agora. Tentando de novo.
        </Texto>
      )}
      <Caixa id="painel-de-atendimento" role="tabpanel" aria-labelledby={`aba-${aba}`}>
        {children}
      </Caixa>
    </Pilha>
  );
}
