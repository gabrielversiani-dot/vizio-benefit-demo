import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Search, Building2, Link2, Unlink, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RDOrganization {
  id: string;
  name: string;
  cnpj?: string | null;
}

interface Empresa {
  id: string;
  nome: string;
  rd_station_enabled?: boolean | null;
  rd_station_organization_id?: string | null;
  rd_station_org_name_snapshot?: string | null;
}

interface RDStationConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresa: Empresa | null;
  onUpdate: () => void;
}

export function RDStationConfigModal({ open, onOpenChange, empresa, onUpdate }: RDStationConfigModalProps) {
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [organizations, setOrganizations] = useState<RDOrganization[]>([]);
  const [selectedOrg, setSelectedOrg] = useState<RDOrganization | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);

  useEffect(() => {
    if (empresa && open) {
      setEnabled(empresa.rd_station_enabled || false);
      if (empresa.rd_station_organization_id) {
        setSelectedOrg({
          id: empresa.rd_station_organization_id,
          name: empresa.rd_station_org_name_snapshot || 'Organização vinculada',
        });
      } else {
        setSelectedOrg(null);
      }
      setError(null);
      setNeedsToken(false);
      setOrganizations([]);
      setSearchQuery("");
    }
  }, [empresa, open]);

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
    if (!empresa) return;
    
    setSaving(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      const { data, error: fnError } = await supabase.functions.invoke('rdstation-link-empresa', {
        headers: {
          Authorization: `Bearer ${session.session?.access_token}`,
        },
        body: {
          empresaId: empresa.id,
          rdOrganizationId: selectedOrg?.id || null,
          rdOrganizationName: selectedOrg?.name || null,
          enabled,
        },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        throw new Error(data.error || 'Erro ao salvar configuração');
      }

      toast.success('Configuração do RD Station salva com sucesso!');
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

  const handleUnlink = () => {
    setSelectedOrg(null);
  };

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
                <Button variant="outline" size="sm" onClick={handleUnlink}>
                  <Unlink className="h-4 w-4 mr-1" />
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

          {/* Error message */}
          {error && !needsToken && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
