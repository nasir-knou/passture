export function isCorrectAnswer(selected: readonly string[], answers: readonly string[]): boolean {
  if (selected.length !== answers.length) {
    return false;
  }

  const selectedSet = new Set(selected);
  return answers.every((answer) => selectedSet.has(answer));
}
