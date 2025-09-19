import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RECEITA_WS_URL = "https://www.receitaws.com.br/v1/cnpj/";

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
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
    const { userId } = await req.json();
    console.log('Starting campaign lead generation for user:', userId);

    if (!userId) {
      throw new Error("UserId é obrigatório");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Load campaign criteria from knowledge base
    const campaignCriteria = await loadCampaignCriteria();
    console.log('Loaded campaign criteria:', campaignCriteria);

    // Discover companies through webscraping/simulation
    const discoveredCompanies = await discoverCompanies(campaignCriteria);
    console.log(`Discovered ${discoveredCompanies.length} potential companies`);

    // Filter and validate companies
    const validCompanies = await filterValidCompanies(discoveredCompanies, campaignCriteria);
    console.log(`Filtered to ${validCompanies.length} valid companies`);

    // Process companies in batches with rate limiting
    const results = [];
    const batchSize = 5; // Process 5 companies at a time
    const delayBetweenBatches = 2000; // 2 seconds between batches

    for (let i = 0; i < validCompanies.length; i += batchSize) {
      const batch = validCompanies.slice(i, i + batchSize);
      console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validCompanies.length / batchSize)}`);

      const batchPromises = batch.map(async (company) => {
        try {
          console.log(`Processing company: ${company.name} (${company.cnpj || company.domain})`);

          // Call generate-lead for each company
          const leadResult = await generateLeadForCompany(company, userId);

          return {
            company: company.name,
            cnpj: company.cnpj,
            domain: company.domain,
            status: 'success',
            leadId: leadResult?.id,
            qualificationScore: leadResult?.qualification_score,
            message: 'Lead qualificado com sucesso'
          };
        } catch (error) {
          console.error(`Error processing company ${company.name}:`, error);
          return {
            company: company.name,
            cnpj: company.cnpj,
            domain: company.domain,
            status: 'error',
            message: error instanceof Error ? error.message : 'Erro desconhecido'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Rate limiting delay between batches
      if (i + batchSize < validCompanies.length) {
        console.log(`Waiting ${delayBetweenBatches}ms before next batch...`);
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`Campaign completed: ${successCount} successes, ${errorCount} errors`);

    return new Response(JSON.stringify({
      success: true,
      totalProcessed: results.length,
      successCount,
      errorCount,
      results
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-auth"
      },
      status: 200,
    });

  } catch (error) {
    console.error('Error in generate-campaign-leads:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno do servidor'
    }), {
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

// Load campaign criteria from knowledge base
async function loadCampaignCriteria() {
  return {
    sectors: [
      'Agroindústria', 'Logística e Transportes', 'Construção Civil',
      'Energia e Utilities', 'Saúde e Farmacêutica', 'Tecnologia e E-commerce',
      'Atacado e Distribuição'
    ],
    minRevenue: 30000000, // R$ 30M
    excludeMEI: true,
    targetRegions: ['GO', 'SP', 'MG', 'RJ', 'RS'], // Focus on major states
    complexTaxRegimes: ['Lucro Real'], // Prefer companies with complex tax situations
    cnaePrefixes: ['01', '05', '41', '42', '43', '35', '86', '47', '49', '52'] // Relevant CNAE codes
  };
}

// Discover companies through multiple sources
async function discoverCompanies(criteria: any) {
  console.log('Starting company discovery process...');

  const allCompanies = [];

  try {
    // 1. Scrape business directories
    console.log('Scraping business directories...');
    const directoryCompanies = await scrapeBusinessDirectories(criteria);
    allCompanies.push(...directoryCompanies);

    // 2. Search company registries
    console.log('Searching company registries...');
    const registryCompanies = await searchCompanyRegistries(criteria);
    allCompanies.push(...registryCompanies);

    // 3. Monitor news and announcements
    console.log('Monitoring business news...');
    const newsCompanies = await monitorBusinessNews(criteria);
    allCompanies.push(...newsCompanies);

    // 4. Cross-reference with existing databases
    console.log('Cross-referencing with business databases...');
    const databaseCompanies = await searchBusinessDatabases(criteria);
    allCompanies.push(...databaseCompanies);

    // Remove duplicates based on CNPJ or domain
    const uniqueCompanies = removeDuplicates(allCompanies);
    console.log(`Found ${uniqueCompanies.length} unique companies after deduplication`);

    return uniqueCompanies;

  } catch (error) {
    console.error('Error during company discovery:', error);
    // Return sample companies as fallback
    return getFallbackCompanies(criteria);
  }
}

// Scrape business directories (simulated)
async function scrapeBusinessDirectories(criteria: any) {
  // In production, this would use services like:
  // - Google Business Profile API
  // - Yellow Pages scraping
  // - Industry-specific directories
  // - LinkedIn company search

  console.log('Simulating business directory scraping...');

  const companies = [
    {
      name: 'Agropecuária São Francisco Ltda',
      cnpj: '12345678000123',
      domain: 'agrofrancisco.com.br',
      sector: 'Agroindústria',
      revenue: 45000000,
      state: 'GO',
      cnae: '0151-2/00',
      regime: 'Lucro Real',
      source: 'business_directory'
    },
    {
      name: 'Transportes Rápidos S.A.',
      cnpj: '23456789000134',
      domain: 'transportesrapidos.com.br',
      sector: 'Logística e Transportes',
      revenue: 52000000,
      state: 'SP',
      cnae: '4930-2/01',
      regime: 'Lucro Real',
      source: 'business_directory'
    }
  ];

  await new Promise(resolve => setTimeout(resolve, 500));
  return companies;
}

// Search company registries (simulated)
async function searchCompanyRegistries(criteria: any) {
  // In production, this would query:
  // - Receita Federal database
  // - State commercial boards (Junta Comercial)
  // - Company registration APIs

  console.log('Simulating company registry search...');

  const companies = [
    {
      name: 'Construtora Moderna Ltda',
      cnpj: '34567890000145',
      domain: 'construtoramoderna.com.br',
      sector: 'Construção Civil',
      revenue: 38000000,
      state: 'MG',
      cnae: '4120-4/00',
      regime: 'Lucro Presumido',
      source: 'company_registry'
    },
    {
      name: 'Farmácia Central S.A.',
      cnpj: '45678901000156',
      domain: 'farmaciacentral.com.br',
      sector: 'Saúde e Farmacêutica',
      revenue: 65000000,
      state: 'RJ',
      cnae: '4771-7/01',
      regime: 'Lucro Real',
      source: 'company_registry'
    }
  ];

  await new Promise(resolve => setTimeout(resolve, 800));
  return companies;
}

// Monitor business news (simulated)
async function monitorBusinessNews(criteria: any) {
  // In production, this would monitor:
  // - Business news APIs (NewsAPI, Google News)
  // - Industry publications
  // - Company announcement RSS feeds
  // - Regulatory filings

  console.log('Simulating business news monitoring...');

  const companies = [
    {
      name: 'Tech Solutions Ltda',
      cnpj: '56789012000167',
      domain: 'techsolutions.com.br',
      sector: 'Tecnologia e E-commerce',
      revenue: 42000000,
      state: 'SP',
      cnae: '6201-5/00',
      regime: 'Lucro Real',
      source: 'business_news',
      newsTrigger: 'Anúncio de expansão tecnológica'
    },
    {
      name: 'Energia Verde S.A.',
      cnpj: '67890123000178',
      domain: 'energiaverde.com.br',
      sector: 'Energia e Utilities',
      revenue: 78000000,
      state: 'RS',
      cnae: '3511-5/00',
      regime: 'Lucro Real',
      source: 'business_news',
      newsTrigger: 'Investimento em energia renovável'
    }
  ];

  await new Promise(resolve => setTimeout(resolve, 600));
  return companies;
}

// Search business databases (simulated)
async function searchBusinessDatabases(criteria: any) {
  // In production, this would query:
  // - Business intelligence databases
  // - Credit rating agencies
  // - Industry association databases
  // - Government business statistics

  console.log('Simulating business database search...');

  const companies = [
    {
      name: 'Distribuidora Nacional Ltda',
      cnpj: '78901234000189',
      domain: 'distribuidoranacional.com.br',
      sector: 'Atacado e Distribuição',
      revenue: 95000000,
      state: 'GO',
      cnae: '4681-8/00',
      regime: 'Lucro Real',
      source: 'business_database'
    }
  ];

  await new Promise(resolve => setTimeout(resolve, 400));
  return companies;
}

// Remove duplicate companies
function removeDuplicates(companies: any[]) {
  const seen = new Set();
  return companies.filter(company => {
    const key = company.cnpj || company.domain;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

// Fallback companies in case of discovery failure
function getFallbackCompanies(criteria: any) {
  console.log('Using fallback company data...');

  return [
    {
      name: 'Empresa Fallback Ltda',
      cnpj: '99999999000199',
      domain: 'fallback.com.br',
      sector: criteria.sectors[0],
      revenue: criteria.minRevenue + 1000000,
      state: criteria.targetRegions[0],
      cnae: criteria.cnaePrefixes[0] + '00-0/00',
      regime: 'Lucro Real',
      source: 'fallback'
    }
  ];
}

// Filter companies based on campaign criteria
async function filterValidCompanies(companies: any[], criteria: any) {
  console.log('Filtering companies by criteria...');

  return companies.filter(company => {
    // Revenue check
    if (company.revenue < criteria.minRevenue) {
      console.log(`Excluding ${company.name}: revenue too low (${company.revenue})`);
      return false;
    }

    // Sector check
    if (!criteria.sectors.some((sector: string) =>
      company.sector.toLowerCase().includes(sector.toLowerCase().split(' ')[0])
    )) {
      console.log(`Excluding ${company.name}: sector not targeted (${company.sector})`);
      return false;
    }

    // Exclude MEI (would check company type in real implementation)
    if (criteria.excludeMEI && company.name.toLowerCase().includes('mei')) {
      console.log(`Excluding ${company.name}: MEI company`);
      return false;
    }

    // Region check
    if (!criteria.targetRegions.includes(company.state)) {
      console.log(`Excluding ${company.name}: region not targeted (${company.state})`);
      return false;
    }

    // CNAE check
    const cnaePrefix = company.cnae.split('-')[0];
    if (!criteria.cnaePrefixes.some((prefix: string) => cnaePrefix.startsWith(prefix))) {
      console.log(`Excluding ${company.name}: CNAE not relevant (${company.cnae})`);
      return false;
    }

    console.log(`Including ${company.name}: matches all criteria`);
    return true;
  });
}

// Generate lead for individual company
async function generateLeadForCompany(company: any, userId: string) {
  console.log(`Generating lead for ${company.name}...`);

  // Call the existing generate-lead function
  const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-lead`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
    },
    body: JSON.stringify({
      cnpj: company.cnpj,
      userId: userId
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to generate lead: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  return result;
}