export interface WinnipegEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  endTime?: string;
  venue: string;
  address: string;
  latitude: number;
  longitude: number;
  price: string;
  category: string;
  age: string;
  description: string;
  url: string;
}

export const EVENTS: WinnipegEvent[] = [
  {
    id: "evt-1",
    title: "NOLA NIGHT – The Dirty Catfish Brass Band",
    date: "2026-03-06",
    time: "9:30 PM",
    endTime: "12:30 AM",
    venue: "Times Change(d) High & Lonesome Club",
    address: "234 Main St., Winnipeg, MB R3C 1A8",
    latitude: 49.89162,
    longitude: -97.13679,
    price: "CA$17.72",
    category: "Music",
    age: "18+",
    description:
      "It's NOLA NIGHT featuring the funky New Orleans-style sounds of the Dirty Catfish Brass Band — Winnipeg Nightlife Awards Entertainers of the Year.",
    url: "https://www.eventbrite.ca/e/nola-night-the-dirty-catfish-brass-band-tickets-1983508090092",
  },
  {
    id: "evt-2",
    title: "SUPER\u2B50STAR: A Geeky Drag Show",
    date: "2026-03-07",
    time: "8:00 PM",
    endTime: "11:00 PM",
    venue: "The Rec Room Seasons of Tuxedo",
    address: "696 Sterling Lyon Pkwy #Lot 5, Winnipeg, MB R3P 1E9",
    latitude: 49.84193,
    longitude: -97.22043,
    price: "CA$10",
    category: "Performance",
    age: "All ages",
    description:
      "Winnipeg's geekiest all-ages drag show! Video games, anime, and more — hosted by Aria Zero & The Yellow Belle. Proceeds donated to Sunshine House.",
    url: "https://www.eventbrite.ca/e/superstar-a-geeky-drag-show-tickets-1983619702929",
  },
  {
    id: "evt-4",
    title: "Slow Leaves + Taylor Jackson",
    date: "2026-03-13",
    time: "9:00 PM",
    endTime: "12:00 AM",
    venue: "Times Change(d) High & Lonesome Club",
    address: "234 Main St., Winnipeg, MB R3C 1A8",
    latitude: 49.89162,
    longitude: -97.13693,
    price: "CA$24.28",
    category: "Music",
    age: "All ages (under 18 with parent)",
    description:
      "Slow Leaves + Taylor Jackson live at Times Change(d). Doors at 8 PM.",
    url: "https://www.eventbrite.ca/e/slow-leaves-taylor-jackson-tickets-1982391263634",
  },
  {
    id: "evt-5",
    title: "St. Patrick's Celebration",
    date: "2026-03-14",
    time: "8:30 PM",
    endTime: "11:30 PM",
    venue: "Prince Edward Legion Branch 81",
    address: "300 Trent Ave, Winnipeg, MB R2K 1E7",
    latitude: 49.92133,
    longitude: -97.10308,
    price: "Free",
    category: "Holiday",
    age: "All ages",
    description:
      "Live music, tasty food, and lots of green fun! Don your greenest outfit and join the St. Patrick's festivities.",
    url: "https://www.eventbrite.com/e/st-patricks-celebration-tickets-1983793716408",
  },
  {
    id: "evt-6",
    title: "Adventure Club – Throwback Tour",
    date: "2026-03-20",
    time: "9:00 PM",
    venue: "Pyramid Cabaret",
    address: "176 Fort Street, Winnipeg, MB R3C 1C9",
    latitude: 49.891,
    longitude: -97.13781,
    price: "From CA$42.52",
    category: "Music",
    age: "18+",
    description:
      "Get ready to travel back in time with Adventure Club as they bring the nostalgic vibes to Winnipeg — it's going to be a wild ride!",
    url: "https://www.eventbrite.ca/e/adventure-club-throwback-tour-winnipeg-tickets-1982440372520",
  },
  {
    id: "evt-7",
    title: "Heated Rivalry Rave Dance Party Night 2",
    date: "2026-03-27",
    time: "9:00 PM",
    endTime: "2:00 AM",
    venue: "Encore Winnipeg",
    address: "206 Osborne St, Winnipeg, MB R3L 1Z3",
    latitude: 49.87603,
    longitude: -97.14287,
    price: "From CA$0",
    category: "Nightlife",
    age: "18+",
    description:
      "Queer chaos, pop obsession, and rivalry-fueled tension on the dance floor. Themed drinks, screens with edits, and a packed dance floor all night.",
    url: "https://www.eventbrite.ca/e/heated-rivalry-rave-dance-party-night-2-encore-winnipeg-tickets-1982846222428",
  },
];
