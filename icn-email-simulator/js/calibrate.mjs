// Calibre les 4 constantes de logistique du moteur (js/engine.js) sur des
// campagnes ICN réelles (data/calibration-campaigns.mjs). Recherche en
// grille sur (openMidpoint, openSteepness) puis (clickMidpoint, clickSteepness),
// erreur en log pondérée par sqrt(volume délivré) pour limiter le poids des
// petits échantillons peu fiables (ex : mail2, 57 délivrés).
//
// Usage : node js/calibrate.mjs
// Affiche les meilleurs paramètres + un tableau prédiction vs réel par mail.
// Les constantes trouvées doivent ensuite être reportées à la main dans
// engine.js (CALIBRATION), pour garder engine.js sans dépendance à ce script.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { analyzeEmail, computeRawSignals, logistic } from './engine.js';
import { CALIBRATION_CAMPAIGNS } from '../data/calibration-campaigns.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const profileCache = new Map();
function loadSegment(segmentId) {
  if (!profileCache.has(segmentId)) {
    profileCache.set(segmentId, JSON.parse(readFileSync(join(DATA_DIR, `profiles-${segmentId}.json`), 'utf8')));
  }
  return profileCache.get(segmentId);
}

// --- Étape 1 : précalcul des signaux bruts (indépendants des constantes) ---
const prepared = CALIBRATION_CAMPAIGNS.map(campaign => {
  const profiles = campaign.segments.flatMap(loadSegment).filter(p => campaign.statuts.includes(p.statut));
  const analysis = analyzeEmail(campaign.email);
  const openSignals = [];
  const clickSignals = [];
  for (const profile of profiles) {
    const { openSignal, clickSignal } = computeRawSignals(profile, analysis);
    openSignals.push(openSignal);
    clickSignals.push(clickSignal);
  }
  return {
    ...campaign,
    openSignals,
    clickSignals,
    weight: Math.sqrt(campaign.delivered),
    actualCTOR: campaign.actualClickRate / campaign.actualOpenRate,
  };
});

function meanLogistic(signals, midpoint, steepness) {
  let sum = 0;
  for (const s of signals) sum += logistic(s, midpoint, steepness);
  return sum / signals.length;
}

function weightedLogError(predictions) {
  // predictions: [{ pred, actual, weight }]
  let err = 0, wsum = 0;
  for (const { pred, actual, weight } of predictions) {
    const p = Math.max(pred, 1e-4);
    const a = Math.max(actual, 1e-4);
    err += weight * (Math.log(p) - Math.log(a)) ** 2;
    wsum += weight;
  }
  return err / wsum;
}

// --- Étape 2 : recherche en grille pour l'ouverture ---
function gridSearch(getSignals, actuals, midpointRange, steepnessRange) {
  let best = null;
  for (let m = midpointRange[0]; m <= midpointRange[1]; m += midpointRange[2]) {
    for (let k = steepnessRange[0]; k <= steepnessRange[1]; k += steepnessRange[2]) {
      const predictions = prepared.map((c, i) => ({
        pred: meanLogistic(getSignals(c), m, k),
        actual: actuals(c),
        weight: c.weight,
      }));
      const err = weightedLogError(predictions);
      if (!best || err < best.err) best = { m, k, err };
    }
  }
  return best;
}

const bestOpen = gridSearch(
  c => c.openSignals,
  c => c.actualOpenRate,
  [20, 160, 1],
  [0.005, 0.20, 0.002],
);

const bestClick = gridSearch(
  c => c.clickSignals,
  c => c.actualCTOR,
  [20, 160, 1],
  [0.005, 0.20, 0.002],
);

console.log('=== Meilleurs paramètres trouvés ===');
console.log(`openMidpoint = ${bestOpen.m}, openSteepness = ${bestOpen.k.toFixed(3)}  (erreur log pondérée = ${bestOpen.err.toFixed(4)})`);
console.log(`clickMidpoint = ${bestClick.m}, clickSteepness = ${bestClick.k.toFixed(3)}  (erreur log pondérée = ${bestClick.err.toFixed(4)})`);

console.log('\n=== Prédiction vs réel avec ces paramètres ===');
const rows = prepared.map(c => {
  const predOpen = meanLogistic(c.openSignals, bestOpen.m, bestOpen.k);
  const predCTOR = meanLogistic(c.clickSignals, bestClick.m, bestClick.k);
  const predClick = predOpen * predCTOR;
  return {
    mail: c.id,
    n: c.delivered,
    'open réel': (c.actualOpenRate * 100).toFixed(2) + '%',
    'open prédit': (predOpen * 100).toFixed(2) + '%',
    'click réel': (c.actualClickRate * 100).toFixed(2) + '%',
    'click prédit': (predClick * 100).toFixed(2) + '%',
    'CTOR réel': (c.actualCTOR * 100).toFixed(2) + '%',
    'CTOR prédit': (predCTOR * 100).toFixed(2) + '%',
  };
});
console.table(rows);

// --- Comparaison avec les anciennes constantes (avant calibration) ---
console.log('\n=== Pour référence : avec les anciennes constantes (52/0.065 ouverture, 46/0.075 clic) ===');
const oldRows = prepared.map(c => {
  const predOpen = meanLogistic(c.openSignals, 52, 0.065);
  const predCTOR = meanLogistic(c.clickSignals, 46, 0.075);
  return {
    mail: c.id,
    'open réel': (c.actualOpenRate * 100).toFixed(2) + '%',
    'open prédit (ancien)': (predOpen * 100).toFixed(2) + '%',
    'CTOR réel': (c.actualCTOR * 100).toFixed(2) + '%',
    'CTOR prédit (ancien)': (predCTOR * 100).toFixed(2) + '%',
  };
});
console.table(oldRows);
