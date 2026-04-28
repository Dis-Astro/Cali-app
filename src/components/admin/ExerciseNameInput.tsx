import { useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

const COLOR_MAP: Record<string, string> = {
  arancione: "#f97316",
  azzurro:   "#38bdf8",
  verde:     "#22c55e",
  giallo:    "#eab308",
  rosso:     "#ef4444",
  blu:       "#3b82f6",
  viola:     "#a855f7",
};

/** Colora le keyword parola per parola, preservando newline e spazi */
function renderColoredTokens(value: string) {
  const lines = value.split(/(\n)/);
  return lines.map((line, lineIdx) => {
    if (line === "\n") {
      return <br key={`br-${lineIdx}`} />;
    }
    const tokens = line.split(/(\s+)/);
    return tokens.map((token, i) => {
      const color = COLOR_MAP[token.toLowerCase().replace(/[^a-zàèéìòù]/gi, "")];
      if (color) {
        return (
          <span key={`${lineIdx}-${i}`} style={{ color }}>
            {token}
          </span>
        );
      }
      return <span key={`${lineIdx}-${i}`}>{token}</span>;
    });
  });
}

interface ExerciseNameInputProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

const ExerciseNameInput = ({
  value,
  onChange,
  placeholder = "Es. Elastico arancione - Squat sotto 90°...",
  className,
}: ExerciseNameInputProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const syncHeight = useCallback(() => {
    const ta = textareaRef.current;
    const mirror = mirrorRef.current;
    if (!ta || !mirror) return;
    // Reset height to auto so scrollHeight recalculates
    ta.style.height = "auto";
    const h = Math.max(40, ta.scrollHeight);
    ta.style.height = `${h}px`;
    mirror.style.height = `${h}px`;
  }, []);

  useEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <div className={cn("relative flex-1", className)} style={{ minHeight: 40 }}>
      {/* Overlay colorato — stessi stili identici del textarea */}
      <div
        ref={mirrorRef}
        aria-hidden="true"
        className="absolute inset-0 px-3 py-2 text-sm pointer-events-none overflow-hidden rounded-md"
        style={{
          zIndex: 1,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "1.25rem",
          fontFamily: "inherit",
        }}
      >
        {value ? renderColoredTokens(value) : null}
      </div>

      {/* Textarea trasparente sopra */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        className={cn(
          "relative w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm ring-offset-background",
          "placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "transition-colors resize-none overflow-hidden"
        )}
        style={{
          color: "transparent",
          caretColor: "hsl(var(--foreground))",
          zIndex: 2,
          minHeight: 40,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: "1.25rem",
          fontFamily: "inherit",
        }}
      />
    </div>
  );
};

export default ExerciseNameInput;
