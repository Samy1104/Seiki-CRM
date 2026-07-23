import type { VoiceProfile } from './types.ts';

export const seikiProfile: VoiceProfile = {
  id: 'seiki',
  bio: `Seiki invents The Mobility Intelligence.

We designed powerful technologies & algorithms to reveal the true potential of population flows data.

For Brand Touchpoints & Advertisers, we dive into audiences and clusters mobility data to improve the impact on your target. We created a recognized MOOH ( Mobile Out of Home ) Audience Measurement methodology to assess the impact of a campaign before ( prediction ), during ( monitoring ) and after ( reporting ) it happens.

For companies in Retail & Real Estate we understand consumers on the move to optimize networks expansion.

For Institutions, we forecast population mouvements to design smart cities, predict and report congestion rates, draw mobility profiles...

Seiki unleashes the power of mobility intelligence, providing mouvement data that make sense.`,
  examples: [
    {
      text: `🚶‍♂️🚴 Mesurer la mobilité pour mieux aménager la ville.

Nous sommes fiers d'accompagner la Ville de Neuilly-sur-Seine dans la mesure et l'analyse des flux piétons et cyclistes sur le Pont de Neuilly.

Grâce à notre technologie de Mobility Intelligence, Seiki fournit une vision objective et continue des usages de cet axe stratégique, avec des indicateurs tels que :

📊 Volume de fréquentation sur 24 heures, à la semaine, au mois et à l'année
📈 Analyse comparative avant / après travaux pour mesurer l'impact réel des aménagements
🧭 Étude des provenances et destinations des usagers afin de mieux comprendre les flux de mobilité

Ces analyses permettent aux collectivités de prendre des décisions fondées sur la donnée, d'évaluer l'efficacité des investissements publics et d'accompagner le développement de mobilités plus durables.

Un grand merci à la Ville de Neuilly-sur-Seine pour sa confiance.

#Seiki #MobilityIntelligence #SmartCity #Mobilité #MobilitéDouce #Urbanisme #Data #Cyclistes #Piétons #NeuillySurSeine #Innovation`,
      note: 'Post data/client : liste à puces avec emojis, chiffres concrets.',
    },
    {
      text: `🇲🇨 Depuis maintenant 2 ans, Seiki est fier d'accompagner le Gouvernement Princier de Monaco en tant que partenaire Data Mobility.

📊 Nous révélons les déplacements des populations entrant et sortant de la Principauté, touristes inclus, afin de mieux comprendre les dynamiques réelles du territoire.

Grâce à la Mobility Intelligence, nous sommes en mesure de :

Analyser les flux touristiques internationaux
📍 Comprendre l'attractivité des différents quartiers et points d'intérêt
🕒 Mesurer les pics de fréquentation sur les 24 heures, les 7 jours et les 52 semaines de l'année
🌍 Identifier les provenances géographiques et profils sociodémographiques des visiteurs
🚶 Mesurer les temps de présence et les comportements de mobilité
🏨 Caractériser les typologies de séjour et les parcours au sein de la Principauté

Notre ambition : transformer les données de mobilité en indicateurs stratégiques au service du tourisme, des événements, de l'aménagement du territoire et du développement économique.

📡 Révéler les flux.
📈 Comprendre l'attractivité.
🎯 Éclairer la décision.

#Monaco #MobilityIntelligence #Data #TourismAnalytics #SmartCity #MobilityData #Tourisme #Innovation #Seiki`,
      note: 'Post data/client : clôture tagline courte en 3 lignes.',
    },
  ],
  tone: ['fier', 'factuel', 'orienté impact business et données concrètes', 'à la première personne du pluriel ("nous")'],
  hook: { minWords: 1, maxWords: 15, mustBe: 'portée par un ou deux emojis pertinents (pas décoratifs), jamais une formule générique' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', "N'hésitez pas à nous contacter", 'GRATUIT', 'URGENT'],
  hashtags: { min: 5, max: 10 },
  bodyStyle: 'either',
};
