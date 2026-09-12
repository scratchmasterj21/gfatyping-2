/** Keep only readable English words from the shared dictionary pool. */
export function prepareRpgWords(tokens: string[]): string[] {
  const words = [
    ...new Set(tokens.map((token) => token.trim().toLowerCase())),
  ].filter(
    (token) => token.length >= 3 && token.length <= 7 && /^[a-z]+$/.test(token),
  );
  if (words.length === 0) {
    throw new Error("The English word list has no usable RPG words");
  }
  return words;
}
