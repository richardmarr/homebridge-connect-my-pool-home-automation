export interface FavouriteVisibilityConfig {
  hideFavourites?: boolean;
}

export function shouldExposeFavourites(config: FavouriteVisibilityConfig): boolean {
  return config.hideFavourites !== true;
}
