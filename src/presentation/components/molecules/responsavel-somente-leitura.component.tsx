import { Pilha } from "@/presentation/components/atoms/caixa.component";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";

// O Responsável pelo Cliente, só leitura (quem não o atribui vê o nome), no mesmo desenho do campo do SN.
export function ResponsavelSomenteLeitura({ nome }: { nome: string }) {
  return (
    <Pilha espaco={1}>
      <Label htmlFor="responsavelId">Responsável</Label>
      <Input id="responsavelId" value={nome} disabled readOnly />
    </Pilha>
  );
}
