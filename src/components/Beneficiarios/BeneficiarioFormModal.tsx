import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useQueryClient, useQuery } from "@tanstack/react-query";

const cpfRegex = /^\d{11}$|^\d{3}\.\d{3}\.\d{3}-\d{2}$/;

const beneficiarioSchema = z.object({
  nome_completo: z.string().min(3, "Nome deve ter no mínimo 3 caracteres").max(200),
  cpf: z.string().refine((val) => cpfRegex.test(val.replace(/\D/g, "")), "CPF inválido"),
  data_nascimento: z.string().min(1, "Data de nascimento é obrigatória"),
  sexo: z.enum(["M", "F", ""]).optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  telefone: z.string().max(20).optional(),
  cep: z.string().max(10).optional(),
  endereco: z.string().max(200).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(100).optional(),
  bairro: z.string().max(100).optional(),
  cidade: z.string().max(100).optional(),
  uf: z.string().max(2).optional(),
  matricula: z.string().max(50).optional(),
  cargo: z.string().max(100).optional(),
  departamento: z.string().max(100).optional(),
  tipo: z.enum(["titular", "dependente"]),
  titular_id: z.string().optional().nullable(),
  grau_parentesco: z.enum(["conjuge", "filho", "mae", "pai", "outro", ""]).optional().nullable(),
  plano_saude: z.boolean().default(false),
  plano_vida: z.boolean().default(false),
  plano_odonto: z.boolean().default(false),
  status: z.enum(["ativo", "inativo", "suspenso"]).default("ativo"),
  data_inclusao: z.string().optional(),
});

type BeneficiarioFormData = z.infer<typeof beneficiarioSchema>;

interface BeneficiarioFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  beneficiario?: {
    id: string;
    nome_completo: string;
    cpf: string;
    data_nascimento: string;
    sexo: string | null;
    email: string | null;
    telefone: string | null;
    cep: string | null;
    endereco: string | null;
    numero: string | null;
    complemento: string | null;
    bairro: string | null;
    cidade: string | null;
    uf: string | null;
    matricula: string | null;
    cargo: string | null;
    departamento: string | null;
    tipo: string;
    titular_id: string | null;
    grau_parentesco: string | null;
    plano_saude: boolean | null;
    plano_vida: boolean | null;
    plano_odonto: boolean | null;
    status: string;
    data_inclusao: string;
  } | null;
}

function normalizeCPF(cpf: string): string {
  return cpf.replace(/\D/g, "");
}

function formatCPF(cpf: string): string {
  const cleaned = cpf.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `${cleaned.slice(0, 3)}.${cleaned.slice(3)}`;
  if (cleaned.length <= 9) return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6)}`;
  return `${cleaned.slice(0, 3)}.${cleaned.slice(3, 6)}.${cleaned.slice(6, 9)}-${cleaned.slice(9, 11)}`;
}

export function BeneficiarioFormModal({ open, onOpenChange, empresaId, beneficiario }: BeneficiarioFormModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isEditing = !!beneficiario;

  const form = useForm<BeneficiarioFormData>({
    resolver: zodResolver(beneficiarioSchema),
    defaultValues: {
      nome_completo: "",
      cpf: "",
      data_nascimento: "",
      sexo: "",
      email: "",
      telefone: "",
      cep: "",
      endereco: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      uf: "",
      matricula: "",
      cargo: "",
      departamento: "",
      tipo: "titular",
      titular_id: null,
      grau_parentesco: "",
      plano_saude: false,
      plano_vida: false,
      plano_odonto: false,
      status: "ativo",
      data_inclusao: new Date().toISOString().split("T")[0],
    },
  });

  const tipoValue = form.watch("tipo");

  // Fetch titulares for dependente selection
  const { data: titulares = [] } = useQuery({
    queryKey: ["titulares", empresaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("beneficiarios")
        .select("id, nome_completo, cpf")
        .eq("empresa_id", empresaId)
        .eq("tipo", "titular")
        .eq("status", "ativo")
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
    enabled: !!empresaId,
  });

  useEffect(() => {
    if (beneficiario) {
      form.reset({
        nome_completo: beneficiario.nome_completo,
        cpf: formatCPF(beneficiario.cpf),
        data_nascimento: beneficiario.data_nascimento,
        sexo: (beneficiario.sexo as "M" | "F" | "") || "",
        email: beneficiario.email || "",
        telefone: beneficiario.telefone || "",
        cep: beneficiario.cep || "",
        endereco: beneficiario.endereco || "",
        numero: beneficiario.numero || "",
        complemento: beneficiario.complemento || "",
        bairro: beneficiario.bairro || "",
        cidade: beneficiario.cidade || "",
        uf: beneficiario.uf || "",
        matricula: beneficiario.matricula || "",
        cargo: beneficiario.cargo || "",
        departamento: beneficiario.departamento || "",
        tipo: beneficiario.tipo as "titular" | "dependente",
        titular_id: beneficiario.titular_id,
        grau_parentesco: (beneficiario.grau_parentesco as "conjuge" | "filho" | "mae" | "pai" | "outro" | "") || "",
        plano_saude: beneficiario.plano_saude || false,
        plano_vida: beneficiario.plano_vida || false,
        plano_odonto: beneficiario.plano_odonto || false,
        status: beneficiario.status as "ativo" | "inativo" | "suspenso",
        data_inclusao: beneficiario.data_inclusao,
      });
    } else {
      form.reset({
        nome_completo: "",
        cpf: "",
        data_nascimento: "",
        sexo: "",
        email: "",
        telefone: "",
        cep: "",
        endereco: "",
        numero: "",
        complemento: "",
        bairro: "",
        cidade: "",
        uf: "",
        matricula: "",
        cargo: "",
        departamento: "",
        tipo: "titular",
        titular_id: null,
        grau_parentesco: "",
        plano_saude: false,
        plano_vida: false,
        plano_odonto: false,
        status: "ativo",
        data_inclusao: new Date().toISOString().split("T")[0],
      });
    }
  }, [beneficiario, form]);

  const onSubmit = async (data: BeneficiarioFormData) => {
    if (!user || !empresaId) return;

    setIsSubmitting(true);

    try {
      const payload = {
        empresa_id: empresaId,
        criado_por: user.id,
        nome_completo: data.nome_completo.trim(),
        cpf: normalizeCPF(data.cpf),
        data_nascimento: data.data_nascimento,
        sexo: data.sexo || null,
        email: data.email?.trim() || null,
        telefone: data.telefone?.trim() || null,
        cep: data.cep?.trim() || null,
        endereco: data.endereco?.trim() || null,
        numero: data.numero?.trim() || null,
        complemento: data.complemento?.trim() || null,
        bairro: data.bairro?.trim() || null,
        cidade: data.cidade?.trim() || null,
        uf: data.uf?.trim()?.toUpperCase() || null,
        matricula: data.matricula?.trim() || null,
        cargo: data.cargo?.trim() || null,
        departamento: data.departamento?.trim() || null,
        tipo: data.tipo,
        titular_id: data.tipo === "dependente" ? data.titular_id : null,
        grau_parentesco: data.tipo === "dependente" && data.grau_parentesco ? data.grau_parentesco : null,
        plano_saude: data.plano_saude,
        plano_vida: data.plano_vida,
        plano_odonto: data.plano_odonto,
        status: data.status,
        data_inclusao: data.data_inclusao || new Date().toISOString().split("T")[0],
      };

      if (isEditing && beneficiario) {
        const { error } = await supabase
          .from("beneficiarios")
          .update(payload)
          .eq("id", beneficiario.id);

        if (error) throw error;
        toast.success("Beneficiário atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("beneficiarios")
          .insert([payload]);

        if (error) {
          if (error.message.includes("duplicate")) {
            toast.error("CPF já cadastrado para esta empresa");
            return;
          }
          throw error;
        }
        toast.success("Beneficiário cadastrado com sucesso!");
      }

      queryClient.invalidateQueries({ queryKey: ["beneficiarios"] });
      onOpenChange(false);
    } catch (error: any) {
      console.error("Erro ao salvar beneficiário:", error);
      toast.error(error.message || "Erro ao salvar beneficiário");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Beneficiário" : "Novo Beneficiário"}</DialogTitle>
          <DialogDescription>
            {isEditing ? "Atualize os dados do beneficiário" : "Preencha os dados para cadastrar um novo beneficiário"}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <Tabs defaultValue="dados" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
                <TabsTrigger value="endereco">Endereço</TabsTrigger>
                <TabsTrigger value="planos">Planos e Status</TabsTrigger>
              </TabsList>

              <TabsContent value="dados" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="nome_completo"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>Nome Completo *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Nome completo do beneficiário" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cpf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CPF *</FormLabel>
                        <FormControl>
                          <Input 
                            {...field} 
                            placeholder="000.000.000-00"
                            onChange={(e) => field.onChange(formatCPF(e.target.value))}
                            maxLength={14}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="data_nascimento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data de Nascimento *</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sexo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sexo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="M">Masculino</SelectItem>
                            <SelectItem value="F">Feminino</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" {...field} placeholder="email@exemplo.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="telefone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Telefone</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="(00) 00000-0000" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tipo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="titular">Titular</SelectItem>
                            <SelectItem value="dependente">Dependente</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {tipoValue === "dependente" && (
                    <>
                      <FormField
                        control={form.control}
                        name="titular_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Titular *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o titular" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {titulares.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.nome_completo} ({t.cpf})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="grau_parentesco"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Grau de Parentesco</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ""}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="conjuge">Cônjuge</SelectItem>
                                <SelectItem value="filho">Filho(a)</SelectItem>
                                <SelectItem value="pai">Pai</SelectItem>
                                <SelectItem value="mae">Mãe</SelectItem>
                                <SelectItem value="outro">Outro</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </>
                  )}

                  <FormField
                    control={form.control}
                    name="matricula"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Matrícula</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Código de matrícula" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cargo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cargo</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cargo do colaborador" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="departamento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Departamento</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Departamento" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="endereco" className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="cep"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>CEP</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="00000-000" maxLength={9} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endereco"
                    render={({ field }) => (
                      <FormItem className="col-span-2 md:col-span-1">
                        <FormLabel>Endereço</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Rua, Avenida..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="numero"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Número</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Número" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="complemento"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Complemento</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Apto, Bloco..." />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bairro"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bairro</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Bairro" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="cidade"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cidade</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Cidade" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="uf"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>UF</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="SP" maxLength={2} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </TabsContent>

              <TabsContent value="planos" className="space-y-4 mt-4">
                <div className="space-y-4">
                  <div>
                    <Label className="text-base font-medium">Planos Contratados</Label>
                    <div className="flex flex-wrap gap-6 mt-2">
                      <FormField
                        control={form.control}
                        name="plano_saude"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">Plano Saúde</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="plano_vida"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">Plano Vida</FormLabel>
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="plano_odonto"
                        render={({ field }) => (
                          <FormItem className="flex items-center space-x-2 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">Plano Odonto</FormLabel>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Status</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ativo">Ativo</SelectItem>
                              <SelectItem value="inativo">Inativo</SelectItem>
                              <SelectItem value="suspenso">Suspenso</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="data_inclusao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Data de Inclusão</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Salvando..." : isEditing ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
