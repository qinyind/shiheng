export function round(value: number, digits = 0) {
  const p = 10 ** digits;
  return Math.round(value * p) / p;
}
