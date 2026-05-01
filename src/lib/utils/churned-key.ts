export function buildChurnedKey(name: string, endDate: string): string {
  return `${name.trim().toLowerCase()}|${endDate}`;
}
