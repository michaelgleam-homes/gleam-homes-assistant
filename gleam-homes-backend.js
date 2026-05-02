/**
 * GLEAM HOMES GUEST ASSISTANT - BACKEND
 * Version 2.2 - Correct Smoobu API Endpoints
 */
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MailtrapClient } = require('mailtrap');

const app = express();
app.use(express.json());

const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN || 'b785c3d3b2d8ff0547d1d8b5b824eb91';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'michaelgesierich@gmail.com';
const BOT_NAME = 'Lisa von Gleam Homes';
const POLL_INTERVAL_MS = 3 * 60 * 1000;
const SMOOBU_BASE = 'https://login.smoobu.com/api';

const APARTMENTS = [
  { id: 2878246, name: 'Boutique-Apartment Dresden-Hafencity' },
  // { id: 2983196, name: 'Design-Apartment Marina Garden' },
  // { id: 2200046, name: 'Exklusives Apartment Altstadtnähe' },
  // { id: 3204855, name: 'Green Boutique Apartment II Neustadt' },
  // { id: 3199025, name: 'Green Boutique Apartment I Neustadt' },
  // { id: 2496273, name: 'Modernes Apartment Zentrumsnah' },
  // { id: 2959186, name: 'Stilvolles Boutique-Apartment Neustadt' },
];

const processedMessageIds = new Set();

const mailtrapClient = new MailtrapClient({ token: MAILTRAP_API_TOKEN });
const sender = { email: 'bot@gleam-homes.com', name: BOT_NAME };

const FAQ_DATABASE = {
  checkInEarly: {
    keywords: ['früher', 'früh einchecken', '13 uhr', '14 uhr', '15 uhr'],
    confidence: 0.92,
    response: 'Hallo {guestName},\n\nsuper, dass du früher ankommst! Lass mich prüfen, ob das möglich ist.\n\nPreise für früheren Check-in:\n- Ab 13:00 Uhr: 25 €\n- Ab 14:00 Uhr: 15 €\n- Standard ab 16:00 Uhr: kostenlos\n\nFür welche Option entscheidest du dich?\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  checkInStandard: {
    keywords: ['wann check-in', 'checkin', 'check in', 'ab wann', 'ankunft', 'einchecken'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\ngerne! Der Standard Check-in ist ab 16:00 Uhr möglich.\n\nSo funktioniert\'s beim Ankommen:\n1. Haustür: Touchdisplay → „Ferienwohnung 52" eingeben → Tür öffnet sich\n2. Mit Lift in die 3. Etage\n3. Wohnungstür: Nuki Keypad → Deinen sechsstelligen Code eingeben\n\nDen Code bekommst du automatisch 24 Stunden vor deiner Anreise per Nachricht.\n\nFalls du früher ankommst: Schreib mir gerne!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  keypad: {
    keywords: ['code', 'keypad', 'nuki', 'schlüssel', 'pin', 'tür öffnen', 'zugangscode', '6-stellig', 'sechsstellig'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\nder Zugang funktioniert komplett kontaktlos:\n\nHaustür:\n1. Touchdisplay → „Ferienwohnung 52" eingeben\n2. Tür öffnet sich nach ca. 3 Sekunden\n3. Mit Lift in die 3. Etage\n\nWohnungstür:\n1. Nuki Keypad (schwarzes Tastfeld)\n2. Sechsstelligen Code eingeben\n3. Fertig!\n\nDen Code bekommst du 24 Stunden vor Anreise automatisch.\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  wifi: {
    keywords: ['wifi', 'wlan', 'internet', 'passwort', 'netzwerk', 'qr code'],
    confidence: 0.94,
    response: 'Hallo {guestName},\n\ndas WiFi-Passwort findest du auf zwei Wegen:\n\nOption 1: QR-Code im Flur scannen\n\nOption 2: Manuell eingeben\n- Netzwerk: Gleam-Guest\n- Passwort: gleam2025!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  parking: {
    keywords: ['parkplatz', 'parken', 'auto', 'garage', 'stellplatz', 'tiefgarage'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\ndein Parkplatz ist Stellplatz Nr. 138 in der Tiefgarage.\n\nEinfahrt: mittig zwischen den Häuserblocks\nHandsender liegt in der Wohnung bereit.\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  checkout: {
    keywords: ['check-out', 'checkout', 'abreise', 'wann muss ich raus', 'bis wann', 'auschecken'],
    confidence: 0.94,
    response: 'Hallo {guestName},\n\nder Standard Check-out ist bis 11:00 Uhr.\n\nSpäterer Check-out möglich:\n- Bis 14:00 Uhr: 35 €\n- Bis 18:00 Uhr: 60 €\n\nKurz Bescheid geben wenn du eine Option brauchst!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  restaurants: {
    keywords: ['restaurant', 'essen gehen', 'empfehlung', 'cafe', 'bar', 'trinken'],
    confidence: 0.88,
    response: 'Hallo {guestName},\n\ngerne gebe ich dir Tipps! Schreib mir kurz was du magst und ich schicke dir meine persönlichen Geheimtipps!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  breakfast: {
    keywords: ['frühstück', 'breakfast', 'morgens essen', 'kaffee'],
    confidence: 0.92,
    response: 'Hallo {guestName},\n\nFrühstück ist nicht inklusive. Die Wohnung hat aber eine vollausgestattete Küche!\n\nGanz in der Nähe gibt es tolle Cafés und Bäckereien.\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  haustiere: {
    keywords: ['hund', 'katze', 'haustier', 'tier', 'pet', 'hunde', 'katzen'],
    confidence: 1.0,
    response: 'Hallo {guestName},\n\nleider können wir in unseren Apartments keine Haustiere erlauben.\n\nBei speziellen Situationen melde dich gerne!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  general: {
    keywords: [],
    confidence: 0.0,
    response: 'Hallo {guestName},\n\ndanke für deine Nachricht! Ich melde mich in Kürze bei dir.\n\nViele Grüße,\nLisa von Gleam Homes'
  }
};

const FALLBACK_MESSAGE = 'Hallo {guestName},\n\nvielen Dank für deine Frage! Ich bin Lisa, Michaels Assistentin.\n\nIch leite deine Frage sofort weiter – Michael meldet sich so schnell wie möglich persönlich.\n\nViele Grüße,\nLisa von Gleam Homes';

function categorizeQuestion(text) {
  const lowerText = text.toLowerCase();
  for (const [key, faq] of Object.entries(FAQ_DATABASE)) {
    if (faq.keywords && faq.keywords.length > 0) {
      const matches = faq.keywords.some(keyword => lowerText.includes(keyword));
      if (matches) return { key, faq, confidence: faq.confidence };
    }
  }
  return { key: 'general', faq: FAQ_DATABASE.general, confidence: 0.3 };
}

async function sendAlertEmail(guestName, guestQuestion, confidence, apartmentName) {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email: ALERT_EMAIL, name: 'Michael' }],
      subject: `🚨 ALERT: Unsichere Frage von ${guestName} (${apartmentName})`,
      text: `Hallo Michael,\n\nApartment: ${apartmentName}\nGast: ${guestName}\nFrage: "${guestQuestion}"\nKonfidenz: ${(confidence * 100).toFixed(0)}%\n\nBitte persönlich in Smoobu antworten!\n\nGleam Homes Bot`
    });
    return true;
  } catch (error) {
    console.error('❌ Alert-Email Fehler:', error.message);
    return false;
  }
}

async function processGuestMessage(guestName, guestQuestion, apartmentName) {
  console.log(`📨 ${guestName}: "${guestQuestion}"`);
  const { key, faq, confidence } = categorizeQuestion(guestQuestion);

  if (key === 'haustiere' || confidence > 0.85) {
    return { type: 'AUTO_RESPONSE', message: faq.response.replace('{guestName}', guestName) };
  }

  if (confidence < 0.60) {
    await sendAlertEmail(guestName, guestQuestion, confidence, apartmentName);
    return { type: 'FALLBACK_WITH_ALERT', message: FALLBACK_MESSAGE.replace('{guestName}', guestName) };
  }

  return { type: 'FALLBACK', message: FALLBACK_MESSAGE.replace('{guestName}', guestName) };
}

const smoobuHeaders = {
  'Api-Key': SMOOBU_API_KEY,
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache'
};

async function getActiveReservations(apartmentId) {
  try {
    const today = new Date();
    const from = new Date(today);
    from.setDate(from.getDate() - 7);
    const to = new Date(today);
    to.setDate(to.getDate() + 30);

    const response = await axios.get(`${SMOOBU_BASE}/reservations`, {
      headers: smoobuHeaders,
      params: {
        apartmentId: apartmentId,
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        pageSize: 20,
        excludeBlocked: true
      }
    });

    return response.data?.bookings || [];
  } catch (error) {
    console.error(`❌ Buchungen (${apartmentId}):`, error.response?.status, error.message);
    return [];
  }
}

async function getReservationMessages(reservationId) {
  try {
    const response = await axios.get(
      `${SMOOBU_BASE}/reservations/${reservationId}/messages`,
      { headers: smoobuHeaders }
    );
    return response.data?.messages || [];
  } catch (error) {
    console.error(`❌ Nachrichten (${reservationId}):`, error.response?.status, error.message);
    return [];
  }
}

async function sendMessageToGuest(reservationId, messageBody) {
  try {
    const response = await axios.post(
      `${SMOOBU_BASE}/reservations/${reservationId}/messages/send-message-to-guest`,
      { messageBody },
      { headers: smoobuHeaders }
    );
    console.log(`✅ Gesendet an Buchung ${reservationId}`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Senden (${reservationId}):`, error.response?.status, error.message);
    return { success: false, error: error.message };
  }
}

async function pollAllApartments() {
  console.log(`\n🔄 Polling: ${new Date().toLocaleTimeString('de-DE')}`);

  for (const apartment of APARTMENTS) {
    try {
      const reservations = await getActiveReservations(apartment.id);
      console.log(`🏠 ${apartment.name}: ${reservations.length} Buchungen`);

      for (const reservation of reservations) {
        const reservationId = reservation.id;
        const guestName = reservation['guest-name'] || 'Gast';
        const messages = await getReservationMessages(reservationId);

        if (!messages.length) continue;

        const lastMessage = messages[messages.length - 1];
        if (!lastMessage || lastMessage.type !== 1) continue;

        const messageId = `${reservationId}-${lastMessage.id}`;
        if (processedMessageIds.has(messageId)) continue;

        const messageText = lastMessage.message || '';
        if (!messageText.trim()) continue;

        const result = await processGuestMessage(guestName, messageText, apartment.name);
        const sendResult = await sendMessageToGuest(reservationId, result.message);

        if (sendResult.success) {
          processedMessageIds.add(messageId);
          console.log(`✅ ${guestName} → ${result.type}`);
        }
      }
    } catch (error) {
      console.error(`❌ ${apartment.name}:`, error.message);
    }
  }
}

function startPolling() {
  console.log(`⏱️ Polling alle ${POLL_INTERVAL_MS / 60000} Minuten`);
  pollAllApartments();
  setInterval(pollAllApartments, POLL_INTERVAL_MS);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    bot: BOT_NAME,
    version: '2.2',
    apartments: APARTMENTS.length,
    pollInterval: `${POLL_INTERVAL_MS / 60000} Minuten`,
    processedMessages: processedMessageIds.size,
    timestamp: new Date().toISOString()
  });
});

app.post('/poll/now', async (req, res) => {
  await pollAllApartments();
  res.json({ success: true, message: 'Polling abgeschlossen' });
});

app.post('/test/process-message', async (req, res) => {
  const { guestName = 'TestGast', message = 'Wann ist Check-in?', apartmentName = 'Test' } = req.body;
  const result = await processGuestMessage(guestName, message, apartmentName);
  res.json({ success: true, input: { guestName, message }, output: result });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 GLEAM HOMES ASSISTANT v2.2 auf Port ${PORT}`);
  console.log(`✨ ${BOT_NAME}`);
  console.log(`🏠 Apartments: ${APARTMENTS.length}`);
  startPolling();
});

module.exports = app;
