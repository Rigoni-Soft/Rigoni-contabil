import { useState } from "react";
import { useRouter } from "next/navigation";

type Resultado = { ok: true } | { ok: false; error: { message: string } };

// Esqueleto comum das ações de usuário: pendente, erro, refresh em caso de sucesso.
export function useAcaoComPendente(mensagemFalha: string) {
  const router = useRouter();
  const [pendente, setPendente] = useState(false);
  const [erro, setErro] = useState<string | undefined>();

  const executar = async (acao: () => Promise<Resultado>) => {
    setPendente(true);
    setErro(undefined);
    try {
      const resultado = await acao();
      if (!resultado.ok) {
        setErro(resultado.error.message);
        return;
      }
      router.refresh();
    } catch {
      setErro(mensagemFalha);
    } finally {
      setPendente(false);
    }
  };

  return { pendente, erro, executar };
}
