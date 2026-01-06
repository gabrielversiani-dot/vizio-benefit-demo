import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Building2, Link2, Unlink, CheckCircle2, AlertTriangle, Building } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEmpresa } from "@/contexts/EmpresaContext";

interface RDOrganization {
  id: string;
  name: string;
  cnpj?: string | null;
}

interface Empresa {
  id: string;
  nome: string;
}

interface RDIntegration {
  empresa_id: string;
  rd_organization_id: string;
  rd_organization_name: string | null;
  ativo: boolean;
}

interface RDStationConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: Empresa | null;
  onUpdate: () => void;
}

export function RDStationConfigModal({ open, onOpenChange, empresa, onUpdate }: RDStationConfigModalProps) {
  const { empresas, isAdminVizio } = useEmpresa();
  
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [organizations, setOrganizations] = useState<RDOrganization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<RDOrganization | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  
  // Multi-empresa selection
  const [selectedEmpresas, setSelectedEmpresas] = useState<string[]>([]);
  const [currentIntegration, setCurrentIntegration] = useState<RDIntegration | null>(null);
  const [loadingIntegration, setLoadingIntegration] = useState(false);

  // Load current integration when modal opens
  useEffect(() => {
    if (empresa && open) {
      loadCurrentIntegration();
    }
  }, [empresa, open]);

  const loadCurrentIntegration = async () => {
    if (!empresa) return;
    
    setLoadingIntegration(true);
    setError(null);
    setNeedsToken(false);
    setOrganizations([]);
    setSearchQuery("");
    setSelectedEmpresas([empresa.id]); // Always include current empresa

    try {
      const { data, error } = await supabase
        .from("rd_empresa_integrations")
        .select("*")
        .eq("empresa_id", empresa.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        throw error;
      }

      if (data) {
        setCurrentIntegration(data);
        setEnabled(data.ativo);
        setSelectedOrg({
          id: data.rd_organization_id,
          name: data.rd_organization_name || 'Organização vinculada',
        });
      } else {
        setCurrentIntegration(null);
        setEnabled(false);
        setSelectedOrg(null);
      }
    } catch (err) {
      console.error('Error loading integration:', err);
    } finally {
      setLoadingIntegration(false);
    }
  };

  const searchOrganizations = async () => {
    if (!searchQuery.trim()) {
      setOrganizations([]);
      return;
    }

    setSearching(true);
    setError(null);
    setNeedsToken(false);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke('rdstation-list-organizations', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: {
          q: searchQuery.trim(),
          page: 1,
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        if (data.needsToken) {
          setNeedsToken(true);
          throw new Error('Token do RD Station não configurado');
        }
        throw new Error(data.error || 'Erro ao buscar organizações');
      }
      
      setOrganizations(data.organizations || []);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar organizações no RD Station';
      console.error('Search error:', err);
      setError(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleSave = async () => {
    if (!empresa || !selectedOrg) return;
    
    setSaving(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const { data: userData } = await supabase.auth.getUser();
      
      // For each selected empresa, upsert the integration
      const empresasToLink = [...new Set([empresa.id, ...selectedEmpresas])]; // Ensure current empresa is always included
      
      for (const empresaId of empresasToLink) {
        const { error: upsertError } = await supabase
          .from("rd_empresa_integrations")
          .upsert({
            empresa_id: empresaId,
            rd_organization_id: selectedOrg.id,
            rd_organization_name: selectedOrg.name,
            ativo: enabled,
            created_by: userData.user?.id,
          }, {
            onConflict: 'empresa_id',
          });

        if (upsertError) {
          throw new Error(`Erro ao vincular empresa ${empresaId}: ${upsertError.message}`);
        }
      }

      // Also update the legacy fields in empresas table for backward compatibility
      await supabase
        .from("empresas")
        .update({
          rd_station_organization_id: selectedOrg.id,
          rd_station_org_name_snapshot: selectedOrg.name,
          rd_station_enabled: enabled,
        })
        .in("id", empresasToLink);

      const empresasNames = empresasToLink.map(id => {
        const emp = empresas.find(e => e.id === id);
        return emp?.nome || id;
      });
      
      toast.success(`RD Station vinculado em: ${empresasNames.join(', ')}`);
      onUpdate();
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar configuração';
      console.error('Save error:', err);
      setError(errorMessage);
      toast.error('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const handleUnlink = async () => {
    if (!empresa) return;
    
    setSaving(true);
    setError(null);

    try {
      // Delete only the current empresa's integration
      const { error: deleteError } = await supabase
        .from("rd_empresa_integrations")
        .delete()
        .eq("empresa_id", empresa.id);

      if (deleteError) throw deleteError;

      // Clear legacy fields
      await supabase
        .from("empresas")
        .update({
          rd_station_organization_id: null,
          rd_station_org_name_snapshot: null,
          rd_station_enabled: false,
        })
        .eq("id", empresa.id);

      setSelectedOrg(null);
      setCurrentIntegration(null);
      setEnabled(false);
      
      toast.success(`${empresa.nome} desvinculada do RD Station`);
      onUpdate();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao desvincular';
      console.error('Unlink error:', err);
      setError(errorMessage);
      toast.error('Erro ao desvincular');
    } finally {
      setSaving(false);
    }
  };

  const handleEmpresaToggle = (empresaId: string, checked: boolean) => {
    if (empresaId === empresa?.id) return; // Cannot uncheck current empresa
    
    setSelectedEmpresas(prev => {
      if (checked) {
        return [...prev, empresaId];
      } else {
        return prev.filter(id => id !== empresaId);
      }
    });
  };

  // Filter empresas that admin can manage
  const availableEmpresas = isAdminVizio 
    ? empresas.filter(e => e.id !== empresa?.id)
    : [];

  const linkedEmpresasNames = [...new Set([empresa?.id, ...selectedEmpresas])]
    .filter(Boolean)
    .map(id => {
      const emp = empresas.find(e => e.id === id);
      return emp?.nome;
    })
    .filter(Boolean);

  if (loadingIntegration) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurar RD Station CRM
          </DialogTitle>
          <DialogDescription>
            Vincule a empresa <strong>{empresa?.nome}</strong> a uma organização do RD Station para sincronizar tarefas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Token warning */}
          {needsToken && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Token não configurado</p>
                <p className="text-sm text-amber-700">
                  O secret <code className="bg-amber-100 px-1 rounded">RD_STATION_API_TOKEN</code> precisa ser configurado nas configurações do projeto.
                </p>
              </div>
            </div>
          )}

          {/* Enable/Disable toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Integração ativa</Label>
              <p className="text-sm text-muted-foreground">
                Habilita a sincronização de tarefas do RD Station
              </p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>

          {/* Currently linked organization */}
          {selectedOrg && (
            <div className="rounded-lg border bg-muted/50 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">{selectedOrg.name}</p>
                    <p className="text-sm text-muted-foreground">Organização vinculada</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={handleUnlink} disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4 mr-1" />}
                  Desvincular
                </Button>
              </div>
            </div>
          )}

          {/* Search organizations */}
          {!selectedOrg && enabled && (
            <div className="space-y-3">
              <Label>Buscar organização no RD Station</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Digite o nome da empresa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && searchOrganizations()}
                />
                <Button onClick={searchOrganizations} disabled={searching || !searchQuery.trim()}>
                  {searching ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Results */}
              {organizations.length > 0 && (
                <ScrollArea className="h-48 rounded-md border">
                  <div className="p-2 space-y-1">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        onClick={() => setSelectedOrg(org)}
                        className="w-full text-left px-3 py-2 rounded-md hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{org.name}</p>
                            {org.cnpj && (
                              <p className="text-xs text-muted-foreground">{org.cnpj}</p>
                            )}
                          </div>
                          <Link2 className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {!searching && organizations.length === 0 && searchQuery && !error && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhuma organização encontrada. Clique em buscar para pesquisar.
                </p>
              )}
            </div>
          )}

          {/* Multi-empresa selection (only for admin_vizio with selected org) */}
          {selectedOrg && isAdminVizio && availableEmpresas.length > 0 && (
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Vincular também em outras empresas (opcional)
              </Label>
              <ScrollArea className="h-32 rounded-md border">
                <div className="p-3 space-y-2">
                  {availableEmpresas.map((emp) => (
                    <div key={emp.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`empresa-${emp.id}`}
                        checked={selectedEmpresas.includes(emp.id)}
                        onCheckedChange={(checked) => handleEmpresaToggle(emp.id, checked as boolean)}
                      />
                      <label
                        htmlFor={`empresa-${emp.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {emp.nome}
                      </label>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Summary before save */}
          {selectedOrg && linkedEmpresasNames.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-800">
                <strong>Resumo:</strong> Você está vinculando a organização <strong>{selectedOrg.name}</strong> em: {linkedEmpresasNames.join(', ')}
              </p>
            </div>
          )}

          {/* Error message */}
          {error && !needsToken && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !selectedOrg}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
