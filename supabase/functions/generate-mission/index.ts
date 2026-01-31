import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

serve(async (req) => {
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
    const { responses, domain = 'mission' } = await req.json()

    // Validate we have responses
    if (!responses || responses.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No responses provided',
        suggestions: [],
        detected_roles: [],
        detected_wellness_zones: []
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    const formattedResponses = responses
      .map((r: any, i: number) => `Q${i + 1}: ${r.questionText}\nA: "${r.response}"`)
      .join('\n\n')

    const isVision = domain === 'vision'
    const statementType = isVision ? 'vision statement' : 'mission statement'
    const statementStart = isVision ? 'In 5 years' : 'To'

    const prompt = `You are helping someone discover their personal ${statementType}. Based on their responses to reflective questions, you will:

1. Generate 3 unique, personalized ${statementType} suggestions
2. Detect which life roles are most relevant to them
3. Detect which wellness zones their answers touch on

Their responses:
${formattedResponses}

AVAILABLE ROLES (only use these exact names):
Family: Wife, Husband, Partner, Spouse, Mother, Father, Daughter, Son, Grandmother, Grandfather, Sister, Brother, Aunt, Uncle, Great Grandmother, Great Grandfather
Home & Stewardship: Homeowner, Steward, Pet Parent
Professional: Business Owner, Leader, Manager, Employee, Consultant, Creator, Mentor, Coach, Student
Caregiving: Caregiver
Community: Neighbor, Friend, Volunteer, Service Club Member, Church Member, Citizen, Philanthropist
Recreation & Hobbies: Athlete, Team Captain, Adventurer, Explorer, Artist/Creator, Musician, Performer, Hobbyist, Club Member, Learner

AVAILABLE WELLNESS ZONES (only use these exact names):
Physical, Emotional, Intellectual, Social, Spiritual, Financial, Recreational, Community

Guidelines for ${statementType}s:
- Each should be 1-2 sentences, starting with "${statementStart}..."
- Reflect their specific passions, values, and goals mentioned in their answers
- Use their own language and themes where possible
- Make each suggestion distinct in focus
- Be inspiring but authentic - avoid generic corporate language

Guidelines for detection:
- Only include roles that are clearly implied or stated in their answers
- Only include wellness zones that are meaningfully addressed
- Be selective - quality over quantity

Respond with ONLY valid JSON in this exact format, no markdown, no backticks:
{
  "suggestions": ["${statementStart}...", "${statementStart}...", "${statementStart}..."],
  "detected_roles": ["Role1", "Role2"],
  "detected_wellness_zones": ["Zone1", "Zone2"]
}`

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      console.error('Anthropic API error:', response.status, response.statusText)
      throw new Error(`API returned ${response.status}`)
    }

    const data = await response.json()
    const content = data.content[0].text

    // Clean potential markdown formatting
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const result = JSON.parse(cleanedContent)

    // Validate structure and provide defaults
    const safeResult = {
      suggestions: Array.isArray(result.suggestions) ? result.suggestions : [],
      detected_roles: Array.isArray(result.detected_roles) ? result.detected_roles : [],
      detected_wellness_zones: Array.isArray(result.detected_wellness_zones) ? result.detected_wellness_zones : [],
    }

    return new Response(JSON.stringify(safeResult), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ 
      error: 'Failed to generate suggestions',
      suggestions: [],
      detected_roles: [],
      detected_wellness_zones: []
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})