import { Fragment } from "react";

const KEYWORD_COLORS: Record<string, string> = {
  arancione: "#f97316",
  azzurro: "#38bdf8",
  verde: "#22c55e",
  giallo: "#eab308",
  rosso: "#ef4444",
  blu: "#3b82f6",
  viola: "#a855f7",
};

const normalizeToken = (token: string) => token.toLocaleLowerCase("it-IT").replace(/[^a-zàèéìòù]/gi, "");

export function ColoredKeywordText({ text }: { text: string }) {
  return text.split(/(\n|\s+)/).map((token, index) => {
    if (token === "\n") return <br key={index} />;
    const color = KEYWORD_COLORS[normalizeToken(token)];
    return color
      ? <span key={index} style={{ color, fontWeight: 700 }}>{token}</span>
      : <Fragment key={index}>{token}</Fragment>;
  });
}
