# Simulateur d'email marketing — ICN Business School

Outil statique (HTML/CSS/JS, sans framework ni build) permettant de simuler la
performance d'une campagne email avant envoi : taux d'ouverture, taux de clic,
attrait par section (objet, pré-header, contenu, CTA) et recommandations,
calculés en confrontant l'email à une base de profils marketing fictive.

⚠️ **Les profils et les taux affichés sont entièrement synthétiques**, générés
pour la démonstration. Ils ne remplacent pas un vrai A/B test ou des données
CRM réelles — c'est un outil d'aide à la décision, pas une prédiction garantie.

## Utiliser l'outil

Comme le JS est chargé en modules ES (`import`/`export`) et charge des JSON en
`fetch`, il faut le servir via un serveur HTTP local (pas de double-clic sur
`index.html` en `file://`) :

```bash
cd icn-email-simulator
python3 -m http.server 8080
# puis ouvrir http://localhost:8080
```

## Structure

```
icn-email-simulator/
  index.html            UI (formulaire + tableau de bord)
  css/styles.css
  js/
    domain.js            Référentiel cibles / campus / statuts
    data-generator.mjs    Génère data/profiles-*.json (Node, offline)
    engine.js              Moteur d'analyse + simulation (partagé Node/navigateur)
    app.js                 Logique UI (navigateur uniquement)
  data/
    profiles-<segment>.json   1 200 profils par cible (généré)
    _summary.json              Statistiques agrégées de contrôle
```

## Les 5 cibles

Basées sur le cycle de recrutement réel d'une école de commerce comme ICN
(campus Nancy, Paris, Berlin ; Bachelor in Management, International BBA,
Programme Grande École, MSc) :

| Cible | Profil type | Diplômes visés |
|---|---|---|
| **Terminale (Parcoursup)** | Lycéens formulant un vœu Parcoursup | Bachelor, IBBA, PGE cursus intégré |
| **Bac+1** | BTS/DUT/L1/CPGE envisageant une réorientation | Bachelor/IBBA entrée 2e année, PGE admission parallèle |
| **Bac+2** | Candidats classiques aux admissions parallèles | PGE admission parallèle 1A, Bachelor entrée 3e année |
| **Bac+3** | Titulaires Licence/Bachelor | PGE admission parallèle 1A, MSc 1A |
| **Bac+4/5** | Master 1, jeunes diplômés, reconversion pro | MSc 2A, Mastère Spécialisé, formation continue |

## Méthodologie de génération des profils (`data-generator.mjs`)

Chaque cible est composée de 4 à 5 **archétypes** (personas) pondérés — par
exemple pour les Terminales : *Convaincu ambitieux*, *Vie étudiante avant
tout*, *Comparateur indécis*, *Suiveur parents*, *International/IBBA*. Chaque
archétype définit une moyenne réaliste pour chaque variable, puis un bruit
gaussien est appliqué par profil pour obtenir une distribution continue et
crédible plutôt que des paliers artificiels.

Variables par profil :
- `interet_formation`, `interet_ecole`, `interet_campus`, `vie_associative`,
  `interet_alternance` (0-100)
- `sensibilite_prix`, `engagement_email` (0-100, propension de base à ouvrir
  des emails marketing, indépendante du contenu)
- `statut` (`lead` / `mql` / `sql`) — attribué par rang d'engagement au sein
  du segment, en respectant une cible de répartition réaliste par cible
  (ex : Terminale ≈ 65% lead / 25% MQL / 10% SQL ; Bac+4/5 ≈ 48/30/22, plus
  qualifiée car issue de campagnes d'admissions parallèles ciblées)
- `diplome_vise`, `campus_vise`, `source` (canal d'acquisition),
  `region_origine`, `canal_principal` (mobile/desktop)
- `anciennete_lead_jours`, `interactions_precedentes` (cohérents avec le statut)

Tendances volontairement injectées (et vérifiables dans `data/_summary.json`) :
l'intérêt pour l'alternance augmente avec le niveau d'études, l'intérêt pour
la vie associative diminue, l'engagement email de base augmente avec la
qualification. Seed déterministe (mulberry32) : régénérer avec
`node js/data-generator.mjs` reproduit exactement la même base.

## Méthodologie du moteur de simulation (`engine.js`)

Le moteur est **basé sur des règles explicables**, pas un modèle boîte noire :
chaque score peut être justifié, ce qui permet de générer des recommandations
concrètes plutôt qu'un simple chiffre.

1. **Analyse thématique** : chaque section de l'email (objet, pré-header,
   contenu, CTA) est scannée avec des dictionnaires de mots-clés français par
   thème (formation, école, campus, vie associative, alternance, financement,
   action, urgence), avec rendements décroissants sur la densité de mots-clés.
2. **Score qualité "bonnes pratiques"** par section (longueur d'objet,
   présence de pré-header distinct de l'objet, verbe d'action dans le CTA,
   longueur du contenu, personnalisation `{prénom}`, etc.).
3. **Probabilité d'ouverture par profil** : combinaison de l'engagement de
   base du profil, de l'affinité thématique objet/pré-header pondérée par les
   centres d'intérêt réels du profil, du score qualité, et d'un ajustement
   selon le statut (lead/MQL/SQL), passée dans une fonction logistique.
4. **Probabilité de clic (sachant l'ouverture)** : même logique appliquée au
   contenu et au CTA, avec bonus/malus de pertinence spécifiques (ex :
   intérêt fort pour l'alternance non adressé dans le contenu → malus).
5. **Agrégation** : les probabilités individuelles sont moyennées sur tous
   les profils de la sélection (cible × statut) pour produire le taux
   d'ouverture, le taux de clic global et le CTOR (clic sur ouverture)
   affichés dans le tableau de bord.
6. **Recommandations** : règles comparant le contenu de l'email aux
   caractéristiques réelles de l'audience sélectionnée (ex : "X% de la cible
   a un fort intérêt pour l'alternance mais l'email n'en parle pas").

## Calibration sur des campagnes ICN réelles (`calibrate.mjs`)

Les constantes du moteur (regroupées dans `CALIBRATION` en tête de
`engine.js`) ne sont **pas devinées** : elles sont calées sur deux sources de
données ICN réelles, en deux temps.

```bash
node js/calibrate.mjs   # relance la calibration, affiche prédit vs réel
```

**Source 1 — sensibilité au contenu** : 6 campagnes avec contenu exact +
résultats HubSpot hors bots (`data/calibration-campaigns.mjs`). Le script
précalcule les signaux bruts (avant fonction logistique) pour chaque
campagne sur le sous-ensemble de profils correspondant à sa cible réelle,
puis cherche par recherche en grille le seuil/la pente qui minimisent l'écart
en log pondéré par `√(volume délivré)` — pour que les petits volumes (ex : 57
délivrés) pèsent moins que les gros (ex : 4 654 délivrés).

**Source 2 — niveau de base par cible** : agrégat de 405 campagnes ICN
réellement envoyées entre août 2024 et juillet 2026 (~186 000 délivrés,
export HubSpot fourni par l'utilisateur le 21/07/2026,
`data/segment-targets.json` + `data/hubspot_segment_stats_source.csv`), sans
contenu détaillé mais avec un volume bien plus robuste par cible. Le nom de
chaque campagne HubSpot encode généralement la cible (`Cible Term`, `B+2`,
`bac+5`, `AST`...) et parfois le statut (`(MQL)`, `(SQL)`, `(LEAD)`), ce qui a
permis de classer ~175 des 405 campagnes par segment. Un email neutre
générique (volontairement pas l'un des 6 exemples ci-dessus, qui performent
plutôt bien) est appliqué à toute la population réelle de chaque segment pour
en déduire un **décalage additif par segment** (`segmentOffsetOpen/Click`).

Ce découplage en deux temps est volontaire : essayer de tout calibrer en un
seul passage fait diverger le calcul (le seuil de la logistique et le
décalage par segment sont redondants pour un décalage constant — non
identifiable si les deux varient en même temps).

**Ce que révèle la source 2, que 6 exemples ne pouvaient pas montrer** :
l'engagement ne progresse pas linéairement avec le niveau académique. Sur
405 campagnes réelles, le Bac+4/5 (CTOR 27,9 %) engage près de 5× plus que la
Terminale (CTOR 5,6 %), à contenu équivalent — un effet de cible/liste
(audience plus décidée, plus proche de la décision) que l'analyse de contenu
seule ne peut pas expliquer, d'où l'ajout d'un décalage par segment
indépendant du texte de l'email.

**Autre ajustement issu de cette calibration** : un signal "urgence
temporelle concrète" (ex : *"dans 2 jours"*) dans le calcul du taux
d'ouverture — les deux campagnes Terminale avec la meilleure ouverture
réelle (27,55 % et 34,19 %) partagent toutes les deux ce type de formulation
dans l'objet, absente des campagnes moins performantes. Ce thème existait
déjà dans les dictionnaires de mots-clés mais n'était jamais utilisé dans le
calcul — c'est corrigé, avec un poids recalé pour expliquer une partie
significative de l'écart observé.

**Mapping cible réelle → segment du simulateur** pour les 6 campagnes
détaillées, documenté et à corriger si besoin dans
`data/calibration-campaigns.mjs` (il détermine directement la qualité de la
calibration) :

| Campagne | Ciblage HubSpot réel | Segment retenu | Statut retenu |
|---|---|---|---|
| Phase complémentaire Parcoursup | Liste "phase complémentaire Parcoursup V2" | `terminale` | `lead` |
| Prépa oraux d'admission | Liste webinaire FR généraliste | `terminale` | `lead` + `mql` |
| MSc alternance (FR) | Liste webinaire MSc alternance | `bac3` + `bac45` | `lead` |
| MSc international, campus Paris, événements (×3) | Workflow "INT - Nurturing 25-26 lead" | `bac3` + `bac45` | `lead` |

## Limites connues / pistes d'amélioration

- Les taux sont désormais calés sur de la donnée réelle en **niveau moyen
  par segment** (source large, ~186k délivrés — fiable), mais restent moins
  précis en **valeur absolue sur un email donné** : les 6 campagnes avec
  contenu détaillé sont plutôt de bons exemples (au-dessus de la moyenne de
  leur cible), donc la prédiction individuelle sur ces cas précis reste
  parfois sous-estimée malgré le signal d'urgence ajouté (ex : la campagne
  "phase complémentaire Parcoursup" prédit 14,1 % contre 27,55 % réel). Le
  modèle reste plus fiable en **comparatif** (email A vs email B sur une même
  cible) qu'en prédiction absolue exacte pour un envoi isolé.
- Un modèle fondé sur l'analyse du contenu ne peut structurellement pas
  capturer les facteurs qui expliquent une bonne partie de la variance
  réelle observée : réputation d'expéditeur/domaine, fraîcheur de la liste,
  jour/heure d'envoi, arrivée en spam, effet des bots de prefetch (Apple Mail
  Privacy Protection gonfle artificiellement les taux d'ouverture bruts —
  d'où l'usage des chiffres "hors bots" pour la calibration).
- Contenu détaillé disponible pour seulement 6 campagnes (toutes lead/MQL,
  aucune SQL, aucune sur Bac+1/Bac+2 purs) ; le niveau de base par segment
  (source 2) couvre les 5 cibles mais avec un volume inégal (17 440 délivrés
  sur Terminale, seulement 178 sur Bac+1). Plus de campagnes réelles avec
  contenu détaillé (surtout SQL, Bac+1, Bac+2) amélioreraient nettement la
  précision — relancer `node js/calibrate.mjs` après avoir complété
  `data/calibration-campaigns.mjs`.
- Les dictionnaires de mots-clés sont volontairement simples (recherche de
  sous-chaînes normalisées) ; un email très détourné du vocabulaire attendu
  peut être mal noté même s'il est pertinent.
- Pistes d'extension : comparaison A/B de deux emails côte à côte, export PDF
  du tableau de bord, pondération manuelle des variables par l'utilisateur,
  ajout d'un paramètre "contexte d'envoi" (fraîcheur de liste, domaine
  expéditeur) si ces facteurs s'avèrent aussi déterminants que suggéré ici.
