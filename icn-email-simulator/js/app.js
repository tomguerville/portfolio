import { SEGMENTS, STATUTS } from './domain.js';
import { simulateCampaign, sectionAppeal, buildRecommendations } from './engine.js';

const profileCache = new Map(); // segmentId -> array of profiles

async function loadSegment(segmentId) {
  if (profileCache.has(segmentId)) return profileCache.get(segmentId);
  const res = await fetch(`data/profiles-${segmentId}.json`);
  if (!res.ok) throw new Error(`Impossible de charger les profils de la cible "${segmentId}" (HTTP ${res.status}).`);
  const data = await res.json();
  profileCache.set(segmentId, data);
  return data;
}

// ---------------------------------------------------------------------------
// Construction des contrôles de cible / statut
// ---------------------------------------------------------------------------
function buildSegmentCheckboxes() {
  const container = document.getElementById('segment-checkboxes');
  SEGMENTS.forEach((seg, i) => {
    const chip = document.createElement('label');
    chip.className = 'chip' + (i === 0 ? ' checked' : '');
    chip.title = seg.description;
    chip.innerHTML = `
      <input type="checkbox" name="segment" value="${seg.id}" ${i === 0 ? 'checked' : ''}>
      ${seg.label}
    `;
    const input = chip.querySelector('input');
    input.addEventListener('change', () => chip.classList.toggle('checked', input.checked));
    container.appendChild(chip);
  });
}

function buildStatutCheckboxes() {
  const container = document.getElementById('statut-checkboxes');
  STATUTS.forEach(st => {
    const chip = document.createElement('label');
    chip.className = 'chip checked';
    chip.title = st.description;
    chip.innerHTML = `
      <input type="checkbox" name="statut" value="${st.id}" checked>
      ${st.label}
    `;
    const input = chip.querySelector('input');
    input.addEventListener('change', () => chip.classList.toggle('checked', input.checked));
    container.appendChild(chip);
  });
}

function getSelectedValues(name) {
  return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`)).map(el => el.value);
}

// ---------------------------------------------------------------------------
// Compteurs live
// ---------------------------------------------------------------------------
function bindCounters() {
  const subject = document.getElementById('input-subject');
  const preheader = document.getElementById('input-preheader');
  const content = document.getElementById('input-content');

  subject.addEventListener('input', () => {
    document.getElementById('count-subject').textContent = `${subject.value.length} caractères`;
  });
  preheader.addEventListener('input', () => {
    document.getElementById('count-preheader').textContent = `${preheader.value.length} caractères`;
  });
  content.addEventListener('input', () => {
    const words = content.value.trim() ? content.value.trim().split(/\s+/).length : 0;
    document.getElementById('count-content').textContent = `${words} mots`;
  });
}

// ---------------------------------------------------------------------------
// Rendu du tableau de bord
// ---------------------------------------------------------------------------
function pct(v) { return `${Math.round(v * 100)}%`; }

function benchmarkNote(rate, [low, high], label) {
  const p = rate * 100;
  if (p < low) return { text: `En dessous du repère sectoriel ${label} (${low}-${high}%)`, cls: 'bad' };
  if (p > high) return { text: `Au dessus du repère sectoriel ${label} (${low}-${high}%)`, cls: 'good' };
  return { text: `Dans le repère sectoriel ${label} (${low}-${high}%)`, cls: 'ok' };
}

function renderGauge(elId, valueElId, rate) {
  const gauge = document.getElementById(elId);
  gauge.style.setProperty('--pct', Math.round(rate * 100));
  document.getElementById(valueElId).textContent = pct(rate);
}

function renderSectionBars(appeal) {
  const container = document.getElementById('section-bars');
  container.innerHTML = '';
  const items = [
    ['Objet', appeal.objet],
    ['Pré-header', appeal.preheader],
    ['Contenu', appeal.contenu],
    ['CTA', appeal.cta],
  ];
  for (const [label, value] of items) {
    const card = document.createElement('div');
    card.className = 'section-bar-card';
    card.innerHTML = `
      <div class="sb-label">${label}</div>
      <div class="sb-value">${value}%</div>
      <div class="sb-track"><div class="sb-fill" style="width:${value}%"></div></div>
    `;
    container.appendChild(card);
  }
}

function renderBarList(containerId, rows) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (rows.length === 0) {
    container.innerHTML = '<p class="recs-empty">Aucune donnée.</p>';
    return;
  }
  const max = Math.max(...rows.map(r => r.value), 1);
  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'bar-row';
    el.innerHTML = `
      <div class="br-label">${row.label}</div>
      <div class="br-track"><div class="br-fill" style="width:${(row.value / max) * 100}%"></div></div>
      <div class="br-value">${row.display}</div>
    `;
    container.appendChild(el);
  }
}

/**
 * Tableau à deux métriques (taux d'ouverture + taux de clic) par ligne,
 * avec une barre distincte et légendée pour chacune — évite l'ambiguïté
 * d'un seul chiffre "X% / Y%" sans étiquette.
 */
function renderMetricTable(containerId, rows) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (rows.length === 0) {
    container.innerHTML = '<p class="recs-empty">Aucune donnée.</p>';
    return;
  }
  const maxOpen = Math.max(...rows.map(r => r.openRate), 0.01);
  const maxClick = Math.max(...rows.map(r => r.clickRate), 0.01);

  const head = document.createElement('div');
  head.className = 'mt-row mt-head';
  head.innerHTML = `
    <div class="mt-label"></div>
    <div class="mt-metric"><span class="mt-dot mt-dot-open"></span>Ouverture</div>
    <div class="mt-metric"><span class="mt-dot mt-dot-click"></span>Clic</div>
  `;
  container.appendChild(head);

  for (const row of rows) {
    const el = document.createElement('div');
    el.className = 'mt-row';
    if (row.empty) {
      el.innerHTML = `
        <div class="mt-label">${row.label}</div>
        <div class="mt-metric mt-empty" colspan="2">Aucun profil</div>
      `;
      container.appendChild(el);
      continue;
    }
    el.innerHTML = `
      <div class="mt-label">${row.label}</div>
      <div class="mt-metric">
        <span class="mt-track"><span class="mt-fill mt-fill-open" style="width:${(row.openRate / maxOpen) * 100}%"></span></span>
        <span class="mt-value">${pct(row.openRate)}</span>
      </div>
      <div class="mt-metric">
        <span class="mt-track"><span class="mt-fill mt-fill-click" style="width:${(row.clickRate / maxClick) * 100}%"></span></span>
        <span class="mt-value">${pct(row.clickRate)}</span>
      </div>
    `;
    container.appendChild(el);
  }
}

function renderRecommendations(recs) {
  const list = document.getElementById('recs-list');
  list.innerHTML = '';
  if (recs.length === 0) {
    list.innerHTML = '<li class="recs-empty">Aucune alerte majeure détectée sur cet email pour la cible sélectionnée.</li>';
    return;
  }
  const labels = { critique: 'Critique', attention: 'Attention', suggestion: 'Suggestion', info: 'Info' };
  for (const rec of recs) {
    const li = document.createElement('li');
    li.className = `rec-item ${rec.severity}`;
    li.innerHTML = `
      <span class="rec-badge">${labels[rec.severity]}</span>
      <span class="rec-text"><span class="rec-section">${rec.section}</span>${rec.text}</span>
    `;
    list.appendChild(li);
  }
}

const SEGMENT_LABEL = Object.fromEntries(SEGMENTS.map(s => [s.id, s.short]));
const STATUT_LABEL = Object.fromEntries(STATUTS.map(s => [s.id, s.label]));

function renderDashboard({ email, profiles, result, appeal, recs, segmentIds, statutIds }) {
  document.getElementById('dashboard-empty').hidden = true;
  const content = document.getElementById('dashboard-content');
  content.hidden = false;

  const segLabels = segmentIds.map(id => SEGMENT_LABEL[id]).join(', ');
  const statutLabels = statutIds.length === STATUTS.length ? 'tous statuts' : statutIds.map(id => STATUT_LABEL[id]).join(', ');
  document.getElementById('dashboard-meta').textContent = `Cible : ${segLabels} — ${statutLabels} — ${result.n} profils simulés`;

  renderGauge('gauge-open', 'kpi-open-value', result.openRate);
  renderGauge('gauge-click', 'kpi-click-value', result.clickRate);
  document.getElementById('kpi-ctor-value').textContent = pct(result.clickToOpenRate);
  document.getElementById('kpi-sample-value').textContent = result.n.toLocaleString('fr-FR');

  const openBench = benchmarkNote(result.openRate, [20, 35], 'éducation');
  const clickBench = benchmarkNote(result.clickRate, [2, 8], 'éducation');
  document.getElementById('kpi-open-benchmark').textContent = openBench.text;
  document.getElementById('kpi-click-benchmark').textContent = clickBench.text;

  renderSectionBars(appeal);

  const segRows = Object.entries(result.bySegment).map(([segId, s]) => ({
    label: SEGMENT_LABEL[segId] || segId,
    openRate: s.openRate,
    clickRate: s.clickRate,
  }));
  document.getElementById('block-by-segment').hidden = segRows.length <= 1;
  renderMetricTable('segment-breakdown', segRows);

  const statutRows = STATUTS
    .filter(st => statutIds.includes(st.id))
    .map(st => {
      const s = result.byStatut[st.id];
      return { label: st.label, openRate: s.openRate, clickRate: s.clickRate, empty: !s.n };
    });
  renderMetricTable('statut-breakdown', statutRows);

  const audienceRows = [
    { label: 'Formation', value: appeal.avgInterest.interet_formation },
    { label: 'École', value: appeal.avgInterest.interet_ecole },
    { label: 'Campus', value: appeal.avgInterest.interet_campus },
    { label: 'Vie associative', value: appeal.avgInterest.vie_associative },
    { label: 'Alternance', value: appeal.avgInterest.interet_alternance },
  ].map(r => ({ ...r, display: `${Math.round(r.value)}/100` }));
  renderBarList('audience-profile', audienceRows);

  renderRecommendations(recs);

  content.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ---------------------------------------------------------------------------
// Soumission du formulaire
// ---------------------------------------------------------------------------
async function handleSubmit(evt) {
  evt.preventDefault();
  const errorEl = document.getElementById('form-error');
  errorEl.hidden = true;

  const email = {
    subject: document.getElementById('input-subject').value.trim(),
    preheader: document.getElementById('input-preheader').value.trim(),
    content: document.getElementById('input-content').value.trim(),
    cta: document.getElementById('input-cta').value.trim(),
  };

  const segmentIds = getSelectedValues('segment');
  const statutIds = getSelectedValues('statut');

  if (segmentIds.length === 0) {
    errorEl.textContent = 'Sélectionnez au moins une cible.';
    errorEl.hidden = false;
    return;
  }
  if (statutIds.length === 0) {
    errorEl.textContent = 'Sélectionnez au moins un statut.';
    errorEl.hidden = false;
    return;
  }
  if (!email.subject && !email.content) {
    errorEl.textContent = "Renseignez au moins un objet ou un contenu avant de lancer la simulation.";
    errorEl.hidden = false;
    return;
  }

  const submitBtn = evt.target.querySelector('button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Simulation en cours...';

  try {
    const segmentProfiles = await Promise.all(segmentIds.map(loadSegment));
    let profiles = segmentProfiles.flat().filter(p => statutIds.includes(p.statut));

    if (profiles.length === 0) {
      errorEl.textContent = "Aucun profil ne correspond à cette combinaison cible / statut.";
      errorEl.hidden = false;
      return;
    }

    const result = simulateCampaign(profiles, email);
    const appeal = sectionAppeal(profiles, result.analysis);
    const recs = buildRecommendations({ profiles, email, analysis: result.analysis, appeal, result });

    renderDashboard({ email, profiles, result, appeal, recs, segmentIds, statutIds });
  } catch (err) {
    console.error(err);
    errorEl.textContent = `Erreur lors de la simulation : ${err.message}`;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Lancer la simulation';
  }
}

// ---------------------------------------------------------------------------
// Exemple pré-rempli
// ---------------------------------------------------------------------------
function loadExample() {
  document.getElementById('input-subject').value = "{prénom}, financez votre MSc grâce à l'alternance";
  document.getElementById('input-preheader').value = "Entreprise partenaire, salaire dès la rentrée, réseau alumni ICN — candidatez avant le 15 août";
  document.getElementById('input-content').value = "Le MSc ICN vous permet de vous spécialiser tout en travaillant en entreprise grâce à l'alternance. Rythme adapté, employeur partenaire, réseau d'entreprises solide et forte employabilité à la sortie : votre formation est financée par votre alternance. Découvrez aussi la vie associative du campus et nos événements étudiants.";
  document.getElementById('input-cta').value = "Je candidate au MSc en alternance";
  ['input-subject', 'input-preheader', 'input-content'].forEach(id => {
    document.getElementById(id).dispatchEvent(new Event('input'));
  });
}

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------
buildSegmentCheckboxes();
buildStatutCheckboxes();
bindCounters();
document.getElementById('simulator-form').addEventListener('submit', handleSubmit);
document.getElementById('load-example').addEventListener('click', loadExample);
