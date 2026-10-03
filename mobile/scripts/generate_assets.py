#!/usr/bin/env python3
"""
Gera os assets oficiais do Vito Mobile a partir da imagem aprovada do mascote.
- icon.png (1024x1024)
- adaptive-icon.png (1024x1024)
- splash.png (1284x2778)
- favicon.png (48x48)
"""

import os
from PIL import Image

SOURCE_IMAGE = "/home/andrevmp/.gemini/antigravity-ide/brain/41b25e44-6c2c-47d3-bd37-8fb2779dc601/vito_octopus_chubby_white_1790998295495.jpg"
ASSETS_DIR = "/home/andrevmp/Downloads/vito/mobile/assets"
BG_COLOR = (26, 26, 30) # #1A1A1E
SPLASH_BG_COLOR = (18, 18, 20) # #121214

def main():
    os.makedirs(ASSETS_DIR, exist_ok=True)
    
    if not os.path.exists(SOURCE_IMAGE):
        raise FileNotFoundError(f"Source image not found: {SOURCE_IMAGE}")
        
    src = Image.open(SOURCE_IMAGE).convert("RGBA")
    
    # 1. icon.png (1024x1024)
    icon = src.resize((1024, 1024), Image.Resampling.LANCZOS)
    icon_path = os.path.join(ASSETS_DIR, "icon.png")
    icon.convert("RGB").save(icon_path, "PNG", optimize=True)
    print(f"Generated: {icon_path} (1024x1024)")
    
    # 2. adaptive-icon.png (1024x1024 com área segura central de ~700px)
    # Android adaptive icons precisam ter o glifo dentro de um círculo de 66% do tamanho total (676px).
    adaptive = Image.new("RGBA", (1024, 1024), BG_COLOR + (255,))
    glyph_size = 680
    resized_glyph = src.resize((glyph_size, glyph_size), Image.Resampling.LANCZOS)
    offset = ((1024 - glyph_size) // 2, (1024 - glyph_size) // 2)
    adaptive.paste(resized_glyph, offset)
    adaptive_path = os.path.join(ASSETS_DIR, "adaptive-icon.png")
    adaptive.convert("RGB").save(adaptive_path, "PNG", optimize=True)
    print(f"Generated: {adaptive_path} (1024x1024 safe area)")
    
    # 3. splash.png (1284x2778 para telas modernas de smartphone com fundo escuro executivo)
    splash = Image.new("RGBA", (1284, 2778), SPLASH_BG_COLOR + (255,))
    splash_glyph_size = 480
    splash_glyph = src.resize((splash_glyph_size, splash_glyph_size), Image.Resampling.LANCZOS)
    splash_offset = ((1284 - splash_glyph_size) // 2, (2778 - splash_glyph_size) // 2 - 100)
    splash.paste(splash_glyph, splash_offset)
    splash_path = os.path.join(ASSETS_DIR, "splash.png")
    splash.convert("RGB").save(splash_path, "PNG", optimize=True)
    print(f"Generated: {splash_path} (1284x2778)")
    
    # 4. favicon.png (48x48)
    favicon = src.resize((48, 48), Image.Resampling.LANCZOS)
    favicon_path = os.path.join(ASSETS_DIR, "favicon.png")
    favicon.convert("RGB").save(favicon_path, "PNG", optimize=True)
    print(f"Generated: {favicon_path} (48x48)")

if __name__ == "__main__":
    main()
