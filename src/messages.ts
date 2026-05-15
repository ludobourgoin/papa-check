export const GREETINGS = [
  "Salut papa, comment tu vas ce matin ?",
  "Coucou, ça va bien aujourd'hui ?",
  "Hello papa, tout va bien ?",
  "Bonjour, comment tu te sens ?",
  "Salut, ça roule ?",
  "Coucou papa, tout va bien chez toi ?",
  "Salut, comment ça va aujourd'hui ?",
  "Bonjour papa, tu vas bien ?",
  "Hello, comment se passe ta journée ?",
  "Coucou, tout est ok ?",
];

export function pickGreeting(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}
