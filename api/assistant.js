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
    return res.status(405).json({
      error: 'Método não permitido.'
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY não configurada.'
    });
  }

  try {
    const body = req.body || {};

    const message = body.message;
    const context = body.context;
    const history = body.history;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Mensagem inválida.'
      });
    }

    const input = [];

    // Histórico
    if (Array.isArray(history)) {
      history.slice(-10).forEach((h) => {
        if (
          h &&
          typeof h.content === 'string' &&
          (h.role === 'user' || h.role === 'assistant')
        ) {
          input.push({
            type:
              h.role === 'assistant'
                ? 'model_output'
                : 'user_input',

            content: [
              {
                type: 'text',
                text: h.content
              }
            ]
          });
        }
      });
    }

    // Mensagem atual
    const pieces = [];

    if (context) {
      pieces.push(
        'Contexto do usuário:\n' +
        String(context)
      );
    }

    pieces.push('Pergunta: ' + message);

    input.push({
      type: 'user_input',

      content: [
        {
          type: 'text',
          text: pieces.join('\n\n')
        }
      ]
    });

    // Chamada da API
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
          input: input
        })
      }
    );

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error(data);

      return res.status(502).json({
        error:
          data?.error?.message ||
          'Erro ao consultar o Gemini.'
      });
    }

    let reply = '';

    if (Array.isArray(data.steps)) {
      for (const step of data.steps) {
        if (
          step.type === 'model_output' &&
          Array.isArray(step.content)
        ) {
          for (const part of step.content) {
            if (
              part.type === 'text' &&
              typeof part.text === 'string'
            ) {
              reply += part.text;
            }
          }
        }
      }
    }

    if (
      !reply &&
      typeof data.output_text === 'string'
    ) {
      reply = data.output_text;
    }

    reply = reply.trim();

    return res.status(200).json({
      reply: reply || 'Sem resposta.'
    });

  } catch (err) {
    console.error(err);

    return res.status(500).json({
      error: 'Erro interno do servidor.'
    });
  }
};
