const Alexa = require('ask-sdk-core');
const https = require('https');

// ── Config ──────────────────────────────────────────────────────────────────
// Collez votre webhook token ici (récupéré dans l'app Biberonnade → bouton ⚡)
const WEBHOOK_TOKEN = process.env.WEBHOOK_TOKEN || 'VOTRE_TOKEN_ICI';
const FIREBASE_HOST = 'suivi-biberon-default-rtdb.europe-west1.firebasedatabase.app';

// ── Envoi vers Firebase ──────────────────────────────────────────────────────
function postToFirebase(data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ ...data, datetime: new Date().toISOString() });
    const options = {
      hostname: FIREBASE_HOST,
      path:     `/ifttt_inbox/${WEBHOOK_TOKEN}.json`,
      method:   'POST',
      headers:  {
        'Content-Type':   'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(options, res => { res.resume(); res.on('end', resolve); });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getSlotValue(slots, name) {
  const slot = slots && slots[name];
  if (!slot) return null;
  // Valeur résolue (custom slot)
  const resolutions = slot.resolutions && slot.resolutions.resolutionsPerAuthority;
  if (resolutions && resolutions[0] && resolutions[0].values) {
    return resolutions[0].values[0].value.id;
  }
  return slot.value || null;
}

// ── Handlers ─────────────────────────────────────────────────────────────────

const LaunchHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'LaunchRequest';
  },
  handle(h) {
    const msg = 'Biberonnade à l\'écoute. '
      + 'Dites sein gauche, sein droit, les deux seins, '
      + 'ou biberon maternel, ou biberon poudre cent vingt millilitres.';
    return h.responseBuilder
      .speak(msg)
      .reprompt('Quel type de tétée ?')
      .getResponse();
  },
};

const SeinGaucheHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(h.requestEnvelope) === 'SeinGaucheIntent';
  },
  async handle(h) {
    await postToFirebase({ type: 'sein_gauche' });
    return h.responseBuilder.speak('Sein gauche enregistré.').getResponse();
  },
};

const SeinDroitHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(h.requestEnvelope) === 'SeinDroitIntent';
  },
  async handle(h) {
    await postToFirebase({ type: 'sein_droit' });
    return h.responseBuilder.speak('Sein droit enregistré.').getResponse();
  },
};

const LesDeuxHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(h.requestEnvelope) === 'LesDeuxIntent';
  },
  async handle(h) {
    await postToFirebase({ type: 'les_deux' });
    return h.responseBuilder.speak('Les deux seins enregistrés.').getResponse();
  },
};

const BiberonHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(h.requestEnvelope) === 'BiberonIntent';
  },
  async handle(h) {
    const slots    = h.requestEnvelope.request.intent.slots;
    const typeLait = getSlotValue(slots, 'typeLait') || 'maternel';
    const qtyRaw   = slots.quantite && slots.quantite.value;
    const quantite = qtyRaw ? parseInt(qtyRaw, 10) : null;

    const data = { type: 'biberon', biberon_type: typeLait };
    if (quantite && !isNaN(quantite)) data.quantity = quantite;

    await postToFirebase(data);

    const typeStr = typeLait === 'poudre' ? 'en poudre' : 'maternel';
    const qtyStr  = quantite ? ` de ${quantite} millilitres` : '';
    return h.responseBuilder
      .speak(`Biberon ${typeStr}${qtyStr} enregistré.`)
      .getResponse();
  },
};

const HelpHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && Alexa.getIntentName(h.requestEnvelope) === 'AMAZON.HelpIntent';
  },
  handle(h) {
    return h.responseBuilder
      .speak('Dites : sein gauche, sein droit, les deux seins, biberon maternel, '
        + 'ou biberon poudre cent vingt millilitres pour enregistrer une quantité.')
      .reprompt('Quel type de tétée ?')
      .getResponse();
  },
};

const StopCancelHandler = {
  canHandle(h) {
    return Alexa.getRequestType(h.requestEnvelope) === 'IntentRequest'
      && ['AMAZON.StopIntent', 'AMAZON.CancelIntent']
          .includes(Alexa.getIntentName(h.requestEnvelope));
  },
  handle(h) {
    return h.responseBuilder.speak('Au revoir.').getResponse();
  },
};

const ErrorHandler = {
  canHandle() { return true; },
  handle(h, error) {
    console.error('Erreur Alexa skill :', error);
    return h.responseBuilder
      .speak('Désolé, une erreur est survenue. Réessayez.')
      .getResponse();
  },
};

// ── Export ────────────────────────────────────────────────────────────────────
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchHandler,
    SeinGaucheHandler,
    SeinDroitHandler,
    LesDeuxHandler,
    BiberonHandler,
    HelpHandler,
    StopCancelHandler,
  )
  .addErrorHandlers(ErrorHandler)
  .lambda();
