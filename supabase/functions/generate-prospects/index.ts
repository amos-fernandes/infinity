import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const googleGeminiApiKey = Deno.env.get('GOOGLE_GEMINI_API_KEY');
const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

console.log('Environment check:', {
  hasGeminiKey: !!googleGeminiApiKey,
  hasSupabaseUrl: !!supabaseUrl,
  hasServiceKey: !!supabaseServiceKey
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    console.log('Generate prospects function started');
    
    let body;
    try {
      body = await req.json();
    } catch (jsonError) {
      console.error('JSON parse error:', jsonError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    const { userId } = body;
    console.log('Generating prospects for user:', userId, 'Body received:', body);
    
    if (!userId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'UserId é obrigatório'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    if (!googleGeminiApiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Google Gemini API key não configurada'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }

    const prompt = `
  Você é um Especialista em Prospecção B2B para Abertura de Conta PJ Digital no C6 Bank, atuando via escritório autorizado Infinity.
  
  Seu papel é identificar EXATAMENTE 50 prospects de alto potencial com CNPJ ativo, EXCLUINDO MEI e organizações do terceiro setor.
  
  Todos os prospects devem ser empresas com perfil de decisão centralizado (dono ou sócio como tomador de decisão).
  
  Use APENAS fontes públicas e auditáveis para gerar cada lead:
    - Receita Federal (CNPJ ativo)
    - Juntas Comerciais
    - Sites oficiais das empresas
    - Imprensa especializada (notícias de expansão, M&A, crescimento)
    - Diários Oficiais (quando aplicável)
    - Órgãos de classe (ex: OAB, CRM, CREA) para profissionais liberais
  
  Para cada prospect, gere:
  
    - "cnpj": string (apenas dígitos)
    - "empresa": nome completo registrado
    - "setor": setor de atuação principal (ex: "Tecnologia", "Varejo", "Advocacia")
    - "contato_decisor": "{Nome} ({Cargo})", onde cargo = Fundador, Sócio, CEO, Diretor, Gerente Geral
    - "telefone_comercial": "(XX) XXXX-XXXX" (do site oficial ou Google Meu Negócio)
    - "email_corporativo": "nome.sobrenome@empresa.com.br" (formato padrão, apenas se inferível com segurança)
    - "website": URL oficial
    - "gancho_prospeccao": texto curto e poderoso baseado em oportunidade REAL, como:
        • Expansão recente → necessidade de conta ágil
        • Uso intenso de Pix/TEDs/boletos → redução de custos
        • Falta de conta digital com atendimento humano
        • Crescimento acelerado sem estrutura financeira
        • Migração de banco tradicional com altas taxas
        • Busca por crédito sujeito a análise
        • Interesse em soluções digitais sem perder o contato humano

  Critérios de qualificação BANT adaptados:
    - Budget: qualquer empresa com movimentação bancária relevante
    - Authority: dono ou sócio (obrigatório)
    - Need: redução de custos bancários OU acesso a crédito
    - Timing: interesse implícito em modernização ou expansão

  NUNCA invente dados. Se não houver informação suficiente, pule o campo ou omita o prospect.
  NÃO gere leads para MEI ou entidades sem fins lucrativos.

  Retorne APENAS um JSON válido, SEM comentários, SEM explicações:

  {
    "prospects": [
      {
        "cnpj": "12417515000105",
        "empresa": "Google Brasil Internet Ltda.",
        "setor": "Tecnologia",
        "contato_decisor": "Sundar Pichai (CEO)",
        "telefone_comercial": "(11) 3388-6800",
        "email_corporativo": "financeiro@google.com.br",
        "website": "https://google.com.br",
        "gancho_prospeccao": "Empresa em constante expansão nacional com alta necessidade de transações digitais ágeis e sem custos"
      }
    ]
  }
`;

    console.log('Calling Google Gemini API...');
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${googleGeminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: prompt
              }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.5
        }
      })
    });
    
    console.log('Google Gemini response status:', response.status);
    
    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Limite de requisições do Google Gemini atingido. Aguarde alguns minutos.');
      }
      throw new Error(`Google Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    let content = '';
    if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
      content = data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Resposta inválida da IA. Estrutura de dados inesperada.');
    }
    
    console.log('Parsing Google Gemini response...');
    console.log('Raw content from Gemini:', content.substring(0, 200));
    
    let cleanedContent = ''; // Initialize cleanedContent outside try block
    let prospectsData;
    try {
      // Clean the content more thoroughly
      cleanedContent = content.trim();
      
      // Remove markdown code blocks if present
      cleanedContent = cleanedContent.replace(/```json\s*/g, '').replace(/```\s*/g, '');
      
      // Find the JSON object in the response - look for the first { and last }
      const jsonStart = cleanedContent.indexOf('{');
      let jsonEnd = cleanedContent.lastIndexOf('}');
      
      if (jsonStart === -1) {
        console.error('No opening brace found in response');
        throw new Error('Resposta da IA não contém JSON válido');
      }
      
      // If no closing brace found, the response might be truncated
      if (jsonEnd === -1 || jsonEnd <= jsonStart) {
        console.log('JSON appears to be truncated, attempting to reconstruct');
        
        // Try to find the end of the prospects array
        const prospectsStart = cleanedContent.indexOf('"prospects"');
        if (prospectsStart !== -1) {
          // Find the array opening bracket
          const arrayStart = cleanedContent.indexOf('[', prospectsStart);
          if (arrayStart !== -1) {
            // Find the last complete prospect object
            let lastCompleteObject = arrayStart;
            let braceCount = 0;
            let inString = false;
            let escapeNext = false;
            
            for (let i = arrayStart + 1; i < cleanedContent.length; i++) {
              const char = cleanedContent[i];
              
              if (escapeNext) {
                escapeNext = false;
                continue;
              }
              
              if (char === '\\') {
                escapeNext = true;
                continue;
              }
              
              if (char === '"') {
                inString = !inString;
                continue;
              }
              
              if (!inString) {
                if (char === '{') {
                  braceCount++;
                } else if (char === '}') {
                  braceCount--;
                  if (braceCount === 0) {
                    lastCompleteObject = i;
                  }
                }
              }
            }
            
            if (lastCompleteObject > arrayStart) {
              // Reconstruct the JSON with complete objects only
              cleanedContent = '{"prospects": [' + 
                cleanedContent.substring(arrayStart + 1, lastCompleteObject + 1) + 
                ']}';
              console.log('Reconstructed JSON from truncated response');
            }
          }
        }
      } else {
        cleanedContent = cleanedContent.substring(jsonStart, jsonEnd + 1);
      }
      
      console.log('Cleaned JSON content length:', cleanedContent.length);
      
      prospectsData = JSON.parse(cleanedContent);
      console.log('Successfully parsed JSON, prospects count:', prospectsData?.prospects?.length || 0);
      
    } catch (parseError) {
      console.error('JSON parse error:', parseError.message);
      console.error('Content that failed to parse:', content.substring(0, 500) + '...');
      if (cleanedContent) {
        console.error('Cleaned content length:', cleanedContent.length);
        console.error('Cleaned content start:', cleanedContent.substring(0, 200));
        console.error('Cleaned content end:', cleanedContent.substring(-200));
      }
      
      // Try alternative parsing - extract complete objects manually
      try {
        const prospectsMatch = content.match(/"prospects"\s*:\s*\[/);
        if (prospectsMatch) {
          const startIndex = content.indexOf('"prospects"');
          const arrayStart = content.indexOf('[', startIndex);
          
          if (arrayStart !== -1) {
            // Find complete objects
            const prospectObjects = [];
            let currentPos = arrayStart + 1;
            let objectCount = 0;
            
            while (currentPos < content.length && objectCount < 15) { // Limit to 15 objects max
              // Find start of next object
              const objStart = content.indexOf('{', currentPos);
              if (objStart === -1) break;
              
              // Find end of this object
              let braceCount = 1;
              let pos = objStart + 1;
              let inString = false;
              let escaped = false;
              
              while (pos < content.length && braceCount > 0) {
                const char = content[pos];
                
                if (escaped) {
                  escaped = false;
                } else if (char === '\\') {
                  escaped = true;
                } else if (char === '"' && !escaped) {
                  inString = !inString;
                } else if (!inString) {
                  if (char === '{') braceCount++;
                  else if (char === '}') braceCount--;
                }
                pos++;
              }
              
              if (braceCount === 0) {
                const objStr = content.substring(objStart, pos);
                try {
                  const testObj = JSON.parse(objStr);
                  if (testObj.empresa) { // Validate it has required fields
                    prospectObjects.push(objStr);
                    objectCount++;
                  }
                } catch (objParseError) {
                  console.log(`Skipping malformed object at position ${objStart}`);
                }
              }
              
              currentPos = pos;
            }
            
            if (prospectObjects.length > 0) {
              const reconstructedJson = `{"prospects":[${prospectObjects.join(',')}]}`;
              prospectsData = JSON.parse(reconstructedJson);
              console.log(`Successfully reconstructed JSON with ${prospectObjects.length} prospects`);
            } else {
              throw new Error('Could not extract any valid prospect objects');
            }
          } else {
            throw new Error('Could not find prospects array start');
          }
        } else {
          throw new Error('Could not find prospects array in response');
        }
      } catch (altParseError) {
        console.error('Alternative parsing also failed:', altParseError.message);
        throw new Error('Resposta inválida da IA. A resposta não está em formato JSON válido.');
      }
    }

    if (!prospectsData.prospects || !Array.isArray(prospectsData.prospects)) {
      throw new Error('Estrutura de dados inválida da IA');
    }

    console.log('Saving to database...');
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const leadsToInsert = prospectsData.prospects.map((prospect) => ({
      user_id: userId,
      empresa: prospect.empresa,
      setor: prospect.setor,
      cnae: prospect.cnae,
      regime_tributario: prospect.regime_tributario,
      contato_decisor: prospect.contato_decisor,
      telefone: prospect.telefone,
      email: prospect.email,
      website: prospect.website,
      gancho_prospeccao: prospect.gancho_prospeccao,
      status: 'novo'
    }));

    const { data: insertedLeads, error: insertError } = await supabase.from('leads').insert(leadsToInsert).select();
    
    if (insertError) {
      console.error('Database error:', insertError);
      throw new Error(`Erro no banco de dados: ${insertError.message}`);
    }
    
    // Salvar nos contatos
    const contactsToInsert = prospectsData.prospects.map((prospect) => ({
      user_id: userId,
      nome: prospect.contato_decisor,
      empresa: prospect.empresa,
      cargo: prospect.contato_decisor.includes('(') ? prospect.contato_decisor.split('(')[1].replace(')', '') : 'Decisor',
      email: prospect.email,
      telefone: prospect.telefone,
      website: prospect.website,
      status: 'ativo'
    }));

    await supabase.from('contacts').insert(contactsToInsert);
    
    console.log('Success! Generated', insertedLeads?.length || 0, 'prospects');
    
    return new Response(JSON.stringify({
      success: true,
      message: `${prospectsData.prospects.length} prospects gerados e cadastrados com sucesso!`,
      prospects: insertedLeads
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error in generate-prospects function:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Erro interno do servidor'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});