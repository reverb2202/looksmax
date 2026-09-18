// api/assistant.js
// Endpoint serverless (Vercel) usando a Gemini Interactions API.
// Requer a variável de ambiente GEMINI_API_KEY.

const SYSTEM_PROMPT =
  'Você é o assistente do app looksmax, um app pessoal de rotina de ' +
  'autocuidado e melhoria física (skincare, treino, suplementação básica, ' +
  'postura, sono, grooming). Responda em português, de forma curta, direta ' +
  'e prática. Use o contexto da rotina do usuário (enviado abaixo) para dar ' +
  'respostas específicas em vez de genéricas.';

const MODEL = 'gemini-3.6-flash';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    res.status(500).json({
      error: 'GEMINI_API_KEY não configurada no servidor.'
    });
    return;
  }

  try {
    const body = req.body || {};

    const message = body.message;
    const context = body.context;
    const history = body.history;

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Mensagem inválida.'
      });
      return;
    }

    // Monta o histórico da conversa.
    const historyParts = [];

    if (Array.isArray(history)) {
      history.slice(-10).forEach((h) => {
        if (
          h &&
          (h.role === 'user' || h.role === 'assistant') &&
          typeof h.content === 'string'
        ) {
          historyParts.push({
            type: h.role === 'assistant'
              ? 'model_output'
              : 'user_input',
            content: h.content
          });
        }
      });
    }

    // Monta a mensagem atual.
    const pieces = [];

    if (context) {
      pieces.push(
        'Contexto da rotina do usuário hoje:\n' + context
      );
    }

    pieces.push('Pergunta: ' + message);

    historyParts.push({
      type: 'user_input',
      content: pieces.join('\n\n')
    });

    const apiResponse = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/interactions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify({
          model: MODEL,
          system_instruction: SYSTEM_PROMPT,
          input: historyParts,
          tools: [
            {
              type: 'google_search'
            }
          ]
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Erro da API Gemini:', data);

      const msg =
        data &&
        data.error &&
        data.error.message
          ? data.error.message
          : 'Erro ao consultar a API do Gemini.';

      res.status(502).json({
        error: msg
      });

      return;
    }

    // A Interactions API retorna a resposta final em steps.
    let reply = '';

    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (
          step &&
          step.type === 'model_output' &&
          Array.isArray(step.content)
        ) {
          for (const content of step.content) {
            if (
              content &&
              content.type === 'text' &&
              typeof content.text === 'string'
            ) {
              reply += content.text;
            }
          }
        }
      }
    }

    // Algumas respostas também podem disponibilizar output_text.
    if (!reply && typeof data.output_text === 'string') {
      reply = data.output_text;
    }

    reply = reply.trim();

    res.status(200).json({
      reply: reply || 'Sem resposta.'
    });

  } catch (err) {
    console.error('Erro no assistente:', err);

    res.status(500).json({
      error: 'Erro interno ao consultar o assistente.'
    });
  }
};
