# TradeLog: trading journal (React + Node/Express + MongoDB)

Opens straight to your dashboard (no login page). Pages: Today, Add trade (General + Psychology tabs), Trades, Insights, Nifty OI, Profile.
Your 7 rules are built in: the Exit Track, the rule check on every trade, the day-stop after 2 losing trades, and the next-expiry hint.

## A. Run it on your PC
1. Install Node.js 20 or newer (LTS) from nodejs.org.
2. Open a terminal in this folder and run: `npm run install:all`
3. Copy `server/.env.example` to `server/.env` and fill `MONGODB_URI`
   (Atlas -> your cluster -> Connect -> Drivers -> copy the string, put your real DB password in
   place of <db_password>, and add `/trading_journal` right before the `?`).
   If the password has symbols like @ # / :, URL-encode them.
4. Atlas -> Network Access -> make sure your current IP is in the list.
5. Start: `npm run build` then `npm start`, open http://localhost:5000
   (while editing code, use two terminals: `npm run dev:server` and `npm run dev:client`, open http://localhost:5173).

## B. Put it online (Render + Atlas)
1. Create a GitHub repo and push this folder (`.env` is ignored, so your password is not uploaded).
2. render.com -> New -> Web Service -> pick the repo. Region: Singapore. Settings:
   Build command: `npm run build`   Start command: `npm start`
3. Environment variables: `MONGODB_URI` (same string), `APP_KEY` (any long secret; the app asks for it once per device).
4. Atlas -> Network Access -> Add IP -> 0.0.0.0/0 (Render's free IPs change). Use a strong DB password.
5. Open the Render URL. Free plans sleep after idle time; the first load can take about a minute.

## C. Install as an app / shortcut
- Android Chrome: menu (three dots) -> Install app.
- iPhone Safari: Share -> Add to Home Screen.
- Windows/Mac Chrome or Edge: install icon in the address bar, or menu -> Save and share -> Install.
The Profile page also shows an "Install app" button when your browser allows it.

## D. About the live Nifty OI
- Source: the same JSON the nseindia.com option-chain page uses (server/services/nse.js). It is not an official API.
- NSE often blocks servers outside India and can change the endpoint. If the OI page says "unavailable" when hosted, run the app on your own PC while you trade, or host on an India-region server, or replace nse.js with a broker API (e.g. Groww).
- Data refreshes every 30 s in market hours. It is context for your 5 min confirmation, not a trade signal.

## E. Files
server/index.js (API + serves the site), server/models (Trade, Profile, Day), server/routes, server/services/nse.js
client/src/rules.js (your rules as code), client/src/pages/* (screens), client/src/styles.css
