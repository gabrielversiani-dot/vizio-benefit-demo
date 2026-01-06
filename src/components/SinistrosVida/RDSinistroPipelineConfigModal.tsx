import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Settings2, CheckCircle2, AlertTriangle, Wand2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Pipeline {
  id: string;
  name: string;
}

interface Stage {
  id: string;
  name: string;
  pipelineId: string;
  position: number;
}

interface PipelineConfig {
  sinistro_pipeline_id: string;
  sinistro_pipeline_name: string | null;
  sinistro_stage_inicial_id: string;
  sinistro_stage_inicial_name: string | null;
  sinistro_stage_em_andamento_id: string | null;
  sinistro_stage_em_andamento_name: string | null;
  sinistro_stage_concluido_id: string | null;
  sinistro_stage_concluido_name: string | null;
}

interface RDSinistroPipelineConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  empresaId: string;
  empresaNome: string;
  onUpdate: () => void;
}

export function RDSinistroPipelineConfigModal({
  open,
  onOpenChange,
  empresaId,
  empresaNome,
  onUpdate,
}: RDSinistroPipelineConfigModalProps) {
  const [loading, setLoading] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [currentConfig, setCurrentConfig] = useState<PipelineConfig | null>(null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  
  // Manual selection state
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageInicialId, setSelectedStageInicialId] = useState<string>("");
  const [selectedStageEmAndamentoId, setSelectedStageEmAndamentoId] = useState<string>("");
  const [selectedStageConcluidoId, setSelectedStageConcluidoId] = useState<string>("");
  const [showManualConfig, setShowManualConfig] = useState(false);

  useEffect(() => {
    if (open && empresaId) {
      loadCurrentConfig();
    }
  }, [open, empresaId]);

  const loadCurrentConfig = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke('rd-discover-sinistro-pipeline', {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: { action: 'get', empresaId },
      });

      if (fnError) throw fnError;
      
      if (data.config) {
        setCurrentConfig(data.config);
        setSelectedPipelineId(data.config.sinistro_pipeline_id);
        setSelectedStageInicialId(data.config.sinistro_stage_inicial_id);
        setSelectedStageEmAndamentoId(data.config.sinistro_stage_em_andamento_id || "");
        setSelectedStageConcluidoId(data.config.sinistro_stage_concluido_id || "");
      }
    } catch (err) {
      console.error('Error loading config:', err);
      setError('Erro ao carregar configuração atual');
    } finally {
      setLoading(false);
    }
  };

  const handleAutoDiscover = async () => {
    setDiscovering(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke('rd-discover-sinistro-pipeline', {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: { action: 'discover', empresaId },
      });

      if (fnError) throw fnError;

      if (!data.success) {
        if (data.code === 'pipeline_not_found') {
          setError(data.error);
          setPipelines(data.availablePipelines || []);
          setShowManualConfig(true);
          await loadAllStages();
          return;
        }
        throw new Error(data.error);
      }

      setCurrentConfig({
        sinistro_pipeline_id: data.config.pipeline.id,
        sinistro_pipeline_name: data.config.pipeline.name,
        sinistro_stage_inicial_id: data.config.stageInicial.id,
        sinistro_stage_inicial_name: data.config.stageInicial.name,
        sinistro_stage_em_andamento_id: data.config.stageEmAndamento?.id || null,
        sinistro_stage_em_andamento_name: data.config.stageEmAndamento?.name || null,
        sinistro_stage_concluido_id: data.config.stageConcluido?.id || null,
        sinistro_stage_concluido_name: data.config.stageConcluido?.name || null,
      });
      
      toast.success('Pipeline e etapas detectados automaticamente!');
      onUpdate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao detectar pipeline';
      console.error('Auto-discover error:', err);
      setError(msg);
    } finally {
      setDiscovering(false);
    }
  };

  const loadAllStages = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke('rd-discover-sinistro-pipeline', {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: { action: 'list', empresaId },
      });

      if (fnError) throw fnError;

      if (data.success) {
        setPipelines(data.pipelines);
        setStages(data.stages);
      }
    } catch (err) {
      console.error('Error loading pipelines/stages:', err);
    }
  };

  const handleManualSave = async () => {
    if (!selectedPipelineId || !selectedStageInicialId) {
      setError('Selecione o pipeline e a etapa inicial');
      return;
    }
    
    setSaving(true);
    setError(null);
    
    try {
      const { data: session } = await supabase.auth.getSession();
      
      const { data, error: fnError } = await supabase.functions.invoke('rd-discover-sinistro-pipeline', {
        headers: { Authorization: `Bearer ${session.session?.access_token}` },
        body: {
          action: 'save',
          empresaId,
          pipelineId: selectedPipelineId,
          stageInicialId: selectedStageInicialId,
          stageEmAndamentoId: selectedStageEmAndamentoId || null,
          stageConcluidoId: selectedStageConcluidoId || null,
        },
      });

      if (fnError) throw fnError;
      if (!data.success) throw new Error(data.error);

      toast.success('Configuração salva!');
      setShowManualConfig(false);
      await loadCurrentConfig();
      onUpdate();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao salvar';
      console.error('Save error:', err);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const filteredStages = stages.filter(s => s.pipelineId === selectedPipelineId);

  if (loading) {
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
            <Settings2 className="h-5 w-5" />
            Configurar Funil de Sinistros
          </DialogTitle>
          <DialogDescription>
            Configure o pipeline e etapas do RD Station para sincronizar sinistros de <strong>{empresaNome}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Current configuration */}
          {currentConfig && !showManualConfig && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-green-50 border-green-200 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-800">Pipeline configurado</span>
                </div>
                
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pipeline:</span>
                    <Badge variant="secondary">{currentConfig.sinistro_pipeline_name}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Etapa inicial:</span>
                    <Badge variant="outline">{currentConfig.sinistro_stage_inicial_name}</Badge>
                  </div>
                  {currentConfig.sinistro_stage_em_andamento_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Em andamento:</span>
                      <Badge variant="outline">{currentConfig.sinistro_stage_em_andamento_name}</Badge>
                    </div>
                  )}
                  {currentConfig.sinistro_stage_concluido_name && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Concluído:</span>
                      <Badge variant="outline">{currentConfig.sinistro_stage_concluido_name}</Badge>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setShowManualConfig(true);
                    loadAllStages();
                  }}
                >
                  <Settings2 className="h-4 w-4 mr-2" />
                  Alterar manualmente
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleAutoDiscover}
                  disabled={discovering}
                >
                  {discovering ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* No config yet */}
          {!currentConfig && !showManualConfig && (
            <div className="space-y-4">
              <div className="rounded-lg border border-dashed p-6 text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                  <Wand2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">Nenhum funil configurado</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Detecte automaticamente o funil "Gestão de Sinistro" ou configure manualmente.
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Button onClick={handleAutoDiscover} disabled={discovering}>
                    {discovering ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Wand2 className="h-4 w-4 mr-2" />
                    )}
                    Auto-detectar funil/etapas
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setShowManualConfig(true);
                      loadAllStages();
                    }}
                  >
                    Configurar manualmente
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Manual configuration */}
          {showManualConfig && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Configuração manual</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowManualConfig(false)}>
                  Cancelar
                </Button>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Pipeline *</Label>
                  <Select value={selectedPipelineId} onValueChange={(val) => {
                    setSelectedPipelineId(val);
                    setSelectedStageInicialId("");
                    setSelectedStageEmAndamentoId("");
                    setSelectedStageConcluidoId("");
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o pipeline..." />
                    </SelectTrigger>
                    <SelectContent>
                      {pipelines.map(p => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedPipelineId && (
                  <>
                    <div className="space-y-2">
                      <Label>Etapa inicial (Abertura) *</Label>
                      <Select value={selectedStageInicialId} onValueChange={setSelectedStageInicialId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a etapa inicial..." />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredStages.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Etapa "Em Andamento" (opcional)</Label>
                      <Select value={selectedStageEmAndamentoId} onValueChange={setSelectedStageEmAndamentoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma</SelectItem>
                          {filteredStages.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Etapa "Concluído" (opcional)</Label>
                      <Select value={selectedStageConcluidoId} onValueChange={setSelectedStageConcluidoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Nenhuma</SelectItem>
                          {filteredStages.map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </>
                )}

                <Button 
                  onClick={handleManualSave} 
                  disabled={saving || !selectedPipelineId || !selectedStageInicialId}
                  className="w-full"
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Salvar configuração
                </Button>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800">{error}</p>
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
