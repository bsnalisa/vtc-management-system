// Picks a readable text colour (as "H S% L%") for a brand colour given as "H S% L%",
// so badges and buttons stay legible whatever colours a centre chooses.
export const foregroundFor = (hsl: string): string => {
  const lightness = Number(/(\d+(?:\.\d+)?)%\s*$/.exec(hsl.trim())?.[1]);
  if (Number.isNaN(lightness)) return "0 0% 100%";
  return lightness > 58 ? "222 47% 11%" : "0 0% 100%";
};
