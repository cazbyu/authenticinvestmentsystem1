import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface BatchResult {
  processed: number;
  successful: number;
  failed: string[];
  totalReflections: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!openaiApiKey) {
      console.error('OPENAI_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { createClient } = await import('npm:@supabase/supabase-js@2');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Starting batch title generation for user:', user.id);

    // Fetch all reflections without titles for this user
    const { data: reflections, error: fetchError } = await supabase
      .from('0008-ap-reflections')
      .select('id, content')
      .eq('user_id', user.id)
      .is('reflection_title', null)
      .eq('archived', false)
      .order('created_at', { ascending: false })
      .limit(100); // Process max 100 at a time

    if (fetchError) {
      console.error('Error fetching reflections:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch reflections' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!reflections || reflections.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No reflections without titles found',
          processed: 0,
          successful: 0,
          failed: [],
          totalReflections: 0,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log(`Found ${reflections.length} reflections to process`);

    const result: BatchResult = {
      processed: 0,
      successful: 0,
      failed: [],
      totalReflections: reflections.length,
    };

    // Process in batches of 10 to avoid overwhelming the API
    const BATCH_SIZE = 10;

    for (let i = 0; i < reflections.length; i += BATCH_SIZE) {
      const batch = reflections.slice(i, i + BATCH_SIZE);

      for (const reflection of batch) {
        try {
          result.processed++;

          const truncatedContent = reflection.content.slice(0, 2000);

          // Call OpenAI API
          const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${openaiApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: 'You are a helpful assistant that creates concise, meaningful titles for daily reflections. Generate titles that capture the essence or main theme of the reflection in 60 characters or less. Be specific and descriptive. Do not use quotes around the title.'
                },
                {
                  role: 'user',
                  content: `Generate a short, meaningful title (max 60 characters) for this reflection:\n\n${truncatedContent}`
                }
              ],
              max_tokens: 20,
              temperature: 0.7,
            }),
          });

          if (!openaiResponse.ok) {
            console.error(`OpenAI API error for reflection ${reflection.id}:`, openaiResponse.status);
            result.failed.push(reflection.id);
            continue;
          }

          const openaiData = await openaiResponse.json();
          const generatedTitle = openaiData.choices?.[0]?.message?.content?.trim() || null;

          if (!generatedTitle) {
            console.error(`No title generated for reflection ${reflection.id}`);
            result.failed.push(reflection.id);
            continue;
          }

          // Update the reflection
          const { error: updateError } = await supabase
            .from('0008-ap-reflections')
            .update({
              reflection_title: generatedTitle,
              title_generated_at: new Date().toISOString(),
              title_generation_method: 'ai',
            })
            .eq('id', reflection.id);

          if (updateError) {
            console.error(`Failed to update reflection ${reflection.id}:`, updateError);
            result.failed.push(reflection.id);
            continue;
          }

          result.successful++;
          console.log(`Generated title for reflection ${reflection.id}: "${generatedTitle}"`);

        } catch (error) {
          console.error(`Error processing reflection ${reflection.id}:`, error);
          result.failed.push(reflection.id);
        }
      }

      // Add delay between batches to respect rate limits
      if (i + BATCH_SIZE < reflections.length) {
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    console.log('Batch processing complete:', result);

    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Fatal error in batch-generate-titles:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        message: String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});