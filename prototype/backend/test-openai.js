const { OpenAI } = require('openai');
require('dotenv').config({ path: './.env' });

async function testOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  
  // בדיקה אם המפתח עדיין על ערך ברירת המחדל
  if (!apiKey || apiKey === 'replace-with-your-openai-api-key' || apiKey === 'your-openai-api-key') {
    console.log('❌ שגיאה: לא הכנסת מפתח API אמיתי לקובץ ה-.env שלך!');
    console.log('נא לערוך את הקובץ .env ולהחליף את "replace-with-your-openai-api-key" במפתח האמיתי שקיבלת מ-OpenAI.');
    return;
  }
  
  console.log('בודק את מפתח ה-OpenAI שלך מול השרתים של OpenAI...');
  
  // שים לב שחלק מהמודלים הישנים של gpt-5 עדיין מוגדרים במערכת,
  // אנחנו ננסה להשתמש במודל ברירת המחדל, או ניפול חזרה ל-gpt-4o לבדיקה
  const modelToTest = process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o';
  console.log(`מנסה להשתמש במודל: ${modelToTest}`);

  const openai = new OpenAI({ apiKey });
  
  try {
    const response = await openai.chat.completions.create({
      model: modelToTest,
      messages: [{ role: 'user', content: 'Say exactly: API is working!' }],
    });
    console.log('\n✅ מעולה! ה-API של OpenAI עובד בהצלחה!');
    console.log('התשובה שהתקבלה מהשרת:', response.choices[0].message.content.trim());
    console.log('\nאתה יכול עכשיו להפעיל את השרת שלך (npm start או npm run dev) ולבדוק דרך הממשק!');
  } catch (err) {
    console.log('\n❌ הבדיקה נכשלה. ה-API לא עובד.');
    console.log('סיבת השגיאה:', err.message);
  }
}

testOpenAI();
