# Document de Design : Dashboard Unifié SEIKI CRM (CODIR & Analytics)

**Date :** 2026-07-30  
**Auteur :** Antigravity AI & Équipe Seiki  
**Statut :** Approuvé  

---

## 🎯 Objectifs du Projet

Fusionner l'ancienne vue `Codir.tsx` et la vue `Stats.tsx` au sein d'une vue unique et moderne nommée **Dashboard** (`Dashboard.tsx`). 

Le nouveau Dashboard répond à quatre impératifs :
1. **Unification** : Réunir la vision exécutive CODIR et les analyses fines du pipeline commercial, de la prospection et des tâches d'équipe.
2. **Comparaison Temporelle & CODIR** : Pouvoir comparer l'évolution des performances entre deux réunions CODIR successives (N vs N-1, N-1 vs N-2) ou entre deux périodes personnalisées.
3. **Objectifs vs Réel** : Permettre la configuration d'objectifs chiffrés (CA, Nouveaux Leads, Win Rate, Prospection) dans les Paramètres et afficher des jauges/graphiques clairs opposant les objectifs au réalisé.
4. **Navigation par Onglets** : Structurer l'information en 4 onglets métier clairs sans encombrement.

---

## 🗄️ 1. Modèle de Données & Configuration (`app_settings`)

### 1.1 Objectifs Cibles (`dashboard_targets`)
Stocké dans `public.app_settings` sous la clé `dashboard_targets` (catégorie `general`) :
```json
{
  "target_ca": 150,
  "target_leads_count": 30,
  "target_win_rate": 25,
  "target_prospection_positive": 15
}
```
*Gérable directement dans l'onglet Paramètres (`Settings.tsx`).*

### 1.2 Historique des Dates CODIR (`codir_history`)
Stocké dans `public.app_settings` sous la clé `codir_history` (catégorie `general`) :
```json
{
  "dates": [
    "2026-07-15T00:00:00.000Z",
    "2026-07-29T00:00:00.000Z"
  ]
}
```
*Permet d'ajouter la date du jour comme date officielle de CODIR en un clic et d'alimenter les sélecteurs de comparaison.*

---

## 📊 2. Structure du Dashboard & Onglets

Le **Dashboard** disposera d'un en-tête global fixe contenant :
* Le titre **Dashboard**
* Le sélecteur de comparaison de périodes :
  * **Mode CODIR** : Dropdown de comparaison rapide (ex: *CODIR du 29/07 vs CODIR du 15/07*).
  * **Mode Périodes Personnalisées** : Deux DatePickers (Période A vs Période B).
* Le filtre habituel par période prédéfinie (Mois, Trimestre, Année, Tout).
* L'export CSV des données du tableau de bord.

---

### 📑 Onglet 1 : Synthèse CODIR & Objectifs
* **Cartes de Progression (Objectifs vs Réel)** :
  * CA Réalisé vs Objectif CA (€).
  * Nouveaux Leads vs Objectif Leads.
  * Taux de Conversion réel vs Objectif Win Rate (%).
* **Badges de Variation (Deltas)** : Pour chaque KPI, affichage du pourcentage d'augmentation/baisse ($+X\%$, $-Y\%$) et de la valeur absolue de différence entre la période A et la période B.
* **Top Opportunités (Hot Deals)** : Liste des 5 plus grands contrats en cours.
* **Alertes Risques (SLA)** : Nombre d'opportunités en dépassement de délai SLA.

---

### 📑 Onglet 2 : Pipeline, Ventes & Évolution des Leads
* **Évolution des Leads (Progression d'étape)** :
  * Indicateur et graphique du nombre de leads ayant changé d'étape (`history` avec `action_type = 'stage_change'`) pendant la période, avec comparaison vs période précédente.
* **Funnel de Conversion** : Visualisation étape par étape du pipeline avec taux de perte.
* **Valeur Globale & Valeur Pondérée** : Forecast financier.
* **Répartition par Segment & Source** : Ventilation du chiffre d'affaires et du nombre de deals par segment (*Media*, *Retail*, *Instit*) et par source (*LinkedIn*, *Inbound*, *Réseau*, etc.).
* **Durée Moyenne du Cycle de Vente**.

---

### 📑 Onglet 3 : Prospection & Sentiment IA
* **Volume d'Envoi & Engagement Email** : Total envoyés, délivrés, ouvertures et réponses.
* **Répartition IA du Sentiment** : Graphique de la classification Gemini des réponses entrantes (*Positif*, *Négatif*, *Neutre*).
* **Performance des Séquences** : Tableau comparatif des taux de réponse et d'intérêt par séquence de prospection.

---

### 📑 Onglet 4 : Tâches & Équipe
* **Synthèse par Collaborateur (`team_members`)** :
  * **Tâches Accomplies** : Liste et total des tâches réalisées pendant la période (`status = 'done'`).
  * **Tâches Restantes à Faire** : Liste des tâches actives (`todo` / `in_progress`), triées par niveau de priorité et par date d'échéance.

---

## 🔄 3. Nettoyage de la Codebase & Migration

1. **Remplacement de la route et composant `Codir.tsx`** :
   * La vue `Codir.tsx` et son dossier associé `src/views/codir` sont supprimés.
   * La route `/codir` dans `App.tsx` et le lien dans la sidebar (`Portal.tsx`) sont retirés/redirigés vers `/dashboard`.
2. **Renommage & Refonte de `Stats.tsx`** :
   * `Stats.tsx` est renommé/remplacé par `Dashboard.tsx` dans `src/views/`.
3. **Mise à jour des Paramètres (`Settings.tsx`)** :
   * Ajout d'une section de configuration pour les **Objectifs** et la **Gestion des dates CODIR**.

---

## 🛠️ Plan de Vérification
* **Tests Unitaires & Build** : Lancement de `npm run build` et `npm test` pour s'assurer qu'aucune régression TypeScript ou d'import ne subsiste.
* **Vérification Fonctionnelle** : S'assurer que le calcul des deltas comparatifs entre deux dates CODIR fonctionne correctement.
