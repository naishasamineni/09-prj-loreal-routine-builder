export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return jsonResponse(
        { error: "Method not allowed. Use POST." },
        405,
        corsHeaders
      );
    }

    try {
      const body = await request.json();
      const {
        mode,
        selectedProducts = [],
        chatHistory = [],
        enableWebSearch = false
      } = body;

      if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
        return jsonResponse(
          { error: "No selected products were provided." },
          400,
          corsHeaders
        );
      }

      if (!env.OPENAI_API_KEY) {
        return jsonResponse(
          { error: "OPENAI_API_KEY is not set in your Cloudflare Worker secrets." },
          500,
          corsHeaders
        );
      }

      const systemPrompt = buildSystemPrompt(mode, selectedProducts, enableWebSearch);
      const input = [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },
        ...chatHistory.map((message) => ({
          role: message.role,
          content: [
            {
              type: "input_text",
              text: message.content
            }
          ]
        }))
      ];

      const tools = enableWebSearch ? [{ type: "web_search" }] : [];

      const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: env.OPENAI_MODEL || "gpt-5.4",
          input,
          tools
        })
      });

      const data = await openaiResponse.json();

      if (!openaiResponse.ok) {
        const message =
          data?.error?.message || "OpenAI request failed inside the worker.";
        return jsonResponse({ error: message }, openaiResponse.status, corsHeaders);
      }

      const answer = extractAnswerText(data);
      const sources = extractSources(data);

      return jsonResponse(
        {
          answer,
          sources
        },
        200,
        corsHeaders
      );
    } catch (error) {
      return jsonResponse(
        { error: error.message || "Unexpected worker error." },
        500,
        corsHeaders
      );
    }
  }
};

function buildSystemPrompt(mode, selectedProducts, enableWebSearch) {
  const selectedProductText = selectedProducts
    .map(
      (product, index) => `
${index + 1}. ${product.name}
   Brand: ${product.brand}
   Category: ${product.category}
   Description: ${product.description}
`
    )
    .join("\n");

  return `
You are a polished and helpful L'Oréal-inspired beauty routine advisor.

Your job:
- Build routines and answer follow-up questions using ONLY the products the user selected unless the user asks for general beauty guidance.
- Stay on topic: skincare, haircare, makeup, fragrance, grooming, suncare, and the user's generated routine.
- If the user asks something unrelated, politely redirect them back to routine and beauty topics.
- Be practical, organized, and easy to understand.
- Do not claim to be a dermatologist or doctor.
- Do not invent products that were not selected unless the user asks for a general recommendation.
- When the user selected multiple products, explain a sensible order of use.
- Mention morning vs night when relevant.
- Mention sunscreen in daytime routines when appropriate.
- If multiple actives could conflict, mention caution in a simple way.
- Keep the response helpful, specific, and grounded in the selected products.
- Use bullet-style formatting only when it makes the routine easier to follow.
- If web search is enabled and you use current web info, include short source-aware guidance in the answer.

Current mode: ${mode}
Web search enabled: ${enableWebSearch ? "yes" : "no"}

Selected products:
${selectedProductText}

If mode is "routine":
- Create a personalized routine using the selected products.
- Organize the answer clearly.
- Explain the purpose of each product.
- Include a simple morning and/or night routine when relevant.
- End by inviting the user to ask follow-up questions.

If mode is "followup":
- Continue the conversation naturally using the earlier routine and full chat history.
- Answer the user's newest question directly.
- Keep the answer connected to the selected products and prior routine.
`;
}

function extractAnswerText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  if (!Array.isArray(data.output)) {
    return "I generated a response, but I could not read the text output clearly.";
  }

  const textParts = [];

  for (const item of data.output) {
    if (!Array.isArray(item.content)) continue;

    for (const contentItem of item.content) {
      if (contentItem.type === "output_text" && contentItem.text) {
        textParts.push(contentItem.text);
      }
    }
  }

  return textParts.join("\n\n").trim() || "No response text was returned.";
}

function extractSources(data) {
  const sources = [];

  if (!Array.isArray(data.output)) {
    return sources;
  }

  for (const item of data.output) {
    if (!Array.isArray(item.content)) continue;

    for (const contentItem of item.content) {
      if (
        contentItem.type === "output_text" &&
        Array.isArray(contentItem.annotations)
      ) {
        for (const annotation of contentItem.annotations) {
          if (annotation.type === "url_citation" && annotation.url) {
            sources.push({
              title: annotation.title || annotation.url,
              url: annotation.url
            });
          }
        }
      }
    }
  }

  return sources;
}

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
}