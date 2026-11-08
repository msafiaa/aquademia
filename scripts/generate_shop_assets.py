import zlib
import struct
import os
import math

def make_png(width, height, pixel_func, filename):
    # pixel_func(x, y) returns (r, g, b, a)
    raw_data = bytearray()
    for y in range(height):
        raw_data.append(0)  # filter type 0 (None)
        for x in range(width):
            r, g, b, a = pixel_func(x, y)
            raw_data.extend([int(r) & 0xFF, int(g) & 0xFF, int(b) & 0xFF, int(a) & 0xFF])
    
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)

    png = bytearray(b"\x89PNG\r\n\x1a\n")
    ihdr_data = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png.extend(chunk(b"IHDR", ihdr_data))
    png.extend(chunk(b"IDAT", zlib.compress(bytes(raw_data), 9)))
    png.extend(chunk(b"IEND", b""))
    
    os.makedirs(os.path.dirname(filename), exist_ok=True)
    with open(filename, "wb") as f:
        f.write(png)
    print(f"Created: {filename} ({width}x{height})")

W, H = 160, 160
CX, CY = W / 2, H / 2

# 1. Pink Coral
def draw_coral(x, y):
    dx, dy = (x - CX) / 60, (y - CY) / 60
    # Branching structure
    dist_stem = math.hypot(dx * 1.5, dy - 0.2)
    b1 = math.hypot(dx - 0.45, dy + 0.3)
    b2 = math.hypot(dx + 0.45, dy + 0.25)
    b3 = math.hypot(dx, dy + 0.45)
    
    inside = (dist_stem < 0.4 and dy > -0.2) or (b1 < 0.32) or (b2 < 0.35) or (b3 < 0.32)
    tip = (b1 < 0.18) or (b2 < 0.2) or (b3 < 0.18)
    
    if tip:
        return (255, 175, 195, 255) # light pink tips
    elif inside:
        return (225, 65, 105, 255)  # coral vibrant pink
    elif (dist_stem < 0.46 and dy > -0.25) or (b1 < 0.38) or (b2 < 0.41) or (b3 < 0.38):
        return (160, 30, 65, 180)   # outline
    return (0, 0, 0, 0)

# 2. Pearl Shell
def draw_shell(x, y):
    dx, dy = (x - CX) / 55, (y - CY) / 50
    # Shell fan
    r = math.hypot(dx, dy + 0.1)
    angle = math.atan2(dy + 0.1, dx)
    ribs = math.cos(angle * 7) * 0.08
    shell_radius = 0.85 + ribs
    
    in_shell = (r < shell_radius) and (dy < 0.6)
    shell_border = (r < shell_radius + 0.08) and (dy < 0.68)
    
    # Pearl at center
    p_dist = math.hypot((x - CX) / 22, (y - (CY + 6)) / 22)
    if p_dist < 0.7:
        # Pearl shine
        shine = math.hypot((x - (CX - 5)) / 8, (y - (CY + 2)) / 8)
        if shine < 0.5:
            return (255, 255, 255, 255)
        return (240, 248, 255, 255)
    elif p_dist < 0.82:
        return (180, 210, 230, 255) # pearl shadow
    
    if in_shell:
        col = int(240 + math.sin(angle * 7) * 15)
        return (col, 215, 235, 255) # pearlescent violet-blue shell
    elif shell_border:
        return (120, 100, 160, 255)
    return (0, 0, 0, 0)

# 3. Treasure Chest
def draw_chest(x, y):
    dx, dy = x - CX, y - CY
    # Base box: -45 <= dx <= 45, -5 <= dy <= 40
    # Lid: -45 <= dx <= 45, -35 <= dy <= -5 (arched)
    in_base = (-42 <= dx <= 42) and (-5 <= dy <= 38)
    lid_arch = math.hypot(dx / 44, (dy + 5) / 32)
    in_lid = (lid_arch < 1.0) and (dy <= -5)
    
    border = ((-46 <= dx <= 46) and (-9 <= dy <= 42)) or ((lid_arch < 1.1) and (dy <= -5))
    
    # Gold lock at center (-7 <= dx <= 7, -8 <= dy <= 6)
    if (-8 <= dx <= 8) and (-9 <= dy <= 7):
        return (255, 215, 0, 255) # gold lock
    
    if in_lid or in_base:
        # Gold bands on sides
        if abs(dx) < 32 and abs(dx) > 22:
            return (235, 185, 45, 255) # gold trim
        return (139, 69, 19, 255)      # rich brown wood
    elif border:
        return (60, 30, 10, 255)       # dark outline
    return (0, 0, 0, 0)

# 4. Sand Castle
def draw_castle(x, y):
    dx, dy = x - CX, y - CY
    # Main wall & 2 side towers
    tower_l = (-45 <= dx <= -15) and (-25 <= dy <= 40)
    tower_r = (15 <= dx <= 45) and (-25 <= dy <= 40)
    center = (-20 <= dx <= 20) and (-10 <= dy <= 40)
    
    # Roof cones
    cone_l = (dy < -25) and (abs(dx + 30) < (dy + 50) * 0.7) and (dy > -50)
    cone_r = (dy < -25) and (abs(dx - 30) < (dy + 50) * 0.7) and (dy > -50)
    
    in_castle = tower_l or tower_r or center or cone_l or cone_r
    # Battlements
    if (-15 <= dx <= 15) and (-18 <= dy <= -10) and (int(dx) % 10 < 5):
        in_castle = True
        
    door = (-8 <= dx <= 8) and (18 <= dy <= 40)
    if door:
        return (80, 50, 30, 255) # dark gateway
        
    if in_castle:
        # Texture
        shade = (int(x + y) % 7) * 4
        return (235 - shade, 205 - shade, 140 - shade, 255) # warm golden sand
    return (0, 0, 0, 0)

# 5. Seaweed Garden
def draw_seaweed(x, y):
    dx, dy = (x - CX), (y - CY)
    # 3 undulating ribbons
    s1 = math.sin((y) * 0.08) * 14
    s2 = math.sin((y + 20) * 0.09) * 16 - 22
    s3 = math.sin((y - 15) * 0.07) * 15 + 24
    
    in_s1 = abs(dx - s1) < 8 and (-50 <= dy <= 55)
    in_s2 = abs(dx - s2) < 7 and (-40 <= dy <= 55)
    in_s3 = abs(dx - s3) < 7.5 and (-45 <= dy <= 55)
    
    if in_s1:
        return (34, 175, 80, 255)  # vibrant emerald
    elif in_s2 or in_s3:
        return (24, 140, 65, 255)  # deep sea green
    elif (abs(dx - s1) < 10 and (-52 <= dy <= 56)) or (abs(dx - s2) < 9 and (-42 <= dy <= 56)) or (abs(dx - s3) < 9.5 and (-47 <= dy <= 56)):
        return (10, 80, 35, 200)   # outline
    return (0, 0, 0, 0)

# 6. Starfish
def draw_starfish(x, y):
    dx, dy = (x - CX) / 50, (y - CY) / 50
    r = math.hypot(dx, dy)
    angle = math.atan2(dy, dx)
    # 5-pointed star modulation
    star_r = 0.45 + 0.38 * math.cos(5 * (angle - math.pi / 10))
    
    if r < star_r:
        # center highlight
        if r < 0.2:
            return (255, 220, 100, 255)
        # bumpy dots
        dot = (math.sin(x * 0.5) * math.cos(y * 0.5)) > 0.6
        if dot:
            return (255, 235, 120, 255)
        return (255, 120, 45, 255) # cheerful vibrant orange
    elif r < star_r + 0.08:
        return (190, 70, 20, 255)  # warm outline
    return (0, 0, 0, 0)

out_dir = r"frontend\static\images\shop"
make_png(W, H, draw_coral, os.path.join(out_dir, "pink_coral.png"))
make_png(W, H, draw_shell, os.path.join(out_dir, "pearl_shell.png"))
make_png(W, H, draw_chest, os.path.join(out_dir, "treasure_chest.png"))
make_png(W, H, draw_castle, os.path.join(out_dir, "sand_castle.png"))
make_png(W, H, draw_seaweed, os.path.join(out_dir, "seaweed.png"))
make_png(W, H, draw_starfish, os.path.join(out_dir, "starfish.png"))
print("All 6 shop item images generated successfully!")
