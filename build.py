#!/usr/bin/env python3
"""Build the self-contained Freshfield retailer presentation."""
import base64
from pathlib import Path

HERE = Path(__file__).parent
assets = {
    '{{FONT_DATA}}': ('FreshfieldDisplay-Regular.woff2', 'font/woff2'),
    '{{LOGO_DATA}}': ('official-logo-white.png', 'image/png'),
    '{{OUTDOORS_DATA}}': ('freshfield-outdoors.jpg', 'image/jpeg'),
}
html = (HERE / 'template.html').read_text()
for marker, (name, _mime) in assets.items():
    assert html.count(marker) == 1, f'expected one {marker}'
    html = html.replace(marker, base64.b64encode((HERE / name).read_bytes()).decode('ascii'))
assert '{{' not in html and '}}' not in html
(HERE / 'index.html').write_text(html)
print(f'Built {HERE / "index.html"} ({(HERE / "index.html").stat().st_size} bytes)')
