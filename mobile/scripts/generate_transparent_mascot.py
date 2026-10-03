#!/usr/bin/env python3
"""
Gera o asset do mascote Vito com fundo transparente e anti-aliasing de alta precisão.
"""

from PIL import Image, ImageFilter
import numpy as np
import os

SOURCE_IMAGE = "/home/andrevmp/.gemini/antigravity-ide/brain/41b25e44-6c2c-47d3-bd37-8fb2779dc601/vito_octopus_chubby_white_1790998295495.jpg"
OUTPUT_PATH = "/home/andrevmp/Downloads/vito/mobile/assets/mascot.png"

def main():
    img = Image.open(SOURCE_IMAGE).convert("RGBA")
    arr = np.array(img, dtype=float)

    # Cor de fundo dos cantos
    corner_bg = np.mean([
        arr[5, 5, :3],
        arr[5, 1018, :3],
        arr[1018, 5, :3],
        arr[1018, 1018, :3]
    ], axis=0)

    diff = np.sqrt(np.sum((arr[:, :, :3] - corner_bg)**2, axis=2))

    # Cria canal alfa suave
    # Thresholds para borda suave
    t_low = 18.0
    t_high = 32.0

    alpha = np.clip((diff - t_low) / (t_high - t_low), 0.0, 1.0) * 255.0
    alpha_img = Image.fromarray(alpha.astype(np.uint8), mode="L")
    alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=0.7))

    # Aplica o canal alfa na imagem
    img.putalpha(alpha_img)

    # Crop da bounding box para centralizacao perfeita
    bbox = img.getbbox()
    if bbox:
        cropped = img.crop(bbox)
        # Cria imagem quadrada mantendo proporcao 1:1
        w, h = cropped.size
        max_dim = max(w, h)
        square = Image.new("RGBA", (max_dim + 40, max_dim + 40), (0, 0, 0, 0))
        offset = ((max_dim + 40 - w) // 2, (max_dim + 40 - h) // 2)
        square.paste(cropped, offset)
        
        # Redimensiona para 512x512 cristalino
        final_img = square.resize((512, 512), Image.Resampling.LANCZOS)
        final_img.save(OUTPUT_PATH, "PNG", optimize=True)
        print(f"Sucesso: {OUTPUT_PATH} gerado em 512x512 com fundo transparente!")

if __name__ == "__main__":
    main()
