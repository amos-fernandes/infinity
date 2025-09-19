import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Filter,
  Users,
  Target,
  Clock,
  TrendingUp,
  Plus,
  Search,
  ArrowRight,
  Send,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface FunnelStats {
  leads: number;
  contatados: number;
  qualificados: number;
  reunioes: number;
  propostas: number;
  fechamentos: number;
  perdidos: number;
}

interface SalesFunnelProps {
  onStatsUpdate: () => void;
}

const SalesFunnel = ({ onStatsUpdate }: SalesFunnelProps) => {
  const { user } = useAuth();
  const [stats, setStats] = useState<FunnelStats>({
    leads: 0,
    contatados: 0,
    qualificados: 0,
    reunioes: 0,
    propostas: 0,
    fechamentos: 0,
    perdidos: 0
  });
  const [loading, setLoading] = useState(false);
  const [campaignResults, setCampaignResults] = useState<any>(null);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  useEffect(() => {
    if (user) {
      loadFunnelStats();
    }
  }, [user]);

  const loadFunnelStats = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Carregar estatísticas de leads
      const { data: leadsData, error: leadsError } = await supabase
        .from('leads')
        .select('status')
        .eq('user_id', user.id);

      if (leadsError) throw leadsError;

      // Carregar estatísticas de oportunidades
      const { data: opportunitiesData, error: opportunitiesError } = await supabase
        .from('opportunities')
        .select('estagio')
        .eq('user_id', user.id);

      if (opportunitiesError) throw opportunitiesError;

      // Calcular estatísticas
      const newStats: FunnelStats = {
        leads: leadsData?.filter(l => l.status === 'novo').length || 0,
        contatados: leadsData?.filter(l => l.status === 'contatado').length || 0,
        qualificados: leadsData?.filter(l => l.status === 'qualificado').length || 0,
        reunioes: opportunitiesData?.filter(o => o.estagio === 'reuniao').length || 0,
        propostas: opportunitiesData?.filter(o => o.estagio === 'proposta').length || 0,
        fechamentos: opportunitiesData?.filter(o => o.estagio === 'fechamento').length || 0,
        perdidos: [...(leadsData?.filter(l => l.status === 'perdido') || []), ...(opportunitiesData?.filter(o => o.estagio === 'perdido') || [])].length
      };

      setStats(newStats);
    } catch (error) {
      console.error('Erro ao carregar estatísticas do funil:', error);
      toast.error('Erro ao carregar estatísticas do funil');
    } finally {
      setLoading(false);
    }
  };

  const createAutoLeadCampaign = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log('🔵 createAutoLeadCampaign called - Campaign-based generation');
    if (!user) return;

    try {
      setLoading(true);

      // Usar nova função de geração baseada em campanha
      const { data, error } = await supabase.functions.invoke('generate-campaign-leads', {
        body: { userId: user.id }
      });

      if (error) throw error;

      if (data.success) {
        const { totalProcessed, successCount, errorCount, results } = data;

        // Store results for detailed display
        setCampaignResults({ totalProcessed, successCount, errorCount, results });

        // Show summary toast
        toast.success(`Campanha concluída: ${successCount}/${totalProcessed} leads qualificados`);

        // Log detailed results for debugging
        console.log('Campaign results:', results);

        // Show results dialog
        setShowResultsDialog(true);

        loadFunnelStats();
        onStatsUpdate();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao executar campanha de leads:', error);
      toast.error('Erro ao executar campanha de prospecção');
    } finally {
      setLoading(false);
    }
  };

  const qualifyLeadsAutomatically = async (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    
    console.log('🟡 qualifyLeadsAutomatically called');
    if (!user) return;

    try {
      setLoading(true);

      // Buscar leads novos
      const { data: newLeads, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'novo');

      if (error) throw error;

      let qualifiedCount = 0;

      for (const lead of newLeads || []) {
        // Qualificar baseado no regime tributário e gancho de prospecção
        const shouldQualify = (
          lead.regime_tributario?.includes('Lucro Real') || 
          lead.gancho_prospeccao?.includes('ICMS') ||
          lead.gancho_prospeccao?.includes('créditos') ||
          lead.gancho_prospeccao?.includes('tributário')
        );

        if (shouldQualify) {
          const { error: updateError } = await supabase
            .from('leads')
            .update({ status: 'qualificado' })
            .eq('id', lead.id);

          if (!updateError) {
            qualifiedCount++;
          }
        }
      }

      toast.success(`${qualifiedCount} leads qualificados automaticamente!`);
      loadFunnelStats();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro na qualificação automática:', error);
      toast.error('Erro na qualificação automática');
    } finally {
      setLoading(false);
    }
  };

  const total = stats.leads + stats.contatados + stats.qualificados + stats.reunioes + stats.propostas + stats.fechamentos;
  const conversionRate = total > 0 ? ((stats.fechamentos / total) * 100).toFixed(1) : '0';

  const funnelSteps = [
    { name: 'Leads', count: stats.leads, color: 'bg-blue-500', percentage: total > 0 ? (stats.leads / total) * 100 : 0 },
    { name: 'Contatados', count: stats.contatados, color: 'bg-yellow-500', percentage: total > 0 ? (stats.contatados / total) * 100 : 0 },
    { name: 'Qualificados', count: stats.qualificados, color: 'bg-orange-500', percentage: total > 0 ? (stats.qualificados / total) * 100 : 0 },
    { name: 'Reuniões', count: stats.reunioes, color: 'bg-purple-500', percentage: total > 0 ? (stats.reunioes / total) * 100 : 0 },
    { name: 'Propostas', count: stats.propostas, color: 'bg-pink-500', percentage: total > 0 ? (stats.propostas / total) * 100 : 0 },
    { name: 'Fechados', count: stats.fechamentos, color: 'bg-green-500', percentage: total > 0 ? (stats.fechamentos / total) * 100 : 0 }
  ];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-primary" />
            Funil de Vendas
          </CardTitle>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={(e) => qualifyLeadsAutomatically(e)}
              disabled={loading}
              type="button"
            >
              <Target className="h-4 w-4 mr-2" />
              Qualificar Leads
            </Button>
            <Button
              onClick={(e) => createAutoLeadCampaign(e)}
              disabled={loading}
              type="button"
              title="Executar campanha automatizada baseada nos critérios definidos"
            >
              <Plus className="h-4 w-4 mr-2" />
              {loading ? 'Executando Campanha...' : 'Executar Campanha IA'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="space-y-6">
          {/* Métricas principais */}
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-primary">{total}</div>
              <div className="text-sm text-muted-foreground">Total Prospects</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-success">{stats.fechamentos}</div>
              <div className="text-sm text-muted-foreground">Fechados</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-warning">{conversionRate}%</div>
              <div className="text-sm text-muted-foreground">Taxa Conversão</div>
            </div>
            <div className="text-center p-4 bg-gradient-subtle rounded-lg">
              <div className="text-2xl font-bold text-destructive">{stats.perdidos}</div>
              <div className="text-sm text-muted-foreground">Perdidos</div>
            </div>
          </div>

          {/* Funil visual */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Pipeline Atual</h3>
            <div className="space-y-3">
              {funnelSteps.map((step, index) => (
                <div key={step.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full ${step.color}`}></div>
                      <span className="font-medium">{step.name}</span>
                      <Badge variant="outline">{step.count}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {step.percentage.toFixed(1)}%
                    </div>
                  </div>
                  <Progress 
                    value={step.percentage} 
                    className="h-2"
                  />
                  {index < funnelSteps.length - 1 && (
                    <div className="flex justify-center">
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="grid grid-cols-2 gap-4 pt-4 border-t">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Automações Disponíveis</h4>
              <div className="text-xs text-muted-foreground">
                • Qualificação automática por regime tributário<br />
                • Importação da base de conhecimento<br />
                • Follow-up programado por estágio
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Próximas Ações</h4>
              <div className="text-xs text-muted-foreground">
                • Executar campanha IA para descobrir novos leads<br />
                • {stats.leads} leads aguardando contato<br />
                • {stats.contatados} prospects para qualificar<br />
                • {stats.qualificados} prontos para reunião
              </div>
            </div>
          </div>
        </div>
      </CardContent>

      {/* Campaign Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Resultados da Campanha de Prospecção</DialogTitle>
          </DialogHeader>

          {campaignResults && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{campaignResults.totalProcessed}</div>
                  <div className="text-sm text-muted-foreground">Total Processado</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{campaignResults.successCount}</div>
                  <div className="text-sm text-muted-foreground">Sucessos</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600">{campaignResults.errorCount}</div>
                  <div className="text-sm text-muted-foreground">Erros</div>
                </div>
              </div>

              {/* Detailed Results */}
              <div className="space-y-2">
                <h4 className="font-medium">Detalhes por Empresa:</h4>
                <div className="max-h-96 overflow-y-auto space-y-2">
                  {campaignResults.results.map((result: any, index: number) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        {result.status === 'success' ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                        <div>
                          <div className="font-medium">{result.company}</div>
                          <div className="text-sm text-muted-foreground">
                            {result.cnpj && `CNPJ: ${result.cnpj}`}
                            {result.domain && ` | Domínio: ${result.domain}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        {result.status === 'success' ? (
                          <div>
                            <Badge variant="default" className="mb-1">
                              Score {result.qualificationScore}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              Lead ID: {result.leadId}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-red-600 max-w-xs truncate" title={result.message}>
                            {result.message}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowResultsDialog(false)}>
                  Fechar
                </Button>
                <Button onClick={() => {
                  setShowResultsDialog(false);
                  setCampaignResults(null);
                }}>
                  OK
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default SalesFunnel;