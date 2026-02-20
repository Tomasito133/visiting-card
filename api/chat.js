/**
 * AI Chat API — Vercel Serverless Function
 * Использует MiniMax API для ответов на основе базы знаний
 */

import { readFileSync } from 'fs';
import { join } from 'path';

function loadKnowledge() {
  try {
    const filePath = join(process.cwd(), 'knowledge.json');
    const data = JSON.parse(readFileSync(filePath, 'utf-8'));
    return formatKnowledge(data);
  } catch (err) {
    console.error('Failed to load knowledge.json:', err.message);
    return '';
  }
}

function formatKnowledge(data) {
  let text = `# ${data.name} — ${data.role}\n\n`;
  text += `## Об услугах\n${data.about}\n\n`;
  text += `## Услуги и цены\n\n`;

  for (const service of data.services) {
    text += `### ${service.category}\n`;
    if (service.description) {
      text += `${service.description}\n`;
      text += `Стоимость: ${service.price}\n`;
      if (service.duration) text += `Сроки: ${service.duration}\n`;
    }
    if (service.items) {
      for (const item of service.items) {
        text += `- ${item.name} — ${item.price}\n`;
      }
    }
    text += '\n';
  }

  text += `## Как работаем\n`;
  data.process.forEach((step, i) => {
    text += `${i + 1}. ${step}\n`;
  });

  text += `\n## Контакты\n`;
  text += `- Email: ${data.contacts.email}\n`;
  text += `- Telegram: ${data.contacts.telegram}\n`;

  text += `\n## FAQ\n`;
  for (const faq of data.faq) {
    text += `**${faq.question}**\n${faq.answer}\n\n`;
  }

  return text;
}

const KNOWLEDGE = loadKnowledge();

const SYSTEM_PROMPT = `Ты — Агент Томасович, AI-консультант по разработке пищевых продуктов.

ПРАВИЛА:
1. Отвечай ТОЛЬКО на основе информации ниже
2. Будь дружелюбным и профессиональным
3. Если спрашивают о чём-то, чего нет в данных — предложи связаться напрямую
4. Отвечай кратко и по делу (2-4 предложения)
5. Если клиент заинтересован — предлагай оставить контакты или написать на почту/телеграм
6. Используй "я" когда говоришь об услугах (это твои услуги)

${KNOWLEDGE}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const API_KEY = process.env.MINIMAX_API_KEY;
  
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  try {
    const { message } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: 'Message required' });
    }

    const response = await fetch('https://api.minimax.io/v1/text/chatcompletion_v2', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'M2-her',
        messages: [
          { role: 'system', name: 'Агент Томасович', content: SYSTEM_PROMPT },
          { role: 'user', name: 'User', content: message }
        ],
        max_completion_tokens: 1000,
        temperature: 0.8
      })
    });

    const data = await response.json();
    
    if (!response.ok || (data.base_resp && data.base_resp.status_code !== 0)) {
      const errMsg = data.base_resp?.status_msg || data.error?.message || JSON.stringify(data);
      console.error('MiniMax API error:', errMsg);
      return res.status(500).json({ error: errMsg });
    }

    const content = data?.choices?.[0]?.message?.content || 'Извините, не удалось получить ответ.';
    
    res.status(200).json({ response: content });
    
  } catch (err) {
    console.error('Chat API error:', err.message, err.stack);
    res.status(500).json({ error: 'Ошибка: ' + err.message });
  }
}
