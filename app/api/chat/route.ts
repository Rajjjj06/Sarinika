import { Groq } from "groq-sdk";

export const maxDuration = 30;

const CBT_SYSTEM_PROMPT = `You are Serenica, an empathetic AI mental health companion trained in Cognitive Behavioral Therapy (CBT) principles. Your role is to help users reframe negative thoughts and develop healthier thinking patterns.

Core principles:
1. Be warm, supportive, and non-judgmental
2. Help users identify cognitive distortions (catastrophizing, black-and-white thinking, overgeneralization, etc.)
3. Guide users through evidence-based CBT techniques like thought records and behavioral activation
4. Ask clarifying questions to understand the user's situation better
5. Provide practical, actionable suggestions
6. Remind users that you're not a substitute for professional medical advice
7. Maintain a safe, confidential tone

When responding:
- Validate their feelings first
- Help them examine the evidence for and against their thoughts
- Suggest alternative, more balanced perspectives
- Encourage small, manageable behavioral changes
- Use gentle, conversational language

Important safety guidelines:
- If a user expresses self-harm or suicide thoughts, respond with compassion and encourage them to seek immediate professional help
- Maintain appropriate boundaries and professional tone
- Never diagnose or provide medical advice`;

export async function POST(req: Request) {
  try {
    const { messages } = await req.json();

    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    // Initialize Groq client
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Prepare Groq messages
    const groqMessages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [];

    // Add CBT system prompt first
    groqMessages.push({
      role: "system",
      content: CBT_SYSTEM_PROMPT,
    });

    // Convert user/assistant messages from request
    for (const msg of messages) {
      const content = msg.content;
      const role = msg.role as "user" | "assistant";
      
      if (content && role) {
        groqMessages.push({ role, content });
      }
    }


    // Create chat completion with improved params
    const chatCompletion = await groq.chat.completions.create({
      messages: groqMessages,
      model: "llama-3.3-70b-versatile",
      temperature: 0.9,
      max_completion_tokens: 8192,
      top_p: 1,
      stream: true,
    });

    // Stream Groq response back in real-time
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of chatCompletion) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              // Send plain text chunks
              controller.enqueue(encoder.encode(content));
            }
          }
          controller.close();
        } catch (error) {
          console.error("Streaming error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to process chat request",
        details: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
