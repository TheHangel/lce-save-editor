import { useMemo } from 'react';
import { Card, Row, Col, Slider, InputNumber, Select, Space, Typography, Divider, Tag, Table, Empty } from 'antd';
import type { LoadedSave } from '../lib/containers';
import { TagType, nbt, cloneNbt, get } from '../lib/nbt';
import type { NbtList, NbtDouble, NbtCompound, NbtByte, NbtShort } from '../lib/nbt';
import { getItemName } from '../lib/items';
import { enchantLabel, toRoman, ENCHANT_BY_ID } from '../lib/enchants';
import ItemIcon from './ItemIcon';

const { Text } = Typography;

// pixel-art HUD icons from the game's loose PNGs
function HudIcon({ src, alt, scale = 2 }: { src: string; alt: string; scale?: number }) {
  return (
    <img src={src} alt={alt} title={alt}
      style={{ imageRendering: 'pixelated', height: 18 * scale, width: 'auto', display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

const EFFECT_NAMES: Record<number, { name: string; color: string }> = {
  1:  { name: 'Speed',            color: '#7dd3fc' },
  2:  { name: 'Slowness',         color: '#94a3b8' },
  3:  { name: 'Haste',            color: '#fcd34d' },
  4:  { name: 'Mining Fatigue',   color: '#78716c' },
  5:  { name: 'Strength',         color: '#f87171' },
  6:  { name: 'Instant Health',   color: '#f87171' },
  7:  { name: 'Instant Damage',   color: '#7f1d1d' },
  8:  { name: 'Jump Boost',       color: '#86efac' },
  9:  { name: 'Nausea',           color: '#a3e635' },
  10: { name: 'Regeneration',     color: '#fb7185' },
  11: { name: 'Resistance',       color: '#a8a29e' },
  12: { name: 'Fire Resistance',  color: '#fb923c' },
  13: { name: 'Water Breathing',  color: '#67e8f9' },
  14: { name: 'Invisibility',     color: '#d4d4d8' },
  15: { name: 'Blindness',        color: '#27272a' },
  16: { name: 'Night Vision',     color: '#a78bfa' },
  17: { name: 'Hunger',           color: '#84cc16' },
  18: { name: 'Weakness',         color: '#a1a1aa' },
  19: { name: 'Poison',           color: '#4ade80' },
  20: { name: 'Wither',           color: '#525252' },
  21: { name: 'Health Boost',     color: '#ef4444' },
  22: { name: 'Absorption',       color: '#fbbf24' },
  23: { name: 'Saturation',       color: '#f87171' },
};

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

  // ── active effects ──────────────────────────────────────────
  const activeEffects = useMemo(() => {
    const list = tags['ActiveEffects'];
    if (!list || list.type !== TagType.List) return [];
    return (list as NbtList).items
      .filter(it => it.type === TagType.Compound)
      .map(it => {
        const t = (it as NbtCompound).tags;
        return {
          id: t['Id']?.type === TagType.Byte ? (t['Id'] as NbtByte).value : 0,
          amplifier: t['Amplifier']?.type === TagType.Byte ? (t['Amplifier'] as NbtByte).value : 0,
          duration: t['Duration']?.type === TagType.Int ? (t['Duration'] as import('../lib/nbt').NbtInt).value : 0,
          ambient: t['Ambient']?.type === TagType.Byte ? !!(t['Ambient'] as NbtByte).value : false,
        };
      });
  }, [tags]);

  // ── ender chest ──────────────────────────────────────────
  const enderItems = useMemo(() => {
    const list = tags['EnderItems'];
    if (!list || list.type !== TagType.List) return [];
    return (list as NbtList).items
      .filter(it => it.type === TagType.Compound)
      .map(it => {
        const t = (it as NbtCompound).tags;
        const slot = t['Slot']?.type === TagType.Byte ? (t['Slot'] as NbtByte).value : 0;
        const id = t['id']?.type === TagType.Short ? (t['id'] as NbtShort).value : 0;
        const count = t['Count']?.type === TagType.Byte ? (t['Count'] as NbtByte).value : 1;
        const damage = t['Damage']?.type === TagType.Short ? (t['Damage'] as NbtShort).value : 0;
        // enchants
        const tagComp = t['tag'];
        const enchants: { id: number; lvl: number }[] = [];
        if (tagComp?.type === TagType.Compound) {
          const enchList = (tagComp as NbtCompound).tags['ench'];
          if (enchList?.type === TagType.List) {
            for (const e of (enchList as NbtList).items) {
              if (e.type !== TagType.Compound) continue;
              const et = (e as NbtCompound).tags;
              enchants.push({
                id: et['id']?.type === TagType.Short ? (et['id'] as NbtShort).value : 0,
                lvl: et['lvl']?.type === TagType.Short ? (et['lvl'] as NbtShort).value : 1,
              });
            }
          }
        }
        return { slot, id, count, damage, enchants };
      })
      .sort((a, b) => a.slot - b.slot);
  }, [tags]);

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

      {/* ── active potion effects ─────────────────────────────────── */}
      {activeEffects.length > 0 && (
        <Col span={24}>
          <Card title={<span style={{ color: '#e6edf3' }}>Active Effects</span>} style={cardStyle} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
            <Row gutter={[12, 12]}>
              {activeEffects.map((eff, i) => {
                const info = EFFECT_NAMES[eff.id] ?? { name: `Effect #${eff.id}`, color: '#6e7681' };
                const seconds = Math.floor(eff.duration / 20);
                const min = Math.floor(seconds / 60);
                const sec = seconds % 60;
                return (
                  <Col xs={24} sm={12} md={8} key={i}>
                    <div style={{
                      background: '#0d1117',
                      border: `1px solid ${info.color}44`,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}>
                      <div>
                        <div style={{ color: info.color, fontSize: 13, fontWeight: 600 }}>
                          {info.name} {eff.amplifier > 0 ? toRoman(eff.amplifier + 1) : ''}
                        </div>
                        <div style={{ color: '#484f58', fontSize: 11 }}>
                          {min}:{sec.toString().padStart(2, '0')} remaining
                        </div>
                      </div>
                      {eff.ambient && <Tag color="default" style={{ fontSize: 10 }}>Ambient</Tag>}
                    </div>
                  </Col>
                );
              })}
            </Row>
          </Card>
        </Col>
      )}

      {/* ── ender chest ───────────────────────────────────────────── */}
      <Col span={24}>
        <Card title={<span style={{ color: '#e6edf3' }}>Ender Chest</span>} style={cardStyle} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          {enderItems.length === 0 ? (
            <Empty description={<Text style={{ color: '#484f58' }}>Empty</Text>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Row gutter={[8, 8]}>
              {enderItems.map(item => (
                <Col xs={12} sm={8} md={6} key={item.slot}>
                  <div style={{
                    background: '#0d1117',
                    border: '1px solid #30363d',
                    borderRadius: 6,
                    padding: '8px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}>
                    <ItemIcon itemId={item.id} size={32} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ color: '#e6edf3', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {getItemName(item.id)}
                      </div>
                      <div style={{ color: '#6e7681', fontSize: 11 }}>
                        ×{item.count}
                        {item.damage > 0 ? ` · dmg ${item.damage}` : ''}
                      </div>
                      {item.enchants.length > 0 && (
                        <div style={{ color: '#a78bfa', fontSize: 10, marginTop: 2 }}>
                          {item.enchants.map(e => {
                            const info = ENCHANT_BY_ID[e.id];
                            return info ? `${info.name} ${toRoman(e.lvl)}` : `#${e.id} ${toRoman(e.lvl)}`;
                          }).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </Col>
              ))}
            </Row>
          )}
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
