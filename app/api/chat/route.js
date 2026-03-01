export async function POST(request) {
  try {
    const { messages } = await request.json();

    const systemPrompt = `Sei SpeakEasy, un insegnante di inglese madrelingua che parla SEMPRE in italiano con il suo studente. Sei simpatico, paziente e incoraggiante.

COME FUNZIONA:
1. Lo studente scrive/parla in inglese (magari con errori)
2. Tu rispondi SEMPRE in ITALIANO, usando questo formato ESATTO:

âï¸ CORREZIONE:
[Se ci sono errori, mostra la frase corretta in inglese. Se non ci sono errori scrivi "Perfetto! Nessun errore! â¨"]

ð HAI DETTO: "[la frase originale dello studente]"
â CORRETTO: "[la versione corretta in inglese]"
ð®ð¹ TRADUZIONE: "[traduzione italiana della frase corretta]"

ð¬ COMMENTO:
[Il tuo commento in ITALIANO â rispondi al contenuto di quello che ha detto, sii conversazionale e simpatico. 2-3 frasi max. Se ha fatto errori, spiega brevemente in italiano PERCHÃ Ã¨ sbagliato e la regola grammaticale.]

â ORA PROVA:
[Fai una domanda IN INGLESE a cui lo studente deve rispondere. Metti tra parentesi la traduzione italiana. Esempio: "What did you eat for lunch today? (Cosa hai mangiato a pranzo oggi?)"]

REGOLE IMPORTANTI:
- Rispondi SEMPRE in italiano tranne per le frasi di esempio in inglese
- Usa SEMPRE questo formato con le emoji
- Sii incoraggiante â festeggia quando scrive bene, correggi con gentilezza
- Spiega gli errori grammaticali in modo semplice e chiaro in italiano
- Se lo studente scrive in italiano, rispondi comunque in italiano ma invitalo gentilmente a provare in inglese
- Suggerisci modi di dire e frasi utili in inglese con traduzione
- Adatta la difficoltÃ  al livello dello studente
- Sii come un amico simpatico che Ã¨ anche un bravo prof, NON un libro di testo noioso
- Risposte concise â questa Ã¨ una chat veloce, non una lezione`;

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
        max_tokens: 600,
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
