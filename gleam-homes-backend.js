/**
 * GLEAM HOMES GUEST ASSISTANT - BACKEND
 * Production-Ready Node.js Server
 * 
 * Features:
 * - Smoobu API Integration
 * - 26 FAQ mit Lisa
 * - Fallback-System für unsichere Fragen
 * - Mailtrap Email Alerts
 * - Haustier-Erkennung
 * - Zeitbasierte Intelligenz
 * - DEBUG MODE für Webhook-Testing
 */

require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MailtrapClient } = require('mailtrap');

const app = express();
app.use(express.json());

// ========== KONFIGURATION ==========
const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const SMOOBU_ACCOMMODATION_ID = process.env.SMOOBU_ACCOMMODATION_ID;
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN || 'b785c3d3b2d8ff0547d1d8b5b824eb91';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'michaelgesierich@gmail.com';
const BOT_NAME = 'Lisa von Gleam Homes';

// Mailtrap Client
const mailtrapClient = new MailtrapClient({
  token: MAILTRAP_API_TOKEN,
});

const sender = {
  email: 'bot@gleam-homes.com',
  name: BOT_NAME,
};

// ========== FAQ DATABASE ==========
const FAQ_DATABASE = {
  checkInEarly: {
    keywords: ['früher', 'einchecken', '13 uhr', '14 uhr', '15 uhr'],
    confidence: 0.92,
    response: `Hallo {guestName},

super, dass du früher ankommst! Das freut mich. Lass mich prüfen, ob das möglich ist.

**Preise für früheren Check-in:**
- 🕐 Ab 13:00 Uhr: 25 €
- 🕐 Ab 14:00 Uhr: 15 €
- 🕐 Standard ab 16:00 Uhr: kostenlos

Für welche Option entscheidest du dich?

Viele Grüße,
Lisa von Gleam Homes`
  },

  checkInStandard: {
    keywords: ['wann check-in', 'checkin zeit', 'ankunft ab wann'],
    confidence: 0.95,
    response: `Hallo {guestName},

gerne! Der Standard Check-in ist ab **16:00 Uhr** möglich.

**So funktioniert's beim Ankommen:**
1. Haustür: Touchdisplay → „Ferienwohnung 52" eingeben → Tür öffnet sich
2. Mit Lift in die 3. Etage
3. Wohnungstür: Nuki Keypad → Deinen sechsstelligen Code eingeben

Den Code bekommst du automatisch **24 Stunden vor deiner Anreise** per Nachricht.

**Falls du früher ankommst:** Schreib mir gerne – wir helfen aus, wenn's möglich ist.

Noch Fragen?

Viele Grüße,
Lisa von Gleam Homes`
  },

  keypad: {
    keywords: ['code', 'keypad', 'nuki', 'schlüssel', 'pin', 'tür öffnen', 'zugangscode', '6-stellig', 'sechsstellig'],
    confidence: 0.95,
    response: `Hallo {guestName},

super einfach! Der Zugang funktioniert komplett kontaktlos:

**Haustür (Haupteingang):**
1. Touchdisplay neben der Briefkasten-Anlage
2. „Ferienwohnung 52" eingeben (erste 3 Buchstaben reichen)
3. Nach ~3 Sekunden: Tür öffnet sich automatisch
4. Mit Lift in die 3. Etage

**Wohnungstür:**
1. Nuki Keypad (schwarzes Tastfeld über der Tür)
2. Deinen **sechsstelligen Code** eingeben
3. Fertig – Tür ist offen!

Den Code bekommst du automatisch **24 Stunden vor Anreise** per Nachricht.

Falls irgendwas nicht klappt, schreib einfach!

Viele Grüße,
Lisa von Gleam Homes`
  },

  wifi: {
    keywords: ['wifi', 'wlan', 'internet', 'passwort', 'netzwerk', 'qr code'],
    confidence: 0.94,
    response: `Hallo {guestName},

gerne! Das WiFi-Passwort findest du auf **zwei Wegen**:

**Option 1: QR-Code (schneller)**
Im Fl
