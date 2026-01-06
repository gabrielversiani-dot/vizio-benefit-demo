import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/contexts/EmpresaContext";
import { useAuth } from "@/hooks/useAuth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const formSchema = z.object({
  beneficiario_nome: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  beneficiario_cpf: z.string().optional(),
  empresa_id: z.string().uuid("Selecione uma empresa"),
  tipo_sinistro: z.string().min(1, "Selecione o tipo de sinistro"),
  data_ocorrencia: z.string().min(1, "Informe a data do evento"),
  valor_estimado: z.string().optional(),
  observacoes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface SinistroFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SinistroFormModal({ open, onOpenChange }: SinistroFormModalProps) {
  const queryClient = useQueryClient();
  const { empresaSelecionada, isAdminVizio } = useEmpresa();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch empresas for admin
  const { data: empresas = [] } = useQuery({
    queryKey: ['empresas-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('empresas')
        .select('id, nome')
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return data || [];
    },
    enabled: isAdminVizio && open,
  });

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      beneficiario_nome: "",
      beneficiario_cpf: "",
      empresa_id: empresaSelecionada || "",
      tipo_sinistro: "",
      data_ocorrencia: "",
      valor_estimado: "",
      observacoes: "",
    },
  });

  // Reset form when modal opens
  const handleOpenChange = (newOpen: boolean) => {
    if (newOpen) {
      form.reset({
        beneficiario_nome: "",
        beneficiario_cpf: "",
        empresa_id: empresaSelecionada || "",
        tipo_sinistro: "",
        data_ocorrencia: "",
        valor_estimado: "",
        observacoes: "",
      });
    }
    onOpenChange(newOpen);
  };

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      if (!user) throw new Error("Usuário não autenticado");

      const valorEstimado = data.valor_estimado 
        ? parseFloat(data.valor_estimado.replace(/[^\d,.-]/g, '').replace(',', '.'))
        : null;

      const sinistroData = {
        empresa_id: data.empresa_id,
        beneficiario_nome: data.beneficiario_nome,
        beneficiario_cpf: data.beneficiario_cpf || null,
        tipo_sinistro: data.tipo_sinistro,
        data_ocorrencia: data.data_ocorrencia,
        valor_estimado: valorEstimado,
        observacoes: data.observacoes || null,
        status: 'em_analise',
        aberto_por_role: isAdminVizio ? 'vizio' : 'empresa',
        criado_por: user.id,
      };

      const { data: newSinistro, error } = await supabase
        .from('sinistros_vida')
        .insert(sinistroData)
        .select()
        .single();

      if (error) throw error;

      // Create timeline entry
      const { data: profile } = await supabase
        .from('profiles')
        .select('nome_completo')
        .eq('id', user.id)
        .single();

      await supabase
        .from('sinistros_vida_timeline')
        .insert({
          sinistro_id: newSinistro.id,
          empresa_id: data.empresa_id,
          tipo_evento: 'created',
          descricao: isAdminVizio 
            ? 'Sinistro aberto pela Vizio' 
            : 'Sinistro aberto pelo cliente',
          status_novo: 'em_analise',
          source: 'sistema',
          criado_por: user.id,
          usuario_nome: profile?.nome_completo || 'Usuário',
        });

      return newSinistro;
    },
    onSuccess: () => {
      toast.success("Sinistro registrado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ['sinistros-vida'] });
      handleOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(`Erro ao registrar sinistro: ${error.message}`);
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync(data);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Registrar Novo Sinistro</DialogTitle>
          <DialogDescription>
            Preencha as informações do sinistro de vida em grupo
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="beneficiario_nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Beneficiário *</FormLabel>
                    <FormControl>
                      <Input placeholder="Nome completo" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="beneficiario_cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input placeholder="000.000.000-00" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isAdminVizio ? (
              <FormField
                control={form.control}
                name="empresa_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Empresa *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a empresa" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {empresas.map((empresa) => (
                          <SelectItem key={empresa.id} value={empresa.id}>
                            {empresa.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <input type="hidden" {...form.register("empresa_id")} />
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="tipo_sinistro"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Evento *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="morte_natural">Morte Natural</SelectItem>
                        <SelectItem value="morte_acidental">Morte Acidental</SelectItem>
                        <SelectItem value="invalidez">Invalidez Permanente</SelectItem>
                        <SelectItem value="doenca_grave">Doença Grave</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="data_ocorrencia"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data do Evento *</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="valor_estimado"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Valor Estimado (R$)</FormLabel>
                  <FormControl>
                    <Input placeholder="0,00" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Detalhes adicionais sobre o sinistro..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Registrar Sinistro
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
