from pathlib import Path
import re
import sys

from fpdf import FPDF


def markdown_to_lines(markdown_text: str) -> list[str]:
    lines: list[str] = []
    for raw in markdown_text.splitlines():
        s = raw.rstrip()
        if not s:
            lines.append("")
            continue

        s = re.sub(r"^#{1,6}\s*", "", s)
        s = re.sub(r"^[-*]\s+", "• ", s)
        s = re.sub(r"`([^`]+)`", r"\1", s)
        s = re.sub(r"\*\*([^*]+)\*\*", r"\1", s)
        s = re.sub(r"\*([^*]+)\*", r"\1", s)
        lines.append(s)
    return lines


def build_pdf(input_path: Path, output_path: Path) -> None:
    text = input_path.read_text(encoding="utf-8")
    lines = markdown_to_lines(text)

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", size=11)

    for line in lines:
        if not line:
            pdf.ln(4)
            continue
        pdf.multi_cell(0, 6, line, wrapmode="CHAR")

    pdf.output(str(output_path))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("Usage: python scripts/md_to_pdf.py <input.md> <output.pdf>")

    input_path = Path(sys.argv[1]).resolve()
    output_path = Path(sys.argv[2]).resolve()

    if not input_path.exists():
        raise SystemExit(f"Input file not found: {input_path}")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    build_pdf(input_path, output_path)
    print(f"Created: {output_path}")


if __name__ == "__main__":
    main()

