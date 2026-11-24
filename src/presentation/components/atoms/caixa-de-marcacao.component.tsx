import { cn } from "@/presentation/lib/utils";

type CaixaDeMarcacaoProps = Omit<React.ComponentProps<"input">, "type"> & {
  rotulo: string;
  rotuloOculto?: boolean;
  className?: string;
};

export function CaixaDeMarcacao({
  rotulo,
  rotuloOculto,
  className,
  ...props
}: CaixaDeMarcacaoProps) {
  return (
    <label className={cn("flex items-center gap-1.5 text-sm", className)}>
      <input
        type="checkbox"
        className="size-4 focus-visible:ring-2 focus-visible:ring-ring pointer-coarse:size-6"
        {...props}
      />
      {rotuloOculto ? <span className="sr-only">{rotulo}</span> : rotulo}
    </label>
  );
}
