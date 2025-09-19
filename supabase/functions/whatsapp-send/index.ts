import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_TOKEN")!;
const PHONE_NUMBER_ID = Deno.env.get("PHONE_NUMBER_ID")!;

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
    const { to, message } = await req.json();

    const response = await fetch(`https://graph.facebook.com/v18.0/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: { name: "lead_qualificado", language: { code: "pt_BR" } }
      }),
    });

    const result = await response.json();

    if (response.ok) {
      return new Response(JSON.stringify({ success: true, result }), {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info, x-supabase-auth"
        },
        status: 200,
      });
    } else {
      throw new Error(result.error?.message || 'WhatsApp API error');
    }
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