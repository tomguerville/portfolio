// Référentiel métier partagé (générateur de données + moteur + UI)
// ICN Business School — campus réels : Nancy (ARTEM), Paris La Défense, Berlin (Moabit)

export const SEGMENTS = [
  {
    id: 'terminale',
    label: 'Terminales (Parcoursup)',
    short: 'Terminale',
    description: "Lycéens en terminale ayant formulé ou envisageant un vœu Parcoursup vers ICN.",
    diplomes: ['Bachelor in Management', 'International BBA', 'Programme Grande École (cursus intégré)'],
  },
  {
    id: 'bac1',
    label: 'Bac+1',
    short: 'Bac+1',
    description: "Étudiants en 1ère année (BTS, DUT/BUT, Licence 1, CPGE) envisageant une réorientation.",
    diplomes: ['Bachelor in Management (entrée 2e année)', 'International BBA (entrée 2e année)', 'Programme Grande École (admission parallèle)'],
  },
  {
    id: 'bac2',
    label: 'Bac+2',
    short: 'Bac+2',
    description: "Étudiants en 2e année (BTS, DUT/BUT, CPGE) candidats aux admissions parallèles.",
    diplomes: ['Programme Grande École (admission parallèle 1A)', 'Bachelor in Management (entrée 3e année)'],
  },
  {
    id: 'bac3',
    label: 'Bac+3',
    short: 'Bac+3',
    description: "Titulaires ou futurs titulaires d'une Licence/Bachelor, candidats PGE ou MSc.",
    diplomes: ['Programme Grande École (admission parallèle 1A)', 'MSc (1ère année)'],
  },
  {
    id: 'bac45',
    label: 'Bac+4/5',
    short: 'Bac+4/5',
    description: "Étudiants en Master 1, jeunes diplômés ou actifs en reconversion (MSc, Mastère Spécialisé).",
    diplomes: ['MSc (2e année / admission directe)', 'Mastère Spécialisé', 'Formation continue / executive'],
  },
];

export const CAMPUSES = ['Nancy', 'Paris', 'Berlin', 'Indifférent / pas encore décidé'];

export const STATUTS = [
  { id: 'lead', label: 'Lead', description: "A manifesté un premier intérêt (brochure, inscription salon, formulaire)." },
  { id: 'mql', label: 'MQL', description: "Marketing Qualified Lead — engagement répété, profil qualifié pour le marketing." },
  { id: 'sql', label: 'SQL', description: "Sales Qualified Lead — prêt à être contacté par les admissions, forte intention." },
];

export const SEGMENT_BY_ID = Object.fromEntries(SEGMENTS.map(s => [s.id, s]));
