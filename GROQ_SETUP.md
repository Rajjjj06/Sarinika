# Groq AI Setup Guide

This project uses Groq AI to power empathetic, CBT-based conversations in the chat feature.

## Getting Your Groq API Key

1. Visit [console.groq.com](https://console.groq.com)
2. Sign up for a free account or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy your API key

## Environment Configuration

Add your Groq API key to `.env.local`:

```bash
GROQ_API_KEY=your_actual_api_key_here
```

## Features

The chat implementation includes:

- **Empathetic AI Responses**: Using Llama 3.3 70B model for natural, understanding conversations
- **CBT-Based Techniques**: Helps users reframe negative thoughts using Cognitive Behavioral Therapy principles
- **Safety First**: Includes safety guidelines for crisis situations
- **Streaming Responses**: Real-time streaming for smooth user experience

## How It Works

1. User sends a message in the chat interface
2. The message is sent to `/api/chat` endpoint
3. Groq AI processes the message with CBT-trained prompts
4. Response streams back in real-time
5. User sees empathetic, evidence-based support

## Important Notes

- Always use empathetic, supportive language
- Never provide medical diagnoses
- Encourage professional help for serious mental health concerns
- Maintain conversation context throughout the session
- Use evidence-based CBT techniques like:
  - Thought records
  - Behavioral activation
  - Cognitive restructuring
  - Mindfulness techniques

## Testing

To test the integration:

1. Start the development server: `npm run dev`
2. Navigate to `/chat`
3. Send a test message
4. Verify you receive empathetic responses

## Troubleshooting

If you encounter issues:

1. Verify your API key is correctly set in `.env.local`
2. Check that the `groq-sdk` package is installed
3. Ensure your Next.js server is restarted after environment changes
4. Check browser console for any errors
5. Verify network connectivity to Groq API

## Cost Considerations

Groq offers free tier usage. Monitor your usage at [console.groq.com](https://console.groq.com) to track API calls and costs.

