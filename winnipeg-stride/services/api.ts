/**
 * API client for the Winnipeg Stride backend.
 */

import { API_URL } from "@/constants/config";
import type {
  Location,
  ChatMessage,
  ItineraryStop,
  WeatherData,
} from "@/types";

const BASE = API_URL;

async function get<T>(path: string): Promise<T> {
  const resp = await fetch(`${BASE}${path}`);
  if (!resp.ok) throw new Error(`GET ${path} failed: ${resp.status}`);
  return resp.json();
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const resp = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error(`POST ${path} failed: ${resp.status}`);
  return resp.json();
}

// -------------------------------------------------------------------
// Locations
// -------------------------------------------------------------------

export async function fetchLocations(params?: {
  category?: string;
  neighbourhood?: string;
  search?: string;
}): Promise<Location[]> {
  const qs = new URLSearchParams();
  if (params?.category && params.category !== "All")
    qs.set("category", params.category);
  if (params?.neighbourhood) qs.set("neighbourhood", params.neighbourhood);
  if (params?.search) qs.set("search", params.search);
  const query = qs.toString();
  return get(`/api/locations${query ? `?${query}` : ""}`);
}

export async function fetchNeighbourhoods(): Promise<string[]> {
  return get("/api/locations/neighbourhoods");
}

export async function fetchCategories(): Promise<string[]> {
  return get("/api/locations/categories");
}

export async function fetchStats(): Promise<{
  total: number;
  byCategory: Record<string, number>;
  topNeighbourhoods: [string, number][];
  avgTourismScore: number;
}> {
  return get("/api/locations/stats");
}

// -------------------------------------------------------------------
// Chat
// -------------------------------------------------------------------

export async function sendChat(
  message: string,
  history?: { role: string; content: string }[]
): Promise<{ reply: string; context: string[]; offline?: boolean }> {
  return post("/api/chat", { message, history });
}

// -------------------------------------------------------------------
// Itinerary
// -------------------------------------------------------------------

export async function generateItinerary(opts?: {
  preferences?: string[];
  neighbourhood?: string;
  maxStops?: number;
}): Promise<{ stops: ItineraryStop[] }> {
  return post("/api/itinerary", opts || {});
}

export async function surpriseItinerary(): Promise<{
  stops: ItineraryStop[];
  neighbourhood: string | null;
}> {
  return post("/api/itinerary/surprise", {});
}

// -------------------------------------------------------------------
// Weather — proxied through backend (no API key on client)
// -------------------------------------------------------------------

export async function fetchWeather(): Promise<WeatherData> {
  try {
    return await get<WeatherData>("/api/weather");
  } catch {
    return { temp: 0, description: "Unknown", icon: "cloud" };
  }
}
