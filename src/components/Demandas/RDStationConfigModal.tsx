import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Building2, Link2, X, CheckCircle2, AlertTriangle, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface RDOrganization {
  id: string;
  name: string;
  cnpj?: string | null;
}

interface LinkedOrg {
  id: string;
  rd_organization_id: string;
  rd_organization_name: string | null;
  active: boolean;
}

interface Empresa {
  id: string;
  nome: string;
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
  const [searchResults, setSearchResults] = useState<RDOrganization[]>([]);
  const [selectedToAdd, setSelectedToAdd] = useState<RDOrganization[]>([]);
  const [linkedOrgs, setLinkedOrgs] = useState<LinkedOrg[]>([]);
  const [orgsToRemove, setOrgsToRemove] = useState<string[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsToken, setNeedsToken] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Load linked organizations when modal opens
  useEffect(() => {
    if (empresa && open) {
      loadLinkedOrganizations();
    }
  }, [empresa, open]);

  const loadLinkedOrganizations = async () => {
    if (!empresa) return;
    
    setLoadingOrgs(true);
    setError(null);
    setNeedsToken(false);
    setSearchResults([]);
    setSearchQuery("");
    setSelectedToAdd([]);
    setOrgsToRemove([]);

    try {
      const { data, error } = await supabase
        .from("empresa_rd_organizacoes")
        .select("*")
        .eq("empresa_id", empresa.id)
        .eq("active", true)
        .order("created_at", { ascending: true });

      if (error) throw error;

      setLinkedOrgs(data || []);
      setEnabled((data || []).length > 0);
    } catch (err) {
      console.error('Error loading linked orgs:', err);
      setError('Erro ao carregar organizações vinculadas');
    } finally {
      setLoadingOrgs(false);
    }
  };

  const searchOrganizations = async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
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
      
      // Filter out already linked orgs
      const alreadyLinkedIds = linkedOrgs.map(o => o.rd_organization_id);
      const selectedIds = selectedToAdd.map(o => o.id);
      const filtered = (data.organizations || []).filter(
        (org: RDOrganization) => !alreadyLinkedIds.includes(org.id) && !selectedIds.includes(org.id)
      );
      
      setSearchResults(filtered);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar organizações no RD Station';
      console.error('Search error:', err);
      setError(errorMessage);
    } finally {
      setSearching(false);
    }
  };

  const handleAddOrg = (org: RDOrganization) => {
    setSelectedToAdd(prev => [...prev, org]);
    setSearchResults(prev => prev.filter(o => o.id !== org.id));
  };

  const handleRemoveFromAdd = (orgId: string) => {
    setSelectedToAdd(prev => prev.filter(o => o.id !== orgId));
  };

  const handleMarkForRemoval = (orgId: string) => {
    setOrgsToRemove(prev => [...prev, orgId]);
  };

  const handleUndoRemoval = (orgId: string) => {
    setOrgsToRemove(prev => prev.filter(id => id !== orgId));
  };

  const handleSave = async () => {
    if (!empresa) return;
    
    setSaving(true);
    setError(null);

    try {
      const { data: userData } = await supabase.auth.getUser();

      // Remove orgs marked for removal
      if (orgsToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("empresa_rd_organizacoes")
          .delete()
          .eq("empresa_id", empresa.id)
          .in("rd_organization_id", orgsToRemove);

        if (deleteError) throw deleteError;
      }

      // Add new orgs
      if (selectedToAdd.length > 0) {
        const newOrgs = selectedToAdd.map(org => ({
          empresa_id: empresa.id,
          rd_organization_id: org.id,
          rd_organization_name: org.name,
          active: true,
          created_by: userData.user?.id,
        }));

        const { error: insertError } = await supabase
          .from("empresa_rd_organizacoes")
          .insert(newOrgs);

        if (insertError) {
          if (insertError.code === '23505') {
            throw new Error('Uma ou mais organizações já estão vinculadas');
          }
          throw insertError;
        }
      }

      // Update legacy fields for backward compatibility (use first active org)
      const finalOrgs = [
        ...linkedOrgs.filter(o => !orgsToRemove.includes(o.rd_organization_id)),
        ...selectedToAdd.map(o => ({ rd_organization_id: o.id, rd_organization_name: o.name }))
      ];

      if (finalOrgs.length > 0) {
        await supabase
          .from("empresas")
          .update({
            rd_station_organization_id: finalOrgs[0].rd_organization_id,
            rd_station_org_name_snapshot: finalOrgs[0].rd_organization_name,
            rd_station_enabled: true,
          })
          .eq("id", empresa.id);
      } else {
        await supabase
          .from("empresas")
          .update({
            rd_station_organization_id: null,
            rd_station_org_name_snapshot: null,
            rd_station_enabled: false,
          })
          .eq("id", empresa.id);
      }

      const addedCount = selectedToAdd.length;
      const removedCount = orgsToRemove.length;
      
      if (addedCount > 0 && removedCount > 0) {
        toast.success(`${addedCount} organização(ões) adicionada(s), ${removedCount} removida(s)`);
      } else if (addedCount > 0) {
        toast.success(`${addedCount} organização(ões) vinculada(s)`);
      } else if (removedCount > 0) {
        toast.success(`${removedCount} organização(ões) desvinculada(s)`);
      } else {
        toast.success('Configuração salva');
      }
      
      onUpdate();
      onOpenChange(false);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao salvar configuração';
      console.error('Save error:', err);
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  // Calculate final state for summary
  const finalLinkedOrgs = [
    ...linkedOrgs.filter(o => !orgsToRemove.includes(o.rd_organization_id)),
    ...selectedToAdd.map(o => ({ rd_organization_id: o.id, rd_organization_name: o.name }))
  ];

  const hasChanges = selectedToAdd.length > 0 || orgsToRemove.length > 0;

  if (loadingOrgs) {
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Configurar RD Station CRM
          </DialogTitle>
          <DialogDescription>
            Vincule <strong>{empresa?.nome}</strong> a uma ou mais organizações do RD Station para sincronizar tarefas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Token warning */}
          {needsToken && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-medium text-amber-800">Token não configurado</p>
                <p className="text-sm text-amber-700">
                  O secret <code className="bg-amber-100 px-1 rounded">RD_STATION_API_TOKEN</code> precisa ser configurado.
                </p>
              </div>
            </div>
          )}

          {/* Currently linked organizations */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Organizações vinculadas ({linkedOrgs.length - orgsToRemove.length})
            </Label>
            
            {linkedOrgs.length === 0 && selectedToAdd.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-center text-muted-foreground">
                <p className="text-sm">Nenhuma organização vinculada.</p>
                <p className="text-xs mt-1">Busque e adicione organizações abaixo.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Existing linked orgs */}
                {linkedOrgs.map((org) => {
                  const isMarkedForRemoval = orgsToRemove.includes(org.rd_organization_id);
                  return (
                    <div 
                      key={org.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        isMarkedForRemoval ? 'bg-red-50 border-red-200 opacity-60' : 'bg-muted/50'
                      }`}
                    >
                      <div>
                        <p className={`font-medium ${isMarkedForRemoval ? 'line-through text-muted-foreground' : ''}`}>
                          {org.rd_organization_name || org.rd_organization_id}
                        </p>
                        <p className="text-xs text-muted-foreground">{org.rd_organization_id}</p>
                      </div>
                      {isMarkedForRemoval ? (
                        <Button variant="ghost" size="sm" onClick={() => handleUndoRemoval(org.rd_organization_id)}>
                          Desfazer
                        </Button>
                      ) : (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="text-destructive hover:text-destructive"
                          onClick={() => handleMarkForRemoval(org.rd_organization_id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  );
                })}

                {/* Newly added orgs (pending save) */}
                {selectedToAdd.map((org) => (
                  <div 
                    key={org.id} 
                    className="flex items-center justify-between p-3 rounded-lg border bg-green-50 border-green-200"
                  >
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-700 text-xs">Novo</Badge>
                      <div>
                        <p className="font-medium">{org.name}</p>
                        <p className="text-xs text-muted-foreground">{org.id}</p>
                      </div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleRemoveFromAdd(org.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search and add organizations */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Adicionar organizações do RD
            </Label>
            <div className="flex gap-2">
              <Input
                placeholder="Buscar por nome..."
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

            {/* Search Results */}
            {searchResults.length > 0 && (
              <ScrollArea className="h-40 rounded-md border">
                <div className="p-2 space-y-1">
                  {searchResults.map((org) => (
                    <button
                      key={org.id}
                      onClick={() => handleAddOrg(org)}
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

            {!searching && searchResults.length === 0 && searchQuery && !error && (
              <p className="text-sm text-muted-foreground text-center py-2">
                Nenhuma organização encontrada.
              </p>
            )}
          </div>

          {/* Summary */}
          {finalLinkedOrgs.length > 0 && (
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-3">
              <p className="text-sm text-blue-800">
                <strong>Resumo:</strong> Esta empresa puxará tarefas do RD das organizações:{' '}
                {finalLinkedOrgs.map(o => o.rd_organization_name || o.rd_organization_id).join(', ')}
              </p>
            </div>
          )}

          {/* Warning if enabled but no orgs */}
          {enabled && finalLinkedOrgs.length === 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5" />
              <p className="text-sm text-amber-800">
                Nenhuma organização vinculada. A sincronização não trará tarefas.
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

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
