export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') { res.status(405).end(); return; }

  try {
    const { messages, system } = req.body;
    
    // Convert messages format for Gemini
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    // Add system prompt as first user message if present
    if (system) {
      contents.unshift({
        role: 'user',
        parts: [{ text: `INSTRUCCIONES DEL SISTEMA: ${system}` }]
      });
      contents.splice(1, 0, {
        role: 'model',
        parts: [{ text: 'Entendido, seguiré esas instrucciones.' }]
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { maxOutputTokens: 1500, temperature: 0.3 }
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Return in Anthropic-compatible format so App.jsx works unchanged
    res.status(200).json({
      content: [{ type: 'text', text }]
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
