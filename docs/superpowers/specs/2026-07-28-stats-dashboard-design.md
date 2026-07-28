# Design Spec - Refonte du Dashboard Statistiques

**Date** : 2026-07-28  
**Statut** : Approuvé  
**Auteur** : Antigravity & User  

---

## 1. Objectif & Vue d'ensemble

L'objectif de cette refonte est de transformer la vue actuelle (`src/views/Stats.tsx`) en une page Dashboard / Statistiques complète, moderne, interactive et épurée. La nouvelle page permettra d'analyser la performance commerciale, la santé du pipeline, l'activité de l'équipe et les prévisions de ventes (forecast).

---

## 2. Choix Techniques & Architecture UI

- **Framework & React** : React 19 + TypeScript.
- **Librairie de Graphiques** : **Recharts** (intégré pour React 19, SVG responsive, personnalisable avec le thème sombre/doré).
- **Styling & Thème** : Tailwind CSS v4 (`#141414`, `#0d0d0d`, `#D4C4A8`, `#f2ede4`, `#1e1e1e`).
- **Icônes** : `lucide-react`.
- **Export** : Fonction utilitaire JavaScript native de génération & téléchargement CSV.

---

## 3. Barre de Filtres Globaux (En-tête de la Page)

La barre supérieure reste fixe en haut de la page quel que soit l'onglet actif :

1. **Filtre Période & Sélecteur de Date** :
   - *Presets* : Aujourd'hui, 7 derniers jours, Ce mois-ci, Ce trimestre, Année en cours, Tout l'historique.
   - *Date Range Picker (Mode Personnalisé)* : Choix d'une plage de dates exacte avec sélecteur de date de début et de fin.
   - *Toggle Comparaison* : Option pour comparer avec la période précédente (ex: Ce mois vs Mois précédent) afin d'afficher les deltas en %.
2. **Filtre Commercial / Périmètre** :
   - Dropdown pour filtrer les données par commercial (Tous les commerciaux / Utilisateur spécifique).
3. **Action d'Export CSV** :
   - Bouton "Exporter (.csv)" pour télécharger un rapport synthétique filtré des opportunités et performances.

---

## 4. Structure des 3 Onglets Thématiques

### 🔷 Onglet 1 : Vue d'Ensemble & Performance Commerciale

* **Cartes KPI (Top Page - 4 colonnes)** :
  1. **Chiffre d'Affaires Gagné (€)** : Total des deals Closed-Won sur la période + % de variation vs période précédente.
  2. **Taux de Conversion (Win Rate %)** : Ratio `(Deals Gagnés / (Deals Gagnés + Perdu))` sur la période.
  3. **Panier Moyen (€)** : Ratio `CA Gagné / Nombre de deals gagnés`.
  4. **Cycle de Vente Moyen (Jours)** : Nombre moyen de jours entre la création d'un lead et sa fermeture gagnée.

* **Graphique d'Évolution Temporelle (Graphique Principal - Recharts Area/Line Chart)** :
  - Axe X : Temps (Jours, Semaines ou Mois selon le filtre sélectionné).
  - Axe Y : Montant (€) & Nombre de Leads.
  - Courbes : CA Gagné cumulé/périodique vs Nouveaux Leads créés.
  - Hover Tooltip personnalisé avec valeurs formatées.

* **Graphiques Secondaires (Grille 2 colonnes)** :
  - **Entonnoir de Conversion (Funnel Chart)** : Représentation visuelle des étapes du pipeline avec le nombre d'opportunités, le montant cumulé et le taux de conversion par étape.
  - **Sources d'Acquisition (Pie / Donut Chart)** : Répartition du CA et du volume de leads par canal d'origine (Inbound, Outbound, LinkedIn, Recommandation, etc.).

---

### 🔷 Onglet 2 : Pipeline & Prévisions (Forecast)

* **Cartes Métriques du Pipeline** :
  - **Pipeline Actif Total (€)** : Somme des opportunités non fermées.
  - **Forecast Pondéré (€)** : Somme de `valeur_deal * probabilité_étape_%`.
  - **Nombre de Deals en Cours**.

* **Graphique de Forecast Pondéré (Recharts Bar Chart)** :
  - Histogramme par étape du pipeline comparant la **Valeur Brute** et la **Valeur Pondérée** de chaque étape.
  - Prise en compte de la probabilité de succès configurée sur les étapes de pipeline.

* **Analyse des Pertes (Recharts Donut Chart & Liste)** :
  - Graphique en beignet affichant la répartition des opportunités perdues par motif (Prix, Concurrence, Budget, Timing, Inconnu).
  - Liste/Tableau des principales affaires perdues sur la période pour analyse rétrospective.

---

### 🔷 Onglet 3 : Activité & Performance d'Équipe

* **Graphique de Volume d'Activités (Recharts Stacked Bar Chart)** :
  - Histogramme du volume d'interactions quotidiennes/hebdomadaires (Appels, Emails, Rendez-vous, Notes).

* **Leaderboard Commercial (Tableau Interactif)** :
  - Tableau comparatif par commercial :
    - Commercial (Nom + Avatar/Initiales)
    - CA Gagné (€)
    - Deals Gagnés (Nombre)
    - Taux de Conversion (%)
    - Activités Réalisées (Nombre total d'actions)
    - Panier Moyen (€)
  - Tri dynamique disponible sur chaque colonne.

---

## 5. Gestion des Données & UX

* **Empty States** : Graphiques et indicateurs adaptés lorsqu'aucune donnée n'est disponible sur la période sélectionnée (illustrations/messages explicatifs au lieu de graphiques vides).
* **Skeleton Loaders** : Structure en filigrane animé pendant le chargement des ressources.
* **Calculs Côté Client / Performance** : Utilisation intensive de `useMemo` pour assurer la réactivité des filtres sans latence.

---

## 6. Plan de Vérification

1. **Test des Filtres Temporels** : Vérifier l'actualisation dynamique des KPIs et des graphiques Recharts lors du changement de preset et lors de l'utilisation du sélecteur de dates personnalisé.
2. **Test des Onglets** : S'assurer du basculement fluide entre *Vue d'Ensemble*, *Pipeline & Forecast* et *Activité & Équipe*.
3. **Test d'Export CSV** : Valider le téléchargement et la conformité du fichier CSV généré.
4. **Test de Responsivité & Thème** : Vérifier le rendu visuel sur écran desktop, tablette et mobile dans le thème sombre Seiki.
