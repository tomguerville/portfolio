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

## Limites connues / pistes d'amélioration

- Les taux sont **relatifs et comparatifs** (utiles pour arbitrer entre deux
  versions d'un même email) plutôt que des prédictions absolues garanties.
- Les dictionnaires de mots-clés sont volontairement simples (recherche de
  sous-chaînes normalisées) ; un email très détourné du vocabulaire attendu
  peut être mal noté même s'il est pertinent.
- Pistes d'extension : import d'un vrai historique de campagnes pour calibrer
  les constantes du modèle, comparaison A/B de deux emails côte à côte,
  export PDF du tableau de bord, pondération manuelle des variables par
  l'utilisateur.
