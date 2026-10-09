import { Label } from "@/presentation/components/ui/label";
import { Select } from "@/presentation/components/ui/select";
import { cn } from "@/presentation/lib/utils";

type CampoSelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  id: string;
  rotulo: string;
};

// Rótulo + seletor compactos, para painéis laterais.
export function CampoSelect({ id, rotulo, className, children, ...props }: CampoSelectProps) {
  return (
    <div className="min-w-0 flex-1 space-y-1">
      <Label htmlFor={id} className="text-xs">
        {rotulo}
      </Label>
      <Select id={id} className={cn("h-10 pointer-coarse:h-11", className)} {...props}>
        {children}
      </Select>
    </div>
  );
}
