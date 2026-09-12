export function turnDamage(wordsTyped: number, mistakes: number): number {
  const words = Math.max(0, Math.floor(wordsTyped));
  return words * 2 + (words > 0 && mistakes === 0 ? 2 : 0);
}
