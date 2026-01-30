import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { responses } = await req.json()

    // Format responses for the prompt
    const formattedResponses = responses
      .map((r: any, i: number) => `Q${i + 1}: ${r.questionText}\nA: "${r.response}"`)
      .join('\n\n')

    const prompt = `You are helping someone discover their personal mission statement. Based on their responses to reflective questions, generate 3 unique, personalized mission statement suggestions.

Their responses:
${formattedResponses}

Guidelines:
- Each mission should be 1-2 sentences, starting with "To..."
- Reflect their specific passions, values, and goals mentioned in their answers
- Use their own language and themes where possible
- Make each suggestion distinct in focus (e.g., one about impact, one about how they work, one about who they serve)
- Be inspiring but authentic - avoid generic corporate language

Respond with ONLY a JSON array of 3 strings, no explanation:
["To...", "To...", "To..."]`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    })

    const data = await response.json()
    const content = data.content[0].text

    // Parse the JSON array from the response
    const suggestions = JSON.parse(content)

    return new Response(JSON.stringify({ suggestions }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Failed to generate suggestions' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})