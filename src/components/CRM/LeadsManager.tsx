import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Search,
  Download,
  Edit,
  Trash2,
  Building2,
  Mail,
  Phone,
  Globe,
  Upload,
  ExternalLink,
  MessageCircle
} from "lucide-react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { exportLeadsToCSV } from "@/utils/csvExport";

const leadSchema = z.object({
  empresa: z.string().min(1, "Nome da empresa é obrigatório"),
  setor: z.string().optional(),
  cnae: z.string().optional(),
  regime_tributario: z.string().optional(),
  contato_decisor: z.string().optional(),
  telefone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  website: z.string().optional(),
  gancho_prospeccao: z.string().optional(),
  status: z.string().default("novo")
});

type LeadFormData = z.infer<typeof leadSchema>;

interface Lead extends LeadFormData {
  id: string;
  created_at: string;
  updated_at: string;
}

interface LeadsManagerProps {
  onStatsUpdate: () => void;
}

const LeadsManager = ({ onStatsUpdate }: LeadsManagerProps) => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [importing, setImporting] = useState(false);
  
  const LEADS_PER_PAGE = 10;

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      empresa: "",
      setor: "",
      cnae: "",
      regime_tributario: "",
      contato_decisor: "",
      telefone: "",
      email: "",
      website: "",
      gancho_prospeccao: "",
      status: "novo"
    }
  });

  useEffect(() => {
    if (user) {
      loadLeads();
    }
  }, [user]);

  const loadLeads = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLeads(data || []);
    } catch (error) {
      console.error('Erro ao carregar leads:', error);
      toast.error('Erro ao carregar leads');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (data: LeadFormData) => {
    if (!user) return;

    try {
      setLoading(true);

      if (editingLead) {
        const { error } = await supabase
          .from('leads')
          .update(data)
          .eq('id', editingLead.id)
          .eq('user_id', user.id);

        if (error) throw error;
        toast.success('Lead atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('leads')
          .insert({ 
            ...data, 
            user_id: user.id,
            empresa: data.empresa || 'Nova Empresa',
          });

        if (error) throw error;
        toast.success('Lead criado com sucesso!');
      }

      form.reset();
      setIsDialogOpen(false);
      setEditingLead(null);
      loadLeads();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro ao salvar lead:', error);
      toast.error('Erro ao salvar lead');
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (lead: Lead) => {
    setEditingLead(lead);
    form.reset(lead);
    setIsDialogOpen(true);
  };

  const handleDelete = async (leadId: string) => {
    if (!user || !confirm('Tem certeza que deseja excluir este lead?')) return;

    try {
      const { error } = await supabase
        .from('leads')
        .delete()
        .eq('id', leadId)
        .eq('user_id', user.id);

      if (error) throw error;
      toast.success('Lead excluído com sucesso!');
      loadLeads();
      onStatsUpdate();
    } catch (error) {
      console.error('Erro ao excluir lead:', error);
      toast.error('Erro ao excluir lead');
    }
  };

  const handleExport = () => {
    exportLeadsToCSV(leads);
    toast.success('Leads exportados com sucesso!');
  };

  const exportToCRM = async (leadId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('crm-export', {
        body: { leadId, crmType: 'pipedrive' } // Default to Pipedrive, can be made configurable
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Lead exportado para o CRM com sucesso!');
      } else {
        throw new Error('Erro na exportação');
      }
    } catch (error) {
      console.error('Erro ao exportar para CRM:', error);
      toast.error('Erro ao exportar para CRM');
    }
  };

  const sendWhatsApp = async (leadId: string) => {
    try {
      const lead = leads.find(l => l.id === leadId);
      if (!lead) {
        toast.error('Lead não encontrado');
        return;
      }

      // Get WhatsApp number from contact channels
      const whatsappNumber = lead.contact_channels?.whatsapp?.numero;
      if (!whatsappNumber) {
        toast.error('Número do WhatsApp não encontrado para este lead');
        return;
      }

      const { data, error } = await supabase.functions.invoke('whatsapp-send', {
        body: { to: whatsappNumber, message: 'Lead qualificado' }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Mensagem WhatsApp enviada com sucesso!');
      } else {
        throw new Error('Erro no envio');
      }
    } catch (error) {
      console.error('Erro ao enviar WhatsApp:', error);
      toast.error('Erro ao enviar WhatsApp');
    }
  };

  const standardizeRegime = (regime: string) => {
    const regimeMap: { [key: string]: string } = {
      'Lucro Real': 'lucro_real',
      'Real': 'lucro_real', 
      'Lucro Presumido': 'lucro_presumido',
      'Presumido': 'lucro_presumido',
      'Simples Nacional': 'simples_nacional',
      'Simples': 'simples_nacional'
    };
    return regimeMap[regime] || 'lucro_presumido';
  };

  const generateProspectingHook = (empresa: string, setor: string, regime: string) => {
    const hooks = {
      'odontol': 'Gestão de folha de pagamento para dentistas e colaboradores. Otimização fiscal e compliance para clínicas.',
      'constru': 'Complexidade na apuração de impostos sobre construção civil. Gestão de projetos e controle orçamentário.',
      'transport': 'Otimização de ICMS sobre serviços de transporte. Gestão de frota e controle de custos operacionais.',
      'aliment': 'Complexidade na apuração de ICMS-ST em produtos alimentícios. Alto volume de transações diárias.',
      'educa': 'Gestão de folha de pagamento para professores. Otimização da carga tributária sobre receitas de mensalidades.',
      'saude': 'Apuração de impostos sobre serviços médicos. Gestão de folha de pagamento especializada.',
      'tecnologia': 'Alta carga tributária sobre serviços de TI. Necessidade de controle fiscal robusto.',
      'advocacia': 'Complexidade dos regimes tributários para sociedades de advogados. Alta carga sobre honorários.',
      'default': 'Oportunidade de otimização tributária e planejamento fiscal estratégico.'
    };
    
    const key = Object.keys(hooks).find(k => 
      setor.toLowerCase().includes(k) || 
      empresa.toLowerCase().includes(k)
    ) || 'default';
    
    return hooks[key];
  };

  const importLeads = async (leadsData: any[]) => {
    if (!user) return;
    
    const { error } = await supabase
      .from('leads')
      .insert(leadsData.map(lead => ({ ...lead, user_id: user.id })));
      
    if (error) throw error;
    
    loadLeads();
    onStatsUpdate();
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      const text = e.target?.result as string;
      
      const isTabSeparated = text.includes('\t');
      const separator = isTabSeparated ? '\t' : ',';
      
      const lines = text.split('\n').filter(line => line.trim());
      const newLeads = [];
      
      for (const line of lines) {
        const columns = line.split(separator);
        
        if (columns.length < 2) continue;
        
        let leadData;
        
        if (isTabSeparated) {
          leadData = {
            empresa: columns[0]?.trim() || '',
            setor: columns[4]?.trim() || '',
            regime_tributario: standardizeRegime(columns[2]?.trim() || ''),
            contato_decisor: columns[7]?.trim() || '',
            telefone: columns[8]?.trim() === '-' ? '' : columns[8]?.trim() || '',
            email: columns[9]?.trim() === '-' ? '' : columns[9]?.trim() || '',
            status: columns[5]?.toLowerCase().includes('ativa') ? 'ativo' : 'inativo',
            gancho_prospeccao: generateProspectingHook(columns[0]?.trim() || '', columns[4]?.trim() || '', columns[2]?.trim() || '')
          };
        } else {
          leadData = {
            empresa: columns[1]?.trim() || '',
            setor: columns[2]?.trim() || '',
            regime_tributario: standardizeRegime(columns[7]?.trim() || ''),
            contato_decisor: columns[8]?.trim() || '',
            telefone: columns[4]?.trim() || '',
            email: columns[5]?.trim() || '',
            cnae: columns[6]?.trim() || '',
            gancho_prospeccao: columns[9]?.trim() || '',
            qualification_score: columns[0]?.trim() || '',
            notes: `Qualificação: ${columns[0]?.trim() || 'N/A'}. CNPJ: ${columns[3]?.trim() || 'N/A'}`
          };
        }
        
        const exists = leads.some(lead => 
          lead.empresa.toLowerCase() === leadData.empresa.toLowerCase()
        );
        
        if (!exists && leadData.empresa) {
          newLeads.push(leadData);
        }
      }
      
      if (newLeads.length > 0) {
        await importLeads(newLeads);
        toast.success(`${newLeads.length} leads importados com sucesso!`);
      } else {
        toast.error('Nenhum lead novo encontrado para importar');
      }
    };
    
    reader.readAsText(file);
    event.target.value = '';
  };

  const filteredLeads = leads.filter(lead =>
    lead.empresa.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.setor?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.contato_decisor?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  const totalPages = Math.ceil(filteredLeads.length / LEADS_PER_PAGE);
  const startIndex = (currentPage - 1) * LEADS_PER_PAGE;
  const endIndex = startIndex + LEADS_PER_PAGE;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'novo': return 'bg-blue-100 text-blue-800';
      case 'contatado': return 'bg-yellow-100 text-yellow-800';
      case 'qualificado': return 'bg-green-100 text-green-800';
      case 'perdido': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Gerenciar Leads
          </CardTitle>
          <div className="flex gap-2">
            <input
              type="file"
              accept=".csv,.txt"
              onChange={handleFileImport}
              style={{ display: 'none' }}
              id="file-input"
            />
            <Button variant="outline" onClick={() => document.getElementById('file-input')?.click()}>
              <Upload className="h-4 w-4 mr-2" />
              Abrir
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={leads.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingLead(null);
                  form.reset();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Lead
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>
                    {editingLead ? 'Editar Lead' : 'Novo Lead'}
                  </DialogTitle>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="empresa"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Empresa *</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Nome da empresa" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="setor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Setor</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: Agroindústria" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="cnae"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>CNAE</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: 1071-6/00" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="regime_tributario"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Regime Tributário</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione o regime" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="lucro_real">Lucro Real</SelectItem>
                                <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                                <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                                <SelectItem value="cooperativa">Cooperativa</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="contato_decisor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Contato Decisor</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="Ex: CFO, Diretor Financeiro" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="novo">Novo</SelectItem>
                                <SelectItem value="contatado">Contatado</SelectItem>
                                <SelectItem value="qualificado">Qualificado</SelectItem>
                                <SelectItem value="perdido">Perdido</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="(62) 3321-8200" />
                            </FormControl>
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
                              <Input {...field} type="email" placeholder="contato@empresa.com" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="website"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Website</FormLabel>
                            <FormControl>
                              <Input {...field} placeholder="www.empresa.com.br" />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="gancho_prospeccao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Gancho de Prospecção</FormLabel>
                          <FormControl>
                            <Textarea 
                              {...field} 
                              placeholder="Descreva a oportunidade ou dor identificada..." 
                              rows={3}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={() => setIsDialogOpen(false)}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" disabled={loading}>
                        {loading ? 'Salvando...' : (editingLead ? 'Atualizar' : 'Criar')}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar leads..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Badge variant="outline">
            {filteredLeads.length} leads encontrados
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Empresa</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Urgência</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="font-medium">
                    <div>
                      <div className="font-semibold">{lead.empresa}</div>
                      {lead.website && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Globe className="h-3 w-3" />
                          {lead.website}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{lead.setor || '-'}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {lead.contato_decisor && (
                        <div className="text-sm">{lead.contato_decisor}</div>
                      )}
                      {lead.email && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </div>
                      )}
                      {lead.telefone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {lead.telefone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(lead.status)} variant="secondary">
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lead.qualification_score === 'A' ? 'default' : lead.qualification_score === 'B' ? 'secondary' : 'outline'}>
                      {lead.qualification_score || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={lead.urgency_level === 'Alta' ? 'destructive' : lead.urgency_level === 'Média' ? 'default' : 'secondary'}>
                      {lead.urgency_level || '-'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(lead.created_at).toLocaleDateString('pt-BR')}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(lead)}
                        title="Editar lead"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => exportToCRM(lead.id)}
                        title="Exportar para CRM"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => sendWhatsApp(lead.id)}
                        title="Enviar WhatsApp"
                      >
                        <MessageCircle className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(lead.id)}
                        className="text-destructive hover:text-destructive"
                        title="Excluir lead"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {paginatedLeads.length === 0 && filteredLeads.length > 0 && (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum lead nesta página
            </div>
          )}
          
          {filteredLeads.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? 'Nenhum lead encontrado com esse termo' : 'Nenhum lead cadastrado'}
            </div>
          )}
        </div>
        
        {totalPages > 1 && (
          <div className="mt-4 flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious 
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
                
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <PaginationItem key={page}>
                    <PaginationLink
                      onClick={() => setCurrentPage(page)}
                      isActive={currentPage === page}
                      className="cursor-pointer"
                    >
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                
                <PaginationItem>
                  <PaginationNext 
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
        
        <div className="mt-4 text-sm text-muted-foreground text-center">
          Mostrando {startIndex + 1}-{Math.min(endIndex, filteredLeads.length)} de {filteredLeads.length} leads
          {filteredLeads.length !== leads.length && ` (${leads.length} no total)`}
        </div>
      </CardContent>
    </Card>
  );
};

export default LeadsManager;