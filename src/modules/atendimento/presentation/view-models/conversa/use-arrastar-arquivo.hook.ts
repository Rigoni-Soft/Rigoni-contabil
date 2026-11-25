import { useRef, useState } from "react";

const temArquivo = (evento: React.DragEvent) => evento.dataTransfer.types.includes("Files");

export function useArrastarArquivo(aoSoltar: ((arquivo: File) => void) | undefined) {
  const [arrastando, setArrastando] = useState(false);
  const entradas = useRef(0);

  if (!aoSoltar) return { arrastando: false, ligacoes: undefined };

  const encerrar = () => {
    entradas.current = 0;
    setArrastando(false);
  };

  return {
    arrastando,
    ligacoes: {
      onDragEnter: (evento: React.DragEvent) => {
        if (!temArquivo(evento)) return;
        entradas.current += 1;
        setArrastando(true);
      },
      onDragOver: (evento: React.DragEvent) => {
        if (temArquivo(evento)) evento.preventDefault();
      },
      onDragLeave: (evento: React.DragEvent) => {
        if (!temArquivo(evento)) return;
        entradas.current = Math.max(0, entradas.current - 1);
        if (entradas.current === 0) setArrastando(false);
      },
      onDrop: (evento: React.DragEvent) => {
        if (!temArquivo(evento)) return;
        evento.preventDefault();
        encerrar();
        const arquivo = evento.dataTransfer.files[0];
        if (arquivo) aoSoltar(arquivo);
      },
    },
  };
}
