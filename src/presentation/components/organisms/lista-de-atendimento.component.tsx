import { Caixa, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { Texto } from "@/presentation/components/atoms/texto.component";
import { AbasDeAtendimento } from "@/presentation/components/molecules/abas-de-atendimento.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import { CardDeConversa } from "@/presentation/components/molecules/card-de-conversa.component";
import { CardDeEspera } from "@/presentation/components/molecules/card-de-espera.component";

type Aba = "espera" | "atendimento";

type EsperaView = {
  id: string;
  contato: string;
  empresa: string;
  resumo: string | null;
  espera: string;
  assumivel: boolean;
};

type ConversaView = {
  id: string;
  titulo: string;
  detalhe: string;
  previa: string | null;
  aguardando: boolean;
};

type ListaDeAtendimentoProps = {
  aba: Aba;
  onEscolherAba: (aba: Aba) => void;
  espera: EsperaView[];
  emAtendimento: ConversaView[];
  abertoId: string | null;
  onAbrir: (id: string) => void;
  onAssumir: (id: string) => void;
  assumindo: boolean;
  aviso?: string;
  carregando?: boolean;
  indisponivel?: boolean;
  // Só o Admin escolhe o Setor; para os demais a espera é a do próprio Setor.
  escolhaDeSetor?: {
    setor: string;
    opcoes: { valor: string; rotulo: string }[];
    onChange: (setor: string) => void;
  };
};

// A coluna da lista: o Setor (Admin), as duas abas e os cards da aba ativa.
export function ListaDeAtendimento({
  aba,
  onEscolherAba,
  espera,
  emAtendimento,
  abertoId,
  onAbrir,
  onAssumir,
  assumindo,
  aviso,
  carregando = false,
  indisponivel = false,
  escolhaDeSetor,
}: ListaDeAtendimentoProps) {
  return (
    <Pilha espaco={3} como="section" aria-label="Atendimentos">
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
          { valor: "espera", rotulo: "Em espera", contador: espera.length },
          { valor: "atendimento", rotulo: "Em atendimento", contador: emAtendimento.length },
        ]}
        ativa={aba}
        onEscolher={(valor) => onEscolherAba(valor as Aba)}
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
        {aba === "espera" ? (
          carregando ? (
            <Texto variante="apoio" role="status">
              Carregando…
            </Texto>
          ) : espera.length === 0 ? (
            <Texto variante="apoio">Nenhum cliente em espera.</Texto>
          ) : (
            <Pilha espaco={2} como="ol" aria-label="Clientes em espera">
              {espera.map(({ id, ...card }) => (
                <Caixa como="li" key={id}>
                  <CardDeEspera {...card} assumindo={assumindo} onAssumir={() => onAssumir(id)} />
                </Caixa>
              ))}
            </Pilha>
          )
        ) : emAtendimento.length === 0 ? (
          <Texto variante="apoio">Você não tem atendimentos em andamento.</Texto>
        ) : (
          <Pilha espaco={2} como="ol" aria-label="Meus atendimentos">
            {emAtendimento.map(({ id, ...card }) => (
              <Caixa como="li" key={id}>
                <CardDeConversa {...card} aberto={id === abertoId} onAbrir={() => onAbrir(id)} />
              </Caixa>
            ))}
          </Pilha>
        )}
      </Caixa>
    </Pilha>
  );
}
