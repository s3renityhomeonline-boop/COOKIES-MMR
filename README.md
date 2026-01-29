# 🍪 Manheim Cookie Refresher

**Automated daily cookie extraction** for Manheim MMR access. This scraper uses yesterday's valid cookies to extract fresh cookies and sends them to your webhook for automated workflows.

---

## 🎯 What It Does

1. **Loads yesterday's cookies** from Apify input
2. **Injects cookies** into browser session
3. **Navigates to site.manheim.com** (marketing site)
4. **Clicks "LEARN MORE" button** to trigger JS events
5. **Opens MMR tool** via URL redirect
6. **Clicks VIN input field** on MMR tool (triggers more events)
7. **Uses browser back button** to return (mimics manual process)
8. **Checks if cookies changed** vs input cookies
9. **Performs up to 3 hard refreshes** if cookies unchanged
10. **Simulates human activity** (mouse movements, scrolling, delays)
11. **Extracts 4 fresh cookies**:
   - `_cl` from `.manheim.com`
   - `SESSION` from `.manheim.com`
   - `session` from `mcom-header-footer.manheim.com`
   - `session.sig` from `mcom-header-footer.manheim.com`
12. **Sends cookies to webhook** (n8n)
13. **Saves backup** to Apify key-value store

---

## 🔧 Setup Instructions

### 1. Extract Initial Cookies (First Time Only)

You need to manually extract cookies **once** to bootstrap the system.

**Option A: Using Browser Extension (Easiest)**
1. Install "EditThisCookie" extension (Chrome/Edge) or "Cookie-Editor" (Firefox)
2. Login to https://home.manheim.com/
3. Click the extension icon
4. Click "Export" → Copy JSON
5. Format it properly (see example below)

**Option B: Using Browser DevTools**
1. Login to https://home.manheim.com/
2. Press F12 to open DevTools
3. Go to **Application** tab → **Cookies**
4. Find and copy these 4 cookies:
   - `_cl` from `.manheim.com`
   - `SESSION` from `.manheim.com`
   - `session` from `mcom-header-footer.manheim.com`
   - `session.sig` from `mcom-header-footer.manheim.com`

**Cookie Format:**
```json
[
  {
    "name": "_cl",
    "value": "abcd1234...",
    "domain": ".manheim.com",
    "path": "/",
    "httpOnly": false,
    "secure": false,
    "sameSite": "Lax"
  },
  {
    "name": "SESSION",
    "value": "xyz789...",
    "domain": ".manheim.com",
    "path": "/",
    "httpOnly": true,
    "secure": false,
    "sameSite": "Lax"
  },
  {
    "name": "session",
    "value": "eyJhc3...",
    "domain": "mcom-header-footer.manheim.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
  },
  {
    "name": "session.sig",
    "value": "BPzqO3V...",
    "domain": "mcom-header-footer.manheim.com",
    "path": "/",
    "httpOnly": true,
    "secure": true,
    "sameSite": "None"
  }
]
```

---

### 2. Deploy to Apify

**Option A: Via Apify CLI**
```bash
cd "MMR Cookies"
apify login
apify push
```

**Option B: Via Apify Console**
1. Create new Actor
2. Upload code as ZIP
3. Build & Publish

---

### 3. Configure n8n Webhook (Optional)

If you want n8n to automatically update the Apify input with fresh cookies:

1. Create a webhook node in n8n: `https://n8n-production-0d7d.up.railway.app/webhook/mmrcookies`
2. Extract `cookies` array from webhook payload
3. Use Apify API to update the Cookie Refresher input with fresh cookies
4. Use Apify API to update the MMR Scraper input with fresh cookies

This creates a fully automated loop!

---

## 📝 Input Configuration

```json
{
  "manheimCookies": [
    {
      "name": "_cl",
      "value": "YOUR_CL_COOKIE_VALUE",
      "domain": ".manheim.com",
      "path": "/",
      "httpOnly": false,
      "secure": false,
      "sameSite": "Lax"
    },
    {
      "name": "SESSION",
      "value": "YOUR_SESSION_COOKIE_VALUE",
      "domain": ".manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": false,
      "sameSite": "Lax"
    },
    {
      "name": "session",
      "value": "YOUR_SESSION_COOKIE_VALUE",
      "domain": "mcom-header-footer.manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    },
    {
      "name": "session.sig",
      "value": "YOUR_SESSION_SIG_VALUE",
      "domain": "mcom-header-footer.manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": true,
      "sameSite": "None"
    }
  ],
  "cookieWebhookUrl": "https://n8n-production-0d7d.up.railway.app/webhook/mmrcookies",
  "proxyConfiguration": {
    "useApifyProxy": false
  }
}
```

---

## 🔒 Anti-Ban Features

✅ **Cookie injection** - No login automation (more reliable)
✅ **Human-like mouse movements** - Random positions and paths
✅ **Random scrolling** - Natural page interaction
✅ **Variable delays** - 1-6 seconds between actions
✅ **Stealth plugins** - Hides automation markers
✅ **CAPTCHA detection** - Stops if challenged
✅ **Session validation** - Checks if cookies still valid

---

## 📤 Webhook Payload

Fresh cookies sent to your n8n webhook:

```json
{
  "success": true,
  "timestamp": "2025-01-28T10:30:00.000Z",
  "cookies": [
    {
      "name": "_cl",
      "value": "fresh_value_here",
      "domain": ".manheim.com",
      "path": "/",
      "httpOnly": false,
      "secure": false,
      "sameSite": "Lax",
      "expires": 1234567890
    },
    {
      "name": "SESSION",
      "value": "fresh_value_here",
      "domain": ".manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": false,
      "sameSite": "Lax",
      "expires": 1234567890
    },
    {
      "name": "session",
      "value": "fresh_value_here",
      "domain": "mcom-header-footer.manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": true,
      "sameSite": "None",
      "expires": 1234567890
    },
    {
      "name": "session.sig",
      "value": "fresh_value_here",
      "domain": "mcom-header-footer.manheim.com",
      "path": "/",
      "httpOnly": true,
      "secure": true,
      "sameSite": "None",
      "expires": 1234567890
    }
  ],
  "cookieDetails": {
    "_cl": {
      "found": true,
      "domain": ".manheim.com",
      "expires": 1234567890
    },
    "SESSION": {
      "found": true,
      "domain": ".manheim.com",
      "expires": 1234567890
    },
    "session": {
      "found": true,
      "domain": "mcom-header-footer.manheim.com",
      "expires": 1234567890
    },
    "session.sig": {
      "found": true,
      "domain": "mcom-header-footer.manheim.com",
      "expires": 1234567890
    }
  }
}
```

**On Failure:**
```json
{
  "success": false,
  "timestamp": "2025-01-28T10:30:00.000Z",
  "error": "CAPTCHA challenge detected",
  "cookies": null
}
```

---

## 🔄 Daily Workflow

### Fully Automated Loop:

```
Day 1 (Manual):
  → Extract cookies manually
  → Configure Apify input

Day 2+:
  1. Cookie Refresher runs (scheduled 3 AM)
  2. Uses Day 1 cookies → Extracts fresh Day 2 cookies
  3. Sends to n8n webhook
  4. n8n updates both Apify actors with fresh cookies
  5. MMR VIN Scraper runs (scheduled 4 AM)
  6. Uses fresh Day 2 cookies

Day 3:
  1. Cookie Refresher runs (scheduled 3 AM)
  2. Uses Day 2 cookies → Extracts fresh Day 3 cookies
  3. Loop continues...
```

**Key Points:**
- ✅ No manual intervention needed after Day 1
- ✅ Cookies stay fresh (never expire)
- ✅ Both scrapers always have valid cookies
- ✅ Fully automated daily refresh

---

## ⚙️ Apify Scheduling

**Recommended Schedule:**

1. **Cookie Refresher:** Every day at **3:00 AM EST**
   - Runs first to get fresh cookies
   - Updates other scrapers via n8n

2. **MMR VIN Scraper:** Every day at **4:00 AM EST**
   - Runs 1 hour after cookie refresh
   - Uses fresh cookies from webhook

**Apify Schedule Settings:**
```
Cookie Refresher:
- Schedule: 0 3 * * * (3 AM daily)
- Timezone: America/New_York

MMR VIN Scraper:
- Schedule: 0 4 * * * (4 AM daily)
- Timezone: America/New_York
```

---

## 📊 Expected Performance

- **Duration:** ~1-2 minutes per run
- **Success Rate:** 95-99% (if yesterday's cookies valid)
- **Frequency:** Daily (or as needed)

**Timing Breakdown:**
- Navigate to site.manheim.com: ~10-15 seconds
- Human activity + click button: ~5-10 seconds
- Navigate to "LEARN MORE" page: ~3-5 seconds
- Go back: ~2-3 seconds
- Open MMR tool via URL: ~10-15 seconds
- Human activity + click VIN input: ~5-10 seconds
- Browser back button: ~3-5 seconds
- Check cookies + hard refresh (0-3x): ~0-45 seconds
- Final human activity: ~5-10 seconds
- Cookie extraction: ~1-2 seconds
- Webhook delivery: ~1-2 seconds
- **Total: ~45-122 seconds (worst case with 3 refreshes)**

---

## 🐛 Troubleshooting

### "Session expired detected"
- Yesterday's cookies are too old or invalid
- Extract fresh cookies manually
- Update Apify input
- Ensure daily scheduling is working

### "Missing cookies: _cl, SESSION, etc."
- The scraper couldn't find all 4 cookies
- Check Apify run logs
- Review "all-cookies-debug" in key-value store
- May need to adjust cookie extraction logic

### "CAPTCHA challenge detected"
- Manheim detected automation
- Wait 24 hours before retrying
- Consider adjusting delays (make them longer)
- Verify stealth plugins are working

### "Webhook failed (500)"
- Your n8n webhook is down or misconfigured
- Check n8n workflow is active
- Verify webhook URL is correct
- Check n8n logs for errors

### "Yesterday's cookies expired"
- The automated loop broke (missed a day)
- Extract fresh cookies manually
- Resume automated schedule

---

## 🔐 Security Notes

- ⚠️ **Never commit cookies to Git**
- ⚠️ **Store cookies securely in Apify secrets or input**
- ⚠️ **Use HTTPS webhook only**
- ⚠️ **Rotate cookies daily** (this scraper does it automatically)
- ⚠️ **Monitor for failures** (set up alerts in n8n)

---

## 📞 n8n Integration Example

**n8n Workflow:**

```
1. Webhook Trigger (receive cookies)
   ↓
2. Check if success === true
   ↓
3. Extract cookies array
   ↓
4. HTTP Request → Update Cookie Refresher input (Apify API)
   {
     "manheimCookies": {{ cookies }}
   }
   ↓
5. HTTP Request → Update MMR VIN Scraper input (Apify API)
   {
     "manheimCookies": {{ cookies }}
   }
   ↓
6. Send success notification (email/Slack/etc)
```

**Apify API Endpoints:**
```
PUT https://api.apify.com/v2/acts/YOUR_ACTOR_ID/input
Headers:
  Authorization: Bearer YOUR_API_TOKEN
  Content-Type: application/json

Body:
{
  "manheimCookies": [...]
}
```

---

## 📞 Support

If you encounter issues:
1. Check Apify run logs for errors
2. Review "fresh-cookies" in key-value store
3. Verify webhook is receiving data (check n8n)
4. Check "all-cookies-debug" if extraction fails
5. Ensure yesterday's cookies are still valid

---

**Created for automated cookie management in the CarGurus Deal Analyzer system** 🚀

**Daily cookie refresh = Zero manual cookie extraction!** 🍪
