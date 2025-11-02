import { Groq } from "groq-sdk";

export const maxDuration = 30;

const JOURNAL_ANALYSIS_PROMPT = `You are an AI assistant specialized in analyzing journal entries to understand a user's emotional and mental state.

Your task is to analyze the journal entry text and determine:
1. The PRIMARY EMOTION from this list: Happy, Calm, Anxious, Sad, Thoughtful, Energetic
2. The MENTAL STATE - a brief descriptive phrase (2-4 words) summarizing their overall mental state

Guidelines:
- Choose the emotion that best represents the dominant feeling expressed in the entry
- If multiple emotions are present, choose the most prominent one
- The mental state should be concise and capture the overall psychological state (e.g., "Stressed but hopeful", "Content and peaceful", "Overwhelmed and uncertain")
- Be sensitive and accurate in your analysis
- Return ONLY a valid JSON object with this exact structure:
{
  "emotion": "one of: Happy, Calm, Anxious, Sad, Thoughtful, Energetic",
  "mentalState": "brief descriptive phrase"
}

Do not include any additional text, explanations, or formatting outside the JSON object.`;

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    if (!content || typeof content !== "string") {
      return new Response(
        JSON.stringify({ error: "Content is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    if (!process.env.GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    // Initialize Groq client
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Create chat completion with analysis prompt
    const chatCompletion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: JOURNAL_ANALYSIS_PROMPT,
        },
        {
          role: "user",
          content: `Analyze this journal entry:\n\n${content}`,
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3, // Lower temperature for more consistent analysis
      max_completion_tokens: 200,
    });

    const responseContent = chatCompletion.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error("No response from AI");
    }

    // Parse the JSON response
    let analysisResult;
    try {
      analysisResult = JSON.parse(responseContent);
    } catch (parseError) {
      // If parsing fails, try to extract JSON from the response
      const jsonMatch = responseContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Invalid JSON response from AI");
      }
    }

    // Validate the response structure
    const validEmotions = ["Happy", "Calm", "Anxious", "Sad", "Thoughtful", "Energetic"];
    if (!analysisResult.emotion || !validEmotions.includes(analysisResult.emotion)) {
      // Default to "Thoughtful" if emotion is invalid
      analysisResult.emotion = "Thoughtful";
    }

    if (!analysisResult.mentalState || typeof analysisResult.mentalState !== "string") {
      analysisResult.mentalState = "Reflective";
    }

    return new Response(
      JSON.stringify({
        emotion: analysisResult.emotion,
        mentalState: analysisResult.mentalState,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Journal analysis API error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to analyze journal entry",
        details: error instanceof Error ? error.message : "Unknown error",
        // Provide default values on error
        emotion: "Thoughtful",
        mentalState: "Reflective",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

