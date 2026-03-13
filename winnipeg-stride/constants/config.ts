/** Central configuration — mirrors src/config.py weights. */

export const TOURISM_WEIGHTS = {
  popularity: 0.35,
  transit_accessibility: 0.25,
  category_diversity: 0.2,
  location_cluster: 0.2,
};

export const GRID_WEIGHTS: Record<string, number> = {
  Park: 3.0,
  Recreation: 3.0,
  "Public Art": 2.0,
  Restaurant: 2.0,
  Transit: 1.0,
  "Arts & Culture": 2.5,
};

export const DEFAULT_RADIUS_KM = 1.0;

/** The Forks — default city centre reference point */
export const CITY_CENTRE = { lat: 49.8875, lon: -97.1313 };

/** Walk speed and detour factor (from src/routing.py) */
export const WALK_SPEED_KMH = 5.0;
export const DETOUR_FACTOR = 1.3;

export const API_URL = "http://localhost:3001";
