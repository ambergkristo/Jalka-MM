export function slugifyPlayerId(name: string): string {
  const normalized = name
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return normalized || 'player';
}

export function generateUniquePlayerId(name: string, existingIds: Set<string>): string {
  const baseId = slugifyPlayerId(name);
  let candidate = baseId;
  let suffix = 2;
  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${suffix}`;
    suffix += 1;
  }
  existingIds.add(candidate);
  return candidate;
}
