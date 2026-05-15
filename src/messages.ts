const MORNING = [
  "Comment ça va ce matin ?",
  "Salut padre, bien dormi ?",
  "Bonjour padre, comment tu te sens ce matin ?",
  "Coucou, bien commencé la journée ?",
  "Hello padre, ça va ce matin ?",
  "Salut, bien réveillé ?",
  "Bonjour padre, tout roule ce matin ?",
  "Coucou padre, bien dormi cette nuit ?",
  "Salut padre, ça démarre bien la journée ?",
  "Hello, comment tu vas ce matin ?",
  "Alors padre, en forme ce matin ?",
  "Bonjour, la nuit a été bonne ?",
];

const AFTERNOON = [
  "Alors le padre, comment ça se passe cette petite journée ?",
  "Salut padre, ça va cet aprem ?",
  "Coucou, comment se passe ta journée ?",
  "Hello padre, bonne journée jusque-là ?",
  "Salut, t'as bien mangé ce midi ?",
  "Bonjour padre, tout va bien aujourd'hui ?",
  "Coucou padre, qu'est-ce que tu fabriques de beau ?",
  "Salut padre, ta journée se passe comment ?",
  "Hello, tout roule cet aprem ?",
  "Coucou, ça va aujourd'hui ?",
  "Alors padre, quoi de neuf cet aprem ?",
  "Salut, ta journée est tranquille ?",
];

const EVENING = [
  "Bonsoir padre, comment s'est passée ta journée ?",
  "Salut padre, soirée tranquille ?",
  "Coucou, ta journée a été bonne ?",
  "Hello padre, comment ça va ce soir ?",
  "Bonsoir, t'as passé une bonne journée ?",
  "Salut padre, ça va ce soir ?",
  "Coucou padre, comment tu te sens ce soir ?",
  "Hello, journée pas trop dure ?",
  "Bonsoir padre, tout va bien ?",
  "Salut, t'as passé une bonne journée ?",
  "Alors padre, ta journée s'est bien passée ?",
  "Coucou padre, la journée est finie, ça va ?",
];

const ANYTIME = [
  "Salut padre, tout va bien ?",
  "Coucou, ça roule ?",
  "Hello padre, comment ça va ?",
  "Salut, tout est ok chez toi ?",
  "Coucou padre, tu vas bien ?",
  "Salut padre, ça va ?",
];

export function pickGreeting(parisHour: number): string {
  let pool: readonly string[];
  if (parisHour < 12) pool = [...MORNING, ...ANYTIME];
  else if (parisHour < 18) pool = [...AFTERNOON, ...ANYTIME];
  else pool = [...EVENING, ...ANYTIME];
  return pool[Math.floor(Math.random() * pool.length)];
}
