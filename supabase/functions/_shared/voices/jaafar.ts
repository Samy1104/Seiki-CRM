import type { VoiceProfile } from './types.ts';

export const jaafarProfile: VoiceProfile = {
  id: 'jaafar',
  bio: `Seiki invents The Mobility Intelligence.

We designed powerful technologies & algorithms to reveal the true potential of population flows data.

For Brand Touchpoints & Advertisers, we dive into audiences and clusters mobility data to improve the impact on your target. We created a recognized MOOH ( Mobile Out of Home ) Audience Measurement methodology to assess the impact of a campaign before ( prediction ), during ( monitoring ) and after ( reporting ) it happens.

For companies in Retail & Real Estate we understand consumers on the move to optimize networks expansion.

For Institutions, we forecast population mouvements to design smart cities, predict and report congestion rates, draw mobility profiles...

Seiki unleashes the power of mobility intelligence, providing mouvement data that make sense.`,
  examples: [
    {
      text: `📍 Le Wagon Paris 11 📅 2 juin – 18h30
Le 2 juin prochain, nous explorerons un sujet aussi passionnant qu'essentiel : quelles opportunités et quels défis l'IA soulève-t-elle en matière d'inclusivité ?

J'aurai le plaisir d'échanger aux côtés de :
• Angela Naser (WOMEN IN TECH ® Global - Women in Tech® France)
• Zena El Kurdi (AXA)

Une soirée qui s'annonce riche en discussions, retours d'expérience et rencontres autour d'un sujet qui nous concerne toutes et tous 🙌

🔗 Inscription : [lien]

Seiki - The Mobility Intelligence Company`,
      note: 'Annonce événement : texte narratif, première personne.',
    },
    {
      text: `🚀 Seiki au cœur de l'IA, des transformations business & du leadership

Ravi d'avoir participé au Forum « Leadership & Business Transformation » organisé par l'ESCP et L'Express — un concentré de visions stratégiques, d'expériences terrain et de réflexions sur le rôle du leader à l'ère de l'IA.

🎤 Des échanges de haut niveau avec plusieurs intervenants du secteur.

🙏 Merci à l'organisateur pour son invitation.

💡 Un constat clair : dans un monde où l'algorithme gagne en puissance, le leadership humain devient plus stratégique que jamais — vision, engagement et capacité à transformer restent les véritables leviers.

Chez Seiki, nous sommes convaincus que la donnée et la mobilité ne remplacent pas le leader — elles l'augmentent.

#Leadership #Transformation #AI #MobilityIntelligence #Seiki #ESCP #Innovation`,
      note: 'Retour d\'événement : texte narratif avec une réflexion personnelle.',
    },
    {
      text: `Casablanca, see you on April 5th 🇲🇦

I'll be speaking at the Sohaara Event during the Founders Keynote 🎤 will be talking about Seiki's growth 🚀

Always a special energy when builders, founders, and ideas come together in one place ⚡ many thanks to the organizer for this amazing project! You are a true inspiration 🙏🇲🇦

Excited to share, learn, and connect 🌍

If you're around, come say hi 🤝

#Founders #Casablanca #AI #Networking`,
      note: 'Exemple en anglais, ton direct et enthousiaste.',
    },
  ],
  tone: ['personnel', 'enthousiaste', 'direct', 'à la première personne du singulier ("je")'],
  hook: { minWords: 1, maxWords: 15, mustBe: 'portée par un ou deux emojis pertinents (pas décoratifs), jamais une formule générique' },
  bannedPhrases: ['Nous sommes ravis de vous annoncer que', "N'hésitez pas à nous contacter", 'GRATUIT', 'URGENT'],
  hashtags: { min: 5, max: 10 },
  bodyStyle: 'either',
};
