/**
 * Winnipeg Flag colour palette.
 * Hex codes extracted directly from the City of Winnipeg flag.
 */
export const Colors = {
  /** Flag blue — primary actions, active tab, user chat bubbles */
  primary: "#002b88",
  /** Dark navy from flag crest — headings, status bar */
  navy: "#001A5C",
  /** Flag gold — accent, Winnie avatar, highlights */
  gold: "#F5B312",
  /** Olive gold from flag (darker accent) */
  olive: "#8B7B2F",
  /** White — backgrounds */
  white: "#FFFFFF",
  /** Light grey — card surfaces */
  surface: "#F2F4F7",
  /** Near-black — body text */
  text: "#1A1A2E",
  /** Muted grey — secondary / caption text */
  muted: "#6B7280",
  /** Error red */
  error: "#DC2626",
  /** Flag brown — warm accent (optional) */
  brown: "#8C4329",
  /** Flag green — park markers */
  green: "#08C44A",
  /** Light periwinkle from flag */
  periwinkle: "#96A4D3",
  /** Lavender from flag */
  lavender: "#9484BE",
  /** Black */
  black: "#000000",
  /** Glassmorphism helpers */
  glass: "rgba(255, 255, 255, 0.72)",
  glassBorder: "rgba(255, 255, 255, 0.45)",
  /** Premium shadow colour */
  shadow: "#002b88",
  /** Subtle surface for premium cards */
  surfaceElevated: "#FFFFFF",
  /** Background for screen fills */
  background: "#F7F8FC",
};

/** Category → marker / badge colour */
export const CategoryColors: Record<string, string> = {
  Park: Colors.green,
  Restaurant: "#F97316",
  "Arts & Culture": Colors.lavender,
  Recreation: Colors.primary,
  "Public Art": Colors.gold,
  Transit: Colors.muted,
};
