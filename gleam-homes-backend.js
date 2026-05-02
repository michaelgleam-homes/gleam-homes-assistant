/**
 * GLEAM HOMES GUEST ASSISTANT - BACKEND v2.3
 * Final Optimized Version
 * - Language Detection (DE/EN)
 * - Smart Alert System (ntfy.sh)
 * - Professional Tone with Michael Signature
 * - 1-Minute Polling
 * - First Name Only
 */
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MailtrapClient } = require('mailtrap');

const app = express();
app.use(express.json());

// ─── CONFIGURATION ────────────────────────────────────────────────────────
const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN || 'b785c3d3b2d8ff0547d1d8b5b824eb91';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'michaelgesierich@gmail.com';
const NTFY_CHANNEL = process.env.NTFY_CHANNEL || 'gleam-homes-michael';
const BOT_NAME = 'Lisa von Gleam Homes';
const POLL_INTERVAL_MS = 1 * 60 * 1000; // 1 Minute
const SMOOBU_BASE = 'https://login.smoobu.com/api';

const APARTMENTS = [
  { id: 2878246, name: 'Boutique-Apartment Dresden-Hafencity' },
];

const processedMessageIds = new Set();

const mailtrapClient = new MailtrapClient({ token: MAILTRAP_API_TOKEN });
const sender = { email: 'bot@gleam-homes.com', name: BOT_NAME };

const SIGNATURE_DE = `Viele Grüße,\nLisa von Gleam Homes\nMichael überwacht alle Anfragen und meldet sich bei Bedarf`;

const SIGNATURE_EN = `Best regards,\nLisa from Gleam Homes\nMichael monitors all inquiries and will reach out if needed`;

// ─── LANGUAGE DETECTION ───────────────────────────────────────────────────
function detectLanguage(text) {
  const germanWords = ['ich', 'die', 'der', 'das', 'ein', 'eine', 'wann', 'wie', 'was', 'wo', 'dank', 'danke'];
  const englishWords = ['i', 'the', 'a', 'an', 'when', 'how', 'what', 'where', 'thanks', 'thank'];
  
  const lowerText = text.toLowerCase();
  const germanCount = germanWords.filter(w => lowerText.includes(w)).length;
  const englishCount = englishWords.filter(w => lowerText.includes(w)).length;
  
  return englishCount > germanCount ? 'en' : 'de';
}

// ─── FAQ DATABASE (GERMAN) ────────────────────────────────────────────────
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

// ─── FAQ DATABASE (ENGLISH) ───────────────────────────────────────────────
const FAQ_DATABASE_EN = {
  checkInEarly: {
    keywords: ['early', 'earlier', 'arrive', 'check-in', '1pm', '2pm', '3pm'],
    confidence: 0.92,
    response: (name) => `Hi ${name},\n\ngreat that you're arriving earlier! Let me check what's possible.\n\nEarly check-in fees:\n- From 1:00 PM: €25\n- From 2:00 PM: €15\n- Standard from 4:00 PM: free\n\nWhich option would you prefer?\n\n${SIGNATURE_EN}`
  },
  checkInStandard: {
    keywords: ['when', 'checkin', 'check in', 'arrival', 'arrive'],
    confidence: 0.95,
    response: (name) => `Hi ${name},\n\nof course! Standard check-in is available from 4:00 PM.\n\nHere's how it works on arrival:\n1. Main door: touchscreen → enter "Apartment 52" → door opens\n2. Take the lift to the 3rd floor\n3. Apartment door: Nuki keypad → enter your 6-digit code\n\nYou'll receive the code automatically 24 hours before arrival.\n\nIf you're arriving earlier, just let me know!\n\n${SIGNATURE_EN}`
  },
  keypad: {
    keywords: ['code', 'keypad', 'nuki', 'key', 'access', 'password'],
    confidence: 0.95,
    response: (name) => `Hi ${name},\n\naccess is completely contactless:\n\nMain door:\n1. Touchscreen → enter "Apartment 52"\n2. Door opens in about 3 seconds\n3. Take the lift to the 3rd floor\n\nApartment door:\n1. Nuki keypad (black panel)\n2. Enter your 6-digit code\n3. You're in!\n\nYou'll receive the code 24 hours before arrival.\n\n${SIGNATURE_EN}`
  },
  wifi: {
    keywords: ['wifi', 'internet', 'password', 'network', 'qr'],
    confidence: 0.94,
    response: (name) => `Hi ${name},\n\nyou can find the WiFi password in two ways:\n\nOption 1: Scan the QR code in the hallway\n\nOption 2: Manual entry\n- Network: Gleam-Guest\n- Password: gleam2025!\n\n${SIGNATURE_EN}`
  },
  parking: {
    keywords: ['parking', 'car', 'garage', 'spot', 'space'],
    confidence: 0.95,
    response: (name) => `Hi ${name},\n\nyour parking spot is #138 in the underground garage.\n\nEntrance: in the middle between the building blocks\nThe garage opener is in the apartment.\n\n${SIGNATURE_EN}`
  },
  checkout: {
    keywords: ['checkout', 'departure', 'when', 'leave', 'late'],
    confidence: 0.94,
    response: (name) => `Hi ${name},\n\nstandard check-out is until 11:00 AM.\n\nLate check-out available:\n- Until 2:00 PM: €35\n- Until 6:00 PM: €60\n\nJust let me know if you need an option!\n\n${SIGNATURE_EN}`
  },
  restaurants: {
    keywords: ['restaurant', 'eat', 'food', 'recommendation', 'cafe', 'bar'],
    confidence: 0.88,
    response: (name) => `Hi ${name},\n\nI'd love to give you some tips! Just tell me what you like and I'll share my personal favorites!\n\n${SIGNATURE_EN}`
  },
  breakfast: {
    keywords: ['breakfast', 'morning', 'coffee', 'eat'],
    confidence: 0.92,
    response: (name) => `Hi ${name},\n\nbreakfast is not included, but the apartment has a fully equipped kitchen!\n\nThere are great cafés and bakeries nearby.\n\n${SIGNATURE_EN}`
  },
  pets: {
    keywords: ['pet', 'dog', 'cat', 'animal', 'pets'],
    confidence: 1.0,
    response: (name) => `Hi ${name},\n\nunfortunately, pets are not allowed in our apartments.\n\nFor special cases, feel free to reach out!\n\n${SIGNATURE_EN}`
  },
  cancellation: {
    keywords: ['cancel', 'cancellation', 'refund', 'cancel booking'],
    confidence: 1.0,
    response: (name) => `Hi ${name},\n\nfor your cancellation request, Michael will handle it personally!\n\nHe'll get back to you as soon as possible.\n\n${SIGNATURE_EN}`
  },
  general: {
    keywords: [],
    confidence: 0.0,
    response: (name) => `Hi ${name},\n\nthanks for your message! I'll get back to you soon.\n\n${SIGNATURE_EN}`
  }
};

// ─── SMART MESSAGE FILTERING ─────────────────────────────────────────────
function shouldIgnoreMessage(text) {
  const ignorePatterns = [
    /^(danke|thanks|thank you|ok|okay|alles klar|all good|👍|👌)$/i,
    /^(ja|yes|yep|sure|klar|natürlich|gerne)$/i,
    /^(nein|no|nope)$/i,
    /.*danke.*(aufenthalt|stay|time).*/i,
  ];
  
  return ignorePatterns.some(pattern => pattern.test(text.trim()));
}

// ─── URGENT & COMPLAINT DETECTION ─────────────────────────────────────────
function isUrgent(text) {
  const urgentKeywords = ['notfall', 'emergency', 'eingeschlossen', 'locked', 'wasserschaden', 'flood', 'heizung nicht', 'heating broken'];
  return urgentKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function isComplaint(text) {
  const complaintKeywords = ['schmutzig', 'dirty', 'kaputt', 'broken', 'funktioniert nicht', 'doesn\'t work', 'beschwerde', 'complaint', 'problem'];
  return complaintKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

function isReview(text) {
  const reviewKeywords = ['bewertung', 'review', 'rating', 'stern', 'star'];
  return reviewKeywords.some(keyword => text.toLowerCase().includes(keyword));
}

// ─── CATEGORIZATION ──────────────────────────────────────────────────────
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

// ─── ALERT SYSTEM ────────────────────────────────────────────────────────
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
    const subject = type === 'URGENT' 
      ? `🚨 NOTFALL: ${guestName}`
      : `⚠️ ${type}: ${guestName}`;
    
    await mailtrapClient.send({
      from: sender,
      to: [{ email: ALERT_EMAIL }],
      subject: subject,
      text: `${guestName} (${apartmentName})\n\n"${guestQuestion}"\n\nBitte antworten!`
    });
    return true;
  } catch (error) {
    console.error('❌ Email Error:', error.message);
    return false;
  }
}

// ─── MAIN PROCESSING ─────────────────────────────────────────────────────
async function processGuestMessage(guestName, guestQuestion, apartmentName, isStorniert = false) {
  const firstName = guestName.split(' ')[0];
  
  if (shouldIgnoreMessage(guestQuestion)) {
    return { type: 'IGNORE' };
  }

  if (isStorniert) {
    return { type: 'IGNORE' };
  }

  if (isUrgent(guestQuestion)) {
    await sendNtfyAlert(`🚨 ${firstName}`, guestQuestion, 'urgent');
    await sendAlertEmail(guestName, guestQuestion, 'URGENT', apartmentName);
    return { type: 'URGENT_ALERT' };
  }

  if (isComplaint(guestQuestion)) {
    await sendNtfyAlert(`⚠️ ${firstName}`, guestQuestion, 'high');
    await sendAlertEmail(guestName, guestQuestion, 'COMPLAINT', apartmentName);
    return { type: 'COMPLAINT_ALERT' };
  }

  if (isReview(guestQuestion)) {
    return { type: 'REVIEW_IGNORE' };
  }

  const language = detectLanguage(guestQuestion);
  const { faq, confidence } = categorizeQuestion(guestQuestion, language);

  if (confidence > 0.85) {
    return { type: 'AUTO_RESPONSE', message: faq.response(firstName) };
  }

  if (confidence < 0.60) {
    await sendNtfyAlert(`❓ ${firstName}`, guestQuestion);
    await sendAlertEmail(guestName, guestQuestion, 'QUESTION', apartmentName);
    const fallback = language === 'en'
      ? `Hi ${firstName},\n\nthanks for your question! Michael will reach out personally.\n\n${SIGNATURE_EN}`
      : `Hallo ${firstName},\n\nvielen Dank für deine Frage! Michael meldet sich persönlich.\n\n${SIGNATURE_DE}`;
    return { type: 'FALLBACK_WITH_ALERT', message: fallback };
  }

  const fallback = language === 'en'
    ? `Hi ${firstName},\n\nthanks for your message!\n\n${SIGNATURE_EN}`
    : `Hallo ${firstName},\n\ndanke für deine Nachricht!\n\n${SIGNATURE_DE}`;
  return { type: 'FALLBACK', message: fallback };
}

// ─── SMOOBU API ──────────────────────────────────────────────────────────
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
    const response = await axios.post(
      `${SMOOBU_BASE}/reservations/${reservationId}/messages/send-message-to-guest`,
      { messageBody },
      { headers: smoobuHeaders }
    );
    console.log(`✅ ${reservationId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Send:`, error.response?.status);
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
      const messages = await getReservationMessages(booking.id);
      if (!messages.length) continue;

      const lastMsg = messages[messages.length - 1];
      if (!lastMsg || lastMsg.type !== 1) continue;

      const msgId = `${booking.id}-${lastMsg.id}`;
      if (processedMessageIds.has(msgId)) continue;

      const text = lastMsg.message?.trim();
      if (!text) continue;

      const result = await processGuestMessage(booking['guest-name'], text, apt.name, booking.type === 'cancellation');

      if (result.message) {
        const sent = await sendMessageToGuest(booking.id, result.message);
        if (sent.success) {
          processedMessageIds.add(msgId);
          console.log(`  → ${firstName}: ${result.type}`);
        }
      } else {
        processedMessageIds.add(msgId);
        console.log(`  → ${firstName}: ${result.type}`);
      }
    }
  }
}

function startPolling() {
  console.log(`⏱️ Polling alle ${POLL_INTERVAL_MS / 60000}min`);
  pollAllApartments();
  setInterval(pollAllApartments, POLL_INTERVAL_MS);
}

// ─── ENDPOINTS ───────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    version: '2.3',
    apartments: APARTMENTS.length,
    processedMessages: processedMessageIds.size,
    timestamp: new Date().toISOString()
  });
});

app.post('/poll/now', async (req, res) => {
  await pollAllApartments();
  res.json({ success: true });
});

// ─── START ───────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 GLEAM HOMES v2.3 auf Port ${PORT}`);
  console.log(`✨ ${BOT_NAME} | DE/EN | ntfy + Email`);
  startPolling();
});

module.exports = app;
