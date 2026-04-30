/**
 * GLEAM HOMES GUEST ASSISTANT - BACKEND
 * Production-Ready Node.js Server
 * DEBUG MODE ACTIVE
 */
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const { MailtrapClient } = require('mailtrap');
 
const app = express();
app.use(express.json());
 
const SMOOBU_API_KEY = process.env.SMOOBU_API_KEY;
const SMOOBU_ACCOMMODATION_ID = process.env.SMOOBU_ACCOMMODATION_ID;
const MAILTRAP_API_TOKEN = process.env.MAILTRAP_API_TOKEN || 'b785c3d3b2d8ff0547d1d8b5b824eb91';
const ALERT_EMAIL = process.env.ALERT_EMAIL || 'michaelgesierich@gmail.com';
const BOT_NAME = 'Lisa von Gleam Homes';
 
const mailtrapClient = new MailtrapClient({ token: MAILTRAP_API_TOKEN });
const sender = { email: 'bot@gleam-homes.com', name: BOT_NAME };
 
const FAQ_DATABASE = {
  checkInEarly: {
    keywords: ['früher', 'einchecken', '13 uhr', '14 uhr', '15 uhr'],
    confidence: 0.92,
    response: 'Hallo {guestName},\n\nsuper, dass du früher ankommst! Das freut mich. Lass mich prüfen, ob das möglich ist.\n\n**Preise für früheren Check-in:**\n- 🕐 Ab 13:00 Uhr: 25 €\n- 🕐 Ab 14:00 Uhr: 15 €\n- 🕐 Standard ab 16:00 Uhr: kostenlos\n\nFür welche Option entscheidest du dich?\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  checkInStandard: {
    keywords: ['wann check-in', 'checkin zeit', 'ankunft ab wann'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\ngerne! Der Standard Check-in ist ab **16:00 Uhr** möglich.\n\n**So funktioniert\'s beim Ankommen:**\n1. Haustür: Touchdisplay → „Ferienwohnung 52" eingeben → Tür öffnet sich\n2. Mit Lift in die 3. Etage\n3. Wohnungstür: Nuki Keypad → Deinen sechsstelligen Code eingeben\n\nDen Code bekommst du automatisch **24 Stunden vor deiner Anreise** per Nachricht.\n\n**Falls du früher ankommst:** Schreib mir gerne – wir helfen aus, wenn\'s möglich ist.\n\nNoch Fragen?\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  keypad: {
    keywords: ['code', 'keypad', 'nuki', 'schlüssel', 'pin', 'tür öffnen', 'zugangscode', '6-stellig', 'sechsstellig'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\nsuper einfach! Der Zugang funktioniert komplett kontaktlos:\n\n**Haustür (Haupteingang):**\n1. Touchdisplay neben der Briefkasten-Anlage\n2. „Ferienwohnung 52" eingeben (erste 3 Buchstaben reichen)\n3. Nach ~3 Sekunden: Tür öffnet sich automatisch\n4. Mit Lift in die 3. Etage\n\n**Wohnungstür:**\n1. Nuki Keypad (schwarzes Tastfeld über der Tür)\n2. Deinen **sechsstelligen Code** eingeben\n3. Fertig – Tür ist offen!\n\nDen Code bekommst du automatisch **24 Stunden vor Anreise** per Nachricht.\n\nFalls irgendwas nicht klappt, schreib einfach!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  wifi: {
    keywords: ['wifi', 'wlan', 'internet', 'passwort', 'netzwerk', 'qr code'],
    confidence: 0.94,
    response: 'Hallo {guestName},\n\ngerne! Das WiFi-Passwort findest du auf **zwei Wegen**:\n\n**Option 1: QR-Code (schneller)**\nIm Flur der Wohnung hängen die Hausregeln. Dort ist ein **QR-Code** – einfach mit deinem Handy scannen und du bist im WLAN!\n\n**Option 2: Manuell eingeben**\n- 📶 Netzwerkname: **Gleam-Guest**\n- 🔑 Passwort: **gleam2025!**\n\nDas Internet ist sehr schnell und kostenlos im Mietpreis enthalten.\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  parking: {
    keywords: ['parkplatz', 'parken', 'auto', 'garage', 'stellplatz', 'tiefgarage'],
    confidence: 0.95,
    response: 'Hallo {guestName},\n\ndein Parkplatz ist in der Tiefgarage – Stellplatz Nr. 138.\n\n**So funktioniert\'s:**\n- Tiefgaragen-Einfahrt: mittig zwischen den beiden Häuserblocks\n- Handsender: liegt in der Wohnung bereit\n- Tor öffnen → einfahren → Platz 138 (linke Seite)\n- Rückweg: nutze den mittigen Ausgang zur Wohnung\n\nDie genaue Anleitung mit Bildern findest du in deiner digitalen Gästemappe (3 Tage vor Anreise).\n\nNoch Fragen?\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  checkout: {
    keywords: ['check-out', 'abreise', 'wann muss ich raus', 'bis wann'],
    confidence: 0.94,
    response: 'Hallo {guestName},\n\nder Standard Check-out ist bis **11:00 Uhr**.\n\n**Falls du länger bleiben möchtest:**\n- Späterer Check-out bis 14:00 Uhr: 35 €\n- Späterer Check-out bis 18:00 Uhr: 60 €\n\nAlle Details dazu findest du auch in deiner Gästemappe.\n\nSchreib einfach kurz Bescheid, wenn du eine dieser Optionen brauchst – ich prüfe dann die Verfügbarkeit!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  restaurants: {
    keywords: ['restaurant', 'essen', 'empfehlung', 'cafe'],
    confidence: 0.88,
    response: 'Hallo {guestName},\n\ngerne! Du bekommst von mir automatisch ein paar persönliche Tipps per E-Mail – mit den besten Restaurants, Cafés und Bars in der Gegend.\n\nWenn du jetzt schon Ideen brauchst, schreib mir gerne – ich geb dir dann ein paar Geheimtipps!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  breakfast: {
    keywords: ['frühstück', 'breakfast', 'morgens', 'essen', 'kaffee'],
    confidence: 0.92,
    response: 'Hallo {guestName},\n\nes gibt kein Frühstück inklusive. Aber die Wohnung hat eine vollausgestattete Küche – du kannst dir alles selbst zubereiten!\n\nGanz in der Nähe gibt\'s tolle Cafés & Bäckereien. Oder ich gebe dir gerne Tipps!\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  haustiere: {
    keywords: ['hund', 'katze', 'haustier', 'tier', 'pet', 'hunde', 'katzen'],
    confidence: 1.0,
    response: 'Hallo {guestName},\n\nvielen Dank für deine Frage zu Haustieren!\n\nLeider können wir in unseren Apartments **keine Haustiere** erlauben – das gilt für alle unsere Wohnungen.\n\nFalls du eine spezielle Situation hast, schreib mir gerne, dann schauen wir gemeinsam weiter.\n\nViele Grüße,\nLisa von Gleam Homes'
  },
  general: {
    keywords: [],
    confidence: 0.0,
    response: 'Hallo {guestName},\n\ndanke für deine Nachricht! Ich schaue mir das gleich an und melde mich in Kürze bei dir.\n\nFalls es dringend ist, ruf auch gerne an – ich helfe gerne weiter!\n\nViele Grüße,\nLisa von Gleam Homes'
  }
};
 
const FALLBACK_MESSAGE = 'Hallo {guestName},\n\nvielen Dank für deine Frage! Ich bin Lisa, Michaels Assistentin.\n\nIch leite deine Frage sofort an Michael weiter – er meldet sich dann so schnell wie möglich persönlich bei dir mit einer ausführlichen Antwort.\n\nViele Grüße,\nLisa von Gleam Homes';
 
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
 
function generateResponse(categoryKey, guestName, faq) {
  return faq.response.replace('{guestName}', guestName);
}
 
async function sendAlertEmail(guestName, guestQuestion, confidence, reason) {
  try {
    await mailtrapClient.send({
      from: sender,
      to: [{ email: ALERT_EMAIL, name: 'Michael' }],
      subject: '🚨 ALERT: Unsichere Frage von ' + guestName,
      text: 'Hallo Michael,\n\n🚨 ALERT: Unsichere Gäste-Frage erkannt\n\nGast: ' + guestName + '\nFrage: "' + guestQuestion + '"\nBot-Konfidenz: ' + (confidence * 100).toFixed(0) + '%\nGrund: ' + reason + '\n\nBitte antworte dem Gast ausführlich und persönlich in Smoobu!\n\nViele Grüße,\nGleam Homes Bot System'
    });
    console.log('✅ Alert-Email gesendet');
    return true;
  } catch (error) {
    console.error('❌ Fehler Alert-Email:', error);
    return false;
  }
}
 
async function processGuestMessage(guestName, guestQuestion, guestId) {
  console.log('📨 Neue Frage von ' + guestName + ': "' + guestQuestion + '"');
  const { key, faq, confidence } = categorizeQuestion(guestQuestion);
  
  if (key === 'haustiere' || confidence > 0.85) {
    return {
      type: 'AUTO_RESPONSE',
      message: generateResponse(key, guestName, faq),
      needsAlert: false,
    };
  }
 
  if (confidence < 0.60) {
    await sendAlertEmail(guestName, guestQuestion, confidence, 'Bot konnte Frage nicht sicher beantworten');
    return {
      type: 'FALLBACK_WITH_ALERT',
      message: FALLBACK_MESSAGE.replace('{guestName}', guestName),
      alertSent: true,
    };
  }
 
  return {
    type: 'FALLBACK',
    message: FALLBACK_MESSAGE.replace('{guestName}', guestName),
    needsAlert: true,
  };
}
 
async function sendToSmoobu(guestId, message) {
  try {
    const response = await axios.post('https://www.smoobu.com/api/guests/' + guestId + '/messages', {
      message: message,
      attachment_url: null,
    }, {
      headers: {
        'Api-Key': SMOOBU_API_KEY,
        'Content-Type': 'application/json',
      },
    });
    console.log('✅ Nachricht in Smoobu versendet');
    return { success: true, data: response.data };
  } catch (error) {
    console.error('❌ Fehler Smoobu:', error.message);
    return { success: false, error: error.message };
  }
}
 
app.post('/webhook/debug', (req, res) => {
  console.log('\n🔍 DEBUG WEBHOOK EMPFANGEN');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  res.json({ success: true, received: true, timestamp: new Date().toISOString() });
});
 
app.get('/health', (req, res) => {
  res.json({ status: 'OK', bot: BOT_NAME, timestamp: new Date().toISOString() });
});
 
app.post('/webhook/message', async (req, res) => {
  try {
    const { action, data } = req.body;
    
    if (action !== 'newMessage' || data?.sender !== 'guest') {
      return res.json({ success: false });
    }
 
    const messageId = data?.id;
    const bookingId = data?.booking?.id;
    const messageText = data?.message || '';
    const guestName = data?.guest_name || 'Gast';
 
    if (!bookingId || !messageText) {
      return res.status(400).json({ error: 'Missing fields' });
    }
 
    const result = await processGuestMessage(guestName, messageText, bookingId);
    const smoobuResult = await sendToSmoobu(bookingId, result.message);
 
    res.json({
      success: true,
      result: result.type,
      alertSent: result.alertSent || false,
      smoobuDelivery: smoobuResult.success,
      messageId: messageId,
    });
  } catch (error) {
    console.error('❌ Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});
 
app.post('/test/process-message', async (req, res) => {
  const { guestName = 'TestGast', message = 'Wann ist Check-in?' } = req.body;
  const result = await processGuestMessage(guestName, message, 'test-guest');
  res.json({ success: true, input: { guestName, message }, output: { type: result.type, response: result.message } });
});
 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n🚀 GLEAM HOMES ASSISTANT LÄUFT auf Port ' + PORT);
  console.log('✨ Lisa von Gleam Homes\n');
});
 
module.exports = app;
