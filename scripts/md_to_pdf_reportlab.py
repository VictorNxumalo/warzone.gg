from pathlib import Path
import re
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfgen import canvas


def normalize_markdown(text: str) -> list[str]:
    out: list[str] = []
    for raw in text.splitlines():
        s = raw.rstrip()
        s = re.sub(r"^#{1,6}\s*", "", s)
        s = re.sub(r"^[-*]\s+", "• ", s)
        s = re.sub(r"`([^`]+)`", r"\1", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
        s = re.sub(r"\*([^*]+)\*", r"\1", s)
        out.append(s)
    return out


def write_pdf(lines: list[str], output_path: Path) -> None:
    page_w, page_h = A4
    margin = 40
    y = page_h - margin
    line_h = 14
    font = "Helvetica"
    size = 10
    c = canvas.Canvas(str(output_path), pagesize=A4)
    c.setFont(font, size)

    max_w = page_w - (margin * 2)

    for line in lines:
        if line == "":
            y -= line_h
            if y < margin:
                c.showPage()
                c.setFont(font, size)
                y = page_h - margin
            continue

        words = line.split(" ")
        current = ""
        for word in words:
            trial = word if not current else f"{current} {word}"
            if pdfmetrics.stringWidth(trial, font, size) <= max_w:
                current = trial
            else:
                if current:
                    c.drawString(margin, y, current)
                    y -= line_h
                    if y < margin:
                        c.showPage()
                        c.setFont(font, size)
                        y = page_h - margin
                # hard-break very long token
                token = word
                while pdfmetrics.stringWidth(token, font, size) > max_w and len(token) > 1:
                    cut = len(token) - 1
                    while cut > 1 and pdfmetrics.stringWidth(token[:cut], font, size) > max_w:
                        cut -= 1
                    c.drawString(margin, y, token[:cut])
                    y -= line_h
                    if y < margin:
                        c.showPage()
                        c.setFont(font, size)
                        y = page_h - margin
                    token = token[cut:]
                current = token

        if current:
            c.drawString(margin, y, current)
            y -= line_h
            if y < margin:
                c.showPage()
                c.setFont(font, size)
                y = page_h - margin

    c.save()


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/md_to_pdf_reportlab.py <input.md> <output.pdf>")

    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    text = input_path.read_text(encoding="utf-8")
    lines = normalize_markdown(text)
    write_pdf(lines, output_path)
    print(f"Created: {output_path}")


if __name__ == "__main__":
    main()

