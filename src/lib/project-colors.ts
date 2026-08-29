/**
 * Preset swatches for projects. Lives outside the dialog component so the
 * constants can be imported without dragging a component along (and so fast
 * refresh keeps working on the dialog itself).
 */
export const PROJECT_COLORS = [
  { hex: "#6366F1", name: "Indigo" },
  { hex: "#8B5CF6", name: "Violet" },
  { hex: "#EC4899", name: "Pink" },
  { hex: "#EF4444", name: "Red" },
  { hex: "#F59E0B", name: "Amber" },
  { hex: "#10B981", name: "Emerald" },
  { hex: "#06B6D4", name: "Cyan" },
  { hex: "#64748B", name: "Slate" },
] as const

export const DEFAULT_PROJECT_COLOR = PROJECT_COLORS[0].hex
