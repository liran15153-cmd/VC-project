const OpenAI = require('openai');
require('dotenv').config({ path: './.env' });

async function testOpenRouter() {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey || apiKey === 'replace-with-your-openrouter-api-key' || apiKey === 'your-openrouter-api-key') {
    console.log('Missing real OPENROUTER_API_KEY in prototype/backend/.env');
    console.log('Create a key at https://openrouter.ai/keys, then rerun this script.');
    return;
  }

  const model = process.env.OPENROUTER_MODEL || process.env.OPENROUTER_DEFAULT_MODEL || 'openai/gpt-5-mini';
  const client = new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': process.env.OPENROUTER_APP_URL || 'http://localhost:5174',
      'X-OpenRouter-Title': process.env.OPENROUTER_APP_TITLE || 'Gaming Vibe Coding'
    }
  });

  console.log(`Testing OpenRouter model: ${model}`);

  try {
    const response = await client.chat.completions.create({
      model,
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: 'Return exactly this JSON object: {"ok":true}' }]
    });
    console.log('OpenRouter API is working.');
    console.log(response.choices[0].message.content.trim());
  } catch (err) {
    console.log('OpenRouter API test failed.');
    console.log('Reason:', err.message);
  }
}

testOpenRouter();
