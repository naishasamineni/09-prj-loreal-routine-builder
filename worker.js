export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method === "GET") {
      return new Response(
        JSON.stringify({ error: "Use POST requests only." }),
        { status: 405, headers: corsHeaders },
      );
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed." }), {
        status: 405,
        headers: corsHeaders,
      });
    }

    try {
      const apiKey = env.OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(
          JSON.stringify({ error: "Missing OPENAI_API_KEY secret." }),
          { status: 500, headers: corsHeaders },
        );
      }

      const apiUrl = "https://api.openai.com/v1/chat/completions";
      const userInput = await request.json();

      const {
        mode = "routine",
        selectedProducts = [],
        chatHistory = [],
      } = userInput;

      if (!Array.isArray(selectedProducts) || selectedProducts.length === 0) {
        return new Response(
          JSON.stringify({ error: "No selected products were provided." }),
          { status: 400, headers: corsHeaders },
        );
      }

      const productText = selectedProducts
        .map(
          (product, index) =>
            `${index + 1}. ${product.name}
Brand: ${product.brand}
Category: ${product.category}
Description: ${product.description}`,
        )
        .join("\n\n");

      let userPrompt = "";

      if (mode === "routine") {
        userPrompt =
          `Create a personalized beauty routine using these selected products:\n\n${productText}\n\n` +
          `Explain the order clearly and keep it simple.`;
      } else {
        const lastUserMessage =
          Array.isArray(chatHistory) && chatHistory.length > 0
            ? chatHistory[chatHistory.length - 1].content
            : "Answer the user's follow-up beauty question.";

        userPrompt =
          `These are the selected products:\n\n${productText}\n\n` +
          `User question: ${lastUserMessage}`;
      }

      const requestBody = {
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful beauty routine advisor. Stay focused on skincare, haircare, makeup, fragrance, grooming, and the user's selected products. Be clear, organized, and practical.",
          },
          ...chatHistory,
          {
            role: "user",
            content: userPrompt,
          },
        ],
        max_tokens: 800,
        temperature: 0.5,
        frequency_penalty: 0.8,
      };

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({
            error: data?.error?.message || "OpenAI request failed.",
          }),
          { status: response.status, headers: corsHeaders },
        );
      }

      const answer =
        data?.choices?.[0]?.message?.content || "No response was returned.";

      return new Response(
        JSON.stringify({
          answer,
          sources: [],
        }),
        { headers: corsHeaders },
      );
    } catch (error) {
      return new Response(
        JSON.stringify({
          error: error.message || "Worker crashed.",
        }),
        { status: 500, headers: corsHeaders },
      );
    }
  },
};
