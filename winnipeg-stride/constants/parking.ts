/**
 * Gryd Parking prediction rules and lot data.
 * Based on utilization trend rules provided by Gryd Park partnership.
 */

export interface ParkingLot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  zone: string;
  capacity: number;
  ratePerHour: number;
}

export type ParkingAvailability = "high" | "moderate" | "limited";

// Sample Gryd lots across Winnipeg zones
export const GRYD_LOTS: ParkingLot[] = [
  { id: "gryd-101", name: "Gryd Lot #101 – Portage Place", latitude: 49.8949, longitude: -97.1437, zone: "downtown", capacity: 220, ratePerHour: 3.5 },
  { id: "gryd-102", name: "Gryd Lot #102 – Old Market Square", latitude: 49.8992, longitude: -97.1372, zone: "exchange", capacity: 150, ratePerHour: 3.0 },
  { id: "gryd-103", name: "Gryd Lot #103 – The Forks", latitude: 49.8880, longitude: -97.1305, zone: "downtown", capacity: 350, ratePerHour: 4.0 },
  { id: "gryd-104", name: "Gryd Lot #104 – Osborne Village", latitude: 49.8790, longitude: -97.1445, zone: "osborne", capacity: 80, ratePerHour: 2.5 },
  { id: "gryd-105", name: "Gryd Lot #105 – Corydon Ave", latitude: 49.8740, longitude: -97.1590, zone: "corydon", capacity: 100, ratePerHour: 2.0 },
  { id: "gryd-106", name: "Gryd Lot #106 – Polo Park", latitude: 49.8810, longitude: -97.2050, zone: "polo_park", capacity: 500, ratePerHour: 2.0 },
  { id: "gryd-107", name: "Gryd Lot #107 – HSC Hospital", latitude: 49.9030, longitude: -97.1560, zone: "hospital", capacity: 300, ratePerHour: 5.0 },
  { id: "gryd-108", name: "Gryd Lot #108 – UofW Campus", latitude: 49.8910, longitude: -97.1540, zone: "uofw", capacity: 180, ratePerHour: 2.5 },
  { id: "gryd-109", name: "Gryd Lot #109 – St. Boniface", latitude: 49.8885, longitude: -97.1165, zone: "st_boniface", capacity: 120, ratePerHour: 2.0 },
  { id: "gryd-110", name: "Gryd Lot #110 – Waterfront Dr", latitude: 49.8960, longitude: -97.1280, zone: "exchange", capacity: 90, ratePerHour: 3.0 },
  { id: "gryd-111", name: "Gryd Lot #111 – Main & Graham", latitude: 49.8935, longitude: -97.1390, zone: "downtown", capacity: 200, ratePerHour: 3.5 },
  { id: "gryd-112", name: "Gryd Lot #112 – University of Manitoba", latitude: 49.8080, longitude: -97.1370, zone: "uofm", capacity: 400, ratePerHour: 2.0 },
];

export const GRYD_CHECKOUT_URL = "https://app.parkwithgryd.com/guest-checkout";

/**
 * Predict parking availability based on Gryd utilization trend rules.
 */
export function predictParking(
  lot: ParkingLot,
  dateTime?: Date
): { availability: ParkingAvailability; label: string; emoji: string } {
  const now = dateTime || new Date();
  const hour = now.getHours();
  const day = now.getDay(); // 0=Sun, 5=Fri, 6=Sat
  const isWeekday = day >= 1 && day <= 5;
  const isFriday = day === 5;
  const isWeekend = day === 0 || day === 6;

  // Hospital zones are ~85% full all day
  if (lot.zone === "hospital") {
    return { availability: "moderate", label: "Moderate", emoji: "🟡" };
  }

  // UofW / Exchange District weekdays 8:00–3:30 → 90-100% full
  if ((lot.zone === "uofw" || lot.zone === "exchange") && isWeekday) {
    if (hour >= 8 && hour < 15.5) {
      return { availability: "limited", label: "Limited", emoji: "🔴" };
    }
  }

  // Fridays after 3pm → availability increases earlier
  if (isFriday && hour >= 15) {
    return { availability: "high", label: "High", emoji: "🟢" };
  }

  // Evenings after 5pm → parking availability increases
  if (hour >= 17 && !isEventTime(lot, hour)) {
    return { availability: "high", label: "High", emoji: "🟢" };
  }

  // Event nights downtown — fills 60-90 min before typical event times (7-10pm)
  if ((lot.zone === "downtown" || lot.zone === "exchange") && hour >= 17 && hour <= 21) {
    return { availability: "limited", label: "Limited", emoji: "🔴" };
  }

  // Weekday business hours downtown
  if ((lot.zone === "downtown" || lot.zone === "exchange") && isWeekday && hour >= 8 && hour < 17) {
    return { availability: "moderate", label: "Moderate", emoji: "🟡" };
  }

  // Weekends generally more available
  if (isWeekend) {
    return { availability: "high", label: "High", emoji: "🟢" };
  }

  // Default
  return { availability: "moderate", label: "Moderate", emoji: "🟡" };
}

function isEventTime(lot: ParkingLot, hour: number): boolean {
  // Downtown event nights typically have events 7-10pm
  return (lot.zone === "downtown" || lot.zone === "exchange") && hour >= 18 && hour <= 22;
}

/**
 * Estimate parking cost for a duration (hours).
 */
export function estimateCost(lot: ParkingLot, hours: number = 3): string {
  const low = Math.round(lot.ratePerHour * hours * 0.8);
  const high = Math.round(lot.ratePerHour * hours * 1.2);
  return `$${low}–$${high}`;
}

/**
 * Find nearest lots to a coordinate.
 */
export function findNearestLots(
  latitude: number,
  longitude: number,
  maxResults: number = 3
): (ParkingLot & { distanceM: number })[] {
  const R = 6371000; // metres
  const toRad = (d: number) => (d * Math.PI) / 180;

  return GRYD_LOTS.map((lot) => {
    const dLat = toRad(lot.latitude - latitude);
    const dLon = toRad(lot.longitude - longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(latitude)) * Math.cos(toRad(lot.latitude)) * Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.asin(Math.sqrt(a));
    return { ...lot, distanceM: Math.round(dist) };
  })
    .sort((a, b) => a.distanceM - b.distanceM)
    .slice(0, maxResults);
}
