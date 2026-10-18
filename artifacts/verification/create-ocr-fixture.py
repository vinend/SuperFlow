"""Create a synthetic scanned image for the recorded local OCR demonstration."""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


output = Path(".runtime/demo-scanned-travel.png")
output.parent.mkdir(parents=True, exist_ok=True)
image = Image.new("RGB", (1600, 540), "white")
draw = ImageDraw.Draw(image)
heading = ImageFont.load_default(size=50)
body = ImageFont.load_default(size=44)
draw.text((75, 55), "SCANNED TRAVEL POLICY", font=heading, fill="#152c36")
draw.line((75, 130, 1520, 130), fill="#697d83", width=3)
draw.text(
    (75, 190),
    "Travel reimbursement requires manager approval.",
    font=body,
    fill="black",
)
draw.text(
    (75, 285),
    "Submit the receipt within 30 days.",
    font=body,
    fill="black",
)
draw.text((75, 440), "Synthetic demonstration source", font=body, fill="#4d5d60")
image.save(output)
print(output)
