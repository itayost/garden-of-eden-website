/**
 * Israeli ID (תעודת זהות) check digit. Up to nine digits, padded with leading
 * zeros; each digit is multiplied by 1 or 2 alternately, two-digit products
 * are summed to one digit, and the total must divide by ten.
 */
export function isValidIsraeliId(value: string): boolean {
  const digits = value.replace(/\s+/g, "");
  if (!/^\d{1,9}$/.test(digits)) return false;
  const padded = digits.padStart(9, "0");

  const total = [...padded].reduce((sum, char, index) => {
    const product = Number(char) * (index % 2 === 0 ? 1 : 2);
    return sum + (product > 9 ? product - 9 : product);
  }, 0);

  return total % 10 === 0;
}
