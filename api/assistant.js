// api/assistant.js
// Endpoint serverless (Vercel) que fala com a API GRATUITA do Gemini
// (Google AI Studio) — sem cartão de crédito, sem custo.
// Requer a variável de ambiente GEMINI_API_KEY (veja o README.md).

const SYSTEM_PROMPT =
  'Você é o assistente do app looksmax, um app pessoal de rotina de ' +
  'autocuidado e melhoria física (skincare, treino, suplementação básica, ' +
  'postura, sono, grooming). Responda em português, de forma curta, direta ' +
  'e prática. Use o contexto da rotina do usuário (enviado abaixo) para dar ' +
  'respostas específicas em vez de genéricas. Quando a pergunta envolver ' +
  'risco à saúde (hormônios sem supervisão, práticas físicas perigosas, ' +
  'medicamentos fora de bula, compostos não aprovados para uso humano), ' +
  'seja honesto sobre os riscos, não forneça protocolos de dosagem, e ' +
  'recomende um profissional de saúde.';

const MODEL = 'gemini-2.5-flash';

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido.' });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor.' });
    return;
  }

  try {
    const body = req.body || {};
    const message = body.message;
    const context = body.context;
    const history = body.history;

    if (!message || typeof message !== 'string') {
      res.status(400).json({ error: 'Mensagem inválida.' });
      return;
    }

    const contents = [];
    const isFirstTurn = !Array.isArray(history) || history.length === 0;

    if (Array.isArray(history)) {
      history.slice(-10).forEach((h) => {
        if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string') {
          contents.push({
            role: h.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: h.content }],
          });
        }
      });
    }

    const pieces = [];
    if (isFirstTurn) pieces.push(SYSTEM_PROMPT);
    if (context) pieces.push('Contexto da rotina do usuário hoje:\n' + context);
    pieces.push('Pergunta: ' + message);

    contents.push({ role: 'user', parts: [{ text: pieces.join('\n\n') }] });

    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/' + MODEL + ':generateContent';

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: contents,
        tools: [{ google_search: {} }],
      }),
    });

    const data = await apiResponse.json();

    if (!apiResponse.ok) {
      console.error('Erro da API Gemini:', data);
      const msg = (data && data.error && data.error.message) || 'Erro ao consultar a API do Gemini.';
      res.status(502).json({ error: msg });
      return;
    }

    const candidate = data.candidates && data.candidates[0];
    const parts = (candidate && candidate.content && candidate.content.parts) || [];
    const reply = parts.map((p) => p.text || '').join('\n').trim();

    res.status(200).json({ reply: reply || 'Sem resposta.' });
  } catch (err) {
    console.error('Erro no assistente:', err);
    res.status(500).json({ error: 'Erro interno ao consultar o assistente.' });
  }
};
