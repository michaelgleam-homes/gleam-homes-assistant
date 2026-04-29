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
 
  codeWhen: {
    keywords: ['wann bekomme ich code', 'code wann', 'wann schickst du'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
den **sechsstelligen Zugangscode** bekommst du automatisch **24 Stunden vor deiner Anreise** per Nachricht in Smoobu.
 
**Voraussetzung:** Du hast das Online Checkin-Formular ausgefüllt (Link ist in deiner Gästemappe).
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  wifi: {
    keywords: ['wifi', 'wlan', 'internet', 'passwort', 'netzwerk', 'qr code'],
    confidence: 0.94,
    response: `Hallo {guestName},
 
gerne! Das WiFi-Passwort findest du auf **zwei Wegen**:
 
**Option 1: QR-Code (schneller)**
Im Flur der Wohnung hängen die Hausregeln. Dort ist ein **QR-Code** – einfach mit deinem Handy scannen und du bist im WLAN!
 
**Option 2: Manuell eingeben**
- 📶 Netzwerkname: **Gleam-Guest**
- 🔑 Passwort: **gleam2025!**
 
Das Internet ist sehr schnell und kostenlos im Mietpreis enthalten.
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  wifiProblem: {
    keywords: ['wifi geht nicht', 'internet funktioniert nicht', 'kein wlan', 'offline'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
entschuldigung! Das ist ärgerlich. Hier sind ein paar schnelle Tipps:
 
1. **Router neu starten** (Gerät ausschalten, 30 Sek warten, wieder anschalten)
2. **Netzwerk neu verbinden** (altes Netzwerk löschen, neu suchen)
3. **QR-Code nutzen** (im Flur, einfacher oft als manuell)
4. **Passwort prüfen** (Groß-/Kleinschreibung: gleam2025!)
 
Wenn's immer noch nicht funktioniert, schreib mir kurz Bescheid – ich kümmere mich sofort drum oder helfe dir per Telefon!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  parking: {
    keywords: ['parkplatz', 'parken', 'auto', 'garage', 'stellplatz', 'tiefgarage'],
    confidence: 0.95,
    response: `Hallo {guestName},
 
dein Parkplatz ist in der Tiefgarage – Stellplatz Nr. 138.
 
**So funktioniert's:**
- Tiefgaragen-Einfahrt: mittig zwischen den beiden Häuserblocks
- Handsender: liegt in der Wohnung bereit
- Tor öffnen → einfahren → Platz 138 (linke Seite)
- Rückweg: nutze den mittigen Ausgang zur Wohnung
 
Die genaue Anleitung mit Bildern findest du in deiner digitalen Gästemappe (3 Tage vor Anreise).
 
Noch Fragen?
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  parkingPrice: {
    keywords: ['parkgebühr', 'parken kostet', 'kosten parkplatz'],
    confidence: 0.95,
    response: `Hallo {guestName},
 
gute Nachricht: der Parkplatz in der Tiefgarage ist **kostenlos** im Mietpreis enthalten! Du zahlst nichts extra.
 
Dein Stellplatz (Nr. 138) steht dir während des gesamten Aufenthalts zur Verfügung.
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  guestFolder: {
    keywords: ['gästemappe', 'digitale mappe', 'infos', 'informationen', 'unterlagen', 'pdf', 'dokumente'],
    confidence: 0.90,
    response: `Hallo {guestName},
 
perfekt! Die digitale Gästemappe wird automatisch **3 Tage vor deiner Anreise** per E-Mail versendet.
 
**Darin findest du:**
- WiFi-Passwort & Netzwerkname
- Sechsstelligen Zugangscode für Nuki Keypad
- Genaue Anfahrtsbeschreibung mit Bildern
- Hausregeln & Infos zur Wohnung
- QR-Code zum direkten WLAN-Zugang
- Tipps zu Restaurants & Sehenswürdigkeiten
- Notfallnummern
 
Falls du vorher schon etwas brauchst, schreib mir einfach!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  onlineCheckin: {
    keywords: ['online checkin', 'formular', 'ausfüllen', 'check-in formular'],
    confidence: 0.90,
    response: `Hallo {guestName},
 
das Online Checkin-Formular findest du in deiner **Gästemappe**, die du **3 Tage vor deiner Anreise** per E-Mail erhältst.
 
**Das Formular ist wichtig, weil:**
- Ich deine Kontaktdaten und Ankunftszeit erfasse
- Der Zugangscode nur nach Ausfüllen versendet wird
- Du Sonderwünsche eintragen kannst
 
**Zeitplan:**
- Formular ausfüllen: gerne sofort nach Erhalt der Gästemappe
- Zugangscode: nach Ausfüllen des Formulars
 
Falls du das Formular nicht findest, schreib mir!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  garbage: {
    keywords: ['müll', 'mülltonnen', 'abfall', 'recycling'],
    confidence: 0.95,
    response: `Hallo {guestName},
 
die Mülltonnen befinden sich neben dem Haupteingang des Hauses. Den Schlüssel dazu findest du im Flur der Wohnung – er hängt bereit.
 
**Behälter:**
- Restmüll
- Papier
- Gelber Sack
- Glas
 
Danke, dass du dich darum kümmerst!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  checkout: {
    keywords: ['check-out', 'abreise', 'wann muss ich raus', 'bis wann'],
    confidence: 0.94,
    response: `Hallo {guestName},
 
der Standard Check-out ist bis **11:00 Uhr**.
 
**Falls du länger bleiben möchtest:**
- Späterer Check-out bis 14:00 Uhr: 35 €
- Späterer Check-out bis 18:00 Uhr: 60 €
 
Alle Details dazu findest du auch in deiner Gästemappe.
 
Schreib einfach kurz Bescheid, wenn du eine dieser Optionen brauchst – ich prüfe dann die Verfügbarkeit!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  lateCheckout: {
    keywords: ['später', 'check-out', 'länger bleiben', 'später raus'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
sehr gerne! Ein späterer Check-out ist nach Verfügbarkeit möglich:
 
🕐 Bis 14:00 Uhr: 35 €
🕐 Bis 18:00 Uhr: 60 €
 
Einfach kurz Bescheid geben, dann prüfe ich, ob's klappt und buche das für dich!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  extras: {
    keywords: ['extra', 'zusatz', 'zusatznacht', 'nacht', 'verlängern'],
    confidence: 0.90,
    response: `Hallo {guestName},
 
sehr gerne! Ich biete dir folgende Optionen (je nach Verfügbarkeit):
 
**Check-in/Check-out:**
🕐 Früherer Check-in (ab 13:00 Uhr): 25 €
🕐 Späterer Check-out (bis 14:00 Uhr): 35 €
🕐 Späterer Check-out (bis 18:00 Uhr): 60 €
 
**Zusatznächte:**
🌙 Ab 85 € pro Nacht (saisonal unterschiedlich)
 
Sag gerne Bescheid, was du brauchst – dann prüfe ich Verfügbarkeit und Preis!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  restaurants: {
    keywords: ['restaurant', 'essen', 'empfehlung', 'cafe'],
    confidence: 0.88,
    response: `Hallo {guestName},
 
gerne! Du bekommst von mir automatisch ein paar persönliche Tipps per E-Mail – mit den besten Restaurants, Cafés und Bars in der Gegend.
 
Wenn du jetzt schon Ideen brauchst, schreib mir gerne – ich geb dir dann ein paar Geheimtipps!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  attractions: {
    keywords: ['sehenswürdigkeiten', 'was sehen', 'aktivitäten', 'museen', 'frauenkirche', 'zwinger'],
    confidence: 0.85,
    response: `Hallo {guestName},
 
Dresden hat wirklich viel zu bieten! Die wichtigsten Attraktionen in der Nähe:
 
🏛️ Frauenkirche & Altstadt
🏰 Zwinger Palace
🎭 Semperoper
🌿 Elbradweg (direkt hier, perfekt zum Rad fahren)
🎨 Kunsthofpassage
 
Alles Weitere mit Tipps, Öffnungszeiten & Kartenlinks findest du in der Gästemappe!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  heating: {
    keywords: ['heizung', 'warm', 'kalt', 'temperatur'],
    confidence: 0.90,
    response: `Hallo {guestName},
 
die Heizung kannst du ganz einfach über den Thermostat steuern (an der Wand im Wohnzimmer).
 
**So funktioniert's:**
1. Wunschtemperatur einstellen (z.B. 21-23°C)
2. Das System regelt automatisch nach
3. Für wärmere/kühlere Räume: einzelne Thermostate an den Heizkörpern
 
Die genaue Bedienungsanleitung findest du in der Gästemappe oder ich schicke sie dir gerne!
 
Wenn's nicht funktioniert oder dir Wärme fehlt, schreib mir – ich kümmere mich sofort!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  laundry: {
    keywords: ['wäsche', 'waschen', 'waschmaschine', 'trockner'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
gute Nachricht: es gibt eine **Waschmaschine** in der Wohnung!
 
Du kannst sie während deines Aufenthalts gerne nutzen. Waschmittel und weitere Utensilien sind vorhanden.
 
**Bettwäsche & Handtücher:** Werden 1x pro Woche gewechselt.
 
Falls du Fragen zur Bedienung hast, schreib mir gerne!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  cleaning: {
    keywords: ['reinigung', 'sauber', 'putzen', 'schmutzig'],
    confidence: 0.90,
    response: `Hallo {guestName},
 
die Wohnung wird vor deiner Ankunft gründlich gereinigt. Alles sollte sauberer als sauber sein!
 
**Während deines Aufenthalts:**
- Kleine tägliche Aufräumarbeiten machst du selbst
- Spülmittel & Putzmittel sind vorhanden
- Bei Bedarf: kurz Bescheid sagen
 
Am Ende: einfach aufgeräumt hinterlassen.
 
Danke dafür!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  noise: {
    keywords: ['laut', 'musik', 'nachbarn', 'ruhe', 'lärm'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
ich lege Wert auf gegenseitigen Respekt.
 
**Hausregeln:**
- Nach 22:00 Uhr: Ruhe (Musik, Partys, laute Diskussionen minimieren)
- Nachbarn respektieren (es sind Privatwohnungen)
- Keine Partys/Events erlaubt
- Normales Leben tagsüber ist natürlich okay!
 
Wir wollen, dass du dich entspannst UND deine Nachbarn auch. Danke dafür!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  guestParking: {
    keywords: ['besuch', 'freunde', 'besucherplatz', 'parken besuch'],
    confidence: 0.88,
    response: `Hallo {guestName},
 
natürlich darf dein Besuch vorbei kommen!
 
**Für Parkplätze:**
In der Gästemappe findest du einen Link zu unserem empfohlenen **kostenlosen Parkplatz**. Die Tiefgarage hat leider keinen Platz für weitere Gäste.
 
**Wichtig:**
- Dürfen keine Gäste in der Wohnung übernachten, die nicht auch gebucht haben
- Respekt vor Nachbarn (kein Lärm)
 
Viel Spaß mit Besuch!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  smoking: {
    keywords: ['rauchen', 'nichtraucher', 'zigarette', 'rauch'],
    confidence: 0.95,
    response: `Hallo {guestName},
 
die Wohnung ist Nichtraucherzimmer.
 
**Das bedeutet:**
- Rauchen NICHT in der Wohnung erlaubt
- **Hauseigener Balkon:** Es gibt einen Hausbalkon an der Straßenseite – dort kannst du rauchen, ohne das Haus zu verlassen
- Bitte Kippen verantwortungsvoll entsorgen
- Sicherheitsverletzung = Nebenkosten/Gebühr
 
Wir bitten um Verständnis – die nächsten Gäste sollen auch den gleichen Standard genießen!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  pricingQuestion: {
    keywords: ['wie viel', 'preis', 'kosten', 'gebühren', 'rechnung'],
    confidence: 0.85,
    response: `Hallo {guestName},
 
eine Rechnung sende ich dir selbstverständlich gerne zu!
 
Sag mir einfach Bescheid, wenn du eine benötigst – ich kümmere mich darum.
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  cancellation: {
    keywords: ['stornieren', 'abbrechen', 'cancel', 'rückgeld', 'erstattung'],
    confidence: 0.88,
    response: `Hallo {guestName},
 
Stornierungsbedingungen findest du in deiner Buchungsbestätigung und bei den **jeweiligen Portalen, über die du gebucht hast** (z.B. Booking.com, Airbnb, Smoobu).
 
**Kurz:**
- Je näher zur Anreise: desto weniger Rückgeld
- Die genauen Bedingungen richten sich nach dem Buchungsportal
 
**Was tun?**
- Melde es schnell (je früher, desto besser)
- Schreib Bescheid, warum (falls relevant)
- Ich helfe bei Umbuchung, wenn gewünscht
 
Genaue Bedingungen: siehe Buchungsbestätigung und Portal.
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  breakfast: {
    keywords: ['frühstück', 'breakfast', 'morgens', 'essen', 'kaffee'],
    confidence: 0.92,
    response: `Hallo {guestName},
 
es gibt kein Frühstück inklusive. Aber die Wohnung hat eine vollausgestattete Küche – du kannst dir alles selbst zubereiten!
 
Ganz in der Nähe gibt's tolle Cafés & Bäckereien. Oder ich gebe dir gerne Tipps!
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  haustiere: {
    keywords: ['hund', 'katze', 'haustier', 'tier', 'pet', 'hunde', 'katzen'],
    confidence: 1.0,
    response: `Hallo {guestName},
 
vielen Dank für deine Frage zu Haustieren!
 
Leider können wir in unseren Apartments **keine Haustiere** erlauben – das gilt für alle unsere Wohnungen.
 
Falls du eine spezielle Situation hast, schreib mir gerne, dann schauen wir gemeinsam weiter.
 
Viele Grüße,
Lisa von Gleam Homes`
  },
 
  general: {
    keywords: [],
    confidence: 0.0,
    response: `Hallo {guestName},
 
danke für deine Nachricht! Ich schaue mir das gleich an und melde mich in Kürze bei dir.
 
Falls es dringend ist, ruf auch gerne an – ich helfe gerne weiter!
 
Viele Grüße,
Lisa von Gleam Homes`
  }
};
 
// ========== FALLBACK MESSAGE ==========
const FALLBACK_MESSAGE = `Hallo {guestName},
 
vielen Dank für deine Frage! Ich bin Lisa, Michaels Assistentin.
 
Ich leite deine Frage sofort an Michael weiter – er meldet sich dann so schnell wie möglich persönlich bei dir mit einer ausführlichen Antwort.
 
Viele Grüße,
Lisa von Gleam Homes`;
 
// ========== FUNKTIONEN ==========
 
function categorizeQuestion(text) {
  const lowerText = text.toLowerCase();
  
  for (const [key, faq] of Object.entries(FAQ_DATABASE)) {
    if (faq.keywords && faq.keywords.length > 0) {
      const matches = faq.keywords.some(keyword => lowerText.includes(keyword));
      if (matches) {
        return { key, faq, confidence: faq.confidence };
      }
    }
  }
  
  return { key: 'general', faq: FAQ_DATABASE.general, confidence: 0.3 };
}
 
function generateResponse(categoryKey, guestName, faq) {
  let response = faq.response;
  response = response.replace('{guestName}', guestName);
  return response;
}
 
async function sendAlertEmail(guestName, guestQuestion, confidence, reason) {
  try {
    const recipients = [
      {
        email: ALERT_EMAIL,
        name: 'Michael',
      },
    ];
 
    const emailContent = `Hallo Michael,
 
🚨 ALERT: Unsichere Gäste-Frage erkannt
 
Gast: ${guestName}
Frage: "${guestQuestion}"
Bot-Konfidenz: ${(confidence * 100).toFixed(0)}%
Grund: ${reason}
 
---
 
KONTEXT:
Lisa hat dem Gast diese freundliche Nachricht versendet:
"Ich bin Lisa, Michaels Assistentin. Ich leite deine Frage an Michael weiter – er meldet sich persönlich bei dir."
 
---
 
DEINE AUFGABE:
Bitte antworte dem Gast ausführlich und persönlich in Smoobu!
 
Viele Grüße,
Gleam Homes Bot System`;
 
    await mailtrapClient.send({
      from: sender,
      to: recipients,
      subject: `🚨 ALERT: Unsichere Frage von ${guestName}`,
      text: emailContent,
    });
 
    console.log(`✅ Alert-Email gesendet an ${ALERT_EMAIL}`);
    return true;
  } catch (error) {
    console.error('❌ Fehler beim Senden der Alert-Email:', error);
    return false;
  }
}
 
async function processGuestMessage(guestName, guestQuestion, guestId) {
  console.log(`\n📨 Neue Frage von ${guestName}: "${guestQuestion}"`);
 
  const { key, faq, confidence } = categorizeQuestion(guestQuestion);
 
  console.log(`🤖 Bot-Kategorisierung: ${key} (Konfidenz: ${(confidence * 100).toFixed(0)}%)`);
 
  // Haustier = IMMER direkte Antwort
  if (key === 'haustiere') {
    const response = generateResponse(key, guestName, faq);
    console.log(`✅ Haustier erkannt - direkte Antwort`);
    return {
      type: 'AUTO_RESPONSE',
      message: response,
      needsAlert: false,
    };
  }
 
  // Hohe Konfidenz = normale Antwort
  if (confidence > 0.85) {
    const response = generateResponse(key, guestName, faq);
    console.log(`✅ Hohe Konfidenz - Bot antwortet direkt`);
    return {
      type: 'AUTO_RESPONSE',
      message: response,
      needsAlert: false,
    };
  }
 
  // Niedrige Konfidenz = Fallback + Alert
  if (confidence < 0.60) {
    const fallbackMsg = FALLBACK_MESSAGE.replace('{guestName}', guestName);
    console.log(`⚠️  Niedrige Konfidenz - Fallback + Alert`);
    
    await sendAlertEmail(
      guestName,
      guestQuestion,
      confidence,
      `Bot konnte Frage nicht sicher beantworten`
    );
 
    return {
      type: 'FALLBACK_WITH_ALERT',
      message: fallbackMsg,
      alertSent: true,
    };
  }
 
  const fallbackMsg = FALLBACK_MESSAGE.replace('{guestName}', guestName);
  return {
    type: 'FALLBACK',
    message: fallbackMsg,
    needsAlert: true,
  };
}
 
async function sendToSmoobu(guestId, message) {
  try {
    const url = `https://www.smoobu.com/api/guests/${guestId}/messages`;
    
    const response = await axios.post(url, {
      message: message,
      attachment_url: null,
    }, {
      headers: {
        'Api-Key': SMOOBU_API_KEY,
        'Content-Type': 'application/json',
      },
    });
 
    console.log(`✅ Nachricht in Smoobu versendet`);
    return { success: true, data: response.data };
  } catch (error) {
    console.error(`❌ Fehler beim Senden zu Smoobu:`, error.message);
    return { success: false, error: error.message };
  }
}
 
// ========== API ENDPOINTS ==========
 
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    bot: BOT_NAME,
    timestamp: new Date().toISOString(),
  });
});
 
app.post('/webhook/message', async (req, res) => {
  try {
    const { guestId, guestName, message } = req.body;
 
    if (!guestId || !message) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
 
    const result = await processGuestMessage(guestName || 'Gast', message, guestId);
    const smoobuResult = await sendToSmoobu(guestId, result.message);
 
    res.json({
      success: true,
      result: result.type,
      alertSent: result.alertSent || false,
      smoobuDelivery: smoobuResult.success,
    });
 
  } catch (error) {
    console.error('❌ Fehler:', error);
    res.status(500).json({ error: error.message });
  }
});
 
app.post('/test/process-message', async (req, res) => {
  try {
    const { guestName = 'TestGast', message = 'Wann ist Check-in?' } = req.body;
    const result = await processGuestMessage(guestName, message, 'test-guest');
 
    res.json({
      success: true,
      input: { guestName, message },
      output: {
        type: result.type,
        response: result.message,
        alertSent: result.alertSent || false,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
 
app.post('/test/send-alert', async (req, res) => {
  try {
    const success = await sendAlertEmail(
      'TestGast',
      'Test-Frage',
      0.25,
      'Test-Alert'
    );
 
    res.json({
      success: success,
      message: `Test-Email gesendet an ${ALERT_EMAIL}`,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
 
// ========== SERVER START ==========
const PORT = process.env.PORT || 3000;
 
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║  🏠 GLEAM HOMES GUEST ASSISTANT           ║
║  ✨ Lisa von Gleam Homes                  ║
║                                            ║
║  🚀 Server läuft auf Port ${PORT}          ║
║  📧 Alerts → ${ALERT_EMAIL}     ║
║  🤖 Bot: Ready                             ║
╚════════════════════════════════════════════╝
  `);
});
 
module.exports = app;
