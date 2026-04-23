# 88inf — Deployment Guide
# איך להעלות את הכל לאוויר

## תשתית מומלצת (עלות: ~$20/חודש)

| רכיב | שירות | עלות |
|---|---|---|
| Frontend (אפליקציה) | Vercel | חינם |
| Backend (API) | Railway | $5/חודש |
| Database | Firebase Firestore | חינם עד 1GB |
| Auth | Firebase + Privy | חינם עד 100K users |
| Solana RPC | Helius | חינם עד 100K req/day |
| Domain | Namecheap | ~$10/שנה |

---

## שלב 1: Firebase

```bash
# התקן Firebase CLI
npm install -g firebase-tools

# התחבר
firebase login

# אתחל בתיקיית הפרויקט
firebase init

# בחר: Firestore, Authentication
# Project: 88inf (שאתה יצרת בקונסול)

# פרוס את חוקי האבטחה
firebase deploy --only firestore:rules
```

---

## שלב 2: Vercel (Frontend)

```bash
# התקן Vercel CLI
npm install -g vercel

# בתיקיית הפרויקט
vercel

# הוסף את כל משתני הסביבה מ-.env.full.example
# דרך: vercel.com → Project → Settings → Environment Variables
```

הגדר את ה-domain:
- vercel.com → Project → Settings → Domains
- הוסף: `app.88inf.com`
- הגדר CNAME ב-Namecheap: `app` → `cname.vercel-dns.com`

---

## שלב 3: Railway (Backend API)

```bash
# התקן Railway CLI
npm install -g @railway/cli

# התחבר
railway login

# בתיקיית server/
railway init
railway up
```

הגדר env vars ב-Railway dashboard:
- `FIREBASE_SERVICE_ACCOUNT`
- `TREASURY_PRIVATE_KEY`
- `CRON_SECRET`
- `SOLANA_RPC`
- `MINT_ADDRESS`
- `ALLOWED_ORIGIN=https://app.88inf.com`

---

## שלב 4: Cron Jobs

הגדר ב-Railway או ב-GitHub Actions:

```yaml
# .github/workflows/cron.yml

name: 88inf Cron Jobs

on:
  schedule:
    # Every 6 hours — process withdrawals
    - cron: '0 */6 * * *'
    # Every hour — ad buyback
    - cron: '0 * * * *'
    # 1st of month — APY distribution
    - cron: '0 0 1 * *'

jobs:
  withdrawals:
    runs-on: ubuntu-latest
    steps:
      - name: Process withdrawals
        run: |
          curl -X POST https://api.88inf.com/api/process-withdrawals \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"

  apy:
    if: github.event.schedule == '0 0 1 * *'
    runs-on: ubuntu-latest
    steps:
      - name: Distribute APY
        run: |
          curl -X POST https://api.88inf.com/api/distribute-apy \
            -H "x-cron-secret: ${{ secrets.CRON_SECRET }}"
```

הוסף `CRON_SECRET` ב: GitHub → Repo → Settings → Secrets

---

## שלב 5: Helius RPC (Solana node מהיר)

1. היכנס ל-helius.dev
2. צור חשבון חינמי
3. צור API key חדש
4. העתק את ה-URL: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
5. הכנס לכל ה-env vars

למה Helius ולא ה-RPC הציבורי?
- ציבורי: 5-10 שניות תגובה, לא אמין
- Helius free: 100ms תגובה, 100K req/day — מספיק לבטא

---

## שלב 6: AdSense (לפרסומות)

1. היכנס ל-adsense.google.com
2. הגש בקשה עם הדומיין שלך
3. ה-approval לוקח 2-7 ימים
4. אחרי אישור: קבל publisher ID
5. הכנס ל-layout.tsx את ה-script tag

**חשוב:** AdSense דורש תוכן אמיתי באתר לפני הגשה.
בנה כמה דפי landing page עם תוכן על 88INF קודם.

---

## צ'קליסט לפני השקה

### טכני
- [ ] טוקן נוצר על Mainnet
- [ ] Mint authority בוטל (Solscan מראה "Disabled")
- [ ] Freeze authority = None
- [ ] נזילות הוספה ל-Raydium
- [ ] LP tokens נעולים ב-Streamflow (לינק פרסמת?)
- [ ] Firebase Firestore rules פורסו
- [ ] API עולה על Railway
- [ ] Frontend עולה על Vercel
- [ ] Cron jobs פועלים

### שיווק (לפני היום הראשון)
- [ ] Twitter/X: @88inf
- [ ] Telegram group
- [ ] Discord server
- [ ] GitHub repo (קוד חוזה פתוח)
- [ ] לינק נעילת נזילות מ-Streamflow — ציוץ ראשון
- [ ] רישום ב-RugCheck.xyz
- [ ] רישום ב-DexScreener (אוטומטי אחרי עסקה ראשונה)

### אחרי שבוע
- [ ] הגש ל-CoinGecko (צריך $50K+ volume)
- [ ] הגש ל-CoinMarketCap
- [ ] גייס עסק אחד לקבלת תשלום

---

## מבנה הקבצים הסופי

```
88inf/
├── app/                    ← Next.js frontend
│   ├── layout.tsx
│   └── page.tsx            ← Earn dashboard
├── lib/
│   ├── firebase.ts         ← Firebase init + helpers
│   ├── wallet.ts           ← Privy wallet integration
│   ├── ads.ts              ← Ad integration
│   └── price.ts            ← DexScreener price feed
├── merchant/
│   └── terminal.tsx        ← Payment terminal for businesses
├── server/
│   ├── api.ts              ← Express backend
│   └── cron.ts             ← Scheduled jobs
├── scripts/                ← Blockchain scripts
│   ├── 01_create_token.ts
│   ├── 02_revoke_mint.ts
│   └── 03_distribute.ts
├── firestore.rules         ← Database security
├── .env.full.example       ← All env vars template
├── MASTER_PLAN.md          ← Full roadmap
└── TERMS_EARN.md           ← Legal text for earn section
```
