import { AvisoDeStatus } from "@/presentation/components/atoms/aviso-de-status.component";
import { Linha, Pilha } from "@/presentation/components/atoms/caixa.component";
import { Opcao } from "@/presentation/components/atoms/opcao.component";
import { TituloDoGrupo } from "@/presentation/components/atoms/titulo-de-grupo.component";
import { CampoSelect } from "@/presentation/components/molecules/campo-select.component";
import { CampoTextarea } from "@/presentation/components/molecules/campo-textarea.component";
import { Button } from "@/presentation/components/ui/button";

type PainelDeTransferenciaProps = {
  setoresDestino: { valor: string; rotulo: string }[];
  onTransferir: (setorDestino: string, resumo: string) => void;
  transferindo: boolean;
  aviso?: { tipo: "erro" | "sucesso"; texto: string };
};

export function PainelDeTransferencia({
  setoresDestino,
  onTransferir,
  transferindo,
  aviso,
}: PainelDeTransferenciaProps) {
  return (
    <Pilha
      espaco={2}
      como="form"
      onSubmit={(evento) => {
        evento.preventDefault();
        const dados = new FormData(evento.currentTarget);
        onTransferir(String(dados.get("setor")), String(dados.get("resumo")));
      }}
    >
      <TituloDoGrupo>Transferir Atendimento</TituloDoGrupo>
      <Linha alinhar="fim" espaco={2}>
        <CampoSelect
          id="transferir-setor"
          rotulo="Setor de destino"
          name="setor"
          required
          defaultValue=""
        >
          <Opcao value="" disabled>
            Escolha o Setor
          </Opcao>
          {setoresDestino.map((setor) => (
            <Opcao key={setor.valor} value={setor.valor}>
              {setor.rotulo}
            </Opcao>
          ))}
        </CampoSelect>
        <Button type="submit" size="sm" className="pointer-coarse:h-11" disabled={transferindo}>
          {transferindo ? "Transferindo…" : "Transferir"}
        </Button>
      </Linha>
      <CampoTextarea
        id="transferir-resumo"
        rotulo="Resumo do assunto"
        name="resumo"
        required
        rows={2}
        maxLength={1000}
        placeholder="O que o próximo atendente precisa saber"
        className="min-h-16 resize-none"
      />
      {aviso && <AvisoDeStatus {...aviso} />}
    </Pilha>
  );
}
