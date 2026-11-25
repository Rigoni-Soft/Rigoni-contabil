import { Caixa } from "@/presentation/components/atoms/caixa.component";
import { Label } from "@/presentation/components/ui/label";
import { Textarea } from "@/presentation/components/ui/textarea";
import { cn } from "@/presentation/lib/utils";

type CampoTextareaProps = React.ComponentProps<"textarea"> & {
  id: string;
  rotulo: string;
  rotuloOculto?: boolean;
  containerClassName?: string;
};

export function CampoTextarea({
  id,
  rotulo,
  rotuloOculto = false,
  containerClassName,
  className,
  ...props
}: CampoTextareaProps) {
  return (
    <Caixa className={cn("min-w-0 flex-1", !rotuloOculto && "space-y-1", containerClassName)}>
      <Label htmlFor={id} className={cn("text-xs", rotuloOculto && "sr-only")}>
        {rotulo}
      </Label>
      <Textarea id={id} className={className} {...props} />
    </Caixa>
  );
}
