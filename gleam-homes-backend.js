/**
 * GLEAM HOMES GUEST ASSISTANT - BACKEND v2.8 DEBUG
 * Detailed logging to diagnose message type, age, and processing
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
const NTFY_CHANNEL = process.env.NTFY_CHANNEL || 'gleam-homes-michael';
const BOT_NAME = 'Lisa von Gleam Homes';
const POLL_INTERVAL_MS = 1 * 60 * 1000;
const SMOOBU_BASE = 'https://login.smoobu.com/api';
const MESSAGE_AGE_LIMIT_HOURS = 1;
const CONFIDENCE_THRESHOLD = 0.75;
const MANUAL_OVERRIDE_MINUTES = 30;

const APARTMENTS = [
  { id: 2878246, name: 'Boutique-Apartment Dresden-Hafencity' },
];

const processedMessageIds = new Set();
const lastBotResponseTime = new Map();
const manuallyHandledBookings = new Map();

const mailtrapClient = new MailtrapClient({ token: MAILTRAP_API_TOKEN });
const sender = { email: 'bot@gleam-homes.com', name: BOT_NAME };

const SIGNATURE_DE = `Viele Grüße,\nLisa von Gleam Homes\nMichael überwacht alle Anfragen und meldet sich bei Bedarf`;
const SIGNATURE_EN = `Best regards,\nLisa from Gleam Homes\nMichael monitors all inquiries and will reach out if needed`;

const CRITICAL_PROBLEMS = [
  'garagentor', 'garage nicht', 'vor der tür', 'code geht nicht', 
  'code funktioniert nicht', 'kein internet', 'wifi geht nicht', 'wlan geht nicht',
  'heizung nicht', 'heizung funktioniert', 'rollläden nicht', 'rollläden funktioniert',
  'markise nicht', 'markise funktioniert', 'aufzug nicht', 'aufzug funktioniert',
  'wasser nicht', 'kein wasser', 'strom nicht', 'kein strom',
  'schloss', 'schloss funktioniert', 'türöffner nicht', 'toilette kaputt', 'dusche nicht',
  'notfall', 'emergency', 'wasserschaden', 'flood'
];

function isCriticalProblem(text) {
  const lowerText = text.toLowerCase();
  return CRITICAL_PROBLEMS.some(keyword => lowerText.includes(keyword));
}

function detectLanguage(text) {
  const germanIndicators = text.match(/[äöüß]/g) || [];
  if (germanIndicators.length > 0) return 'de';
  
  const germanWords = ['danke', 'hallo', 'guten', 'schreib', 'code', 'nuki', 'wifi', 'wlan', 'parkplatz', 'zimmer', 'checkin', 'auschecken', 'aufenthalt', 'früh', 'ankunft', 'abreise', 'schlüssel', 'tür', 'wohnung'];
  
  const lowerText = text.toLowerCase();
  const germanCount = germanWords.filter(w => lowerText.includes(w)).length;
  
  if (germanCount >= 1) return 'de';
  return 'en';
}

const FAQ_DATABASE_DE = {
  checkInEarly: {
    keywords: ['früher', 'früh einchecken', '13 uhr', '14 uhr', '15 uhr', 'ankunft', 'einchecken'],
    confidence: 0.92,
    response: (name) => `Hallo ${name},\n\nsuper, dass du früher ankommst! Lass mich prüfen, ob das möglich ist.\n\nPreise für früheren Check-in:\n- Ab 13:00 Uhr: 25 €\n- Ab 14:00 Uhr: 15 €\n- Standard ab 16:00 Uhr: kostenlos\n\nFür welche Option entscheidest du dich?\n\n${SIGNATURE_DE}`
  },
  checkInStandard: {
    keywords: ['wann check-in', 'checkin', 'check in', 'ab wann', 'ankunft', 'einchecken'],
    confidence: 0.95,
    response: (name) => `Hallo ${name},\n\ngerne! Der Standard Check-in ist ab 16:00 Uhr möglich.\n\nSo funktioniert's beim Ankommen:\n1. Haustür: Touchdisplay → „Ferienwohnung 52" eingeben → Tür öffnet sich\n2. Mit Lift in die 3. Etage\n3. Wohnungstür: Nuki Keypad → Deinen sechsstelligen Code eingeben\n\nDen Code bekommst du automatisch 24 Stunden vor deiner Anreise per Nachricht.\n\nFalls du früher ankommst: Schreib mir gerne!\n\n${SIGNATURE_DE}`
  },
  keypad: {
    keywords: ['code', 'keypad', 'nuki', 'schlüssel', 'pin', 'tür öffnen', 'zugangscode'],
    confidence: 0.95,
    response: (name) => `Hallo ${name},\n\nder Zugang funktioniert komplett kontaktlos:\n\nHaustür:\n1. Touchdisplay → „Ferienwohnung 52" eingeben\n2. Tür öffnet sich nach ca. 3 Sekunden\n3. Mit Lift in die 3. Etage\n\nWohnungstür:\n1. Nuki Keypad (schwarzes Tastfeld)\n2. Sechsstelligen Code eingeben\n3. Fertig!\n\nDen Code bekommst du 24 Stunden vor Anreise automatisch.\n\n${SIGNATURE_DE}`
  },
  wifi: {
    keywords: ['wifi', 'wlan', 'internet', 'passwort', 'netzwerk', 'qr code'],
    confidence: 0.94,
    response: (name) => `Hallo ${name},\n\ndas WiFi-Passwort findest du auf zwei Wegen:\n\nOption 1: QR-Code im Flur scannen\n\nOption 2: Manuell eingeben\n- Netzwerk: Gleam-Guest\n- Passwort: gleam2025!\n\n${SIGNATURE_DE}`
  },
  parking: {
    keywords: ['parkplatz', 'parken', 'auto', 'garage', 'stellplatz', 'tiefgarage'],
    confidence: 0.95,
    response: (name) => `Hallo ${name},\n\ndein Parkplatz ist Stellplatz Nr. 138 in der Tiefgarage.\n\nEinfahrt: mittig zwischen den Häuserblocks\nHandsender liegt in der Wohnung bereit.\n\n${SIGNATURE_DE}`
  },
  checkout: {
    keywords: ['check-out', 'checkout', 'abreise', 'wann muss ich raus', 'bis wann', 'auschecken'],
    confidence: 0.94,
    response: (name) => `Hallo ${name},\n\nder Standard Check-out ist bis 11:00 Uhr.\n\nSpäterer Check-out möglich:\n- Bis 14:00 Uhr: 35 €\n- Bis 18:00 Uhr: 60 €\n\nKurz Bescheid geben wenn du eine Option brauchst!\n\n${SIGNATURE_DE}`
  },
  restaurants: {
    keywords: ['restaurant', 'essen gehen', 'empfehlung', 'cafe', 'bar', 'trinken'],
    confidence: 0.88,
    response: (name) => `Hallo ${name},\n\ngerne gebe ich dir Tipps! Schreib mir kurz was du magst und ich schicke dir meine persönlichen Geheimtipps!\n\n${SIGNATURE_DE}`
  },
  breakfast: {
    keywords: ['frühstück', 'breakfast', 'morgens essen', 'kaffee'],
    confidence: 0.92,
    response: (name) => `Hallo ${name},\n\nFrühstück ist nicht inklusive. Die Wohnung hat aber eine vollausgestattete Küche!\n\nGanz in der Nähe gibt es tolle Cafés und Bäckereien.\n\n${SIGNATURE_DE}`
  },
  pets: {
    keywords: ['hund', 'katze', 'haustier', 'tier', 'pet', 'hunde', 'katzen'],
    confidence: 1.0,
    response: (name) => `Hallo ${name},\n\nleider können wir in unseren Apartments keine Haustiere erlauben.\n\nBei speziellen Situationen melde dich gerne!\n\n${SIGNATURE_DE}`
  },
  cancellation: {
    keywords: ['stornierung', 'stornieren', 'absage', 'absagen', 'kündigung', 'kündigen'],
    confidence: 1.0,
    response: (name) => `Hallo ${name},\n\nfür deine Stornierungsanfrage kümmere ich mich persönlich!\n\nMichael meldet sich so schnell wie möglich bei dir.\n\n${SIGNATURE_DE}`
  },
  general: {
    keywords: [],
    confidence: 0.0,
    response: (name) => `Hallo ${name},\n\ndanke für deine Nachricht! Ich melde mich in Kürze bei dir.\n\n${SIGNATURE_DE}`
  }
};

const FAQ_DATABASE_EN = {
  checkInStandard: {
    keywords: ['when', 'checkin', 'check in', 'arrival', 'arrive'],
    confidence: 0.95,
    response: (name) => `Hi ${name},\n\nof course! Standard check-in is available from 4:00 PM.\n\n${SIGNATURE_EN}`
  },
  general: {
    keywords: [],
    confidence: 0.0,
    response: (name) => `Hi ${name},\n\nthanks for your message! I'll get back to you soon.\n\n${SIGNATURE_EN}`
  }
};

function shouldIgnoreMessage(text) {
  const ignorePatterns = [
    /^(danke|thanks|thank you|ok|okay|alles klar|all good|👍|👌)$/i,
    /^(ja|yes|yep|sure|klar|natürlich|gerne|si|da|tak|да)$/i,
    /^(nein|no|nope|nie|nee|не|nie)$/i,
    /.*danke.*(aufenthalt|stay|time).*/i,
  ];
  
  return ignorePatterns.some(pattern => pattern.test(text.trim()));
}

function isMessageTooOld(messageTimestamp) {
  const now = new Date();
  const ageHours = (now - new Date(messageTimestamp)) / (1000 * 60 * 60);
  return ageHours > MESSAGE_AGE_LIMIT_HOURS;
}

function isComplaint(text) {
  const complaintKeywords = ['schmutzig', 'dirty', 'kaputt', 'broken', 'funktioniert nicht', 'doesn\'t work', 'beschwerde', 'complaint', 'problem'];
  return complaintKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function isReview(text) {
  const reviewKeywords = ['bewertung', 'review', 'rating', 'stern', 'star'];
  return reviewKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function categorizeQuestion(text, language = 'de') {
  const faqDb = language === 'en' ? FAQ_DATABASE_EN : FAQ_DATABASE_DE;
  const lowerText = text.toLowerCase();
  
  for (const [key, faq] of Object.entries(faqDb)) {
    if (faq.keywords && faq.keywords.length > 0) {
      const matches = faq.keywords.some(keyword => lowerText.includes(keyword));
      if (matches) return { key, faq, confidence: faq.confidence };
    }
  }
  return { key: 'general', faq: faqDb.general, confidence: 0.3 };
}

async function sendNtfyAlert(title, message, priority = 'default') {
  try {
    await axios.post(`https://ntfy.sh/${NTFY_CHANNEL}`, message, {
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': 'warning'
      }
    });
    return true;
  } catch (error) {
    console.error('❌ Ntfy Error:', error.message);
    return false;
  }
}

async function sendAlertEmail(guestName, guestQuestion, type, apartmentName) {
  try {
    const subject = type === 'CRITICAL' 
      ? `🚨 KRITISCHES PROBLEM: ${guestName}`
      : `❓ FRAGE: ${guestName}`;
    
    await mailtrapClient.send({
      from: sender,
      to: [{ email: ALERT_EMAIL }],
      subject: subject,
      text: `${guestName} (${apartmentName})\n\n"${guestQuestion}"\n\nBitte persönlich antworten!`
    });
    return true;
  } catch (error) {
    console.error('❌ Email Error:', error.message);
    return false;
  }
}

async function processGuestMessage(guestName, guestQuestion, apartmentName, isStorniert = false) {
  const firstName = guestName.split(' ')[0];
  
  if (shouldIgnoreMessage(guestQuestion)) {
    return { type: 'IGNORE' };
  }

  if (isStorniert) {
    return { type: 'IGNORE' };
  }

  if (isCriticalProblem(guestQuestion)) {
    await sendNtfyAlert(`🚨 KRITISCH: ${firstName}`, guestQuestion, 'urgent');
    await sendAlertEmail(guestName, guestQuestion, 'CRITICAL', apartmentName);
    const fallback = detectLanguage(guestQuestion) === 'en'
      ? `Hi ${firstName},\n\nI'm reaching out to Michael immediately!\n\n${SIGNATURE_EN}`
      : `Hallo ${firstName},\n\nMichael kümmert sich sofort!\n\n${SIGNATURE_DE}`;
    return { type: 'CRITICAL_ALERT', message: fallback };
  }

  if (isComplaint(guestQuestion)) {
    await sendNtfyAlert(`⚠️ BESCHWERDE: ${firstName}`, guestQuestion, 'high');
    await sendAlertEmail(guestName, guestQuestion, 'COMPLAINT', apartmentName);
    return { type: 'COMPLAINT_ALERT' };
  }

  if (isReview(guestQuestion)) {
    return { type: 'REVIEW_IGNORE' };
  }

  const language = detectLanguage(guestQuestion);
  const { faq, confidence } = categorizeQuestion(guestQuestion, language);

  if (confidence > CONFIDENCE_THRESHOLD) {
    return { type: 'AUTO_RESPONSE', message: faq.response(firstName) };
  }

  await sendNtfyAlert(`❓ FRAGE: ${firstName}`, guestQuestion);
  await sendAlertEmail(guestName, guestQuestion, 'QUESTION', apartmentName);
  const fallback = language === 'en'
    ? `Hi ${firstName},\n\nthanks for your question! Michael will reach out personally.\n\n${SIGNATURE_EN}`
    : `Hallo ${firstName},\n\nvielen Dank für deine Frage! Michael meldet sich persönlich.\n\n${SIGNATURE_DE}`;
  return { type: 'FALLBACK_WITH_ALERT', message: fallback };
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
        apartmentId,
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
        pageSize: 20,
        excludeBlocked: true
      }
    });

    return response.data?.bookings || [];
  } catch (error) {
    console.error(`❌ Buchungen:`, error.response?.status);
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
    return [];
  }
}

async function sendMessageToGuest(reservationId, messageBody) {
  try {
    console.log(`📤 Sende an ${reservationId}: "${messageBody.substring(0, 50)}..."`);
    
    const response = await axios.post(
      `${SMOOBU_BASE}/reservations/${reservationId}/messages/send-message-to-guest`,
      { messageBody },
      { headers: smoobuHeaders }
    );
    
    console.log(`✅ SUCCESS ${reservationId}: status=${response.status}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ FEHLER ${reservationId}:`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    return { success: false };
  }
}

// ─── POLLING ─────────────────────────────────────────────────────────────
async function pollAllApartments() {
  console.log(`\n🔄 Polling: ${new Date().toLocaleTimeString('de-DE')}`);

  for (const apt of APARTMENTS) {
    const bookings = await getActiveReservations(apt.id);
    console.log(`🏠 ${apt.name}: ${bookings.length} Buchungen`);

    for (const booking of bookings) {
      const firstName = booking['guest-name'].split(' ')[0];
      const bookingId = booking.id;
      const now = new Date();

      if (lastBotResponseTime.has(bookingId)) {
        const lastResponseTime = lastBotResponseTime.get(bookingId);
        const secondsSinceResponse = (now - lastResponseTime) / 1000;
        if (secondsSinceResponse < 3 * 60) {
          continue;
        }
      }

      const messages = await getReservationMessages(bookingId);
      if (!messages.length) continue;

      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || !lastMsg.message) continue;

      const msgId = `${bookingId}-${lastMsg.id}`;
      if (processedMessageIds.has(msgId)) continue;

      const text = lastMsg.message?.trim();
      if (!text) continue;

      // ✅ DEBUG: Log message details
      console.log(`\n📝 DEBUG ${firstName}:`);
      console.log(`   ID: ${lastMsg.id}`);
      console.log(`   Type: ${lastMsg.type} (1=guest, 2=host)`);
      console.log(`   Created: ${lastMsg.created || lastMsg.createdAt}`);
      console.log(`   Message: "${text.substring(0, 50)}..."`);

      // CHECK MESSAGE AGE FIRST
      if (isMessageTooOld(lastMsg.created || lastMsg.createdAt)) {
        processedMessageIds.add(msgId);
        console.log(`   → ZU ALT (>1h)`);
        continue;
      }

      // CHECK 30MIN SILENCE
      if (lastMsg.type === 2) {
        const guestMessageExists = messages.length > 1 && messages[messages.length - 2]?.type === 1;
        
        if (guestMessageExists) {
          manuallyHandledBookings.set(bookingId, now);
          console.log(`   → MICHAEL ANTWORTET (30min Stille)`);
          continue;
        } else {
          processedMessageIds.add(msgId);
          console.log(`   → NUR BUCHUNGSBESTÄTIGUNG`);
          continue;
        }
      }

      // CHECK IF IN SILENCE
      if (manuallyHandledBookings.has(bookingId)) {
        const lastManualTime = manuallyHandledBookings.get(bookingId);
        const minutesSinceManual = (now - lastManualTime) / (1000 * 60);
        if (minutesSinceManual < MANUAL_OVERRIDE_MINUTES) {
          console.log(`   → IN 30MIN STILLE (${Math.round(MANUAL_OVERRIDE_MINUTES - minutesSinceManual)}min)`);
          continue;
        } else {
          manuallyHandledBookings.delete(bookingId);
        }
      }

      // PROCESS MESSAGE
      console.log(`   → VERARBEITE...`);
      const result = await processGuestMessage(booking['guest-name'], text, apt.name, booking.type === 'cancellation');

      if (result.message) {
        console.log(`   → Sende ${result.type}`);
        const sent = await sendMessageToGuest(bookingId, result.message);
        if (sent.success) {
          processedMessageIds.add(msgId);
          lastBotResponseTime.set(bookingId, now);
          console.log(`   ✅ ERFOLG`);
        } else {
          console.log(`   ❌ SEND FEHLER`);
        }
      } else {
        processedMessageIds.add(msgId);
        console.log(`   → ${result.type}`);
      }
    }
  }
}

function startPolling() {
  console.log(`⏱️ Polling alle ${POLL_INTERVAL_MS / 60000}min`);
  console.log(`🔧 v2.8 DEBUG: Detailliertes Logging aktiviert`);
  pollAllApartments();
  setInterval(pollAllApartments, POLL_INTERVAL_MS);
}

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '2.8 DEBUG',
    apartments: APARTMENTS.length,
    timestamp: new Date().toISOString()
  });
});

app.post('/poll/now', async (req, res) => {
  await pollAllApartments();
  res.json({ success: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 GLEAM HOMES v2.8 DEBUG auf Port ${PORT}`);
  console.log(`✨ Detailliertes Message-Logging aktiviert`);
  startPolling();
});

module.exports = app;
