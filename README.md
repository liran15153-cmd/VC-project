# 🎮 Gaming Vibe Coding

> **AI-Powered Game Creation Platform**
>
> Create full 3D/2D games with just text prompts. No coding experience needed.

---

## 🌟 תיאור הפרויקט

Gaming Vibe Coding היא פלטפורמה שמאפשרת לאנשים ללא ניסיון בתכנות ליצור משחקים מלאים בעזרת:

1. 💬 **Prompts בחינם** - כתיבת תיאור של המשחק שרוצים
2. 🤖 **AI Analysis** - AI שואל שאלות (MCQ) כדי להבין טוב יותר
3. 🎮 **Game Generation** - AI יוצר משחק מלא (JSON + code)
4. ▶️ **Instant Play** - משחק רץ מיד בbrowser

**התוצאה?** משחק playable בתוך דקות.

---

## 🚀 Quick Start

### **דרישות**

```bash
✅ Node.js 20+ (https://nodejs.org)
✅ Git (https://git-scm.com)
✅ Gemini API Key (https://aistudio.google.com/apikey) - חינם!
✅ PostgreSQL (https://www.postgresql.org) - אם רוצה DB
```

### **התקנה (שלב 1: Setup)**

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/gaming-vibe-coding.git
cd gaming-vibe-coding

# Backend setup
cd backend
npm install
cp .env.example .env
# ערוך את .env והוסף את ה-Gemini API key שלך
npm run dev

# Frontend setup (terminal חדש)
cd frontend
npm install
npm run dev
```

### **לחץ על בדיקה**

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

---

## 📁 Project Structure

```
gaming-vibe-coding/
├── backend/          # Node.js + Express
│   ├── server.js
│   ├── routes/
│   ├── services/
│   └── prompts/
├── frontend/         # React + Vite
│   └── src/
├── database/         # PostgreSQL
└── ARCHITECTURE.md   # תיעוד מלא
```

**רוצה להבין את המבנה?** קרא את **ARCHITECTURE.md**

---

## 🎯 How It Works

### **משתמש יוצר משחק:**

```
"בנה לי RPG עם דרקונים"
         ↓
AI: "כמה שחקנים? קומבט turn-based או real-time?"
         ↓
משתמש בוחר תשובות
         ↓
AI יוצר משחק JSON
         ↓
אנחנו ממירים ל-Phaser/Three.js
         ↓
משחק רץ בbrowser! 🎮
```

### **משתמש עורך משחק:**

```
"הוסף שיקוי בריאות"
         ↓
AI זוכר את המשחק הישן
         ↓
AI משנה את ה-JSON
         ↓
משחק מתעדכן 🔄
```

---

## 🛠️ Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | React + Vite | מודרני, מהיר |
| **Backend** | Node.js + Express | פשוט, יעיל |
| **Database** | PostgreSQL | חזק, אמין |
| **AI** | Gemini API | בחרנו בו |
| **2D Games** | Phaser.js | Best-in-class |
| **3D Games** | Three.js | Flexible, עוצמתי |
| **Physics** | Rapier | Advanced |

---

## 📚 Documentation

| קובץ | מה בו |
|------|--------|
| **ARCHITECTURE.md** | מפה מלאה של הפרויקט + 7 שלבי פיתוח |
| **Claude.md** | CTO guide - החלטות בנושא AI, prompts, וכו' |
| **README.md** | הקובץ הזה - quick start |

---

## 🔑 Environment Variables

צור קובץ `.env` בתיקיית backend:

```env
# Gemini API
GEMINI_API_KEY=your_key_here

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/gaming_vibe

# Server
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_secret_here
```

⚠️ **אל תעלה את .env ל-GitHub!**

---

## 🚦 Development Roadmap

- [x] ✅ Architecture planning
- [x] ✅ Documentation
- [ ] 🔵 Phase 1: Backend Foundation
- [ ] 🔵 Phase 2: AI Integration
- [ ] 🔵 Phase 3: Template Builder
- [ ] 🔵 Phase 4: Database
- [ ] 🔵 Phase 5: Frontend
- [ ] 🔵 Phase 6: Auth + Tokens

**מפה מלאה?** קרא את ARCHITECTURE.md

---

## 📖 Learning Resources

### **Frontend**
- 📘 [React Docs](https://react.dev)
- 📘 [Vite](https://vitejs.dev)
- 📘 [Tailwind CSS](https://tailwindcss.com)

### **Backend**
- 📘 [Node.js](https://nodejs.org/docs)
- 📘 [Express](https://expressjs.com)
- 📘 [PostgreSQL](https://www.postgresql.org/docs)

### **Game Engines**
- 🎮 [Phaser.js](https://phaser.io/learn)
- 🎮 [Three.js](https://threejs.org/docs)
- 🎮 [Rapier Physics](https://rapier.rs)

### **AI**
- 🤖 [Gemini API](https://ai.google.dev)

---

## 💡 Tips for Development

### **Git Workflow**

```bash
# Create a branch
git checkout -b feature/your-feature

# Commit regularly
git commit -m "Add: descriptive message"

# Push
git push origin feature/your-feature

# Create Pull Request on GitHub
```

### **Testing Endpoints**

Use **Postman** to test API endpoints:
- Download: https://www.postman.com
- Import requests from `backend/postman.json` (יש ליצור)

### **Database Setup**

```bash
# Create database
createdb gaming_vibe

# Run migrations (כשיהיו)
npm run migrate
```

---

## 🤝 Contributing

זה פרויקט סולו. עזרה מקבלת בברכה!

1. Fork את הrepo
2. Create branch
3. Commit changes
4. Push ו-create PR

---

## 📝 License

MIT License - בחופשיות!

---

## 🆘 Troubleshooting

### **"npm: command not found"**
```bash
# Node.js לא מותקן. התקן מ:
https://nodejs.org
```

### **"ECONNREFUSED localhost:5432"**
```bash
# PostgreSQL לא פועל. הפעל:
# Mac
brew services start postgresql

# Windows
pg_ctl -D "C:\Program Files\PostgreSQL\data" start

# Linux
sudo service postgresql start
```

### **"GEMINI_API_KEY is undefined"**
```bash
# וודא שיש לך .env עם API key
cat .env | grep GEMINI
```

### **עדיין תקוע?**

תפתח issue ב-GitHub או שאל.

---

## 📞 Contact

- 💻 GitHub: [Your Profile]
- 📧 Email: [Your Email]
- 💬 Discord: [Your Discord] (אם יש)

---

## 🎉 Acknowledgments

תודה ל:
- **Anthropic** - Claude AI
- **Google** - Gemini API
- **Phaser** - Game Framework
- **Three.js** - 3D Graphics

---

## 🔮 Future Ideas

- [ ] Multiplayer games support
- [ ] Advanced asset generation (Dall-E 3D)
- [ ] Game marketplace
- [ ] Mobile app
- [ ] VR/AR support
- [ ] Custom AI model fine-tuning

---

**Last Updated:** 30 באפריל, 2026  
**Version:** 0.1.0 (Planning Phase)  
**Status:** 🟡 In Development

---

> 🚀 **Ready to build amazing games with AI?**
>
> Let's start! Follow the [ARCHITECTURE.md](./ARCHITECTURE.md) for step-by-step guide.
