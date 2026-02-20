/**
 * AI Chat API — Vercel Serverless Function
 * Использует MiniMax API для ответов на основе базы знаний
 */

const KNOWLEDGE = `
# Агент Томасович — Консультант по разработке пищевых продуктов

## Об услугах
Помогаю компаниям создавать новые пищевые продукты: от идеи до запуска в производство.
Специализация: напитки, функциональное питание, снеки, кондитерские изделия.

## Основные услуги и цены

### 1. Разработка рецептуры
- Безалкогольные напитки (лимонады, энергетики, спортивные) — от 50 000 ₽
- Функциональные напитки и смузи — от 60 000 ₽
- Сиропы и концентраты — от 40 000 ₽
- Снеки и закуски — от 70 000 ₽
- Кондитерские изделия — от 80 000 ₽

### 2. Полный цикл NPD (New Product Development)
Включает: генерация идей, разработка концепции, создание рецептуры, 
тестовые образцы, доработка, документация, сопровождение запуска.
Стоимость: от 150 000 ₽ (зависит от сложности продукта)
Сроки: 2-4 месяца

### 3. Технологический консалтинг
- Аудит производства — от 30 000 ₽
- Оптимизация рецептур — от 25 000 ₽
- Консультация (разовая, 2 часа) — 15 000 ₽

### 4. Документация
- Разработка ТТК (технико-технологическая карта) — от 5 000 ₽
- Расчёт БЖУ и калорийности — от 2 000 ₽
- Полный пакет нормативной документации — от 20 000 ₽

## Как работаем
1. Обсуждаем задачу и составляем ТЗ (бесплатно)
2. Согласовываем стоимость и сроки
3. Заключаем договор (предоплата 50%)
4. Разрабатываем рецептуру и тестовые образцы
5. Дорабатываем по обратной связи (до 3 итераций включено)
6. Передаём документацию и рецептуру
7. Сопровождаем запуск производства (опционально)

## Контакты
- Email: tomas@mirafruit.ru
- Telegram: @easee_peasee
- Бесплатная консультация: напишите в чат или на почту

## FAQ
**Сколько времени занимает разработка?**
Простая рецептура — 2-4 недели. Полный NPD-цикл — 2-4 месяца.

**Работаете с физлицами?**
Да, работаю и с компаниями, и с предпринимателями.

**Можно получить тестовые образцы?**
Да, предоставляю образцы для дегустации и тестирования.

**Есть гарантии?**
Дорабатываем рецептуру до достижения согласованного результата (до 3 итераций включено в стоимость).
`;

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
