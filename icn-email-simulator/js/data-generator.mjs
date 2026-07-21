// Générateur de base de données fictive de profils marketing (Node.js, exécution offline).
// Produit data/profiles-<segment>.json — un fichier par cible, 1200 profils chacun.
//
// Méthodologie : chaque cible est composée de plusieurs "archétypes" (personas) dont les
// pondérations et les moyennes de variables reflètent des comportements réalistes observés
// dans le recrutement d'une école de commerce (Parcoursup pour les terminales, admissions
// parallèles pour les Bac+2/3, alternance/reconversion pour les Bac+4/5, etc.).
// Un bruit gaussien est ajouté à chaque variable pour éviter les profils "en escalier"
// et obtenir une distribution continue et crédible à l'intérieur de chaque archétype.

import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dirname, '..', 'data');
mkdirSync(OUT_DIR, { recursive: true });

const PROFILES_PER_SEGMENT = 1200;

// ---------------------------------------------------------------------------
// PRNG déterministe (mulberry32) — garantit une base reproductible d'une
// génération à l'autre (même seed = mêmes profils).
// ---------------------------------------------------------------------------
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seedStr) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return mulberry32(h >>> 0);
}

function gaussian(rng, mean, std) {
  // Box-Muller
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * std;
}

function clamp(v, min = 0, max = 100) {
  return Math.max(min, Math.min(max, v));
}

function clampInt(v, min, max) {
  return Math.round(clamp(v, min, max));
}

function pick(rng, weightedItems) {
  // weightedItems: [[value, weight], ...]
  const total = weightedItems.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, weight] of weightedItems) {
    r -= weight;
    if (r <= 0) return value;
  }
  return weightedItems[weightedItems.length - 1][0];
}

function pickN(rng, weightedItems, n) {
  return Array.from({ length: n }, () => pick(rng, weightedItems));
}

// ---------------------------------------------------------------------------
// Référentiels partagés
// ---------------------------------------------------------------------------
const REGIONS_FR = [
  ['Grand Est', 30], ['Île-de-France', 20], ['Auvergne-Rhône-Alpes', 10],
  ['Hauts-de-France', 8], ['Bourgogne-Franche-Comté', 6], ['Occitanie', 6],
  ['Nouvelle-Aquitaine', 5], ['Pays de la Loire', 5], ['Normandie', 4],
  ['Bretagne', 3], ['PACA', 3],
];
const REGIONS_INTL = [
  ['Allemagne', 4], ['Belgique', 3], ['Luxembourg', 3], ['Maroc', 3],
  ['Chine', 2], ['Afrique subsaharienne', 3], ['Autre UE', 2],
];

function regionPool(intlWeight) {
  const fr = REGIONS_FR.map(([r, w]) => [r, w * (1 - intlWeight)]);
  const intl = REGIONS_INTL.map(([r, w]) => [r, w * intlWeight * 4]);
  return [...fr, ...intl];
}

const CAMPUS_DEFAULT = [['Nancy', 45], ['Paris', 28], ['Berlin', 10], ['Indifférent / pas encore décidé', 17]];

// ---------------------------------------------------------------------------
// Définition des archétypes par cible.
// Chaque archétype porte : poids relatif, moyennes de variables (0-100),
// écarts-types, préférences de diplôme / campus / source pondérées.
// ---------------------------------------------------------------------------
const SOURCES = {
  terminale: [
    ['Parcoursup — vœu enregistré', 34], ['Salon étudiant / JPO', 22],
    ['Réseaux sociaux (Instagram/TikTok)', 20], ['Recommandation (bouche-à-oreille)', 10],
    ['Prescripteur (professeur, CIO)', 8], ['Publicité en ligne', 6],
  ],
  bac1: [
    ['Site web ICN — demande de brochure', 26], ['Salon Studyrama/L\'Étudiant', 22],
    ['Réseaux sociaux (Instagram/LinkedIn)', 20], ['Publicité en ligne (Google/Meta Ads)', 16],
    ['Recommandation alumni', 9], ['Concours (Passerelle/Ambitions+)', 7],
  ],
  bac2: [
    ['Concours (Passerelle/AST)', 28], ['Salon Studyrama/L\'Étudiant', 20],
    ['Site web ICN — demande de brochure', 18], ['Réseaux sociaux (LinkedIn/Instagram)', 16],
    ['Publicité en ligne (Google/Meta Ads)', 12], ['Recommandation alumni', 6],
  ],
  bac3: [
    ['Concours (Passerelle/AST)', 26], ['Site web ICN — demande de brochure', 20],
    ['Salon Studyrama/L\'Étudiant', 16], ['Réseaux sociaux (LinkedIn)', 18],
    ['Publicité en ligne (Google/Meta Ads)', 12], ['Recommandation alumni', 8],
  ],
  bac45: [
    ['Site web ICN — demande de brochure', 22], ['Réseaux sociaux (LinkedIn)', 24],
    ['CPF / Pôle emploi / Transitions Pro', 14], ['Publicité en ligne (Google/Meta Ads)', 14],
    ['Salon Studyrama/L\'Étudiant', 10], ['Recommandation alumni', 16],
  ],
};

const ARCHETYPES = {
  terminale: [
    {
      name: 'Convaincu ambitieux', weight: 18,
      means: { formation: 75, ecole: 80, campus: 60, vie_associative: 55, alternance: 28, prix: 40, engagement: 70 },
      diplomes: [['Programme Grande École (cursus intégré)', 60], ['Bachelor in Management', 30], ['International BBA', 10]],
      campus: [['Nancy', 50], ['Paris', 32], ['Berlin', 8], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.05,
    },
    {
      name: 'Vie étudiante avant tout', weight: 22,
      means: { formation: 45, ecole: 50, campus: 70, vie_associative: 85, alternance: 18, prix: 55, engagement: 60 },
      diplomes: [['Bachelor in Management', 55], ['International BBA', 25], ['Programme Grande École (cursus intégré)', 20]],
      campus: [['Nancy', 48], ['Paris', 26], ['Berlin', 8], ['Indifférent / pas encore décidé', 18]],
      intlWeight: 0.05,
    },
    {
      name: 'Comparateur indécis', weight: 30,
      means: { formation: 40, ecole: 40, campus: 45, vie_associative: 40, alternance: 15, prix: 70, engagement: 35 },
      diplomes: [['Bachelor in Management', 40], ['Programme Grande École (cursus intégré)', 35], ['International BBA', 25]],
      campus: [['Nancy', 32], ['Paris', 26], ['Berlin', 6], ['Indifférent / pas encore décidé', 36]],
      intlWeight: 0.04,
    },
    {
      name: 'Suiveur parents / sécurité', weight: 18,
      means: { formation: 55, ecole: 60, campus: 40, vie_associative: 30, alternance: 20, prix: 75, engagement: 45 },
      diplomes: [['Bachelor in Management', 50], ['Programme Grande École (cursus intégré)', 40], ['International BBA', 10]],
      campus: [['Nancy', 55], ['Paris', 25], ['Berlin', 5], ['Indifférent / pas encore décidé', 15]],
      intlWeight: 0.03,
    },
    {
      name: 'International / IBBA', weight: 12,
      means: { formation: 65, ecole: 65, campus: 55, vie_associative: 50, alternance: 25, prix: 45, engagement: 55 },
      diplomes: [['International BBA', 80], ['Bachelor in Management', 20]],
      campus: [['Paris', 35], ['Berlin', 35], ['Nancy', 20], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.35,
    },
  ],
  bac1: [
    {
      name: 'Réorientation motivée', weight: 25,
      means: { formation: 70, ecole: 60, campus: 50, vie_associative: 45, alternance: 50, prix: 55, engagement: 55 },
      diplomes: [['Bachelor in Management (entrée 2e année)', 70], ['International BBA (entrée 2e année)', 30]],
      campus: [['Nancy', 46], ['Paris', 30], ['Berlin', 8], ['Indifférent / pas encore décidé', 16]],
      intlWeight: 0.05,
    },
    {
      name: 'Explorateur passif', weight: 35,
      means: { formation: 35, ecole: 35, campus: 35, vie_associative: 35, alternance: 30, prix: 60, engagement: 28 },
      diplomes: [['Bachelor in Management (entrée 2e année)', 60], ['International BBA (entrée 2e année)', 20], ['Programme Grande École (admission parallèle)', 20]],
      campus: [['Nancy', 34], ['Paris', 24], ['Berlin', 6], ['Indifférent / pas encore décidé', 36]],
      intlWeight: 0.04,
    },
    {
      name: 'Ambitieux Grande École', weight: 15,
      means: { formation: 75, ecole: 75, campus: 55, vie_associative: 40, alternance: 55, prix: 35, engagement: 65 },
      diplomes: [['Programme Grande École (admission parallèle)', 85], ['Bachelor in Management (entrée 2e année)', 15]],
      campus: [['Nancy', 45], ['Paris', 35], ['Berlin', 10], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.06,
    },
    {
      name: 'Sensible coût / alternance', weight: 25,
      means: { formation: 55, ecole: 45, campus: 35, vie_associative: 30, alternance: 75, prix: 80, engagement: 45 },
      diplomes: [['Bachelor in Management (entrée 2e année)', 65], ['International BBA (entrée 2e année)', 15], ['Programme Grande École (admission parallèle)', 20]],
      campus: [['Nancy', 50], ['Paris', 28], ['Berlin', 5], ['Indifférent / pas encore décidé', 17]],
      intlWeight: 0.02,
    },
  ],
  bac2: [
    {
      name: 'Candidat PGE déterminé', weight: 30,
      means: { formation: 80, ecole: 78, campus: 55, vie_associative: 40, alternance: 60, prix: 40, engagement: 70 },
      diplomes: [['Programme Grande École (admission parallèle 1A)', 80], ['Bachelor in Management (entrée 3e année)', 20]],
      campus: [['Nancy', 44], ['Paris', 36], ['Berlin', 10], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.05,
    },
    {
      name: 'Alternant prioritaire', weight: 25,
      means: { formation: 65, ecole: 55, campus: 35, vie_associative: 25, alternance: 85, prix: 60, engagement: 55 },
      diplomes: [['Programme Grande École (admission parallèle 1A)', 55], ['Bachelor in Management (entrée 3e année)', 45]],
      campus: [['Nancy', 48], ['Paris', 34], ['Berlin', 6], ['Indifférent / pas encore décidé', 12]],
      intlWeight: 0.03,
    },
    {
      name: 'CPGE reconversion', weight: 15,
      means: { formation: 75, ecole: 70, campus: 40, vie_associative: 30, alternance: 45, prix: 35, engagement: 60 },
      diplomes: [['Programme Grande École (admission parallèle 1A)', 90], ['Bachelor in Management (entrée 3e année)', 10]],
      campus: [['Nancy', 40], ['Paris', 42], ['Berlin', 10], ['Indifférent / pas encore décidé', 8]],
      intlWeight: 0.04,
    },
    {
      name: 'Explorateur / comparateur', weight: 30,
      means: { formation: 45, ecole: 40, campus: 40, vie_associative: 35, alternance: 45, prix: 55, engagement: 32 },
      diplomes: [['Programme Grande École (admission parallèle 1A)', 45], ['Bachelor in Management (entrée 3e année)', 55]],
      campus: [['Nancy', 34], ['Paris', 28], ['Berlin', 7], ['Indifférent / pas encore décidé', 31]],
      intlWeight: 0.04,
    },
  ],
  bac3: [
    {
      name: 'MSc spécialisation carrière', weight: 30,
      means: { formation: 80, ecole: 70, campus: 45, vie_associative: 25, alternance: 70, prix: 45, engagement: 65 },
      diplomes: [['MSc (1ère année)', 65], ['Programme Grande École (admission parallèle 1A)', 35]],
      campus: [['Nancy', 34], ['Paris', 44], ['Berlin', 14], ['Indifférent / pas encore décidé', 8]],
      intlWeight: 0.07,
    },
    {
      name: 'PGE généraliste ambitieux', weight: 25,
      means: { formation: 78, ecole: 80, campus: 50, vie_associative: 35, alternance: 55, prix: 40, engagement: 68 },
      diplomes: [['Programme Grande École (admission parallèle 1A)', 85], ['MSc (1ère année)', 15]],
      campus: [['Nancy', 42], ['Paris', 40], ['Berlin', 10], ['Indifférent / pas encore décidé', 8]],
      intlWeight: 0.05,
    },
    {
      name: 'Alternance-first', weight: 25,
      means: { formation: 60, ecole: 50, campus: 30, vie_associative: 20, alternance: 88, prix: 65, engagement: 55 },
      diplomes: [['MSc (1ère année)', 55], ['Programme Grande École (admission parallèle 1A)', 45]],
      campus: [['Nancy', 46], ['Paris', 38], ['Berlin', 8], ['Indifférent / pas encore décidé', 8]],
      intlWeight: 0.04,
    },
    {
      name: 'International / mobilité', weight: 20,
      means: { formation: 70, ecole: 65, campus: 55, vie_associative: 35, alternance: 45, prix: 40, engagement: 60 },
      diplomes: [['MSc (1ère année)', 70], ['Programme Grande École (admission parallèle 1A)', 30]],
      campus: [['Paris', 38], ['Berlin', 34], ['Nancy', 20], ['Indifférent / pas encore décidé', 8]],
      intlWeight: 0.22,
    },
  ],
  bac45: [
    {
      name: 'Spécialisation pointue', weight: 35,
      means: { formation: 85, ecole: 65, campus: 30, vie_associative: 15, alternance: 75, prix: 50, engagement: 60 },
      diplomes: [['MSc (2e année / admission directe)', 70], ['Mastère Spécialisé', 30]],
      campus: [['Paris', 46], ['Nancy', 28], ['Berlin', 16], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.08,
    },
    {
      name: 'Reconversion professionnelle', weight: 20,
      means: { formation: 70, ecole: 45, campus: 20, vie_associative: 10, alternance: 40, prix: 70, engagement: 45 },
      diplomes: [['Mastère Spécialisé', 55], ['Formation continue / executive', 45]],
      campus: [['Nancy', 40], ['Paris', 38], ['Berlin', 8], ['Indifférent / pas encore décidé', 14]],
      intlWeight: 0.03,
    },
    {
      name: 'Networking / carrière', weight: 25,
      means: { formation: 65, ecole: 75, campus: 35, vie_associative: 20, alternance: 55, prix: 40, engagement: 58 },
      diplomes: [['MSc (2e année / admission directe)', 55], ['Mastère Spécialisé', 35], ['Formation continue / executive', 10]],
      campus: [['Paris', 48], ['Nancy', 26], ['Berlin', 16], ['Indifférent / pas encore décidé', 10]],
      intlWeight: 0.06,
    },
    {
      name: 'Explorateur tardif', weight: 20,
      means: { formation: 45, ecole: 40, campus: 25, vie_associative: 15, alternance: 40, prix: 55, engagement: 30 },
      diplomes: [['MSc (2e année / admission directe)', 40], ['Mastère Spécialisé', 35], ['Formation continue / executive', 25]],
      campus: [['Nancy', 32], ['Paris', 34], ['Berlin', 10], ['Indifférent / pas encore décidé', 24]],
      intlWeight: 0.05,
    },
  ],
};

// Cibles de répartition du statut (lead/mql/sql) par segment — reflète un
// entonnoir marketing classique en école de commerce (Parcoursup génère un
// volume massif de leads peu qualifiés ; les admissions parallèles Bac+2/3/4-5
// attirent une audience plus décidée, donc un taux MQL/SQL plus élevé).
const STATUT_TARGETS = {
  terminale: { lead: 0.65, mql: 0.25, sql: 0.10 },
  bac1: { lead: 0.75, mql: 0.18, sql: 0.07 },
  bac2: { lead: 0.55, mql: 0.30, sql: 0.15 },
  bac3: { lead: 0.50, mql: 0.32, sql: 0.18 },
  bac45: { lead: 0.48, mql: 0.30, sql: 0.22 },
};

const SEGMENT_SEED = { terminale: 1001, bac1: 1002, bac2: 1003, bac3: 1004, bac45: 1005 };

function generateSegment(segmentId) {
  const rng = makeRng(`icn-${segmentId}-${SEGMENT_SEED[segmentId]}`);
  const archetypes = ARCHETYPES[segmentId];
  const sources = SOURCES[segmentId];
  const archPool = archetypes.map(a => [a, a.weight]);

  const profiles = [];
  for (let i = 0; i < PROFILES_PER_SEGMENT; i++) {
    const arch = pick(rng, archPool);
    const noise = () => gaussian(rng, 0, 12);

    const interet_formation = clampInt(arch.means.formation + noise(), 2, 99);
    const interet_ecole = clampInt(arch.means.ecole + noise(), 2, 99);
    const interet_campus = clampInt(arch.means.campus + noise(), 2, 99);
    const vie_associative = clampInt(arch.means.vie_associative + noise(), 2, 99);
    const interet_alternance = clampInt(arch.means.alternance + noise(), 0, 99);
    const sensibilite_prix = clampInt(arch.means.prix + noise(), 5, 99);
    const engagement_email = clampInt(arch.means.engagement + gaussian(rng, 0, 14), 2, 99);

    const diplome_vise = pick(rng, arch.diplomes);
    const campus_vise = pick(rng, arch.campus);
    const source = pick(rng, sources);
    const region_origine = pick(rng, regionPool(arch.intlWeight));
    const canal_principal = pick(rng, [['mobile', 68], ['desktop', 32]]);

    profiles.push({
      id: `${segmentId.toUpperCase()}-${String(i + 1).padStart(5, '0')}`,
      segment: segmentId,
      archetype: arch.name,
      statut: null, // assigné après tri par score d'engagement (cf. plus bas)
      source,
      diplome_vise,
      campus_vise,
      region_origine,
      canal_principal,
      interet_formation,
      interet_ecole,
      interet_campus,
      vie_associative,
      interet_alternance,
      sensibilite_prix,
      engagement_email,
      anciennete_lead_jours: 0,
      interactions_precedentes: 0,
      _rankScore: engagement_email + gaussian(rng, 0, 8),
    });
  }

  // Attribution du statut par rang (score d'engagement + bruit), en respectant
  // les proportions cibles du segment — corrèle statut et engagement sans
  // figer une règle déterministe stricte.
  const targets = STATUT_TARGETS[segmentId];
  const sorted = [...profiles].sort((a, b) => b._rankScore - a._rankScore);
  const nSql = Math.round(PROFILES_PER_SEGMENT * targets.sql);
  const nMql = Math.round(PROFILES_PER_SEGMENT * targets.mql);
  sorted.forEach((p, idx) => {
    if (idx < nSql) p.statut = 'sql';
    else if (idx < nSql + nMql) p.statut = 'mql';
    else p.statut = 'lead';
  });

  // Ancienneté et interactions précédentes, cohérentes avec le statut.
  for (const p of profiles) {
    delete p._rankScore;
    if (p.statut === 'sql') {
      p.anciennete_lead_jours = clampInt(gaussian(rng, 240, 110), 15, 720);
      p.interactions_precedentes = clampInt(gaussian(rng, 16, 6), 6, 40);
    } else if (p.statut === 'mql') {
      p.anciennete_lead_jours = clampInt(gaussian(rng, 150, 90), 5, 600);
      p.interactions_precedentes = clampInt(gaussian(rng, 7, 3), 2, 20);
    } else {
      p.anciennete_lead_jours = clampInt(gaussian(rng, 70, 70), 0, 500);
      p.interactions_precedentes = clampInt(gaussian(rng, 1.5, 1.5), 0, 8);
    }
  }

  return profiles;
}

const summary = {};
for (const segment of Object.keys(ARCHETYPES)) {
  const profiles = generateSegment(segment);
  const filePath = join(OUT_DIR, `profiles-${segment}.json`);
  writeFileSync(filePath, JSON.stringify(profiles));

  const avg = (key) => (profiles.reduce((s, p) => s + p[key], 0) / profiles.length).toFixed(1);
  const statutCounts = profiles.reduce((acc, p) => { acc[p.statut] = (acc[p.statut] || 0) + 1; return acc; }, {});
  summary[segment] = {
    count: profiles.length,
    statutCounts,
    avg_interet_formation: avg('interet_formation'),
    avg_interet_ecole: avg('interet_ecole'),
    avg_interet_campus: avg('interet_campus'),
    avg_vie_associative: avg('vie_associative'),
    avg_interet_alternance: avg('interet_alternance'),
    avg_engagement_email: avg('engagement_email'),
  };
  console.log(`✓ ${segment}: ${profiles.length} profils → ${filePath}`);
}

writeFileSync(join(OUT_DIR, '_summary.json'), JSON.stringify(summary, null, 2));
console.log('\nRésumé statistique écrit dans data/_summary.json');
console.table(summary);
