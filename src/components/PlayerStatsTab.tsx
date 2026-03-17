import { useMemo } from 'react';
import { Card, Row, Col, Slider, InputNumber, Select, Space, Typography, Divider, Tag } from 'antd';
import type { LoadedSave } from '../lib/containers';
import { TagType, nbt, cloneNbt, get } from '../lib/nbt';
import type { NbtList, NbtDouble } from '../lib/nbt';

const { Text } = Typography;

// pixel-art HUD icons from the game's loose PNGs
function HudIcon({ src, alt, scale = 2 }: { src: string; alt: string; scale?: number }) {
  return (
    <img src={src} alt={alt} title={alt}
      style={{ imageRendering: 'pixelated', height: 18 * scale, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

interface Props {
  loaded: LoadedSave;
  onUpdate: (updater: (s: LoadedSave) => LoadedSave) => void;
}

export default function PlayerStatsTab({ loaded, onUpdate }: Props) {
  const tags = loaded.playerNbt.root.tags;

  function mutate(fn: (tags: Record<string, import('../lib/nbt').NbtValue>) => void) {
    onUpdate(s => {
      const clone = cloneNbt(s.playerNbt);
      fn(clone.root.tags);
      return { ...s, playerNbt: clone };
    });
  }

  const health   = useMemo(() => get.float(tags, 'Health')         ?? 20, [tags]);
  const food     = useMemo(() => get.int(tags, 'FoodLevel')        ?? 20, [tags]);
  const foodSat  = useMemo(() => get.float(tags, 'FoodSaturationLevel') ?? 5, [tags]);
  const xpLevel  = useMemo(() => get.int(tags, 'XpLevel')         ?? 0, [tags]);
  const xpP      = useMemo(() => get.float(tags, 'XpP')           ?? 0, [tags]);
  const score    = useMemo(() => get.int(tags, 'Score')           ?? 0, [tags]);
  const gameMode = useMemo(() => get.int(tags, 'playerGameType')  ?? 0, [tags]);

  // Pos is stored as a list of 3 doubles in the nbt
  const posList = useMemo(() => {
    const v = tags['Pos'];
    if (v?.type !== TagType.List) return [0, 64, 0];
    return (v as NbtList).items.map(d =>
      d.type === TagType.Double ? (d as NbtDouble).value : 0
    );
  }, [tags]);

  const spawnX = useMemo(() => get.int(tags, 'SpawnX') ?? 0, [tags]);
  const spawnY = useMemo(() => get.int(tags, 'SpawnY') ?? 64, [tags]);
  const spawnZ = useMemo(() => get.int(tags, 'SpawnZ') ?? 0, [tags]);

  function setFloat(key: string, v: number) {
    mutate(t => { t[key] = nbt.float(v); });
  }
  function setInt(key: string, v: number) {
    mutate(t => { t[key] = nbt.int(v); });
  }
  function setPosCoord(idx: number, v: number) {
    mutate(t => {
      const list = t['Pos'] as NbtList | undefined;
      if (!list || list.type !== TagType.List) {
        t['Pos'] = { type: TagType.List, elementType: TagType.Double, items: [0, 64, 0].map(x => nbt.float(x)) };
      }
      const l = t['Pos'] as NbtList;
      const items = [...l.items] as NbtDouble[];
      items[idx] = { type: TagType.Double, value: v };
      l.items = items;
    });
  }

  const heartColor  = (hp: number) => hp > 12 ? '#f87171' : hp > 6 ? '#facc15' : '#ef4444';
  const foodColor   = (f: number)  => f > 14 ? '#a3e635' : f > 6  ? '#facc15' : '#f87171';

  const cardStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
  };

  return (
    <Row gutter={[16, 16]}>
      {/* ── health & food ─────────────────────────────────────────── */}
      <Col span={24}>
        <Card title={<span style={{ color: '#e6edf3', display: 'flex', alignItems: 'center', gap: 8 }}>
           Vitals</span>} style={cardStyle} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <StatRow
                label="Health"
                sublabel="(0 – 20 half-hearts)"
                color={heartColor(health)}
                value={health}
                min={0} max={20} step={1}
                onSlider={v => setFloat('Health', v)}
                renderInput={() => (
                  <InputNumber
                    value={health} min={0} max={20} step={0.5}
                    size="small" style={{ width: 80 }}
                    onChange={v => v !== null && setFloat('Health', v)}
                  />
                )}
              />
            </Col>
            <Col xs={24} md={12}>
              <StatRow
                label="Food Level"
                sublabel="(0 – 20)"
                color={foodColor(food)}
                value={food}
                min={0} max={20}
                onSlider={v => setInt('FoodLevel', v)}
                renderInput={() => (
                  <InputNumber
                    value={food} min={0} max={20} size="small" style={{ width: 80 }}
                    onChange={v => v !== null && setInt('FoodLevel', v)}
                  />
                )}
              />
            </Col>
            <Col xs={24} md={12}>
              <StatRow
                label="Food Saturation"
                sublabel="(0 – 5)"
                color="#f59e0b"
                value={foodSat}
                min={0} max={5} step={0.5}
                onSlider={v => setFloat('FoodSaturationLevel', v)}
                renderInput={() => (
                  <InputNumber
                    value={foodSat} min={0} max={5} step={0.1} size="small" style={{ width: 80 }}
                    onChange={v => v !== null && setFloat('FoodSaturationLevel', v)}
                  />
                )}
              />
            </Col>
          </Row>
        </Card>
      </Col>

      {/* ── xp ───────────────────────────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#e6edf3' }}>Experience</span></div>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 6 }}>XP Level</div>
              <InputNumber
                value={xpLevel} min={0} max={10000}
                style={{ width: '100%' }}
                addonBefore="Level"
                onChange={v => v !== null && setInt('XpLevel', v)}
              />
            </div>
            <div>
              <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 6 }}>Progress within level (0 – 1)</div>
              <Slider
                value={xpP} min={0} max={1} step={0.01}
                onChange={v => setFloat('XpP', v)}
                trackStyle={{ background: '#a3e635' }}
              />
              <InputNumber
                value={xpP} min={0} max={1} step={0.01} size="small" style={{ width: 80 }}
                onChange={v => v !== null && setFloat('XpP', v)}
              />
            </div>
            <div>
              <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 6 }}>Score</div>
              <InputNumber
                value={score} min={0} max={2147483647}
                style={{ width: '100%' }}
                onChange={v => v !== null && setInt('Score', v)}
              />
            </div>
          </Space>
        </Card>
      </Col>

      {/* ── game mode ────────────────────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ color: '#e6edf3' }}>Game Mode</span>
          <Tag color={gameMode === 0 ? 'red' : gameMode === 1 ? 'blue' : 'orange'} style={{ fontSize: 13, padding: '4px 10px' }}>
            {['Survival', 'Creative', 'Adventure'][gameMode] ?? 'Unknown'}
          </Tag>
          </div>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Select
            value={gameMode}
            style={{ width: '100%' }}
            onChange={v => setInt('playerGameType', v)}
            options={[
              { value: 0, label: 'Survival' },
              { value: 1, label: 'Creative' },
              { value: 2, label: 'Adventure' },
            ]}
          />
          <Divider style={{ borderColor: '#30363d', margin: '16px 0' }} />
          
        </Card>
      </Col>

      {/* ── position ─────────────────────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<span style={{ color: '#e6edf3' }}>Position</span>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {(['X', 'Y', 'Z'] as const).map((axis, i) => (
              <div key={axis} className="flex items-center gap-3">
                <Text style={{ width: 16, color: ['#f87171', '#4ade80', '#60a5fa'][i], fontWeight: 700, flexShrink: 0 }}>
                  {axis}
                </Text>
                <InputNumber
                  value={posList[i] ?? 0}
                  style={{ flex: 1 }}
                  step={1}
                  onChange={v => v !== null && setPosCoord(i, v)}
                />
              </div>
            ))}
          </Space>
        </Card>
      </Col>

      {/* ── spawn point ──────────────────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<span style={{ color: '#e6edf3' }}>Spawn Point</span>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size={10}>
            {[['SpawnX', '#f87171'], ['SpawnY', '#4ade80'], ['SpawnZ', '#60a5fa']] .map(([key, color]) => (
              <div key={key} className="flex items-center gap-3">
                <Text style={{ width: 56, color, flexShrink: 0, fontSize: 12, fontFamily: 'monospace' }}>
                  {key}
                </Text>
                <InputNumber
                  value={key === 'SpawnX' ? spawnX : key === 'SpawnY' ? spawnY : spawnZ}
                  style={{ flex: 1 }}
                  onChange={v => v !== null && setInt(key, v)}
                />
              </div>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  );
}

// ── reusable stat row ────────────────────────────────────────────────────────

function StatRow({
  label, sublabel, color, value, min, max, step = 1,
  onSlider, renderInput,
}: {
  label: string;
  sublabel: string;
  color: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onSlider: (v: number) => void;
  renderInput: () => React.ReactNode;
}) {
  return (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <Text style={{ color: '#e6edf3', fontWeight: 600, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: '#6e7681', fontSize: 11 }}>{sublabel}</Text>
      </div>
      <div className="flex items-center gap-3">
        <Slider
          value={value} min={min} max={max} step={step}
          onChange={onSlider}
          style={{ flex: 1 }}
          trackStyle={{ background: color }}
        />
        {renderInput()}
      </div>
    </div>
  );
}
