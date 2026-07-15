# Guide de Configuration des Webhooks Resend pour Seiki CRM

Ce guide explique comment configurer les webhooks de Resend et votre zone DNS pour activer :
1. Le suivi de l'ouverture des e-mails en temps réel.
2. La réception automatique des réponses des prospects directement dans le CRM.

---

## Étape 1 : Configurer votre DNS pour la réception (MX Records)

Pour que Resend puisse recevoir les e-mails de réponse envoyés à votre domaine (ex: `prospection@votredomaine.com`), vous devez pointer vos enregistrements MX vers les serveurs de Resend chez votre fournisseur DNS (OVH, GoDaddy, Cloudflare, etc.).

Ajoutez les enregistrements suivants dans la zone DNS de votre domaine :

| Type | Nom/Hôte | Valeur / Cible | Priorité |
| :--- | :--- | :--- | :--- |
| **MX** | `@` (ou votre sous-domaine) | `feedback-smtp.us-east-1.amazonses.com` | `10` |
| **MX** | `@` (ou votre sous-domaine) | `feedback-smtp.us-east-1.amazonses.com` | `20` |

*Note : Resend utilise l'infrastructure AWS SES sous le capot pour la réception. Veuillez vous référer à la section **Inbound** de votre tableau de bord Resend pour confirmer les valeurs exactes des enregistrements MX si nécessaire.*

---

## Étape 2 : Déployer l'Edge Function Supabase

Déployez la fonction `resend-webhook` que nous venons de créer en ouvrant votre terminal et en exécutant la commande suivante dans le dossier racine de votre projet :

```bash
supabase functions deploy resend-webhook --no-verify-jwt
```

> [!IMPORTANT]
> L'option `--no-verify-jwt` est **indispensable** car l'appelant (Resend) ne dispose pas d'un jeton JWT Supabase. C'est la fonction elle-même qui vérifiera la signature cryptographique du webhook.

Une fois déployée, votre fonction sera disponible à l'adresse suivante :
`https://[VOTRE_PROJECT_ID].supabase.co/functions/v1/resend-webhook`

---

## Étape 3 : Configurer le Webhook dans Resend

1. Connectez-vous à votre compte **Resend**.
2. Allez dans l'onglet **Webhooks** puis cliquez sur **Add Webhook** (ou **Add Endpoint**).
3. Saisissez les informations suivantes :
   - **Endpoint URL** : L'adresse URL de votre fonction Edge Supabase (`https://[VOTRE_PROJECT_ID].supabase.co/functions/v1/resend-webhook`).
   - **Events** : Cochez au moins les événements suivants :
     - `email.opened` (Ouverture)
     - `email.clicked` (Clic)
     - `email.received` (Réponse reçue)
     - `email.bounced` (Rebond/Erreur de livraison)
     - `email.delivery_delayed` (Livraison retardée)
4. Cliquez sur **Add Webhook** pour valider.

---

## Étape 4 : Sécuriser la communication avec la signature Svix

Une fois le webhook créé sur Resend, une clé de signature de webhook (commençant par `whsec_...`) s'affichera à l'écran. 

Pour que Supabase puisse valider que les requêtes reçues proviennent bien de Resend et n'ont pas été altérées, ajoutez ce secret aux variables d'environnement de votre projet Supabase :

```bash
supabase secrets set RESEND_WEBHOOK_SECRET=whsec_votre_secret_ici
```

Désormais, toute requête webhook entrante sera validée cryptographiquement. Si un intrus tente d'appeler l'URL directement, la requête sera rejetée avec une erreur `400 Invalid signature`.

---

## Étape 5 : Activer le suivi des ouvertures (Open Tracking) sur Resend

Assurez-vous que le suivi des ouvertures est actif pour votre domaine d'envoi dans Resend :
1. Dans le tableau de bord Resend, allez dans **Domains**.
2. Sélectionnez votre domaine validé.
3. Allez dans les **Settings** du domaine.
4. Activez l'option **Open Tracking** (ainsi que **Click Tracking** si désiré).

---

## Visualisation dans Seiki CRM

Une fois configuré :
- Dès qu'un prospect ouvre un e-mail, son statut passe à **Ouvert** dans le tableau de bord des campagnes.
- Si le prospect répond, la séquence automatique s'arrête immédiatement (passage en statut `replied`).
- Le contenu de sa réponse est importé dans sa fiche Lead et s'affiche dans l'onglet **Historique**.
