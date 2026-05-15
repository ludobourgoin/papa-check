export const GREETINGS = [
  "Salut padre, comment tu vas ce matin ?",
  "Coucou, ça va bien aujourd'hui ?",
  "Hello padre, tout va bien ?",
  "Bonjour padre, comment tu te sens ?",
  "Salut, ça roule ?",
  "Coucou padre, tout va bien chez toi ?",
  "Salut, comment ça va aujourd'hui ?",
  "Bonjour padre, tu vas bien ?",
  "Hello, comment se passe ta journée ?",
  "Coucou padre, tout est ok ?",
];

export function pickGreeting(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}