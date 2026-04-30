# 🎮 Gaming Vibe Coding - Architecture & Roadmap

> **המדריך המלא לבניית הפרוטוטיפ**
> 
> מסמך זה הוא ה-"מפה" שלך. בכל שלב של הפיתוח, חזור הנה כדי להבין:
> - איפה אתה נמצא בתהליך
> - מה הצעד הבא
> - איך כל חלק מתחבר לאחר

---

## 📌 תוכן עניינים

1. [סקירה כללית](#-סקירה-כללית)
2. [Tech Stack](#-tech-stack)
3. [Project Structure](#-project-structure)
4. [זרימת המערכת](#-זרימת-המערכת)
5. [שלבי הפיתוח](#-שלבי-הפיתוח)
6. [Status Tracker](#-status-tracker)
7. [Glossary - מושגים בסיסיים](#-glossary---מושגים-בסיסיים)
8. [Resources](#-resources)

---

## 🎯 סקירה כללית

### **מה אנחנו בונים?**

פלטפורמת **Gaming Vibe Coding** - כלי שמאפשר למשתמשים ללא ניסיון בתכנות ליצור משחקים מלאים בעזרת AI ופרומפטים.

### **איך זה עובד? (תיאור פשוט)**

```
משתמש כותב פרומפט   →   AI שואל שאלות   →   AI יוצר משחק   →   משחק רץ ב-browser
"בנה לי RPG"           (MCQ)             (JSON + code)         (iframe)
```

### **מה אנחנו לא בונים?**

❌ לא משחקים
❌ לא Game Engine חדש
✅ **פלטפורמה** שמייצרת משחקים אוטומטית באמצעות AI

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────────────────┐
│                    FRONTEND (UI)                        │
│  React + Vite + Tailwind CSS                           │
│  → ממשק הצ'אט שהמשתמש רואה                              │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                    BACKEND (API)                        │
│  Node.js + Express                                     │
│  → השרת שמעבד בקשות ומדבר עם AI                         │
└─────────────────────────────────────────────────────────┘
                         ↕
┌──────────────────┐  ┌──────────────────┐  ┌────────────┐
│   AI Service     │  │    Database      │  │   Game     │
│   Gemini API     │  │   PostgreSQL     │  │  Engines   │
│   → יוצר משחקים  │  │   → שמירת נתונים │  │  Phaser +  │
│                  │  │                  │  │  Three.js  │
└──────────────────┘  └──────────────────┘  └────────────┘
```

### **למה דווקא הטכנולוגיות האלה?**

| טכנולוגיה | סיבה |
|-----------|------|
| **Node.js + Express** | פשוט, פופולרי, הרבה דוגמאות לAI ללמוד ממנו |
| **PostgreSQL** | חזק ואמין, JSONB מצוין לאחסון JSON של משחקים |
| **React** | סטנדרט תעשייה, Cursor מבין אותו מצוין |
| **Tailwind CSS** | עיצוב מהיר בלי לכתוב CSS מאפס |
| **Gemini API** | הבחירה שלך - פחות יקר מ-Claude API |
| **Three.js** | Best-in-class ל-3D ב-browser |
| **Phaser.js** | Best-in-class ל-2D games |

---

## 📁 Project Structure

```
gaming-vibe-coding/
│
├── 📂 backend/                      # השרת
│   │
│   ├── 📄 server.js                 # נקודת כניסה - איפה הכל מתחיל
│   ├── 📄 package.json              # רשימת dependencies
│   ├── 📄 .env                      # סודות (API keys) - לא ב-Git!
│   │
│   ├── 📂 routes/                   # API endpoints
│   │   ├── auth.js                 # /api/auth/* - login, register
│   │   ├── games.js                # /api/games/* - CRUD משחקים
│   │   └── tokens.js               # /api/tokens/* - ניהול tokens
│   │
│   ├── 📂 services/                 # לוגיקה עסקית
│   │   ├── geminiService.js        # תקשורת עם Gemini API
│   │   ├── templateBuilder.js      # JSON → HTML/JS playable game
│   │   └── validator.js            # בדיקה שה-JSON תקין
│   │
│   ├── 📂 prompts/                  # System prompts ל-AI
│   │   ├── mcqGenerator.js         # פרומפט ליצירת שאלות
│   │   └── gameGenerator.js        # פרומפט ליצירת משחק
│   │
│   ├── 📂 database/                 # חיבור ל-DB
│   │   ├── db.js                   # connection
│   │   └── queries.js              # SQL queries
│   │
│   └── 📂 middleware/               # מעבירים בין routes
│       ├── auth.js                 # בדיקת JWT
│       └── tokenCheck.js           # בדיקת tokens של משתמש
│
├── 📂 frontend/                     # ממשק המשתמש
│   │
│   ├── 📄 package.json
│   ├── 📄 vite.config.js
│   │
│   └── 📂 src/
│       ├── 📄 App.jsx               # קומפוננטה ראשית
│       ├── 📄 main.jsx              # נקודת כניסה
│       │
│       ├── 📂 components/           # רכיבי UI
│       │   ├── ChatInterface.jsx   # ממשק הצ'אט
│       │   ├── MCQDisplay.jsx      # תצוגת שאלות
│       │   ├── GamePreview.jsx     # iframe של המשחק
│       │   ├── Dashboard.jsx       # רשימת משחקי המשתמש
│       │   ├── Login.jsx           # התחברות
│       │   └── Register.jsx        # הרשמה
│       │
│       ├── 📂 services/             # קריאות ל-API
│       │   └── api.js              # axios calls
│       │
│       └── 📂 styles/               # CSS
│           └── globals.css
│
├── 📂 database/
│   └── schema.sql                  # מבנה ה-DB
│
├── 📄 .gitignore                    # מה לא להעלות ל-Git
├── 📄 README.md                     # תיעוד הפרויקט
└── 📄 ARCHITECTURE.md               # המסמך הזה
```

### **למה כל תיקייה קיימת?**

🎯 **Separation of Concerns** - כל תיקייה אחראית על דבר אחד.

- `routes/` = "מה עושים כשמגיעה בקשה?"
- `services/` = "איך עושים את הדבר?"
- `prompts/` = "מה אומרים ל-AI?"
- `middleware/` = "מה עושים לפני שמתחילים?"

---

## 🔄 זרימת המערכת

### **תרחיש 1: משתמש יוצר משחק חדש**

```
┌──────────────┐
│   משתמש      │  כותב: "בנה לי RPG עם דרקונים"
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   FRONTEND (React)                       │
│   ChatInterface.jsx                      │
│   → שולח POST request ל-backend         │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   BACKEND - routes/games.js              │
│   POST /api/games/create                 │
│                                          │
│   1. middleware/auth.js                  │
│      → בודק שהמשתמש מחובר                │
│   2. middleware/tokenCheck.js            │
│      → בודק שיש tokens                   │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   services/geminiService.js              │
│                                          │
│   → קורא ל-Gemini API                    │
│   → משתמש ב-prompts/mcqGenerator.js      │
│   → מקבל שאלות MCQ                       │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────┐
│   משתמש      │  עונה על השאלות
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   services/geminiService.js              │
│                                          │
│   → קורא שוב ל-Gemini API                │
│   → משתמש ב-prompts/gameGenerator.js     │
│   → מקבל JSON של המשחק                   │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   services/validator.js                  │
│                                          │
│   → בודק שה-JSON תקין                    │
│   → אם לא תקין → שולח חזרה ל-AI          │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   services/templateBuilder.js            │
│                                          │
│   → מקבל JSON                            │
│   → מחזיר HTML שלם עם Phaser/Three.js    │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   database/queries.js                    │
│                                          │
│   → שומר ב-PostgreSQL:                   │
│     - JSON של המשחק                      │
│     - HTML של המשחק                      │
│     - tokens שנוצלו                      │
└──────┬───────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│   FRONTEND - GamePreview.jsx             │
│                                          │
│   → מציג את ה-HTML ב-iframe              │
│   → המשתמש משחק! 🎮                      │
└──────────────────────────────────────────┘
```

### **תרחיש 2: משתמש עורך משחק קיים**

```
משתמש: "הוסף שיקוי בריאות"
       ↓
Backend מושך JSON ישן מ-DB
       ↓
שולח ל-Gemini: "ערוך את ה-JSON הזה לפי הבקשה"
       ↓
Gemini מחזיר JSON מעודכן
       ↓
Validator → Template Builder
       ↓
JSON ישן נמחק, JSON חדש נשמר
       ↓
משחק מתעדכן ב-iframe
```

---

## 🚀 שלבי הפיתוח

> **חשוב:** כל שלב בונה על השלב הקודם. אל תדלג!

---

### 🔵 שלב 1: הכנת התשתית
**משך זמן:** יום 1

**מטרה:** שהסביבה שלך תהיה מוכנה.

```
☐ Node.js מותקן
☐ Cursor מוכן
☐ Git + GitHub מוכן
☐ Gemini API key
☐ יצרת repository
☐ יצרת project structure ריק
```

**תוצר:** תיקייה ריקה עם השלד.

---

### 🔵 שלב 2: Backend Foundation
**משך זמן:** ימים 2-3
**תלוי ב:** שלב 1

**מטרה:** שרת פשוט שעובד ויודע לדבר עם Gemini.

```
☐ npm init - אתחול הפרויקט
☐ התקנת dependencies (express, dotenv, axios)
☐ server.js - שרת בסיסי שרץ
☐ קובץ .env עם ה-API key
☐ endpoint ראשון: POST /api/test
☐ קישור ראשון ל-Gemini API
☐ בדיקה: שולחים פרומפט, מקבלים תשובה
```

**תוצר:** Backend עובד, מקבל פרומפט, מחזיר תשובה מ-Gemini.

**מה תלמד בשלב הזה:**
- מה זה npm ו-package.json
- איך עובד Express server
- מה זה async/await
- איך לקרוא ל-API חיצוני

---

### 🔵 שלב 3: AI Integration המלאה
**משך זמן:** ימים 4-6
**תלוי ב:** שלב 2

**מטרה:** המערכת יודעת לייצר משחקים מלאים.

```
☐ prompts/mcqGenerator.js - פרומפט לשאלות
☐ prompts/gameGenerator.js - פרומפט ליצירת משחק
☐ services/geminiService.js - שירות מלא
☐ POST /api/games/generate-mcq
   → מקבל פרומפט, מחזיר MCQ
☐ POST /api/games/generate-from-mcq
   → מקבל תשובות, מחזיר JSON
☐ services/validator.js - בדיקת JSON
☐ Validation loop - retry אם JSON שבור
```

**תוצר:** API שיודע ליצור JSON של משחק מלא.

**מה תלמד:**
- Prompt Engineering
- JSON Schema
- Error handling
- איך מנהלים שיחה עם AI

---

### 🔵 שלב 4: Template Builder
**משך זמן:** ימים 7-9
**תלוי ב:** שלב 3

**מטרה:** המרת JSON ל-HTML משחקי.

```
☐ services/templateBuilder.js
☐ Template ל-Phaser.js (2D)
☐ Template ל-Three.js (3D)
☐ Template ל-Rapier (physics)
☐ פונקציה: buildGameHTML(json)
☐ בדיקה: JSON → HTML → שמירה כקובץ
☐ פתיחת ה-HTML ב-browser - המשחק רץ!
```

**תוצר:** מהפרומפט עד למשחק רץ ב-browser. End-to-end!

**מה תלמד:**
- Template Literals
- HTML/JavaScript embedding
- בסיסי Phaser ו-Three.js

---

### 🔵 שלב 5: Database
**משך זמן:** ימים 10-12
**תלוי ב:** שלב 4

**מטרה:** שמירה ושליפה של משחקים ומשתמשים.

```
☐ התקנת PostgreSQL מקומית
☐ database/schema.sql - מבנה הטבלאות
☐ טבלאות: users, games, token_usage, prompts_history
☐ database/db.js - חיבור
☐ database/queries.js - פונקציות CRUD
☐ עדכון routes לשמור ב-DB
☐ GET /api/user/games - רשימת משחקים
☐ GET /api/games/:id - שליפת משחק
```

**תוצר:** משחקים נשמרים, אפשר לשלוף אותם, אפשר לערוך אותם.

**מה תלמד:**
- SQL Basics
- PostgreSQL
- Relations בין טבלאות
- JSONB column type

---

### 🔵 שלב 6: Frontend
**משך זמן:** ימים 13-19
**תלוי ב:** שלב 5

**מטרה:** ממשק משתמש שלם.

```
☐ npm create vite@latest frontend
☐ התקנת React + Tailwind
☐ App.jsx - routing בסיסי
☐ components/ChatInterface.jsx
☐ components/MCQDisplay.jsx
☐ components/GamePreview.jsx (iframe)
☐ components/Dashboard.jsx
☐ services/api.js - axios calls
☐ חיבור Frontend ↔ Backend
☐ עיצוב בסיסי עם Tailwind
☐ State management (useState, useContext)
```

**תוצר:** UI מלא שעובד עם ה-Backend.

**מה תלמד:**
- React Components
- JSX
- Hooks (useState, useEffect)
- API calls מ-Frontend
- Tailwind CSS

---

### 🔵 שלב 7: Auth + Tokens + Polish
**משך זמן:** ימים 20-23
**תלוי ב:** שלב 6

**מטרה:** מערכת מלאה עם משתמשים.

```
☐ middleware/auth.js - JWT verification
☐ middleware/tokenCheck.js - בדיקת tokens
☐ routes/auth.js - register, login
☐ Hash passwords (bcrypt)
☐ JWT generation
☐ Frontend: Login.jsx, Register.jsx
☐ Frontend: Protected routes
☐ Token deduction logic
☐ User dashboard עם תצוגת tokens
☐ Error handling כללי
☐ Loading states
☐ Polish UI
```

**תוצר:** פלטפורמה מלאה ועובדת! 🎉

**מה תלמד:**
- JWT Authentication
- Password hashing
- Protected routes
- Production-ready code

---

## 📊 Status Tracker

> **השתמש בזה לעקוב אחרי ההתקדמות שלך**
> סמן ✅ ליד השלב שסיימת

```
┌────────────────────────────────────────────────────────┐
│  ההתקדמות שלי                                          │
├────────────────────────────────────────────────────────┤
│                                                        │
│  [⬜] שלב 1: הכנת התשתית                                │
│  [⬜] שלב 2: Backend Foundation                        │
│  [⬜] שלב 3: AI Integration                            │
│  [⬜] שלב 4: Template Builder                          │
│  [⬜] שלב 5: Database                                  │
│  [⬜] שלב 6: Frontend                                  │
│  [⬜] שלב 7: Auth + Tokens + Polish                    │
│                                                        │
└────────────────────────────────────────────────────────┘

מקרא:
⬜ = לא התחלתי
🟡 = בעבודה
✅ = הושלם
🔴 = תקוע - צריך עזרה
```

### **בכל פעם שמסיים שלב, שאל את עצמך:**

1. ✅ האם הכל עובד?
2. ✅ האם עשיתי git commit?
3. ✅ האם אני מבין מה עשיתי?
4. ✅ האם אני מוכן לשלב הבא?

---

## 📚 Glossary - מושגים בסיסיים

> מושגים שתפגוש בדרך - חזור הנה כשמשהו לא ברור.

### **Backend / Server-side**

| מושג | מה זה? |
|------|--------|
| **Server** | מחשב שמקבל בקשות ומחזיר תשובות |
| **API** | "תפריט" של פעולות שהשרת יודע לעשות |
| **Endpoint** | כתובת ספציפית באפ"י, למשל `/api/games/create` |
| **Request** | בקשה שהלקוח שולח לשרת |
| **Response** | התשובה שהשרת מחזיר |
| **Middleware** | קוד שרץ "באמצע" - בין הבקשה לתשובה |
| **Route** | "כביש" - איזה endpoint מטפל באיזה בקשה |

### **Frontend / Client-side**

| מושג | מה זה? |
|------|--------|
| **Component** | חתיכה של UI שאפשר להשתמש בה שוב |
| **State** | מידע שמשתנה בזמן אמת |
| **Props** | מידע שמועבר מ-component לבן שלו |
| **Hook** | פונקציה מיוחדת ב-React |
| **JSX** | תחביר שנראה כמו HTML אבל זה JavaScript |

### **Database**

| מושג | מה זה? |
|------|--------|
| **Schema** | מבנה ה-DB - איזה טבלאות יש ומה בהן |
| **Query** | "שאלה" ל-DB ב-SQL |
| **CRUD** | Create, Read, Update, Delete - 4 פעולות בסיסיות |
| **Relation** | קשר בין טבלאות (למשל user → games) |
| **JSONB** | סוג עמודה ב-PostgreSQL לאחסון JSON |

### **AI Integration**

| מושג | מה זה? |
|------|--------|
| **System Prompt** | "הוראות הכלליות" ל-AI - איך הוא צריך להתנהג |
| **User Prompt** | מה שהמשתמש כותב |
| **Token** | "יחידה" בעולם של AI - בערך מילה |
| **Temperature** | "יצירתיות" של ה-AI (0=דטרמיניסטי, 1=יצירתי) |
| **Validation Loop** | מנגנון שבודק את התשובה ומבקש לתקן אם צריך |

### **General**

| מושג | מה זה? |
|------|--------|
| **JSON** | פורמט לאחסון נתונים: `{"name": "value"}` |
| **JWT** | "כרטיס זהות" דיגיטלי שמוכיח שאתה מחובר |
| **JWT Token** | הטוקן עצמו - מחרוזת ארוכה |
| **Async/Await** | דרך לטפל בפעולות שלוקחות זמן |
| **npm** | מנהל החבילות של Node.js |
| **package.json** | קובץ עם רשימת dependencies |
| **.env** | קובץ עם סודות - לא עולה ל-Git |

---

## 🔗 Resources

### **תיעוד רשמי (קרא כשנתקע)**

- 📘 **Node.js**: https://nodejs.org/docs/
- 📘 **Express**: https://expressjs.com/
- 📘 **React**: https://react.dev/
- 📘 **Vite**: https://vitejs.dev/
- 📘 **PostgreSQL**: https://www.postgresql.org/docs/
- 📘 **Gemini API**: https://ai.google.dev/docs
- 📘 **Tailwind CSS**: https://tailwindcss.com/docs

### **Game Engines (לשלב 4)**

- 🎮 **Phaser.js**: https://phaser.io/learn
- 🎮 **Three.js**: https://threejs.org/docs/
- 🎮 **Rapier Physics**: https://rapier.rs/docs/

### **כלים**

- 🛠️ **Cursor**: https://cursor.sh
- 🛠️ **GitHub**: https://github.com
- 🛠️ **Postman** (לבדיקת API): https://www.postman.com

---

## 💡 טיפים חשובים בדרך

### **1. Git Commits**

🎯 בכל פעם שמשהו עובד → commit!

```bash
git add .
git commit -m "תיאור ברור של מה עשיתי"
git push
```

### **2. .env לעולם לא ב-Git!**

ב-`.gitignore`:
```
node_modules/
.env
*.log
```

### **3. בעיות? אל תפחד!**

- שאל אותי
- שאל את Cursor (Cmd+K)
- חפש בגוגל את שגיאה - 99% שמישהו כבר נתקל

### **4. אל תעתיק קוד שאתה לא מבין**

- כל שורה - אם לא מבין, שאל
- זה איך לומדים נכון

### **5. הפסקות!**

- 90 דקות עבודה → 15 דקות הפסקה
- מוח עייף = באגים
- שינה טובה = פתרונות יצירתיים

---

## 🎯 הצעד הבא

**עכשיו:** התחל ב-**שלב 1**.

חזור למסמך הזה בכל פעם שאתה לא בטוח איפה אתה.

---

**📅 עודכן לאחרונה:** 30 באפריל, 2026
**👤 מחבר:** CTO Guide for Solo Developer
**📌 סטטוס:** Prototype Planning Complete

---

> 💪 **זוכר:** אתה בונה משהו מורכב. תיקח את הזמן, תלמד תוך כדי, ותהנה מהדרך!
