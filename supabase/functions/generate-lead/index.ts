// supabase/functions/generate-lead/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECEITA_WS_URL = "https://www.receitaws.com.br/v1/cnpj/";
const HUNTER_API_KEY = Deno.env.get("HUNTER_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

console.log('Environment variables check:', {
  hasHunterKey: !!HUNTER_API_KEY,
  hasOpenAIKey: !!OPENAI_API_KEY,
  supabaseUrl: !!Deno.env.get("SUPABASE_URL"),
  supabaseServiceKey: !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
});

if (!HUNTER_API_KEY || !OPENAI_API_KEY) {
  console.error('Missing required API keys. Please set HUNTER_API_KEY and OPENAI_API_KEY environment variables.');
}

serve(async (req) => {
  console.log('generate-lead function called with method:', req.method);

  if (req.method === "OPTIONS") {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-auth",
      },
    });
  }

  try {
    console.log('generate-lead function: Starting execution');

    console.log('Parsing request body...');
    const body = await req.json();
    console.log('Request body received:', JSON.stringify(body, null, 2));

    const { cnpj, userId } = body;

    console.log('Extracted parameters:', { cnpj, userId });

    if (!cnpj) {
      console.log('CNPJ validation failed: cnpj is empty');
      throw new Error("CNPJ é obrigatório");
    }

    if (!userId) {
      console.log('userId validation failed: userId is empty');
      throw new Error("userId é obrigatório");
    }

    console.log('Validation passed. Processing CNPJ:', cnpj, 'for user:', userId);

    // // TEMPORARY: Return mock response to test function execution
    // console.log('Returning mock response for testing...');

    // const mockResponse = {
    //   id: 'test-' + Date.now(),
    //   user_id: userId,
    //   cnpj: cnpj,
    //   qualification_score: 'A',
    //   urgency_level: 'Alta',
    //   approach_strategy: 'Abordagem direta via WhatsApp',
    //   contact_channels: {
    //     telefoneComercial: { numero: '(62) 3234-5678', status: 'confirmado', fonte: 'ReceitaWS' },
    //     telefonePessoalDecisor: { numero: '(62) 99999-8888', status: 'confirmado', fonte: 'Hunter.io' },
    //     emailCorporativo: { email: 'contato@empresa.com.br', status: 'confirmado', fonte: 'Hunter.io' },
    //     whatsapp: { numero: '(62) 99999-8888', status: 'confirmado', fonte: 'Web Scraping' }
    //   },
    //   raw_data: {
    //     cnpjData: { nome_fantasia: 'Empresa Teste Ltda', cnae: '6201-5/00' },
    //     emailData: { email: 'contato@empresa.com.br' },
    //     contactData: { phone: '(62) 3234-5678', whatsapp: '(62) 99999-8888' },
    //     event: 'Empresa anunciou expansão'
    //   },
    //   created_at: new Date().toISOString()
    // };

    // console.log('Mock response created:', mockResponse);

    // return new Response(JSON.stringify(mockResponse), {
    //   headers: {
    //     "Content-Type": "application/json",
    //     "Access-Control-Allow-Origin": "*"
    //   },
    //   status: 200,
    // });

    /*
    // ORIGINAL CODE - COMMENTED OUT FOR TESTING
    // Check API keys*/
    if (!HUNTER_API_KEY) {
      throw new Error('HUNTER_API_KEY não configurada. Configure a chave da API Hunter.io.');
    }
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY não configurada. Configure a chave da API OpenAI.');
    }

    // 1. Coletar dados do CNPJ
    console.log('Fetching CNPJ data from ReceitaWS...');
    const cnpjData = await fetchReceitaWS(cnpj);
    console.log('CNPJ data received:', cnpjData);

    if (!cnpjData || cnpjData.status === "ERROR") {
      console.log('CNPJ validation failed:', cnpjData);
      throw new Error("CNPJ inválido ou não encontrado");
    }
    

    
    // 2. Encontrar e-mail corporativo (Hunter.io)
    console.log('Finding email with Hunter.io...');
    const emailData = await findEmailWithHunter(cnpjData.email || cnpjData.nome_fantasia, cnpjData.site);
    console.log('Email data:', emailData);

    // 3. Verificar WhatsApp e telefone (Google Maps ou site scraping)
    const contactData = await scrapeContactInfo(cnpjData.site || "");

    // 4. Buscar evento recente (scraping do Instagram ou notícias)
    const event = await scrapeRecentEvent(cnpjData.nome_fantasia);

    // 5. Qualificar com LLM
    const qualification = await qualifyLeadWithLLM({
      empresa: cnpjData.nome_fantasia,
      setor: mapCNAEToSector(cnpjData.cnae),
      cnae: cnpjData.cnae,
      regime_tributario: cnpjData.regime_tributario || "Não informado",
      contato_decisor: `${cnpjData.socio} (Sócio)`,
      telefone_comercial: contactData.phone || "Não encontrado",
      telefone_pessoal: contactData.whatsapp || "Não encontrado",
      email_corporativo: emailData.email || `${cnpjData.socio?.split(" ")[0].toLowerCase()}.${cnpjData.socio?.split(" ")[1]?.toLowerCase()}@${cnpjData.site?.replace("www.", "").replace("http://", "").replace("https://", "")}`.replace("/", ""),
      website: cnpjData.site,
      whatsapp_confirmado: !!contactData.whatsapp,
      evento_recente: event || "Sem eventos recentes identificados",
    });

    // 6. Salvar no Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("leads")
      .insert([{
        user_id: userId,
        cnpj,
        qualification_score: qualification.qualificationScore,
        urgency_level: qualification.urgencyLevel,
        approach_strategy: qualification.approachStrategy,
        contact_channels: qualification.contactChannels,
        raw_data: { cnpjData, emailData, contactData, event }
      }])
      .select();

    if (error) throw error;

    // 7. Retornar lead qualificado
    return new Response(JSON.stringify(data[0]), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-auth"
      },
      status: 200,
    });
    

  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-auth"
      },
      status: 500,
    });
  }
});

// Funções auxiliares (implemente ou mocke inicialmente)

async function fetchReceitaWS(cnpj: string) {
  const cleanCNPJ = cnpj.replace(/\D/g, "");
  const res = await fetch(`${RECEITA_WS_URL}${cleanCNPJ}`);
  return await res.json();
}

async function findEmailWithHunter(companyName: string, domain: string) {
  if (!domain) return { email: "", confidence: 0 };
  const res = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${HUNTER_API_KEY}`);
  const data = await res.json();
  return data.data?.emails?.[0] || { email: "", confidence: 0 };
}

async function scrapeContactInfo(site: string) {
  // Mock inicial — depois integre com Puppeteer/ScrapingBee
  return {
    phone: "(62) 3234-5678",
    whatsapp: "(62) 99999-8888"
  };
}

async function scrapeRecentEvent(companyName: string) {
  // Mock — depois integre com Google News ou Instagram API
  return `Empresa anunciou expansão em ${new Date().toLocaleDateString()}`;
}

async function qualifyLeadWithLLM(lead: any) {
  const prompt = `
    Você é um especialista em qualificação de leads B2B para abertura de conta PJ no C6 Bank via escritório Infinity.
    Com base nos dados REAIS fornecidos, gere um relatório de qualificação no formato JSON.
    NÃO INVENTE DADOS. Use apenas o que foi fornecido.

    Dados:
    Empresa: ${lead.empresa}
    Setor: ${lead.setor}
    Evento Recente: ${lead.evento_recente}
    WhatsApp Confirmado: ${lead.whatsapp_confirmado ? "Sim" : "Não"}

    RETORNE APENAS JSON NO FORMATO:
    {
      "qualificationScore": "A",
      "urgencyLevel": "Alta",
      "approachStrategy": "string",
      "contactChannels": {
        "telefoneComercial": { "numero": "string", "status": "confirmado|inferido", "fonte": "string" },
        "telefonePessoalDecisor": { "numero": "string", "status": "confirmado|inferido", "fonte": "string" },
        "emailCorporativo": { "email": "string", "status": "confirmado|sugerido", "fonte": "string" },
        "whatsapp": { "numero": "string", "status": "confirmado|provavel", "fonte": "string" }
      }
    }
  `;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      max_tokens: 500,
    }),
  });

  const completion = await res.json();
  const content = completion.choices[0].message.content;
  return JSON.parse(content.trim().replace(/```json\n?|```/g, ""));
}

function mapCNAEToSector(cnae: string) {
  // Simplificado — use uma lib ou mapeamento completo
  if (cnae.startsWith("86")) return "Saúde";
  if (cnae.startsWith("47")) return "Varejo";
  return "Outros";
}