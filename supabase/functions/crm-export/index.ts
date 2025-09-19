import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
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
    const { leadId, crmType } = await req.json();

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get lead data
    const { data: lead, error } = await supabase
      .from("leads")
      .select("*")
      .eq("id", leadId)
      .single();

    if (error || !lead) {
      throw new Error("Lead não encontrado");
    }

    // Export to CRM based on type
    if (crmType === "pipedrive") {
      // Example Pipedrive API call
      const PIPEDRIVE_API_KEY = Deno.env.get("PIPEDRIVE_API_KEY");
      const response = await fetch("https://api.pipedrive.com/v1/persons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PIPEDRIVE_API_KEY}`,
        },
        body: JSON.stringify({
          name: lead.empresa,
          email: lead.email || "",
          phone: lead.telefone || "",
          org_name: lead.empresa,
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao exportar para Pipedrive");
      }
    } else if (crmType === "hubspot") {
      // Example HubSpot API call
      const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
      const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${HUBSPOT_API_KEY}`,
        },
        body: JSON.stringify({
          properties: {
            company: lead.empresa,
            email: lead.email || "",
            phone: lead.telefone || "",
            notes: `Lead qualificado via Leados AI. Score: ${lead.qualification_score || 'N/A'}`,
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Erro ao exportar para HubSpot");
      }
    }

    return new Response(JSON.stringify({ success: true }), {
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