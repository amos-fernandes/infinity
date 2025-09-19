import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  BarChart3,
  Users,
  Target,
  TrendingUp,
  Calendar,
  DollarSign,
  Plus,
  Download,
  Brain,
  Sparkles,
  CheckCircle2,
  Zap
} from "lucide-react";
import LeadsManager from "./LeadsManager";
import ContactsManager from "./ContactsManager";
import OpportunitiesManager from "./OpportunitiesManager";
import InteractionsManager from "./InteractionsManager";
import SalesFunnel from "./SalesFunnel";
import CampaignManager from "../CampaignManager";
import CampaignResults from "../CampaignResults";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const CRMDashboard = () => {
  const { user } = useAuth();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isQualifying, setIsQualifying] = useState(false);
  const [cnpj, setCnpj] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [stats, setStats] = useState({
    totalLeads: 0,
    totalContacts: 0,
    totalOpportunities: 0,
    totalInteractions: 0,
    qualifiedLeads: 0,
    hotLeads: 0,
    conversionRate: 0,
    pipelineValue: 0
  });

  const loadStats = async () => {
    if (!user) return;

    try {
      // Carregar leads
      const { data: leads } = await supabase
        .from('leads')
        .select('status')
        .eq('user_id', user.id);

      // Carregar contatos
      const { data: contacts } = await supabase
        .from('contacts')
        .select('id')
        .eq('user_id', user.id);

      // Carregar oportunidades
      const { data: opportunities } = await supabase
        .from('opportunities')
        .select('valor, estagio')
        .eq('user_id', user.id);

      // Carregar interações
      const { data: interactions } = await supabase
        .from('interactions')
        .select('id')
        .eq('user_id', user.id);

      const totalLeads = leads?.length || 0;
      const qualifiedLeads = leads?.filter(l => l.status === 'qualificado').length || 0;
      const hotLeads = 0; // Será preenchido depois da migração com qualificationScore
      const closedOpportunities = opportunities?.filter(o => o.estagio === 'fechamento').length || 0;
      const conversionRate = totalLeads > 0 ? (closedOpportunities / totalLeads) * 100 : 0;
      const pipelineValue = opportunities?.reduce((sum, opp) => sum + (opp.valor || 0), 0) || 0;

      setStats({
        totalLeads,
        totalContacts: contacts?.length || 0,
        totalOpportunities: opportunities?.length || 0,
        totalInteractions: interactions?.length || 0,
        qualifiedLeads,
        hotLeads,
        conversionRate: parseFloat(conversionRate.toFixed(1)),
        pipelineValue
      });
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const handleGenerateLead = async () => {
    if (!cnpj.trim()) {
      toast.error("Por favor, insira um CNPJ válido");
      return;
    }

    setIsGenerating(true);
    try {
      console.log('Calling generate-lead with CNPJ:', cnpj, 'user ID:', user?.id);

      const { data, error } = await supabase.functions.invoke('generate-lead', {
        body: { cnpj: cnpj.trim(), userId: user?.id }
      });

      console.log('Generate lead response:', { data, error });

      if (error) {
        console.error('Supabase function invoke error:', error);
        throw new Error(error.message || 'Erro na chamada da função');
      }

      if (!data) {
        throw new Error('Nenhuma resposta recebida da função');
      }

      if (data.id) {
        toast.success("Lead qualificado gerado com sucesso!");
        setCnpj("");
        setIsDialogOpen(false);
        await loadStats();
      } else {
        throw new Error('Erro na resposta da função');
      }
    } catch (error) {
      console.error('Erro ao gerar lead:', error);
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido ao gerar lead";
      toast.error(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQualifyLeads = async () => {
    setIsQualifying(true);
    try {
      const { data, error } = await supabase.functions.invoke('qualify-leads', {
        body: { userId: user?.id }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(data.message);
        await loadStats();
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Erro ao qualificar leads:', error);
      toast.error(error.message || "Erro ao qualificar leads");
    } finally {
      setIsQualifying(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, [user]);

  return (
    <div className="space-y-6">
      {/* Header com estatísticas */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM Dashboard</h1>
          <p className="text-muted-foreground">
            Hub de prospecção inteligente com IA real para geração e qualificação de leads
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button
                disabled={isGenerating || isQualifying}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Brain className="h-4 w-4 mr-2" />
                {isGenerating ? 'Gerando...' : 'Novo Lead IA'}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Gerar Lead Qualificado</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="cnpj">CNPJ da Empresa</Label>
                  <Input
                    id="cnpj"
                    placeholder="00.000.000/0000-00"
                    value={cnpj}
                    onChange={(e) => setCnpj(e.target.value)}
                  />
                </div>
                <Button
                  onClick={handleGenerateLead}
                  disabled={isGenerating || !cnpj.trim()}
                  className="w-full"
                >
                  {isGenerating ? 'Gerando Lead...' : 'Gerar Lead Qualificado'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button 
            variant="outline"
            onClick={handleQualifyLeads}
            disabled={isQualifying || isGenerating}
          >
            <Sparkles className="h-4 w-4 mr-2" />
            {isQualifying ? 'Qualificando...' : 'Qualificar Leads IA'}
          </Button>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Exportar Relatório
          </Button>
        </div>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Leads</CardTitle>
            <Target className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{stats.totalLeads}</div>
            <p className="text-xs text-muted-foreground">leads cadastrados</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Qualificados</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{stats.qualifiedLeads}</div>
            <p className="text-xs text-muted-foreground">
              {stats.totalLeads > 0 ? `${((stats.qualifiedLeads / stats.totalLeads) * 100).toFixed(1)}%` : '0%'} do total
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads Prioritários</CardTitle>
            <Zap className="h-4 w-4 text-warning" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{stats.hotLeads}</div>
            <p className="text-xs text-muted-foreground">score A (alta prioridade)</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Oportunidades</CardTitle>
            <TrendingUp className="h-4 w-4 text-info" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-info">{stats.totalOpportunities}</div>
            <p className="text-xs text-muted-foreground">em andamento</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa Conversão</CardTitle>
            <BarChart3 className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{stats.conversionRate}%</div>
            <p className="text-xs text-muted-foreground">taxa de fechamento</p>
          </CardContent>
        </Card>

        <Card className="shadow-soft">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline</CardTitle>
            <DollarSign className="h-4 w-4 text-success" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              R$ {stats.pipelineValue.toLocaleString('pt-BR')}
            </div>
            <p className="text-xs text-muted-foreground">valor total</p>
          </CardContent>
        </Card>
      </div>

      {/* Funil de Vendas */}
      <SalesFunnel onStatsUpdate={loadStats} />

      {/* Tabs para gerenciar diferentes aspectos do CRM */}
      <Tabs defaultValue="campaigns" className="space-y-4">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="campaigns">Campanhas</TabsTrigger>
          <TabsTrigger value="results">Resultados</TabsTrigger>
          <TabsTrigger value="leads">Leads</TabsTrigger>
          <TabsTrigger value="contacts">Contatos</TabsTrigger>
          <TabsTrigger value="opportunities">Oportunidades</TabsTrigger>
          <TabsTrigger value="interactions">Interações</TabsTrigger>
        </TabsList>
        
        <TabsContent value="campaigns">
          <CampaignManager />
        </TabsContent>
        
        <TabsContent value="results">
          <CampaignResults />
        </TabsContent>
        
        <TabsContent value="leads">
          <LeadsManager onStatsUpdate={loadStats} />
        </TabsContent>
        
        <TabsContent value="contacts">
          <ContactsManager onStatsUpdate={loadStats} />
        </TabsContent>
        
        <TabsContent value="opportunities">
          <OpportunitiesManager onStatsUpdate={loadStats} />
        </TabsContent>
        
        <TabsContent value="interactions">
          <InteractionsManager onStatsUpdate={loadStats} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CRMDashboard;