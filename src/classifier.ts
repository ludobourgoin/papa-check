const POSITIVE_PATTERNS: RegExp[] = [
  /\bça va\b/i,
  /\bca va\b/i,
  /\bça roule\b/i,
  /\bca roule\b/i,
  /\btout roule\b/i,
  /\btout va bien\b/i,
  /\bje vais bien\b/i,
  /\bje me sens bien\b/i,
  /\btrès bien\b/i,
  /\btres bien\b/i,
  /\bbien\b/i,
  /\bsuper\b/i,
  /\bnickel\b/i,
  /\bimpec(cable)?\b/i,
  /\bparfait\b/i,
  /\bgénial\b/i,
  /\bgenial\b/i,
  /\bcool\b/i,
  /\bforme\b/i,
  /^\s*oui\b/i,
  /^\s*ouais\b/i,
  /^\s*ok\b/i,
  /^👍/u,
  /^😊/u,
  /^😀/u,
  /^👌/u,
  /^🙂/u,
  /^💪/u,
];

const NEGATIVE_BLOCKERS: RegExp[] = [
  /\bpas (très |tres |trop )?bien\b/i,
  /\bpas (très |tres |trop )?super\b/i,
  /\bpas (très |tres |trop )?en forme\b/i,
  /\bmal\b/i,
  /\bdouleur/i,
  /\bmalade\b/i,
  /\bfatigué/i,
  /\bfatigue\b/i,
  /\bbof\b/i,
  /\bmoyen\b/i,
  /\bcomme ci comme ça\b/i,
  /\bcomme ci comme ca\b/i,
  /\?\s*$/,
];

export function isPositive(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (NEGATIVE_BLOCKERS.some((p) => p.test(trimmed))) return false;
  return POSITIVE_PATTERNS.some((p) => p.test(trimmed));
}
