import { useState } from "react";
import { AppLayout } from "@/components/Layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileText, Download, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const MovimentacaoVidas = () => {
  const { toast } = useToast();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [tipo, setTipo] = useState<string>("");
  const [categoria, setCategoria] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [observacoes, setObservacoes] = useState("");
  const [motivoRejeicao, setMotivoRejeicao] = useState("");

  // Mock data for demonstration
  const movimentacoesPendentes = [
    {
      id: "1",
      tipo: "inclusao",
      categoria: "saude",
      arquivo_nome: "inclusoes_maio_2024.xlsx",
      total_registros: 45,
      data_upload: "2024-05-15T10:30:00",
      criado_por: "João Silva",
      observacoes: "Inclusões do mês de maio",
    },
    {
      id: "2",
      tipo: "exclusao",
      categoria: "odonto",
      arquivo_nome: "exclusoes_desligamentos.xlsx",
      total_registros: 12,
      data_upload: "2024-05-14T14:20:00",
      criado_por: "Maria Santos",
      observacoes: "Desligamentos aprovados pela diretoria",
    },
  ];

  const historicoMovimentacoes = [
    {
      id: "3",
      tipo: "alteracao_cadastral",
      categoria: "vida",
      arquivo_nome: "alteracoes_cadastrais_abril.xlsx",
      total_registros: 28,
      registros_processados: 28,
      status: "processada",
      data_upload: "2024-04-20T09:15:00",
      data_processamento: "2024-04-21T16:30:00",
      aprovado_por: "Admin Sistema",
    },
    {
      id: "4",
      tipo: "mudanca_plano",
      categoria: "saude",
      arquivo_nome: "upgrades_plano.xlsx",
      total_registros: 15,
      registros_processados: 0,
      status: "rejeitada",
      data_upload: "2024-04-18T11:00:00",
      motivo_rejeicao: "Dados inconsistentes na planilha",
    },
  ];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/csv",
      ];
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Arquivo inválido",
          description: "Por favor, selecione um arquivo Excel (.xlsx, .xls) ou CSV",
          variant: "destructive",
        });
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !tipo || !categoria) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione o tipo, categoria e arquivo para fazer o upload",
        variant: "destructive",
      });
      return;
    }

    setUploading(true);

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Get user's empresa_id
      const { data: profile } = await supabase
        .from("profiles")
        .select("empresa_id")
        .eq("id", user.id)
        .single();

      if (!profile?.empresa_id) throw new Error("Empresa não encontrada");

      // Upload file to storage
      const fileExt = selectedFile.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError, data: uploadData } = await supabase.storage
        .from("movimentacoes")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      // Armazenar apenas o caminho do arquivo (não URL pública)
      // Create movement record
      const { error: insertError } = await supabase
        .from("movimentacoes_vidas")
        .insert({
          tipo: tipo as "inclusao" | "exclusao" | "alteracao_cadastral" | "mudanca_plano",
          categoria: categoria as "saude" | "vida" | "odonto",
          arquivo_url: fileName, // Armazena apenas o path, não a URL pública
          arquivo_nome: selectedFile.name,
          empresa_id: profile.empresa_id,
          criado_por: user.id,
          observacoes,
          total_registros: 0, // Will be updated after file processing
        });

      if (insertError) throw insertError;

      toast({
        title: "Upload realizado com sucesso!",
        description: "A movimentação foi enviada para aprovação",
      });

      // Reset form
      setSelectedFile(null);
      setTipo("");
      setCategoria("");
      setObservacoes("");
      
      // Reset file input
      const fileInput = document.getElementById("file-upload") as HTMLInputElement;
      if (fileInput) fileInput.value = "";

    } catch (error: any) {
      toast({
        title: "Erro ao fazer upload",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleAprovar = async (id: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("movimentacoes_vidas")
        .update({
          status: "aprovada",
          aprovado_por: user.id,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Movimentação aprovada",
        description: "A movimentação foi aprovada e será processada",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao aprovar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleRejeitar = async (id: string, motivo: string) => {
    if (!motivo.trim()) {
      toast({
        title: "Motivo obrigatório",
        description: "Por favor, informe o motivo da rejeição",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from("movimentacoes_vidas")
        .update({
          status: "rejeitada",
          motivo_rejeicao: motivo,
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Movimentação rejeitada",
        description: "A movimentação foi rejeitada",
      });
      
      setMotivoRejeicao("");
    } catch (error: any) {
      toast({
        title: "Erro ao rejeitar",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const getTipoLabel = (tipo: string) => {
    const labels: Record<string, string> = {
      inclusao: "Inclusão",
      exclusao: "Exclusão",
      alteracao_cadastral: "Alteração Cadastral",
      mudanca_plano: "Mudança de Plano",
    };
    return labels[tipo] || tipo;
  };

  const getCategoriaLabel = (categoria: string) => {
    const labels: Record<string, string> = {
      saude: "Saúde",
      vida: "Vida",
      odonto: "Odonto",
    };
    return labels[categoria] || categoria;
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", icon: any }> = {
      pendente: { variant: "secondary", icon: Clock },
      aprovada: { variant: "default", icon: CheckCircle },
      rejeitada: { variant: "destructive", icon: XCircle },
      processada: { variant: "outline", icon: CheckCircle },
    };
    
    const config = variants[status] || { variant: "outline", icon: AlertCircle };
    const Icon = config.icon;
    
    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Movimentação de Vidas</h1>
          <p className="text-muted-foreground">
            Gerencie inclusões, exclusões e alterações de beneficiários
          </p>
        </div>

        <Tabs defaultValue="upload" className="space-y-6">
          <TabsList>
            <TabsTrigger value="upload">
              <Upload className="h-4 w-4 mr-2" />
              Nova Movimentação
            </TabsTrigger>
            <TabsTrigger value="pendentes">
              <Clock className="h-4 w-4 mr-2" />
              Pendentes de Aprovação
            </TabsTrigger>
            <TabsTrigger value="historico">
              <FileText className="h-4 w-4 mr-2" />
              Histórico
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Upload de Arquivo</CardTitle>
                <CardDescription>
                  Faça o upload de um arquivo Excel ou CSV com os dados da movimentação
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tipo">Tipo de Movimentação</Label>
                    <Select value={tipo} onValueChange={setTipo}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inclusao">Inclusão</SelectItem>
                        <SelectItem value="exclusao">Exclusão</SelectItem>
                        <SelectItem value="alteracao_cadastral">Alteração Cadastral</SelectItem>
                        <SelectItem value="mudanca_plano">Mudança de Plano</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="categoria">Categoria</Label>
                    <Select value={categoria} onValueChange={setCategoria}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a categoria" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="saude">Saúde</SelectItem>
                        <SelectItem value="vida">Vida</SelectItem>
                        <SelectItem value="odonto">Odonto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    placeholder="Adicione observações sobre esta movimentação..."
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="file-upload">Arquivo</Label>
                  <div className="flex items-center gap-4">
                    <Input
                      id="file-upload"
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={handleFileSelect}
                      className="flex-1"
                    />
                    {selectedFile && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        {selectedFile.name}
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Formatos aceitos: .xlsx, .xls, .csv
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleUpload} disabled={uploading || !selectedFile}>
                    {uploading ? "Enviando..." : "Enviar para Aprovação"}
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="/templates/modelo_movimentacao.xlsx" download>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar Modelo
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pendentes" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Movimentações Pendentes de Aprovação</CardTitle>
                <CardDescription>
                  Revise e aprove as movimentações enviadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead>Enviado por</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {movimentacoesPendentes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>{getTipoLabel(mov.tipo)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoriaLabel(mov.categoria)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{mov.arquivo_nome}</TableCell>
                        <TableCell>{mov.total_registros}</TableCell>
                        <TableCell>{mov.criado_por}</TableCell>
                        <TableCell>
                          {new Date(mov.data_upload).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleAprovar(mov.id)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Aprovar
                            </Button>
                            
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="destructive">
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Rejeitar
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Rejeitar Movimentação</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Informe o motivo da rejeição
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <Textarea
                                  placeholder="Motivo da rejeição..."
                                  value={motivoRejeicao}
                                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                                  rows={3}
                                />
                                <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setMotivoRejeicao("")}>
                                    Cancelar
                                  </AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleRejeitar(mov.id, motivoRejeicao)}
                                  >
                                    Confirmar Rejeição
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="historico" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Movimentações</CardTitle>
                <CardDescription>
                  Visualize todas as movimentações processadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Registros</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data Upload</TableHead>
                      <TableHead>Data Processamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicoMovimentacoes.map((mov) => (
                      <TableRow key={mov.id}>
                        <TableCell>{getTipoLabel(mov.tipo)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{getCategoriaLabel(mov.categoria)}</Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{mov.arquivo_nome}</TableCell>
                        <TableCell>
                          {mov.registros_processados}/{mov.total_registros}
                        </TableCell>
                        <TableCell>{getStatusBadge(mov.status)}</TableCell>
                        <TableCell>
                          {new Date(mov.data_upload).toLocaleDateString("pt-BR")}
                        </TableCell>
                        <TableCell>
                          {mov.data_processamento
                            ? new Date(mov.data_processamento).toLocaleDateString("pt-BR")
                            : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default MovimentacaoVidas;
