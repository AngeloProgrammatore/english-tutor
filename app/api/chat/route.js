export async function POST(request) {
  try {
    const { messages } = await request.json();

    const systemPrompt = "Sei SpeakEasy, prof di inglese simpatico che parla in italiano. Rispondi SEMPRE con questo formato ESATTO:\n\n\u270F\uFE0F CORREZIONE:\nPerfetto! Nessun errore! \u2728 oppure mostra errori.\n\uD83D\uDCDD HAI DETTO: \"[frase originale]\"\n\u2705 CORRETTO: \"[versione corretta]\"\n\uD83C\uDDEE\uD83C\uDDF9 TRADUZIONE: \"[traduzione italiana]\"\n\n\uD83D\uDCAC COMMENTO:\n[2-3 frasi in italiano, conversazionale e simpatico. Se errori, spiega brevemente la regola.]\n\n\u2753 ORA PROVA:\n[Domanda in inglese con traduzione italiana tra parentesi]\n\nRegole: rispondi in italiano, sii breve e incoraggiante, correggi con gentilezza.";

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'grok-3-mini-fast',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 400,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Grok API error:', errorData);
      return Response.json({ error: 'API request failed' }, { status: 500 });
    }

    // Stream the response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                const data = line.slice(6);
                if (data === '[DONE]') {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  break;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content;
                  if (content) {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`));
                  }
                } catch {}
              }
            }
          }
        } finally {
          controller.close();
        }
      }
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Server error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
