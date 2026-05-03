/* ============================================================================
   MCQ Generator
   ============================================================================
   Generates contextual multiple-choice questions based on user's prompt.
   Always 4+ questions, in "do you want to add/change X" style.
   Questions are SHORT but ALWAYS related to user's request.
   ========================================================================= */

const MCQGenerator = {

  // Detect game type from prompt (Hebrew + English)
  detectGameType(prompt) {
    const p = prompt.toLowerCase();

    // Platformer indicators
    if (/(פלטפורמ|מאריו|קפיצ|דרקונ|הרפתק|platformer|mario|jump|adventure)/i.test(p)) {
      return 'platformer';
    }

    // Shooter indicators
    if (/(חלל|יורה|ירי|לחימ|space|shoot|shooter|invader|fighter)/i.test(p)) {
      return 'shooter';
    }

    // Runner indicators
    if (/(ריצ|אינסופ|רץ|מכשול|runner|endless|run|obstacle)/i.test(p)) {
      return 'runner';
    }

    // Breakout indicators
    if (/(שובר|לבנ|כדור|מחבט|breakout|brick|paddle|ball|arkanoid)/i.test(p)) {
      return 'breakout';
    }

    // RPG/Maze indicators
    if (/(rpg|מבוך|אוצר|דרקונ|חרב|fantasy|maze|dungeon|treasure|sword|quest)/i.test(p)) {
      return 'rpg';
    }

    // 3D indicators
    if (/(3d|תלת.?ממד|first.person|third.person|fps|explorer)/i.test(p)) {
      return 'explorer-fp';
    }

    // Default to platformer
    return 'platformer';
  },

  // Detect dimension (2D vs 3D)
  detectDimension(prompt) {
    const p = prompt.toLowerCase();
    if (/(3d|תלת.?ממד|first.person|fps|three.?d)/i.test(p)) {
      return '3D';
    }
    return '2D';
  },

  // Generate 4-6 contextual MCQs based on game type and prompt
  generate(prompt) {
    const gameType = this.detectGameType(prompt);
    const dimension = this.detectDimension(prompt);

    // Base questions used in all games (always relevant)
    const baseQuestions = this.getBaseQuestions(gameType);

    // Genre-specific questions
    const genreQuestions = this.getGenreQuestions(gameType);

    // Combine and limit to 5 questions
    const allQuestions = [...baseQuestions, ...genreQuestions];

    return {
      gameType,
      dimension,
      questions: allQuestions.slice(0, 5)
    };
  },

  // Base questions that work for any game
  getBaseQuestions(gameType) {
    return [
      {
        id: 'difficulty',
        question: 'איזו רמת קושי אתה רוצה?',
        options: [
          { value: 'easy', label: '😊 קל (5 חיים, אויבים איטיים)' },
          { value: 'medium', label: '⚔️ בינוני (3 חיים, מאוזן)' },
          { value: 'hard', label: '💀 קשה (2 חיים, אתגר רציני)' }
        ]
      },
      {
        id: 'theme',
        question: 'איזה סגנון ויזואלי אתה רוצה להוסיף?',
        options: this.getThemeOptions(gameType)
      }
    ];
  },

  getThemeOptions(gameType) {
    const themes = {
      platformer: [
        { value: 'fantasy', label: '🐉 פנטזיה (סגול וזהב)' },
        { value: 'forest', label: '🌳 יער (ירוק וחום)' },
        { value: 'retro', label: '👾 רטרו (8-bit פיקסלי)' }
      ],
      shooter: [
        { value: 'space', label: '🚀 חלל (כחול כהה)' },
        { value: 'scifi', label: '🤖 סייפיי (ניאון)' },
        { value: 'retro', label: '👾 רטרו (Space Invaders)' }
      ],
      runner: [
        { value: 'cyber', label: '🌃 סייברפאנק (ניאון ורוד)' },
        { value: 'forest', label: '🌳 יער (ירוק)' },
        { value: 'desert', label: '🏜 מדבר (כתום)' }
      ],
      breakout: [
        { value: 'space', label: '🚀 חלל (כוכבים)' },
        { value: 'arcade', label: '🕹 ארקייד קלאסי' },
        { value: 'neon', label: '✨ ניאון מודרני' }
      ],
      rpg: [
        { value: 'dungeon', label: '🏰 מבוך אפלולי' },
        { value: 'fantasy', label: '🐉 פנטזיה קלאסית' },
        { value: 'pixel', label: '👾 פיקסל RPG' }
      ]
    };
    return themes[gameType] || themes.platformer;
  },

  // Genre-specific questions based on game type
  getGenreQuestions(gameType) {
    const questions = {
      platformer: [
        {
          id: 'enemyCount',
          question: 'כמה אויבים אתה רוצה להוסיף?',
          options: [
            { value: 'few', label: '🟢 מעט (2-3 אויבים)' },
            { value: 'normal', label: '🟡 רגיל (4-5 אויבים)' },
            { value: 'many', label: '🔴 הרבה (6+ אויבים)' }
          ]
        },
        {
          id: 'collectibles',
          question: 'מה אתה רוצה לאסוף במשחק?',
          options: [
            { value: 'coin', label: '🪙 מטבעות זהב' },
            { value: 'treasure', label: '💎 אבני חן יקרות' },
            { value: 'powerup', label: '⚡ Power-ups חזקים' }
          ]
        },
        {
          id: 'jumpStyle',
          question: 'איך הקפיצה צריכה להרגיש?',
          options: [
            { value: 'floaty', label: '🎈 צפה גבוה (מאריו)' },
            { value: 'snappy', label: '⚡ מהירה ונחוצה' },
            { value: 'realistic', label: '🌍 ריאליסטית (כבדה)' }
          ]
        }
      ],
      shooter: [
        {
          id: 'enemySpawnRate',
          question: 'באיזו תדירות אתה רוצה שאויבים יופיעו?',
          options: [
            { value: 'slow', label: '😌 איטית (כל 3 שניות)' },
            { value: 'normal', label: '⚔️ רגילה (כל 1.5 שניות)' },
            { value: 'intense', label: '🔥 אינטנסיבית (כל שנייה)' }
          ]
        },
        {
          id: 'controls',
          question: 'איזה שליטה אתה מעדיף?',
          options: [
            { value: 'wasd', label: '⌨️ WASD בלבד' },
            { value: 'arrows', label: '🎮 חיצים בלבד' },
            { value: 'both', label: '✨ שניהם (גמיש)' }
          ]
        },
        {
          id: 'lives',
          question: 'כמה חיים אתה רוצה להתחיל?',
          options: [
            { value: '5', label: '❤️❤️❤️❤️❤️ 5 חיים (קל)' },
            { value: '3', label: '❤️❤️❤️ 3 חיים (סטנדרט)' },
            { value: '1', label: '❤️ חיים אחד (Hardcore)' }
          ]
        }
      ],
      runner: [
        {
          id: 'speed',
          question: 'באיזה מהירות אתה רוצה שהמשחק ירוץ?',
          options: [
            { value: 'slow', label: '🐢 איטי (300px/s)' },
            { value: 'normal', label: '🏃 רגיל (450px/s)' },
            { value: 'fast', label: '⚡ מהיר (600px/s)' }
          ]
        },
        {
          id: 'obstacleType',
          question: 'איזה מכשולים אתה רוצה להוסיף?',
          options: [
            { value: 'low', label: '⬆️ נמוכים (קופצים מעל)' },
            { value: 'high', label: '⬇️ גבוהים (גוחנים מתחת)' },
            { value: 'mixed', label: '🎲 מעורבים (יותר אתגר)' }
          ]
        },
        {
          id: 'progression',
          question: 'האם אתה רוצה שהמשחק יהיה קשה יותר עם הזמן?',
          options: [
            { value: 'yes', label: '✅ כן, קושי עולה' },
            { value: 'constant', label: '➡️ לא, קושי קבוע' }
          ]
        }
      ],
      breakout: [
        {
          id: 'brickRows',
          question: 'כמה שורות לבנים אתה רוצה?',
          options: [
            { value: '3', label: '🟢 3 שורות (קצר)' },
            { value: '5', label: '🟡 5 שורות (סטנדרט)' },
            { value: '7', label: '🔴 7 שורות (ארוך)' }
          ]
        },
        {
          id: 'ballSpeed',
          question: 'באיזה מהירות הכדור צריך לנוע?',
          options: [
            { value: 'slow', label: '🐢 איטי (לימודי)' },
            { value: 'normal', label: '⚔️ רגיל (קלאסי)' },
            { value: 'fast', label: '🔥 מהיר (אתגר)' }
          ]
        },
        {
          id: 'powerups',
          question: 'האם אתה רוצה להוסיף Power-ups?',
          options: [
            { value: 'yes', label: '✨ כן, יותר כיף' },
            { value: 'no', label: '🎯 לא, קלאסי טהור' }
          ]
        }
      ],
      rpg: [
        {
          id: 'enemyType',
          question: 'איזה אויבים אתה רוצה לפגוש?',
          options: [
            { value: 'monsters', label: '👹 מפלצות מבוך' },
            { value: 'guards', label: '🛡 שומרי טירה' },
            { value: 'mixed', label: '⚔️ שניהם מעורבים' }
          ]
        },
        {
          id: 'treasureAmount',
          question: 'כמה אוצרות אתה רוצה לאסוף?',
          options: [
            { value: 'few', label: '💎 מעט (3-4 יקרים)' },
            { value: 'many', label: '💰 הרבה (8+ קטנים)' }
          ]
        },
        {
          id: 'goal',
          question: 'מה המטרה הסופית של המשחק?',
          options: [
            { value: 'exit', label: '🚪 למצוא יציאה' },
            { value: 'collect', label: '🏆 לאסוף את כל האוצרות' },
            { value: 'survive', label: '⏱ לשרוד 60 שניות' }
          ]
        }
      ],
      'explorer-fp': [
        {
          id: 'environment',
          question: 'באיזו סביבה אתה רוצה לחקור?',
          options: [
            { value: 'forest', label: '🌳 יער מסתורי' },
            { value: 'space', label: '🚀 תחנת חלל' },
            { value: 'underground', label: '🕳 מערות תת-קרקעיות' }
          ]
        },
        {
          id: 'mood',
          question: 'איזה מצב רוח אתה רוצה להוסיף?',
          options: [
            { value: 'bright', label: '☀️ בהיר ושמח' },
            { value: 'moody', label: '🌫 קודר ומסתורי' },
            { value: 'horror', label: '💀 אימה מצמררת' }
          ]
        },
        {
          id: 'objective',
          question: 'מה המטרה?',
          options: [
            { value: 'collect', label: '💎 לאסוף קריסטלים' },
            { value: 'escape', label: '🚪 לברוח החוצה' },
            { value: 'explore', label: '🗺 פשוט לחקור' }
          ]
        }
      ]
    };

    return questions[gameType] || questions.platformer;
  }
};

window.MCQGenerator = MCQGenerator;
