import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ColoredKeywordText } from "./ColoredKeywordText";

describe("ColoredKeywordText", () => {
  it("colora solo le parole previste senza distinguere maiuscole e minuscole", () => {
    const { container } = render(<p><ColoredKeywordText text="Elastico VERDE, poi giallo e Blu." /></p>);

    expect(screen.getByText("VERDE,")).toHaveStyle({ color: "#22c55e" });
    expect(screen.getByText("giallo")).toHaveStyle({ color: "#eab308" });
    expect(screen.getByText("Blu.")).toHaveStyle({ color: "#3b82f6" });
    expect(container.querySelectorAll("span")).toHaveLength(3);
    expect(container).toHaveTextContent("Elastico VERDE, poi giallo e Blu.");
  });
});
