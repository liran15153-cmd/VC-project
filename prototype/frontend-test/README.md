# Gaming Vibe Coding - Frontend Test App

Frontend ׳§׳׳™׳ ׳׳‘׳“׳™׳§׳× ׳”-backend ׳”׳—׳“׳©.

## Run

```powershell
cd "C:\Users\lior\Desktop\CLAUDE FILES\prototype"
npm run frontend
```

Open:

```text
http://localhost:5173
```

Backend default:

```text
http://localhost:3000/api
```

## What You Can Test

- Register / Login / Logout
- Token balance
- Generate MCQ questions
- Generate game with backend AI flow
- Preview playable HTML in iframe
- Inspect JSON / HTML / Assets
- Edit an existing game
- List and load saved games
- Download ZIP
- Delete game
- Admin stats and token grants

## Notes

- First registered user becomes admin if `AUTO_ADMIN_FIRST_USER=true`.
- MCQ and game generation require `OPENAI_API_KEY` in `backend/.env`.
- If a user already exists, use Login instead of Register.

