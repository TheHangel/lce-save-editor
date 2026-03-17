/**
 * renders a minecraft-style item icon tile
 *
 * if you drop the vanilla items.png (256×256, 16-column sprite sheet) at
 *   public/assets/game/gui/items.png
 * it will be used as a sprite atlas for item ids 256+
 * otherwise a coloured tile showing the item's initials is used as a fallback
 */
import { useState, useEffect } from 'react';
import { getItemCategory, CATEGORY_COLORS, getItemName } from '../lib/items';

const ITEMS_PNG = '/assets/game/gui/items.png';

// singleton check — resolves once we know whether items.png is actually available
let itemsPngAvailable: boolean | null = null;
const listeners: Array<(ok: boolean) => void> = [];

function checkItemsPng() {
  if (itemsPngAvailable !== null) return;
  const img = new Image();
  img.onload  = () => { itemsPngAvailable = true;  listeners.forEach(fn => fn(true));  listeners.length = 0; };
  img.onerror = () => { itemsPngAvailable = false; listeners.forEach(fn => fn(false)); listeners.length = 0; };
  img.src = ITEMS_PNG;
}

function useItemsPng(): boolean {
  const [ok, setOk] = useState<boolean>(itemsPngAvailable ?? false);
  useEffect(() => {
    if (itemsPngAvailable !== null) { setOk(itemsPngAvailable); return; }
    const cb = (v: boolean) => setOk(v);
    listeners.push(cb);
    checkItemsPng();
    return () => { const i = listeners.indexOf(cb); if (i !== -1) listeners.splice(i, 1); };
  }, []);
  return ok;
}

interface Props {
  itemId: number;
  size?: number;
}

export default function ItemIcon({ itemId, size = 24 }: Props) {
  const hasPng = useItemsPng();
  const cat    = getItemCategory(itemId);
  const color  = CATEGORY_COLORS[cat];
  const name   = getItemName(itemId);

  // items.png is 256×256 with 16 sprites per row at 16×16px — index into it with (itemId - 256)
  if (hasPng && itemId >= 256 && itemId <= 511) {
    const idx = itemId - 256;
    const col = idx % 16;
    const row = Math.floor(idx / 16);
    const scale = size / 16;
    return (
      <div
        title={name}
        style={{
          width:               size,
          height:              size,
          flexShrink:          0,
          backgroundImage:     `url(${ITEMS_PNG})`,
          backgroundPosition:  `-${col * 16 * scale}px -${row * 16 * scale}px`,
          backgroundSize:      `${256 * scale}px ${256 * scale}px`,
          backgroundRepeat:    'no-repeat',
          imageRendering:      'pixelated',
          borderRadius:        2,
        }}
      />
    );
  }

  // ── coloured tile fallback ────────────────────────────────────────────────
  // build a 2-letter abbreviation from the item name for the fallback tile
  const words = name.split(' ').filter(Boolean);
  const abbr  = words.length >= 2
    ? (words[0][0] + words[words.length > 2 ? 1 : 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();

  const fontSize = size <= 20 ? 7 : size <= 28 ? 9 : 11;

  return (
    <div
      title={name}
      style={{
        width:        size,
        height:       size,
        flexShrink:   0,
        borderRadius: 2,
        border:       `1px solid ${color}55`,
        background:   `linear-gradient(135deg, ${color}33, ${color}18)`,
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'center',
        fontFamily:   "'Mojangles', monospace",
        fontSize,
        fontWeight:   700,
        color,
        textShadow:   '1px 1px 0 rgba(0,0,0,0.7)',
        letterSpacing: 0,
        overflow:     'hidden',
        userSelect:   'none',
      }}
    >
      {abbr}
    </div>
  );
}
