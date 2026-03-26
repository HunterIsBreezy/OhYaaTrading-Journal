# ohYaaa Trading Journal - Landing Page Deployment Guide

## 📁 Files Included

| File | Description |
|------|-------------|
| `landing.html` | Main landing/marketing page (rename to `index.html` for root) |
| `feature-trade-logging.html` | Trade Logging feature detail page |
| `feature-dashboard.html` | Dashboard & Analytics feature detail page |
| `feature-calendar.html` | Calendar View feature detail page |
| `feature-goals.html` | Goals & Challenges feature detail page |
| `feature-mentor.html` | Mentorship feature detail page |
| `favicon.svg` | Browser tab icon |
| `logo-final.svg` | ohYaaa logo (optional, embedded in HTML) |
| `icon-192.svg` | PWA icon 192x192 |
| `icon-512.svg` | PWA icon 512x512 |

---

## 🚀 Deployment Options

### Option 1: Firebase Hosting (Recommended - Same as your app)

Since your app is already on Firebase (`trading-journal-86e97`), this is the easiest:

```bash
# 1. Navigate to your Firebase project folder
cd your-firebase-project

# 2. Create/update the public folder structure
mkdir -p public/features

# 3. Copy files
cp landing.html public/index.html
cp feature-trade-logging.html public/features/trade-logging.html
cp feature-dashboard.html public/features/dashboard.html
cp feature-calendar.html public/features/calendar.html
cp feature-goals.html public/features/goals.html
cp feature-mentor.html public/features/mentor.html
cp favicon.svg public/
cp icon-192.svg public/
cp icon-512.svg public/

# 4. Update firebase.json to handle routing
```

**firebase.json configuration:**
```json
{
  "hosting": {
    "public": "public",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "/app",
        "destination": "/app.html"
      },
      {
        "source": "/app/**",
        "destination": "/app.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.svg",
        "headers": [
          {
            "key": "Content-Type",
            "value": "image/svg+xml"
          }
        ]
      }
    ]
  }
}
```

```bash
# 5. Deploy
firebase deploy --only hosting
```

**Your URLs will be:**
- Landing: `https://trading-journal-86e97.web.app/`
- Trade Logging: `https://trading-journal-86e97.web.app/features/trade-logging.html`
- Dashboard: `https://trading-journal-86e97.web.app/features/dashboard.html`
- Calendar: `https://trading-journal-86e97.web.app/features/calendar.html`
- Goals: `https://trading-journal-86e97.web.app/features/goals.html`
- Mentorship: `https://trading-journal-86e97.web.app/features/mentor.html`
- App: `https://trading-journal-86e97.web.app/app` (your main React app)

---

### Option 2: Vercel

```bash
# 1. Create a new folder
mkdir ohyaaa-landing
cd ohyaaa-landing

# 2. Copy all files and rename landing.html
cp landing.html index.html
mkdir features
cp feature-trade-logging.html features/trade-logging.html
cp feature-dashboard.html features/dashboard.html
cp feature-calendar.html features/calendar.html
cp feature-goals.html features/goals.html
cp feature-mentor.html features/mentor.html
cp favicon.svg .
cp icon-*.svg .

# 3. Deploy
npx vercel
```

---

### Option 3: Netlify

```bash
# 1. Create folder structure (same as Vercel above)

# 2. Drag & drop the folder to netlify.com/drop
# OR use CLI:
npx netlify deploy --prod
```

---

### Option 4: GitHub Pages

```bash
# 1. Create a new repo or use existing
git init
git checkout -b gh-pages

# 2. Rename and organize files
mv landing.html index.html
mkdir features
mv feature-*.html features/
# Rename feature files to remove "feature-" prefix
mv features/feature-trade-logging.html features/trade-logging.html
mv features/feature-dashboard.html features/dashboard.html
mv features/feature-calendar.html features/calendar.html
mv features/feature-goals.html features/goals.html
mv features/feature-mentor.html features/mentor.html

# 3. Commit and push
git add .
git commit -m "Landing page"
git push origin gh-pages

# 4. Enable GitHub Pages in repo settings
```

---

## 🔗 Update Internal Links

The HTML files have links that may need updating based on your deployment:

### Links to Update in `landing.html`:

1. **"Get Started Free" / "Start Trading Smarter" buttons** - Currently link to `/app`:
```html
<a href="/app" ...>Get Started Free</a>
```
Change to your app URL if different (e.g., `https://trading-journal-86e97.web.app/app`)

2. **Feature page links** in the Features dropdown and cards:
```html
<a href="/features/trade-logging.html">Trade Logging</a>
```
These should work as-is if you follow the folder structure above.

3. **Login link** - Currently `/app?login=true`:
```html
<a href="/app?login=true">Login</a>
```

### Links in Feature Pages:

Each feature page has:
- Back to home: `href="/"`
- Try it now buttons: `href="/app"`
- Other feature links: `href="/features/[name].html"`

---

## 📱 Mobile Considerations

All pages are fully responsive. The navigation includes:
- Desktop: Full nav with dropdowns
- Mobile: Hamburger menu with slide-out drawer

---

## 🎨 Customization

### Colors (CSS Variables in each file):
```css
:root {
  --primary: #10b981;      /* Green accent */
  --primary-dark: #059669;
  --bg-dark: #0a0a0a;      /* Background */
  --card-bg: #1a1a1a;      /* Card backgrounds */
}
```

### Logo:
The logo is embedded as inline SVG in each HTML file. To change it, search for the `<svg` tag inside the nav and replace.

---

## ✅ Pre-Launch Checklist

- [ ] Update all `/app` links to your actual app URL
- [ ] Test all navigation links
- [ ] Verify favicon appears in browser tab
- [ ] Test mobile responsive menu
- [ ] Check that "Get Started" buttons work
- [ ] Verify feature page navigation works
- [ ] Test login link redirects correctly

---

## 📞 Support

If you need help with deployment, the key things to remember:
1. `landing.html` should become `index.html` at your root
2. Feature pages go in a `/features/` folder
3. Update any hardcoded URLs to match your domain
4. The app (index.html from your React build) should be at `/app` or `/app.html`
