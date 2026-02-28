function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function checkAnswer(guess, song) {
  if (!guess || typeof guess !== 'string') return false;
  const trimmed = guess.trim().toLowerCase();
  if (trimmed.length === 0) return false;

  const candidates = [song.movie, ...(song.aliases || [])];

  for (const candidate of candidates) {
    const target = candidate.toLowerCase();
    if (trimmed === target) return true;

    const dist = levenshtein(trimmed, target);
    const maxLen = Math.max(trimmed.length, target.length);
    const similarity = 1 - dist / maxLen;

    if (similarity >= 0.8) return true;
  }

  return false;
}

module.exports = { checkAnswer };
