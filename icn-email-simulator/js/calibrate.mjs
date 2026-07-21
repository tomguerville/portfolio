// Calibre le moteur de simulation (js/engine.js) sur deux sources de données
// ICN réelles :
//   1. data/calibration-campaigns.mjs — 6 campagnes avec contenu exact +
//      résultats HubSpot hors bots (calibre la SENSIBILITÉ AU CONTENU :
//      objet/pré-header/contenu/CTA).
//   2. data/segment-targets.json — agrégat de 405 campagnes réelles
//      (~186k délivrés, cf. hubspot_segment_stats_source.csv), sans contenu
//      détaillé mais avec un volume bien plus robuste par cible (calibre le
//      NIVEAU DE BASE PAR SEGMENT, indépendant du contenu — ex : Bac+4/5
//      engage nettement plus que Terminale à contenu comparable).
//
// Les deux étapes sont volontairement DÉCOUPLÉES plutôt que fittées ensemble
// (essayé, ça diverge : offset et midpoint sont redondants pour un shift
// constant, et les 6 mails connus sont des exemples plutôt performants —
// forcer leur moyenne à retomber sur l'agrégat "tout contenu confondu" du
// segment casse leur prédiction individuelle sans rien apprendre d'utile).
//   Étape 1 : fit midpoint/steepness sur les 6 mails, offsets = 0.
//   Étape 2 : fit un offset par segment avec un email NEUTRE (générique,
//   qualité moyenne — pas un des 6 exemples, qui sont plutôt bons) appliqué
//   à toute la population du segment, pour matcher l'agrégat réel. L'offset
//   capture ainsi "l'engagement propre à la cible", pas un artefact du
//   contenu utilisé pour le fit.
//
// Usage : node js/calibrate.mjs
// Les constantes trouvées (CALIBRATION.*) doivent être reportées à la main
// dans engine.js, pour garder engine.js sans dépendance à ce script.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeEmail, computeRawSignals, logistic, CALIBRATION } from './engine.js';
import { CALIBRATION_CAMPAIGNS } from '../data/calibration-campaigns.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const SEGMENT_IDS = ['terminale', 'bac1', 'bac2', 'bac3', 'bac45'];

const profileCache = new Map();
function loadSegment(segmentId) {
  if (!profileCache.has(segmentId)) {
    profileCache.set(segmentId, JSON.parse(readFileSync(join(DATA_DIR, `profiles-${segmentId}.json`), 'utf8')));
  }
  return profileCache.get(segmentId);
}

// Neutralise les offsets déjà écrits en dur dans engine.js par une
// calibration précédente, pour que ce script reste reproductible.
for (const seg of SEGMENT_IDS) {
  CALIBRATION.segmentOffsetOpen[seg] = 0;
  CALIBRATION.segmentOffsetClick[seg] = 0;
}

function meanLogistic(signals, m, k) {
  let sum = 0;
  for (const s of signals) sum += logistic(s, m, k);
  return sum / signals.length;
}

function weightedLogError(predictions) {
  let err = 0, wsum = 0;
  for (const { pred, actual, weight } of predictions) {
    const p = Math.max(pred, 1e-4), a = Math.max(actual, 1e-4);
    err += weight * (Math.log(p) - Math.log(a)) ** 2;
    wsum += weight;
  }
  return err / wsum;
}

function findOffset(signals, midpoint, steepness, target) {
  let lo = -150, hi = 150;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (meanLogistic(signals.map(s => s + mid), midpoint, steepness) < target) lo = mid; else hi = mid;
  }
  return Math.round(((lo + hi) / 2) * 10) / 10;
}

// ---------------------------------------------------------------------------
// Étape 1 : midpoint/steepness sur les 6 campagnes détaillées (offset = 0)
// ---------------------------------------------------------------------------
const detailed = CALIBRATION_CAMPAIGNS.map(campaign => {
  const profiles = campaign.segments.flatMap(loadSegment).filter(p => campaign.statuts.includes(p.statut));
  const analysis = analyzeEmail(campaign.email);
  const openSignals = [], clickSignals = [];
  for (const profile of profiles) {
    const { openSignal, clickSignal } = computeRawSignals(profile, analysis);
    openSignals.push(openSignal);
    clickSignals.push(clickSignal);
  }
  return {
    id: campaign.id,
    delivered: campaign.delivered,
    weight: Math.sqrt(campaign.delivered),
    actualOpenRate: campaign.actualOpenRate,
    actualClickRate: campaign.actualClickRate,
    actualCTOR: campaign.actualClickRate / campaign.actualOpenRate,
    openSignals,
    clickSignals,
  };
});

function gridSearch(getSignals, actuals, midpointRange, steepnessRange) {
  let best = null;
  for (let m = midpointRange[0]; m <= midpointRange[1]; m += midpointRange[2]) {
    for (let k = steepnessRange[0]; k <= steepnessRange[1]; k += steepnessRange[2]) {
      const predictions = detailed.map(c => ({ pred: meanLogistic(getSignals(c), m, k), actual: actuals(c), weight: c.weight }));
      const err = weightedLogError(predictions);
      if (!best || err < best.err) best = { m, k, err };
    }
  }
  return best;
}

const bestOpen = gridSearch(c => c.openSignals, c => c.actualOpenRate, [20, 160, 1], [0.005, 0.20, 0.002]);
const bestClick = gridSearch(c => c.clickSignals, c => c.actualCTOR, [20, 160, 1], [0.005, 0.20, 0.002]);

console.log('=== Étape 1 : forme de la logistique (6 campagnes détaillées) ===');
console.log(`openMidpoint = ${bestOpen.m}, openSteepness = ${bestOpen.k.toFixed(3)}  (erreur = ${bestOpen.err.toFixed(4)})`);
console.log(`clickMidpoint = ${bestClick.m}, clickSteepness = ${bestClick.k.toFixed(3)}  (erreur = ${bestClick.err.toFixed(4)})`);

console.log('\n=== Validation étape 1 — 6 campagnes détaillées (sans offset segment) ===');
console.table(detailed.map(c => ({
  mail: c.id, n: c.delivered,
  'open réel': (c.actualOpenRate * 100).toFixed(2) + '%',
  'open prédit': (meanLogistic(c.openSignals, bestOpen.m, bestOpen.k) * 100).toFixed(2) + '%',
  'CTOR réel': (c.actualCTOR * 100).toFixed(2) + '%',
  'CTOR prédit': (meanLogistic(c.clickSignals, bestClick.m, bestClick.k) * 100).toFixed(2) + '%',
})));

// ---------------------------------------------------------------------------
// Étape 2 : offset par segment, avec un email NEUTRE (générique, qualité
// moyenne, volontairement PAS l'un des 6 exemples ci-dessus qui performent
// plutôt bien) appliqué à toute la population réelle du segment.
// ---------------------------------------------------------------------------
const NEUTRAL_EMAIL = {
  subject: "Votre avenir chez ICN Business School",
  preheader: "Découvrez nos programmes et la vie sur nos campus.",
  content: "ICN Business School propose des formations reconnues, un accompagnement personnalisé et une vie étudiante riche. Nos équipes sont à votre disposition pour répondre à vos questions sur nos programmes et nos campus.",
  cta: "En savoir plus",
};
const neutralAnalysis = analyzeEmail(NEUTRAL_EMAIL);

const segmentTargets = JSON.parse(readFileSync(join(DATA_DIR, 'segment-targets.json'), 'utf8'));
const segmentOffsetOpen = {}, segmentOffsetClick = {};
const segRows = [];

for (const segmentId of SEGMENT_IDS) {
  const profiles = loadSegment(segmentId);
  const openSignals = [], clickSignals = [];
  for (const profile of profiles) {
    const { openSignal, clickSignal } = computeRawSignals(profile, neutralAnalysis);
    openSignals.push(openSignal);
    clickSignals.push(clickSignal);
  }
  const target = segmentTargets[segmentId];
  const offsetOpen = findOffset(openSignals, bestOpen.m, bestOpen.k, target.open_rate);
  const offsetClick = findOffset(clickSignals, bestClick.m, bestClick.k, target.ctor);
  segmentOffsetOpen[segmentId] = offsetOpen;
  segmentOffsetClick[segmentId] = offsetClick;

  segRows.push({
    segment: segmentId,
    'délivrés réels': target.remis_total,
    'open réel': (target.open_rate * 100).toFixed(2) + '%',
    'open prédit (email neutre)': (meanLogistic(openSignals.map(s => s + offsetOpen), bestOpen.m, bestOpen.k) * 100).toFixed(2) + '%',
    'CTOR réel': (target.ctor * 100).toFixed(2) + '%',
    'CTOR prédit (email neutre)': (meanLogistic(clickSignals.map(s => s + offsetClick), bestClick.m, bestClick.k) * 100).toFixed(2) + '%',
    offsetOpen, offsetClick,
  });
}

console.log('\n=== Étape 2 : offsets par segment (405 campagnes réelles, email neutre) ===');
console.table(segRows);

console.log('\n=== À reporter dans engine.js (CALIBRATION) ===');
console.log(`openMidpoint: ${bestOpen.m}, openSteepness: ${bestOpen.k.toFixed(3)},`);
console.log(`clickMidpoint: ${bestClick.m}, clickSteepness: ${bestClick.k.toFixed(3)},`);
console.log('segmentOffsetOpen:', JSON.stringify(segmentOffsetOpen), ',');
console.log('segmentOffsetClick:', JSON.stringify(segmentOffsetClick), ',');

// ---------------------------------------------------------------------------
// Validation finale : les 6 campagnes détaillées, AVEC l'offset de leur
// segment appliqué (= ce que produira réellement le moteur en usage normal).
// ---------------------------------------------------------------------------
console.log('\n=== Validation finale — 6 campagnes détaillées, offset segment inclus ===');
const finalRows = CALIBRATION_CAMPAIGNS.map(campaign => {
  const profiles = campaign.segments.flatMap(loadSegment).filter(p => campaign.statuts.includes(p.statut));
  const analysis = analyzeEmail(campaign.email);
  let openSum = 0, clickSum = 0;
  for (const profile of profiles) {
    const { openSignal, clickSignal } = computeRawSignals(profile, analysis);
    openSum += logistic(openSignal + segmentOffsetOpen[profile.segment], bestOpen.m, bestOpen.k);
    clickSum += logistic(clickSignal + segmentOffsetClick[profile.segment], bestClick.m, bestClick.k);
  }
  const predOpen = openSum / profiles.length;
  const predCTOR = clickSum / profiles.length;
  return {
    mail: campaign.id, n: campaign.delivered,
    'open réel': (campaign.actualOpenRate * 100).toFixed(2) + '%',
    'open prédit': (predOpen * 100).toFixed(2) + '%',
    'click réel': (campaign.actualClickRate * 100).toFixed(2) + '%',
    'click prédit': (predOpen * predCTOR * 100).toFixed(2) + '%',
    'CTOR réel': ((campaign.actualClickRate / campaign.actualOpenRate) * 100).toFixed(2) + '%',
    'CTOR prédit': (predCTOR * 100).toFixed(2) + '%',
  };
});
console.table(finalRows);
