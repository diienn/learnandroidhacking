# LearnAndroidHacking Forum

Free Android modding and reverse engineering community forum.

---

## Project Structure

```
lah-forum/
├── index.html
├── vite.config.js
├── package.json
├── .env              ← your Supabase keys go here (never commit this)
├── .gitignore
└── src/
    ├── main.jsx      ← entry point
    └── App.jsx       ← the forum
```

---

## 1. Install dependencies

```bash
npm install
```

---

## 2. Add your Supabase keys

Open `.env` and fill in your values from Supabase > Settings > API:

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 3. Set up the database

- Go to your Supabase project > SQL Editor
- Paste the contents of `schema.sql` and click Run

---

## 4. Run locally

```bash
npm run dev
```

Opens at http://localhost:5173

---

## 5. Deploy to Vercel (recommended, free)

1. Push this repo to GitHub
2. Go to https://vercel.com and import the repo
3. In Vercel project settings > Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy — Vercel auto-detects Vite and builds it correctly

---

## 6. Deploy to Netlify (alternative, also free)

1. Push to GitHub
2. Go to https://netlify.com > Add new site > Import from Git
3. Build command: `npm run build`
4. Publish directory: `dist`
5. In Site settings > Environment variables, add the same two keys
6. Deploy

---

## 7. Make yourself admin

After registering your account, run this in the Supabase SQL Editor:

```sql
update profiles set role = 'admin' where username = 'YOUR_USERNAME';
```

---

## Notes

- Never commit `.env` — it's in `.gitignore`
- On Vercel/Netlify, env variables are set in the dashboard, not in the repo
- The `schema.sql` file is safe to commit (no secrets in it)
