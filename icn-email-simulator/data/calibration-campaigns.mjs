// Campagnes ICN réelles (contenu exact + résultats HubSpot hors bots) utilisées
// pour calibrer les constantes du moteur (js/calibrate.mjs). Source : document
// fourni par l'utilisateur le 21/07/2026 ("Sources_mail.docx").
//
// Le mapping segment/statut est une estimation de correspondance entre le
// ciblage HubSpot réel (listes, workflows) et les 5 cibles du simulateur —
// à corriger si besoin, il détermine directement la qualité de la calibration.

export const CALIBRATION_CAMPAIGNS = [
  {
    id: 'mail1_phase_complementaire',
    label: 'Mail 1 — Webinaire phase complémentaire Parcoursup',
    email: {
      subject: "Ta rentrée de septembre se joue dans 2 jours",
      preheader: "Participe à notre webinaire pour découvrir tes solutions pour septembre.",
      content: "Hello 🤞 Tes résultats ne sont pas ceux que tu espérais ? Participe à notre webinaire dans 2 jours pour découvrir les solutions concrètes pour ta rentrée de septembre : la phase complémentaire Parcoursup, les formations post-bac (Bachelor et BBA), et les modalités d'admission à ICN. 🎓 Tu pourras poser toutes tes questions en direct, et repartir avec de quoi sécuriser ta rentrée. Petit rappel : ce webinaire ne sera pas enregistré. Pour avoir les réponses, il faut être là mercredi 15 juillet à 18h. C'est quand ? Le mercredi 15 juillet 2026 à 18h. C'est où ? En visio (le lien te sera envoyé la veille)",
      cta: "Je m'inscris dès maintenant",
    },
    segments: ['terminale'],
    statuts: ['lead'],
    actualOpenRate: 0.2755,
    actualClickRate: 0.0019,
    delivered: 4654,
    note: "HubSpot signale une performance clic/ouverture sous les repères HubSpot pour cet envoi.",
  },
  {
    id: 'mail2_msc_international',
    label: 'Mail 2 — Nurture MSc marché international',
    email: {
      subject: "🚀 Votre carrière, votre expertise, votre impact avec ICN",
      preheader: "Des MSc conçus pour accélérer votre parcours international et vous démarquer à l'international.",
      content: "Votre carrière, votre expertise, votre impact. À ICN Business School, nos programmes Master of Science (MSc) sont bien plus que de simples diplômes. Ce sont de véritables accélérateurs pour les esprits ambitieux qui veulent acquérir une expertise pointue, se démarquer à l'international et réussir dans des secteurs hautement compétitifs. Pourquoi choisir un MSc à ICN ? Expertise spécialisée : plus de 360 heures de cours approfondis dans des domaines à forte valeur ajoutée (finance, marketing, luxe, supply chain), enrichis de Capstone Projects et de micro-certificats. Double diplôme : obtenez votre MSc et le diplôme d'État DESSMI, conférant le grade de Master. Immersion professionnelle : parcours en alternance ou à temps plein, avec un réseau de plus de 150 entreprises partenaires, des forums de recrutement et un service carrières dédié. Pédagogie ATM : notre approche Art Technology Management favorise l'adaptabilité, la créativité et le travail en équipe pluridisciplinaire. Opportunités internationales : cours en français ou en anglais, études à l'étranger, certificats internationaux. Employabilité garantie : projets concrets en entreprise, accompagnement carrière et réseau de 24 000 alumni. Une expérience étudiante sur laquelle vous pouvez compter, à Paris, Nancy ou Berlin. Découvre ta voie : de Finance, Risk & Markets à Luxury & Design Management, de Brand & Marketing à Smart & Sustainable Supply Chain Management.",
      cta: "Découvrir les MSc",
    },
    segments: ['bac3', 'bac45'],
    statuts: ['lead'],
    actualOpenRate: 0.2456,
    actualClickRate: 0.0175,
    delivered: 57,
    note: "Volume très faible (57 délivrés, ~1 clic) : peu fiable statistiquement, pondération réduite dans la calibration.",
  },
  {
    id: 'mail3_campus_paris',
    label: 'Mail 3 — Nurture campus Paris La Défense (objet personnalisé)',
    email: {
      subject: "{prénom} étudie dans une Grande École de Commerce",
      preheader: "Découvre notre campus de La Défense et plonge dans l'univers des affaires.",
      content: "CAMPUS DE PARIS – FRANCE. Imagine étudier dans une Grande Ecole de Commerce, là où se prennent chaque jour des décisions qui façonnent le monde. Sur notre campus parisien à La Défense — le plus grand quartier d'affaires d'Europe — tu es entouré·e des entreprises du CAC 40, de pôles d'innovation à la pointe et d'une communauté internationale dynamique. Ici, ta salle de classe s'étend jusque dans les salles de conseil, les événements de networking et les stages auprès de leaders mondiaux. Ce n'est pas juste étudier à Paris ; c'est vivre le monde des affaires de l'intérieur.",
      cta: "Découvrir le campus",
    },
    segments: ['bac3', 'bac45'],
    statuts: ['lead'],
    actualOpenRate: 0.0746,
    actualClickRate: 0.0088,
    delivered: 228,
  },
  {
    id: 'mail4_msc_alternance_fr',
    label: 'Mail 4 — Webinaire MSc en alternance (marché FR)',
    email: {
      subject: "Une alternance en MSc, sans entreprise pour l'instant ?",
      preheader: "À ICN, tu n'es pas seul pour la trouver. On t'explique mercredi.",
      content: "Hello 🤞 Beaucoup hésitent à se lancer dans un MSc en alternance pour une seule raison : ne pas avoir encore d'entreprise. Et si c'était justement là qu'on pouvait t'aider ? Le mercredi 1er juillet à 18h, nos équipes t'expliquent comment candidater à un MSc ICN pour la rentrée 2026, comment fonctionne l'alternance, et surtout comment ICN t'accompagne concrètement dans ta recherche d'entreprise. 🚀 Et si l'alternance n'est pas faite pour toi, ou que tu ne trouves pas d'entreprise à temps : pas d'inquiétude. D'autres formats existent pour suivre ton MSc, et on t'explique lesquels. Pas juste la théorie : les vraies étapes, les vrais délais, et à qui t'adresser pour avancer. Une heure pour y voir clair et te lancer sereinement. C'est quand ? Le mercredi 1er juillet 2026 à 18h. C'est où ? En visioconférence",
      cta: "Je réserve ma place",
    },
    segments: ['bac3', 'bac45'],
    statuts: ['lead'],
    actualOpenRate: 0.2169,
    actualClickRate: 0.0151,
    delivered: 332,
    note: "HubSpot signale un ratio clic/ouverture meilleur que la moyenne de la campagne.",
  },
  {
    id: 'mail5_events_international',
    label: 'Mail 5 — Nurture webinaires & salons internationaux (objet personnalisé)',
    email: {
      subject: "{prénom} découvre ICN en direct : webinaires et salons internationaux",
      preheader: "Participe à nos événements en ligne ou en personne et commence à te projeter sur nos campus.",
      content: "PARIS · NANCY · BERLIN. Bonjour, imagine une journée sur nos campus de Paris, Nancy ou Berlin : tu échanges avec des étudiants venus du monde entier, tu découvres des méthodes pédagogiques innovantes, tu prépares un projet international et tu construis ton futur à ton rythme. Nos webinaires te permettent de vivre cette expérience avant même ton arrivée : nos conseillers internationaux, accompagnés d'intervenants, professeurs, alumni et étudiants ambassadeurs internationaux, te feront découvrir le quotidien sur nos campus et partageront des conseils concrets pour réussir ta candidature. Tu pourras même explorer nos campus virtuellement et poser toutes tes questions en direct. Choisis le webinaire qui te correspond et réserve ta place en quelques clics.",
      cta: "Découvrir nos prochains évènements",
    },
    segments: ['bac3', 'bac45'],
    statuts: ['lead'],
    actualOpenRate: 0.0972,
    actualClickRate: 0.0094,
    delivered: 319,
  },
  {
    id: 'mail6_prepa_oraux',
    label: 'Mail 6 — Webinaire préparation aux oraux d\'admission (marché FR)',
    email: {
      subject: "Prépare tes oraux d'admission : c'est dans 2 jours",
      preheader: "Mercredi 8 juillet à 18h : les clés pour te démarquer le jour J.",
      content: "Hello 🤞 Dans 2 jours, notre session d'entraînement t'aide à aborder tes oraux d'admission avec confiance : les attentes du jury, les modalités des épreuves, et des conseils concrets pour te démarquer. Tu pourras poser toutes tes questions en direct, aux directeurs de programmes et au service concours. Une heure de préparation qui peut vraiment faire la différence le jour J. On t'attend mercredi 8 juillet à 18h. C'est quand ? Le mercredi 08 juillet 2026 à 18h. C'est où ? En visioconférence (le lien te sera envoyé avant)",
      cta: "Je m'inscris dès maintenant",
    },
    segments: ['terminale'],
    statuts: ['lead', 'mql'],
    actualOpenRate: 0.3419,
    actualClickRate: 0.0035,
    delivered: 2261,
    note: "HubSpot signale un taux d'ouverture meilleur que la moyenne de la campagne. Segment estimé (candidats en phase orale, potentiellement aussi Bac+2/3 admissions parallèles).",
  },
];
