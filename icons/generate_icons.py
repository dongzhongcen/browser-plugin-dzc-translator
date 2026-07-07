from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
SIZES = [16, 32, 48, 128]


def rounded_rectangle(draw, box, radius, fill):
    draw.rounded_rectangle(box, radius=radius, fill=fill)


def draw_icon(size):
    scale = size / 128
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    def s(value):
        return int(round(value * scale))

    bg_radius = s(30)
    rounded_rectangle(draw, (0, 0, size, size), bg_radius, (21, 21, 21, 255))

    for y in range(size):
        ratio = y / max(size - 1, 1)
        color = (
            int(21 + 31 * ratio),
            int(21 + 27 * ratio),
            int(21 + 21 * ratio),
            255,
        )
        draw.line((0, y, size, y), fill=color)

    rounded_rectangle(draw, (s(28), s(34), s(94), s(100)), s(18), (255, 245, 231, 255))
    rounded_rectangle(draw, (s(36), s(28), s(102), s(94)), s(18), (232, 93, 63, 255))

    draw.line((s(56), s(48), s(84), s(48)), fill=(255, 245, 231, 255), width=max(s(8), 1))
    draw.line((s(70), s(48), s(70), s(80)), fill=(255, 245, 231, 255), width=max(s(8), 1))
    draw.arc((s(54), s(44), s(88), s(84)), 102, 178, fill=(255, 245, 231, 255), width=max(s(7), 1))

    try:
        font = ImageFont.truetype("arialbd.ttf", s(44))
    except OSError:
        font = ImageFont.load_default()

    draw.text((s(40), s(50)), "A", font=font, fill=(21, 21, 21, 255))
    draw.ellipse((s(86), s(25), s(104), s(43)), fill=(255, 245, 231, 255))
    draw.ellipse((s(92), s(31), s(100), s(39)), fill=(232, 93, 63, 255))

    return image


def main():
    for size in SIZES:
        icon = draw_icon(size)
        icon.save(ROOT / f"icon-{size}.png")


if __name__ == "__main__":
    main()
