import { consumeStream, convertToModelMessages, streamText, type UIMessage } from "ai"

export const maxDuration = 30

const CBT_SYSTEM_PROMPT = `You are Sarinika, an empathetic AI mental health companion trained in Cognitive Behavioral Therapy (CBT) principles. Your role is to help users reframe negative thoughts and develop healthier thinking patterns.

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
- Use gentle, conversational language`

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json()

  const prompt = convertToModelMessages(messages)

  const result = streamText({
    model: "openai/gpt-4-mini",
    system: CBT_SYSTEM_PROMPT,
    messages: prompt,
    abortSignal: req.signal,
    temperature: 0.7,
    maxOutputTokens: 1000,
  })

  return result.toUIMessageStreamResponse({
    onFinish: async ({ isAborted }) => {
      if (isAborted) {
        console.log("[v0] Chat stream aborted")
      }
    },
    consumeSseStream: consumeStream,
  })
}
