import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

/**
 * Rileva parole-chiave di colore nel testo e applica il colore alla scritta.
 * Supporta: arancione, azzurro, verde, giallo
 */

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316",
  azzurro: "#38bdf8",
  verde: "#22c55e",
  giallo: "#eab308",
};

function detectColor(value: string): string | undefined {
  const lower = value.toLowerCase();
  for (const [keyword, hex] of Object.entries(COLOR_MAP)) {
    if (lower.includes(keyword)) return hex;
  }
  return undefined;
}

interface ColoredNoteInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const ColoredNoteInput = ({ value, onChange, placeholder = "Tecnica...", className }: ColoredNoteInputProps) => {
  const color = detectColor(value);

  return (
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`h-8 text-sm transition-colors ${className ?? ""}`}
      style={color ? { color, borderColor: color + "60", fontWeight: 600 } : undefined}
    />
  );
};

export default ColoredNoteInput;
