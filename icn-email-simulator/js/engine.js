// Moteur de simulation — module ES pur (fonctionne navigateur et Node).
// Aucune dépendance externe. Toute la logique est déterministe et explicable :
// pas de "boîte noire", chaque score peut être justifié par des règles lisibles,
// ce qui permet de générer des recommandations concrètes.

// ---------------------------------------------------------------------------
// 1. Dictionnaires thématiques (FR) — utilisés pour évaluer à quel point un
//    texte adresse chaque thème d'intérêt d'un profil.
// ---------------------------------------------------------------------------
const THEME_KEYWORDS = {
  formation: [
    'formation', 'programme', 'diplôme', 'diplome', 'pge', 'bachelor', 'msc', 'mba',
    'cours', 'pédagogie', 'pedagogie', 'compétence', 'competence', 'spécialisation',
    'specialisation', 'double diplôme', 'accréditation', 'accreditation', 'classement',
    'expertise', 'majeure', 'mastère', 'mastere', 'concours', 'admission', 'candidature',
    'épreuve', 'epreuve', 'jury', 'oral',
  ],
  ecole: [
    'icn', 'école', 'ecole', 'business school', 'grande école', 'grande ecole',
    'réputation', 'reputation', 'réseau', 'reseau', 'alumni', 'entreprises partenaires',
    'classement', 'accréditation', 'accreditation', 'artem', 'triple accréditation',
    'notoriété', 'notoriete', 'employabilité', 'employabilite',
  ],
  campus: [
    'campus', 'nancy', 'paris', 'berlin', 'la défense', 'la defense', 'locaux',
    'infrastructure', 'résidence', 'residence', 'logement', 'lieu de vie', 'bâtiment',
    'batiment', 'moabit', 'ville', 'implantation',
  ],
  vie_associative: [
    'association', 'vie étudiante', 'vie etudiante', 'événement', 'evenement', 'bde',
    'club', 'sport', 'culture', 'soirée', 'soiree', 'intégration', 'integration',
    'rencontre', 'communauté', 'communaute', 'ambiance', 'gala', 'week-end', 'weekend',
  ],
  alternance: [
    'alternance', 'apprentissage', 'contrat pro', 'contrat de professionnalisation',
    'entreprise', 'rythme', 'professionnalisation', 'cfa', 'employeur', 'salaire',
    'rémunéré', 'remunere', 'expérience professionnelle', 'experience professionnelle',
    'stage',
  ],
  financement: [
    'prix', 'tarif', 'coût', 'cout', 'frais de scolarité', 'frais de scolarite',
    'bourse', 'financement', 'cpf', 'paiement', 'mensualité', 'mensualite', 'gratuit',
    'réduction', 'reduction', 'aide financière', 'aide financiere',
  ],
  action: [
    'inscrivez-vous', 'inscrivez vous', 'candidatez', 'découvrez', 'decouvrez',
    'réservez', 'reservez', 'téléchargez', 'telechargez', 'rejoignez', "je m'inscris",
    'je m inscris', 'en savoir plus', 'postuler', 'participez', 'obtenez', 'demandez',
    'contactez', 'échangez', 'echangez', 'planifiez',
  ],
  urgence: [
    'dernier jour', 'derniers jours', 'places limitées', 'places limitees',
    'avant le', 'clôture', 'cloture', 'urgent', 'ne manquez pas', 'plus que',
    "aujourd'hui", 'aujourd hui', 'maintenant', 'vite', 'dernière chance', 'derniere chance',
  ],
};

const PERSONALIZATION_TOKENS = ['{prénom}', '{prenom}', '{firstname}', '{nom}'];

// Radicaux de verbes d'action utilisés pour repérer un CTA engageant, que la
// formulation soit à l'impératif ("Réservez") ou à la 1ère personne
// ("Je réserve", tournure très utilisée en emailing pour l'appropriation).
const ACTION_VERB_STEMS = [
  'inscri', 'candidat', 'decouvr', 'reserv', 'telecharg', 'rejoi', 'postul',
  'particip', 'obten', 'demand', 'contact', 'echang', 'planifi', 'explor',
  'en savoir plus', 'je m', 'commenc', 'accede', 'accéd',
];

// ---------------------------------------------------------------------------
// 2. Analyse de texte
// ---------------------------------------------------------------------------
function normalize(text) {
  return (text || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, ''); // retire les accents pour matcher largement
}

function countOccurrences(normalizedText, keyword) {
  const normKeyword = normalize(keyword);
  if (!normKeyword) return 0;
  let count = 0;
  let idx = 0;
  while ((idx = normalizedText.indexOf(normKeyword, idx)) !== -1) {
    count++;
    idx += normKeyword.length;
  }
  return count;
}

/**
 * Calcule un score 0-100 par thème pour un texte donné, avec rendements
 * décroissants (le 3e mot-clé d'un thème compte moins que le 1er).
 */
function scoreThemes(text) {
  const normalized = normalize(text);
  const wordCount = Math.max(normalized.split(/\s+/).filter(Boolean).length, 1);
  const scores = {};
  for (const [theme, keywords] of Object.entries(THEME_KEYWORDS)) {
    let hits = 0;
    for (const kw of keywords) hits += countOccurrences(normalized, kw);
    // Densité pondérée avec rendements décroissants (racine carrée), calibrée
    // pour qu'un texte court avec 1-2 mentions pertinentes atteigne déjà un
    // score correct, sans nécessiter un bourrage de mots-clés.
    const density = hits / Math.sqrt(wordCount);
    scores[theme] = Math.round(Math.min(100, 100 * (1 - Math.exp(-density * 3.2))));
  }
  return scores;
}

function hasPersonalization(text) {
  const normalized = normalize(text);
  return PERSONALIZATION_TOKENS.some(t => normalized.includes(normalize(t)));
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Score de qualité "bonnes pratiques" (0-100) indépendant du ciblage,
 * pour l'objet, le pré-header et le CTA.
 */
function subjectQualityScore(subject) {
  const len = (subject || '').length;
  let score = 100;
  if (len === 0) return 0;
  // Longueur optimale ~30-50 caractères (lisible sur mobile).
  if (len < 15) score -= 35;
  else if (len < 30) score -= 12;
  else if (len > 70) score -= 30;
  else if (len > 50) score -= 12;
  if (/[!?]{2,}/.test(subject)) score -= 10; // ponctuation excessive
  if (/^[A-ZÀ-Ü\s!?]+$/.test(subject.trim()) && subject.trim().length > 3) score -= 20; // tout en majuscules
  if (hasPersonalization(subject)) score += 10;
  const emojiCount = (subject.match(/\p{Extended_Pictographic}/gu) || []).length;
  if (emojiCount === 1) score += 5;
  if (emojiCount > 2) score -= 10;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function preheaderQualityScore(preheader, subject) {
  const len = (preheader || '').length;
  let score = 100;
  if (len === 0) return 15; // absence de pré-header = grosse perte d'opportunité
  if (len < 20) score -= 25;
  else if (len > 110) score -= 25;
  else if (len > 90) score -= 10;
  const normSub = normalize(subject).trim();
  const normPre = normalize(preheader).trim();
  if (normSub && normPre && normSub === normPre) score -= 25; // simple répétition de l'objet = occasion manquée
  if (hasPersonalization(preheader)) score += 8;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function ctaQualityScore(cta) {
  const len = (cta || '').trim().length;
  let score = 100;
  if (len === 0) return 0;
  if (len > 30) score -= 25; // CTA trop long
  if (len < 3) score -= 20;
  const normalized = normalize(cta);
  const hasActionVerb = ACTION_VERB_STEMS.some(stem => normalized.includes(normalize(stem)));
  if (!hasActionVerb) score -= 30;
  if (/^(cliquez ici|click here)$/i.test(cta.trim())) score -= 20; // peu engageant
  const wordCount = countWords(cta);
  if (wordCount > 6) score -= 15;
  return Math.round(Math.max(0, Math.min(100, score)));
}

function contentQualityScore(content) {
  const wc = countWords(content);
  let score = 100;
  if (wc === 0) return 0;
  if (wc < 25) score -= 30; // trop court pour convaincre
  else if (wc < 50) score -= 10;
  else if (wc > 350) score -= 25; // trop long pour un email
  else if (wc > 220) score -= 10;
  if (hasPersonalization(content)) score += 8;
  const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
  const avgSentenceLen = sentences.length ? wc / sentences.length : wc;
  if (avgSentenceLen > 30) score -= 12; // phrases trop longues
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Analyse complète d'un email : thèmes par section + scores qualité.
 */
export function analyzeEmail(email) {
  const { subject = '', preheader = '', content = '', cta = '' } = email;
  const fullText = `${subject} ${preheader} ${content} ${cta}`;
  return {
    themes: {
      subject: scoreThemes(subject),
      preheader: scoreThemes(preheader),
      content: scoreThemes(content),
      cta: scoreThemes(cta),
      full: scoreThemes(fullText),
    },
    quality: {
      subject: subjectQualityScore(subject),
      preheader: preheaderQualityScore(preheader, subject),
      content: contentQualityScore(content),
      cta: ctaQualityScore(cta),
    },
    meta: {
      subjectLength: subject.length,
      preheaderLength: preheader.length,
      contentWordCount: countWords(content),
      hasPersonalization: hasPersonalization(fullText),
      mentionsAlternance: (scoreThemes(fullText).alternance || 0) > 15,
      mentionsFinancement: (scoreThemes(fullText).financement || 0) > 15,
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Simulation par profil
// ---------------------------------------------------------------------------
const THEME_TO_INTEREST = {
  formation: 'interet_formation',
  ecole: 'interet_ecole',
  campus: 'interet_campus',
  vie_associative: 'vie_associative',
  alternance: 'interet_alternance',
};

const STATUT_BASELINE = { lead: -6, mql: 4, sql: 12 };

function logistic(x, midpoint, steepness) {
  return 1 / (1 + Math.exp(-steepness * (x - midpoint)));
}

/**
 * Calcule la probabilité d'ouverture et de clic pour UN profil face à
 * l'analyse d'un email donné. Retourne des probabilités [0,1].
 */
function scoreProfile(profile, analysis) {
  // --- Score d'affinité "objet + pré-header" (détermine l'ouverture) ---
  let subjectAffinity = 0;
  let weightSum = 0;
  for (const [theme, interestKey] of Object.entries(THEME_TO_INTEREST)) {
    const themeScore = (analysis.themes.subject[theme] * 0.65 + analysis.themes.preheader[theme] * 0.35);
    const w = profile[interestKey] / 100;
    subjectAffinity += themeScore * w;
    weightSum += 100 * w;
  }
  subjectAffinity = weightSum > 0 ? subjectAffinity / weightSum * 100 : 0;

  const subjectQuality = (analysis.quality.subject * 0.6 + analysis.quality.preheader * 0.4);

  // Diplôme cité dans l'objet/pré-header -> bonus fort (pertinence directe).
  const subjectPreText = normalize(`${analysis.meta.subjectLength ? '' : ''}`); // no-op, kept for clarity
  const openSignal =
    profile.engagement_email * 0.42 +
    subjectAffinity * 0.33 +
    subjectQuality * 0.25 +
    STATUT_BASELINE[profile.statut];

  const openProbability = logistic(openSignal, 52, 0.065);

  // --- Score d'affinité "contenu + CTA" (détermine le clic, sachant l'ouverture) ---
  let contentAffinity = 0;
  weightSum = 0;
  for (const [theme, interestKey] of Object.entries(THEME_TO_INTEREST)) {
    const themeScore = analysis.themes.content[theme];
    const w = profile[interestKey] / 100;
    contentAffinity += themeScore * w;
    weightSum += 100 * w;
  }
  contentAffinity = weightSum > 0 ? contentAffinity / weightSum * 100 : 0;

  const contentQuality = (analysis.quality.content * 0.5 + analysis.quality.cta * 0.5);

  // Bonus/malus de pertinence spécifique.
  let relevanceBonus = 0;
  const alternanceGap = profile.interet_alternance - analysis.themes.full.alternance;
  if (profile.interet_alternance > 55 && analysis.themes.full.alternance < 15) relevanceBonus -= 8; // intérêt fort non adressé
  if (profile.interet_alternance > 55 && analysis.themes.full.alternance > 40) relevanceBonus += 6;
  if (profile.sensibilite_prix > 60 && analysis.themes.full.financement < 10) relevanceBonus -= 5;
  if (profile.sensibilite_prix > 60 && analysis.themes.full.financement > 30) relevanceBonus += 5;

  const clickSignal =
    profile.engagement_email * 0.25 +
    contentAffinity * 0.35 +
    contentQuality * 0.28 +
    relevanceBonus +
    STATUT_BASELINE[profile.statut] * 0.8;

  const clickGivenOpenProbability = logistic(clickSignal, 46, 0.075);

  return { openProbability, clickGivenOpenProbability };
}

// ---------------------------------------------------------------------------
// 4. Agrégation sur une population de profils
// ---------------------------------------------------------------------------
export function simulateCampaign(profiles, email) {
  const analysis = analyzeEmail(email);
  let sumOpen = 0;
  let sumClickOnOpen = 0;
  let sumClickGlobal = 0;
  const bySegment = {};
  const byStatut = { lead: { open: 0, click: 0, n: 0 }, mql: { open: 0, click: 0, n: 0 }, sql: { open: 0, click: 0, n: 0 } };

  for (const profile of profiles) {
    const { openProbability, clickGivenOpenProbability } = scoreProfile(profile, analysis);
    const clickGlobal = openProbability * clickGivenOpenProbability;
    sumOpen += openProbability;
    sumClickOnOpen += clickGivenOpenProbability;
    sumClickGlobal += clickGlobal;

    if (!bySegment[profile.segment]) bySegment[profile.segment] = { open: 0, click: 0, n: 0 };
    bySegment[profile.segment].open += openProbability;
    bySegment[profile.segment].click += clickGlobal;
    bySegment[profile.segment].n += 1;

    byStatut[profile.statut].open += openProbability;
    byStatut[profile.statut].click += clickGlobal;
    byStatut[profile.statut].n += 1;
  }

  const n = profiles.length;
  for (const seg of Object.values(bySegment)) {
    seg.openRate = seg.n ? seg.open / seg.n : 0;
    seg.clickRate = seg.n ? seg.click / seg.n : 0;
  }
  for (const s of Object.values(byStatut)) {
    s.openRate = s.n ? s.open / s.n : 0;
    s.clickRate = s.n ? s.click / s.n : 0;
  }

  return {
    n,
    openRate: n ? sumOpen / n : 0,
    clickRate: n ? sumClickGlobal / n : 0, // taux de clic global (sur envoyés)
    clickToOpenRate: n ? sumClickOnOpen / n : 0, // CTOR moyen
    bySegment,
    byStatut,
    analysis,
  };
}

// ---------------------------------------------------------------------------
// 5. Attrait par section (%) — moyenne pondérée par les intérêts réels de
//    l'audience sélectionnée, combinée à la qualité intrinsèque de la section.
// ---------------------------------------------------------------------------
export function sectionAppeal(profiles, analysis) {
  const avgInterest = { interet_formation: 0, interet_ecole: 0, interet_campus: 0, vie_associative: 0, interet_alternance: 0 };
  for (const p of profiles) {
    avgInterest.interet_formation += p.interet_formation;
    avgInterest.interet_ecole += p.interet_ecole;
    avgInterest.interet_campus += p.interet_campus;
    avgInterest.vie_associative += p.vie_associative;
    avgInterest.interet_alternance += p.interet_alternance;
  }
  const n = Math.max(profiles.length, 1);
  for (const k of Object.keys(avgInterest)) avgInterest[k] /= n;

  function targetingScore(themeScores) {
    let sum = 0, wsum = 0;
    for (const [theme, interestKey] of Object.entries(THEME_TO_INTEREST)) {
      const w = avgInterest[interestKey];
      sum += (themeScores[theme] || 0) * w;
      wsum += 100 * w;
    }
    return wsum > 0 ? sum / wsum * 100 : 0;
  }

  const objet = Math.round(analysis.quality.subject * 0.55 + targetingScore(analysis.themes.subject) * 0.45);
  const preheader = Math.round(analysis.quality.preheader * 0.55 + targetingScore(analysis.themes.preheader) * 0.45);
  const contenu = Math.round(analysis.quality.content * 0.45 + targetingScore(analysis.themes.content) * 0.55);
  const cta = Math.round(analysis.quality.cta * 0.7 + targetingScore(analysis.themes.cta) * 0.3);

  return {
    objet: clamp01to100(objet),
    preheader: clamp01to100(preheader),
    contenu: clamp01to100(contenu),
    cta: clamp01to100(cta),
    avgInterest,
  };
}

function clamp01to100(v) {
  return Math.max(0, Math.min(100, v));
}

// ---------------------------------------------------------------------------
// 6. Recommandations — règles lisibles générées à partir des écarts entre
//    le contenu et le profil réel de l'audience.
// ---------------------------------------------------------------------------
export function buildRecommendations({ profiles, email, analysis, appeal, result, segmentLabels }) {
  const recs = [];
  const n = Math.max(profiles.length, 1);
  const pct = (key, threshold, cmp = '>') => {
    const count = profiles.filter(p => cmp === '>' ? p[key] > threshold : p[key] < threshold).length;
    return Math.round((count / n) * 100);
  };

  // --- Objet ---
  if (analysis.meta.subjectLength === 0) {
    recs.push({ severity: 'critique', section: 'Objet', text: "L'objet est vide : sans lui, le taux d'ouverture s'effondre. Rédigez un objet de 30 à 50 caractères." });
  } else if (analysis.meta.subjectLength < 15) {
    recs.push({ severity: 'attention', section: 'Objet', text: `L'objet est très court (${analysis.meta.subjectLength} caractères) : il manque probablement d'accroche. Visez 30-50 caractères.` });
  } else if (analysis.meta.subjectLength > 70) {
    recs.push({ severity: 'attention', section: 'Objet', text: `L'objet est long (${analysis.meta.subjectLength} caractères) et sera tronqué sur mobile. Raccourcissez-le à 50 caractères maximum.` });
  }
  if (!analysis.meta.hasPersonalization) {
    recs.push({ severity: 'suggestion', section: 'Objet', text: "Aucune personnalisation détectée (ex : {prénom}). La personnalisation de l'objet augmente sensiblement le taux d'ouverture." });
  }

  // --- Pré-header ---
  if (analysis.meta.preheaderLength === 0) {
    recs.push({ severity: 'critique', section: 'Pré-header', text: "Le pré-header est vide : c'est une opportunité perdue, les clients mail l'affichent juste après l'objet. Ajoutez une phrase complémentaire (40-90 caractères)." });
  } else if (normalize(email.preheader).trim() === normalize(email.subject).trim()) {
    recs.push({ severity: 'attention', section: 'Pré-header', text: "Le pré-header répète l'objet à l'identique. Utilisez-le pour apporter une information complémentaire (bénéfice, urgence, preuve sociale)." });
  }

  // --- Alternance ---
  const alternanceInterestPct = pct('interet_alternance', 55);
  if (alternanceInterestPct > 35 && analysis.themes.full.alternance < 15) {
    recs.push({ severity: 'attention', section: 'Contenu', text: `${alternanceInterestPct}% de la cible sélectionnée a un fort intérêt pour l'alternance, mais votre email n'en parle pas. Mentionnez le rythme alternance/rémunération pour lever un frein majeur.` });
  }

  // --- Vie associative ---
  const vieAssoInterestPct = pct('vie_associative', 60);
  if (vieAssoInterestPct > 40 && analysis.themes.full.vie_associative < 15) {
    recs.push({ severity: 'suggestion', section: 'Contenu', text: `${vieAssoInterestPct}% de la cible valorise fortement la vie associative/étudiante, thème absent de votre email. Une mention (clubs, événements, BDE) peut augmenter l'engagement.` });
  }

  // --- Financement / prix ---
  const priceSensitivePct = pct('sensibilite_prix', 65);
  if (priceSensitivePct > 40 && analysis.themes.full.financement < 10) {
    recs.push({ severity: 'suggestion', section: 'Contenu', text: `${priceSensitivePct}% de la cible est sensible au coût de la formation. Évoquer le financement (bourses, CPF, alternance rémunérée) peut rassurer une part importante de l'audience.` });
  }

  // --- Campus ---
  const campusInterestPct = pct('interet_campus', 60);
  if (campusInterestPct > 40 && analysis.themes.full.campus < 15) {
    recs.push({ severity: 'suggestion', section: 'Contenu', text: `${campusInterestPct}% de la cible accorde de l'importance au campus/lieu de vie. Ajouter un visuel ou une mention du campus (Nancy, Paris, Berlin) peut renforcer l'attrait.` });
  }

  // --- CTA ---
  if (!email.cta || !email.cta.trim()) {
    recs.push({ severity: 'critique', section: 'CTA', text: "Aucun CTA renseigné : sans appel à l'action clair, le taux de clic sera très faible." });
  } else if (analysis.quality.cta < 55) {
    recs.push({ severity: 'attention', section: 'CTA', text: `Le CTA "${email.cta}" manque de force. Utilisez un verbe d'action à l'impératif ("Je découvre le programme", "Je candidate") et restez concis.` });
  }

  // --- Contenu trop long/court ---
  if (analysis.meta.contentWordCount < 25) {
    recs.push({ severity: 'attention', section: 'Contenu', text: "Le contenu est très court et risque de ne pas convaincre une audience encore indécise. Développez un peu les bénéfices clés (formation, débouchés, vie de campus)." });
  } else if (analysis.meta.contentWordCount > 350) {
    recs.push({ severity: 'suggestion', section: 'Contenu', text: "Le contenu est long pour un email marketing. Priorisez un message principal et renvoyez le détail vers une landing page via le CTA." });
  }

  // --- Statut de la cible ---
  const sqlPct = Math.round((profiles.filter(p => p.statut === 'sql').length / n) * 100);
  const leadPct = Math.round((profiles.filter(p => p.statut === 'lead').length / n) * 100);
  if (leadPct > 65) {
    recs.push({ severity: 'info', section: 'Stratégie', text: `${leadPct}% de la cible est encore au stade "Lead" (premier intérêt). Privilégiez un ton pédagogique et rassurant plutôt qu'un CTA de candidature directe.` });
  } else if (sqlPct > 25) {
    recs.push({ severity: 'info', section: 'Stratégie', text: `${sqlPct}% de la cible est déjà "SQL" (prête à candidater). Un CTA direct et actionnable ("Je candidate maintenant") sera particulièrement efficace sur ce segment.` });
  }

  // --- Diagnostic global taux ---
  if (result.openRate < 0.15) {
    recs.push({ severity: 'critique', section: 'Global', text: `Le taux d'ouverture estimé (${(result.openRate * 100).toFixed(1)}%) est en-dessous des standards du secteur (20-30%). Retravaillez en priorité l'objet et le pré-header.` });
  }
  if (result.clickToOpenRate < 0.10) {
    recs.push({ severity: 'attention', section: 'Global', text: `Le taux de clic sur ouverture estimé (${(result.clickToOpenRate * 100).toFixed(1)}%) est faible. Le contenu ou le CTA n'accroche probablement pas assez la cible.` });
  }

  const order = { critique: 0, attention: 1, suggestion: 2, info: 3 };
  recs.sort((a, b) => order[a.severity] - order[b.severity]);
  return recs;
}
