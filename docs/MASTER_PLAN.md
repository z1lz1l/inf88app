# 88inf — תוכנית עבודה מלאה

## מה בנינו כאן

קוד מוכן להפעלה ל-4 שלבים של יצירת מטבע מקצועי על רשת סולאנה.

---

## סדר ביצוע מדויק

### שלב A — הכנה (יום 1)

1. התקן Node.js מ-nodejs.org
2. צור תיקייה: `mkdir 88inf && cd 88inf`
3. הכנס את כל הקבצים שקיבלת לתיקייה הזאת
4. הרץ: `npm install`
5. צור קובץ `.env` על בסיס `.env.example`
6. הכנס את ה-Private Key של הארנק שלך (Phantom → Settings → Security → Export)

### שלב B — Devnet (ימים 1-2, ללא עלות)

```bash
npm run devnet:create      # יצור טוקן + ימנה 88M
npm run devnet:revoke      # יבטל הדפסת עוד מטבעות
npm run devnet:distribute  # יפזר לארנקים
```

בדוק ב-solscan.io שהכל עבד. שנה ל-cluster=devnet.
וודא:
- "Mint Authority" = Disabled ✓
- "Freeze Authority" = None ✓
- יתרות בארנקים נכונות ✓

### שלב C — Mainnet (יום 3)

כשהכל עובד על devnet:
```bash
npm run mainnet:create
npm run mainnet:revoke
npm run mainnet:distribute
```

עלות: ~0.05 SOL (~$5-7)

### שלב D — נזילות ונעילה (יום 4)

1. **Raydium:** raydium.io → Create Pool
   - Token A: 88INF (הכנס את כתובת המטבע שלך)
   - Token B: SOL
   - כמות 88INF: 35,200,000
   - כמות SOL: שווה ל-$7,000
   - שמור את ה-LP Token שתקבל!

2. **Streamflow:** streamflow.finance → Create Lock
   - Token: LP Token שקיבלת מ-Raydium
   - Duration: 365 days
   - פרסם את לינק הנעילה בכל הרשתות החברתיות

3. **RugCheck:** rugcheck.xyz — הגש את הטוקן לבדיקה
   - ציון A = אמינות מקסימלית

---

## הטוקנומיקה המלאה

| ייעוד | % | כמות | נעילה |
|---|---|---|---|
| נזילות (Raydium) | 40% | 35,200,000 | נעול 12 חודש |
| תגמולי אפליקציה | 30% | 26,400,000 | משוחרר לפי שימוש |
| שיווק/פיתוח | 20% | 17,600,000 | 10% לחודש |
| צוות | 10% | 8,800,000 | נעול 12 חודש |

**מחיר פתיחה:** ~$0.000199
**מחיר ל-$1:** צריך צמיחה של ×5,000 (אפשרי לאורך שנים)

---

## חלוקת עמלת 0.3%

בכל עסקה (קנייה בסופר, העברה, מסחר):

- **0.1%** → Pool של מחזיקים (מחולק אחת לחודש כ-APY)
- **0.1%** → ארנק ops (שיווק ופיתוח)
- **0.1%** → ארנק החברה

**⚠️ שים לב:** Token-2022 גובה את העמלה אוטומטית בכל העברה.
חלוקת ה-0.1% בין מחזיקים דורשת סקריפט נפרד שירוץ אחת לחודש.

---

## לגבי אפליקציית "הכרייה"

### מה לכתוב בתנאי השימוש:
> "88inf Earn is not real cryptocurrency mining. No computational work is performed on your device. You earn 88INF tokens as a reward for your engagement with the app, including viewing advertisements, completing surveys, and daily activity. Token rewards are funded by advertising revenue."

### מקורות ההכנסה לרכישת מטבעות:
1. פרסומות (AdMob/Unity Ads): $0.01–$0.05 לצפייה
2. סקרים (Pollfish): $0.50–$2.00 לסקר
3. Affiliate links: 3-8% עמלה על קניות
4. עמלת 0.1% מהעסקאות

**הכל הולך לרכישת 88INF מהשוק → לחץ קנייה קבוע**

---

## השלב הבא: האפליקציה

לאחר שהטוקן על ה-Mainnet, המשך:

1. **Privy.io** — לארנק מובנה (ללא seed phrase)
2. **Next.js** — ל-frontend האפליקציה
3. **Firebase** — לניהול משתמשים ויתרות וירטואליות
4. **Solana Pay** — לתשלומים בעסקים

---

## רישום בבורסות

| שלב | תוקף | פלטפורמה |
|---|---|---|
| מיידי | יום ההשקה | DexScreener.com |
| שבוע 1 | אחרי 7 ימי מסחר | Birdeye.so |
| חודש 2 | $50K+ volume | CoinGecko (טופס הגשה) |
| חודש 4+ | $200K+ volume | CoinMarketCap |
| שנה+ | בחינה | Binance/Coinbase |

---

## הזהרות חשובות

1. **אל תשתף את ה-PRIVATE_KEY** עם אף אחד — לא עם מפתח, לא עם AI
2. **שמור גיבוי** של ה-seed phrase במקום פיזי
3. **בדוק כפול** את כתובות הארנקים לפני שליחה
4. **התחל devnet** — אין עלות ואפשר לבדוק הכל
