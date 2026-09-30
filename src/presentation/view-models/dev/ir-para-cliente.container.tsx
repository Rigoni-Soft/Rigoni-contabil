"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/presentation/components/ui/button";
import { Input } from "@/presentation/components/ui/input";
import { Label } from "@/presentation/components/ui/label";

export function IrParaClienteContainer() {
  const router = useRouter();
  const [id, setId] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (id.trim()) router.push(`/clientes/${id.trim()}`);
      }}
    >
      <div className="space-y-1">
        <Label htmlFor="clienteId">Id do cliente</Label>
        <Input id="clienteId" value={id} onChange={(e) => setId(e.target.value)} />
      </div>
      <Button type="submit">Ir</Button>
    </form>
  );
}
