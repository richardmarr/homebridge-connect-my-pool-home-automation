export function shouldExposeFavourites(config: unknown): boolean {
  if (!config || typeof config !== 'object') {
    return true;
  }
  return (config as { hideFavourites?: unknown }).hideFavourites !== true;
}
