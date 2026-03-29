import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { Spin, Typography, Space, Tag, Slider, Tooltip, Checkbox, Segmented } from 'antd';
import { LoadingOutlined, ZoomInOutlined, ZoomOutOutlined, AimOutlined } from '@ant-design/icons';
import type { LoadedSave } from '../lib/containers';
import type { ParsedChunk } from '../lib/region';
import {
  parseRegionFilename,
  parseRegionChunks,
  getTopBlocks,
} from '../lib/region';
import { getBlockColor, isWater } from '../lib/blockColors';
import { findStructures, STRUCTURE_INFO } from '../lib/structures';
import type { StructureLocation, StructureType } from '../lib/structures';
import { get } from '../lib/nbt';

const { Text } = Typography;

interface Props {
  loaded: LoadedSave;
}

/** Nether-aware top block scanner: skips bedrock ceiling, finds first visible surface */
function getNetherTopBlocks(chunk: ParsedChunk): { blockId: number; y: number }[] {
  const result: { blockId: number; y: number }[] = new Array(256);

  for (let z = 0; z < 16; z++) {
    for (let x = 0; x < 16; x++) {
      // Start from y=126 (skip y=127 bedrock ceiling) and find the first air block
      let y = 126;
      let foundAir = false;
      while (y >= 0) {
        const idx = (x << 11) | (z << 7) | y;
        if (chunk.blocks[idx] === 0) {
          foundAir = true;
          break;
        }
        y--;
      }
      if (foundAir) {
        // Now scan down through air to find the actual surface
        while (y >= 0) {
          const idx = (x << 11) | (z << 7) | y;
          if (chunk.blocks[idx] !== 0) break;
          y--;
        }
      }
      if (y >= 0) {
        const idx = (x << 11) | (z << 7) | y;
        result[z * 16 + x] = { blockId: chunk.blocks[idx], y };
      } else {
        result[z * 16 + x] = { blockId: 0, y: 0 };
      }
    }
  }
  return result;
}

/** Pre-render all chunk tiles into a single large offscreen canvas */
function buildMapImage(chunks: ParsedChunk[], isNether = false): {
  canvas: HTMLCanvasElement;
  minChunkX: number;
  minChunkZ: number;
  maxChunkX: number;
  maxChunkZ: number;
  chunkCount: number;
} | null {
  if (chunks.length === 0) return null;

  let minCX = Infinity, maxCX = -Infinity;
  let minCZ = Infinity, maxCZ = -Infinity;
  for (const c of chunks) {
    if (c.chunkX < minCX) minCX = c.chunkX;
    if (c.chunkX > maxCX) maxCX = c.chunkX;
    if (c.chunkZ < minCZ) minCZ = c.chunkZ;
    if (c.chunkZ > maxCZ) maxCZ = c.chunkZ;
  }

  const w = (maxCX - minCX + 1) * 16;
  const h = (maxCZ - minCZ + 1) * 16;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;

  // fill background with void color
  ctx.fillStyle = '#0a0e14';
  ctx.fillRect(0, 0, w, h);

  for (const chunk of chunks) {
    const topBlocks = isNether ? getNetherTopBlocks(chunk) : getTopBlocks(chunk);
    const img = new ImageData(16, 16);

    for (let z = 0; z < 16; z++) {
      for (let x = 0; x < 16; x++) {
        const { blockId, y } = topBlocks[z * 16 + x];
        let [r, g, b] = getBlockColor(blockId, y);

        if (isWater(blockId)) {
          let waterDepth = 0;
          let wy = y - 1;
          while (wy >= 0) {
            const idx = (x << 11) | (z << 7) | wy;
            if (chunk.blocks[idx] !== 8 && chunk.blocks[idx] !== 9) break;
            waterDepth++;
            wy--;
          }
          const darken = Math.max(0.4, 1 - waterDepth * 0.06);
          r = Math.round(r * darken);
          g = Math.round(g * darken);
          b = Math.round(b * darken);
        }

        const pi = (z * 16 + x) * 4;
        img.data[pi] = r;
        img.data[pi + 1] = g;
        img.data[pi + 2] = b;
        img.data[pi + 3] = 255;
      }
    }

    const px = (chunk.chunkX - minCX) * 16;
    const pz = (chunk.chunkZ - minCZ) * 16;
    ctx.putImageData(img, px, pz);
  }

  return { canvas, minChunkX: minCX, minChunkZ: minCZ, maxChunkX: maxCX, maxChunkZ: maxCZ, chunkCount: chunks.length };
}

type Dimension = 'overworld' | 'DIM-1' | 'DIM1';
const DIMENSION_LABELS: Record<Dimension, string> = {
  overworld: 'Overworld',
  'DIM-1': 'Nether',
  'DIM1': 'The End',
};

export default function WorldMapTab({ loaded }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<ReturnType<typeof buildMapImage>>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');
  const [chunkCount, setChunkCount] = useState(0);
  const [scale, setScale] = useState(2);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, offsetX: 0, offsetY: 0 });
  const [hoverInfo, setHoverInfo] = useState<string | null>(null);
  const rafRef = useRef(0);
  const [structures, setStructures] = useState<StructureLocation[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<StructureType>>(new Set());
  const visibleStructures = useMemo(
    () => structures.filter(s => !hiddenTypes.has(s.type)),
    [structures, hiddenTypes],
  );
  const chunksRef = useRef<ParsedChunk[]>([]);
  const [dimension, setDimension] = useState<Dimension>('overworld');

  // detect which dimensions have region files
  const availableDimensions = useMemo(() => {
    if (!loaded.container) return [] as Dimension[];
    const dims = new Set<string>();
    for (const e of loaded.container.entries) {
      const info = parseRegionFilename(e.name);
      if (info) dims.add(info.dimension);
    }
    const result: Dimension[] = [];
    if (dims.has('overworld')) result.push('overworld');
    if (dims.has('DIM-1')) result.push('DIM-1');
    if (dims.has('DIM1')) result.push('DIM1');
    return result;
  }, [loaded.container]);

  // parse regions for current dimension
  useEffect(() => {
    if (!loaded.container) return;

    const regionEntries = loaded.container.entries.filter(e => {
      const info = parseRegionFilename(e.name);
      return info && info.dimension === dimension;
    });

    if (regionEntries.length === 0) {
      mapImageRef.current = null;
      chunksRef.current = [];
      setChunkCount(0);
      setStructures([]);
      return;
    }

    setLoading(true);
    setProgress('Parsing region files...');

    const allChunks: ParsedChunk[] = [];
    let regionIdx = 0;

    function processNextRegion() {
      if (regionIdx >= regionEntries.length) {
        setProgress('Rendering map...');
        setTimeout(() => {
          const isNether = dimension === 'DIM-1';
          const mapImage = buildMapImage(allChunks, isNether);
          mapImageRef.current = mapImage;
          chunksRef.current = allChunks;
          setChunkCount(allChunks.length);

          // compute structure locations (overworld only)
          if (dimension === 'overworld' && loaded.levelNbt) {
            const dataTags = loaded.levelNbt.root.tags['Data'];
            if (dataTags?.type === 10) {
              const seed = get.long(dataTags.tags, 'RandomSeed');
              if (seed !== undefined) {
                setProgress('Finding structures...');
                const found = findStructures(allChunks, seed);
                setStructures(found);
              }
            }
          } else {
            setStructures([]);
          }

          setLoading(false);
          setProgress('');

          if (mapImage) {
            // center the map
            const canvas = canvasRef.current;
            const cw = canvas?.width ?? 800;
            const ch = canvas?.height ?? 600;
            const centerBlockX = ((mapImage.minChunkX + mapImage.maxChunkX) / 2) * 16;
            const centerBlockZ = ((mapImage.minChunkZ + mapImage.maxChunkZ) / 2) * 16;
            setOffset({
              x: cw / 2 - centerBlockX * 2,
              y: ch / 2 - centerBlockZ * 2,
            });
          }
        }, 0);
        return;
      }

      const entry = regionEntries[regionIdx];
      const info = parseRegionFilename(entry.name)!;
      setProgress(`Region ${regionIdx + 1}/${regionEntries.length}: ${entry.name}`);

      try {
        const chunks = parseRegionChunks(entry.data, info.regionX, info.regionZ);
        allChunks.push(...chunks);
      } catch (err) {
        console.warn(`Failed to parse region ${entry.name}:`, err);
      }

      regionIdx++;
      setTimeout(processNextRegion, 0);
    }

    processNextRegion();
  }, [loaded.container, dimension]);

  // draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const mapImage = mapImageRef.current;
    if (!canvas || !mapImage) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, w, h);

    // draw the pre-rendered map image
    const mapPixelX = mapImage.minChunkX * 16 * scale + offset.x;
    const mapPixelZ = mapImage.minChunkZ * 16 * scale + offset.y;
    const mapW = mapImage.canvas.width * scale;
    const mapH = mapImage.canvas.height * scale;

    ctx.drawImage(mapImage.canvas, mapPixelX, mapPixelZ, mapW, mapH);

    // draw coordinate axes through world origin (0, 0)
    const originX = offset.x;
    const originY = offset.y;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(originX, 0);
    ctx.lineTo(originX, h);
    ctx.moveTo(0, originY);
    ctx.lineTo(w, originY);
    ctx.stroke();

    // draw spawn point (overworld only)
    if (dimension === 'overworld' && loaded.playerNbt) {
      const tags = loaded.playerNbt.root.tags;
      const spawnX = tags['SpawnX'];
      const spawnZ = tags['SpawnZ'];
      if (spawnX?.type === 3 && spawnZ?.type === 3) {
        const sx = spawnX.value * scale + offset.x;
        const sz = spawnZ.value * scale + offset.y;
        ctx.fillStyle = '#ff4444';
        ctx.beginPath();
        ctx.arc(sx, sz, Math.max(4, scale * 2), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // draw player position (overworld only — player dimension not stored separately)
    if (dimension === 'overworld' && loaded.playerNbt) {
      const posList = loaded.playerNbt.root.tags['Pos'];
      if (posList?.type === 9 && posList.items.length >= 3) {
        const px = (posList.items[0] as { value: number }).value;
        const pz = (posList.items[2] as { value: number }).value;
        const sx = px * scale + offset.x;
        const sz = pz * scale + offset.y;
        ctx.fillStyle = '#4ade80';
        ctx.beginPath();
        ctx.arc(sx, sz, Math.max(3, scale * 1.5), 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // draw structure markers
    if (visibleStructures.length > 0) {
      const iconSize = Math.max(12, Math.min(28, scale * 6));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      for (const s of visibleStructures) {
        const sx = s.blockX * scale + offset.x;
        const sz = s.blockZ * scale + offset.y;

        // skip if off-screen
        if (sx < -iconSize || sx > w + iconSize || sz < -iconSize || sz > h + iconSize) continue;

        const info = STRUCTURE_INFO[s.type];

        // draw background circle
        const radius = iconSize / 2 + 2;
        ctx.fillStyle = info.color + 'cc';
        ctx.beginPath();
        ctx.arc(sx, sz, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // draw emoji icon
        ctx.font = `${Math.round(iconSize * 0.7)}px sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.fillText(info.emoji, sx, sz);
      }
    }
  }, [scale, offset, loaded.playerNbt, visibleStructures, dimension]);

  // redraw when state changes
  useEffect(() => {
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, chunkCount]);

  // resize canvas to container
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const obs = new ResizeObserver(() => {
      canvas.width = container.clientWidth;
      canvas.height = Math.max(500, container.clientHeight);
      draw();
    });
    obs.observe(container);
    return () => obs.disconnect();
  }, [draw]);

  // mouse handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      offsetX: offset.x,
      offsetY: offset.y,
    };
  }, [offset]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (dragging) {
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      setOffset({
        x: dragRef.current.offsetX + dx,
        y: dragRef.current.offsetY + dy,
      });
    }

    // compute hovered block coordinates
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const worldX = Math.floor((mx - offset.x) / scale);
    const worldZ = Math.floor((my - offset.y) / scale);

    // check if hovering near a structure
    let structLabel = '';
    if (visibleStructures.length > 0) {
      for (const s of visibleStructures) {
        const sx = s.blockX * scale + offset.x;
        const sz = s.blockZ * scale + offset.y;
        const dist = Math.sqrt((mx - sx) ** 2 + (my - sz) ** 2);
        if (dist < Math.max(16, scale * 8)) {
          const info = STRUCTURE_INFO[s.type];
          const extra = s.entityId ? ` (${s.entityId})` : '';
          structLabel = ` — ${info.emoji} ${info.label}${extra}`;
          break;
        }
      }
    }
    setHoverInfo(`X: ${worldX}  Z: ${worldZ}${structLabel}`);
  }, [dragging, offset, scale, visibleStructures]);

  const handleMouseUp = useCallback(() => {
    setDragging(false);
  }, []);

  // attach wheel listener with { passive: false } so preventDefault() works
  const wheelRef = useRef<(e: WheelEvent) => void>();
  wheelRef.current = (e: WheelEvent) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const oldScale = scale;
    const factor = e.deltaY > 0 ? 0.85 : 1.18;
    const newScale = Math.max(0.25, Math.min(32, scale * factor));

    const worldX = (mx - offset.x) / oldScale;
    const worldZ = (my - offset.y) / oldScale;
    setScale(newScale);
    setOffset({
      x: mx - worldX * newScale,
      y: my - worldZ * newScale,
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (e: WheelEvent) => wheelRef.current?.(e);
    canvas.addEventListener('wheel', handler, { passive: false });
    return () => canvas.removeEventListener('wheel', handler);
  }, []);

  const handleRecenter = useCallback(() => {
    const canvas = canvasRef.current;
    const mapImage = mapImageRef.current;
    if (!canvas || !mapImage) return;

    const centerBlockX = ((mapImage.minChunkX + mapImage.maxChunkX) / 2) * 16;
    const centerBlockZ = ((mapImage.minChunkZ + mapImage.maxChunkZ) / 2) * 16;
    setOffset({
      x: canvas.width / 2 - centerBlockX * scale,
      y: canvas.height / 2 - centerBlockZ * scale,
    });
  }, [scale]);

  if (!loaded.container) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: '#6e7681' }}>
        <Text>World map requires a .ms container file with region data.</Text>
      </div>
    );
  }

  return (
    <div>
      {/* ── toolbar line 1: controls ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        {availableDimensions.length > 1 && (
          <Segmented
            value={dimension}
            onChange={v => setDimension(v as Dimension)}
            options={availableDimensions.map(d => ({ label: DIMENSION_LABELS[d], value: d }))}
            size="small"
          />
        )}
        <Tag color="blue">{chunkCount} chunks loaded</Tag>
        <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#6e7681', minWidth: 140 }}>
          {hoverInfo ?? '\u00A0'}
        </div>
        <Tooltip title="Recenter map">
          <AimOutlined
            onClick={handleRecenter}
            style={{ cursor: 'pointer', color: '#6e7681', fontSize: 16 }}
          />
        </Tooltip>
        <Space size={4} align="center">
          <ZoomOutOutlined style={{ color: '#6e7681' }} />
          <Slider
            min={0.25}
            max={16}
            step={0.25}
            value={scale}
            onChange={setScale}
            style={{ width: 120 }}
            tooltip={{ formatter: (v) => `${v}x` }}
          />
          <ZoomInOutlined style={{ color: '#6e7681' }} />
        </Space>
        {loading && (
          <Space>
            <Spin indicator={<LoadingOutlined spin />} size="small" />
            <Text style={{ color: '#6e7681', fontSize: 12 }}>{progress}</Text>
          </Space>
        )}
        {dimension === 'overworld' && (
          <Text style={{ color: '#484f58', fontSize: 11 }}>
            <span style={{ color: '#ff4444' }}>●</span> spawn
            {' '}
            <span style={{ color: '#4ade80' }}>●</span> player
          </Text>
        )}
      </div>

      {/* ── toolbar line 2: structure filters ── */}
      {structures.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          {Object.entries(
            structures.reduce<Record<string, number>>((acc, s) => {
              acc[s.type] = (acc[s.type] || 0) + 1;
              return acc;
            }, {})
          ).map(([type, count]) => {
            const t = type as StructureType;
            const info = STRUCTURE_INFO[t];
            const visible = !hiddenTypes.has(t);
            return (
              <Checkbox
                key={type}
                checked={visible}
                onChange={e => {
                  setHiddenTypes(prev => {
                    const next = new Set(prev);
                    if (e.target.checked) next.delete(t);
                    else next.add(t);
                    return next;
                  });
                }}
                style={{ fontSize: 11 }}
              >
                <span style={{ color: visible ? info.color : '#484f58' }}>
                  {info.emoji} {info.label} ({count})
                </span>
              </Checkbox>
            );
          })}
        </div>
      )}

      <div
        ref={containerRef}
        style={{
          border: '1px solid #30363d',
          borderRadius: 8,
          overflow: 'hidden',
          background: '#0a0e14',
          cursor: dragging ? 'grabbing' : 'grab',
          position: 'relative',
        }}
      >
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ display: 'block', width: '100%', imageRendering: 'pixelated' }}
        />
        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          background: 'rgba(0,0,0,0.6)',
          padding: '4px 8px',
          borderRadius: 4,
          fontSize: 11,
          color: '#6e7681',
          fontFamily: 'monospace',
          pointerEvents: 'none',
        }}>
          Scroll to zoom · Drag to pan
        </div>
      </div>
    </div>
  );
}