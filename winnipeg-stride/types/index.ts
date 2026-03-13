export interface Location {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  category: string;
  neighbourhood: string;
  distanceKm?: number;
  tourismScore?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface ItineraryStop {
  stopNumber: number;
  name: string;
  category: string;
  latitude: number;
  longitude: number;
  walkMinutes?: number;
  time?: string;
}

export interface SavedItinerary {
  id: string;
  name: string;
  title: string;
  date: string;
  createdAt: string;
  stops: ItineraryStop[];
}

export interface UserPreferences {
  name: string;
  startAddress: string;
  startCoords: { latitude: number; longitude: number } | null;
  interests: {
    outdoor: boolean;
    indoor: boolean;
    family: boolean;
    transit: boolean;
    hidden_gems: boolean;
  };
  neighbourhood: string | null;
}

export interface WeatherData {
  temp: number;
  description: string;
  icon: string;
}
