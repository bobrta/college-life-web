export function pert(o, m, p) {
  if (![o, m, p].every(Number.isFinite) || o < 0 || o > m || m > p)
    throw Error("估時需符合：0 ≤ 樂觀 ≤ 最可能 ≤ 悲觀");
  return (o + 4 * m + p) / 6;
}
