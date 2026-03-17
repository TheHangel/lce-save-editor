import { useMemo } from 'react';
import { Card, Row, Col, Slider, InputNumber, Select, Switch, Space, Typography, Divider, Tag } from 'antd';
import type { LoadedSave } from '../lib/containers';
import { TagType, nbt, cloneNbt, get } from '../lib/nbt';
import type { NbtCompound, NbtString } from '../lib/nbt';

const { Text, Title } = Typography;

interface Props {
  loaded: LoadedSave;
  onUpdate: (updater: (s: LoadedSave) => LoadedSave) => void;
}

export default function WorldTab({ loaded, onUpdate }: Props) {
  if (!loaded.levelNbt) {
    return (
      <div style={{ color: '#6e7681', textAlign: 'center', padding: 40 }}>
        No level.dat found in this save container.
      </div>
    );
  }

  // level.dat root is sometimes wrapped in a "Data" compound — handle both layouts
  const rootTags = loaded.levelNbt.root.tags;
  const dataTags: Record<string, import('../lib/nbt').NbtValue> =
    rootTags['Data']?.type === TagType.Compound
      ? (rootTags['Data'] as NbtCompound).tags
      : rootTags;

  function mutate(fn: (data: Record<string, import('../lib/nbt').NbtValue>) => void) {
    onUpdate(s => {
      if (!s.levelNbt) return s;
      const clone = cloneNbt(s.levelNbt);
      const root = clone.root.tags;
      const data = root['Data']?.type === TagType.Compound
        ? (root['Data'] as NbtCompound).tags
        : root;
      fn(data);
      return { ...s, levelNbt: clone };
    });
  }

  const levelName = useMemo(() => get.str(dataTags, 'LevelName') ?? '', [dataTags]);
  const seed      = useMemo(() => get.long(dataTags, 'RandomSeed') ?? 0n, [dataTags]);
  const dayTime   = useMemo(() => Number(get.long(dataTags, 'DayTime') ?? 0n) % 24000, [dataTags]);
  const raining   = useMemo(() => !!(get.byte(dataTags, 'raining') ?? 0), [dataTags]);
  const thundering= useMemo(() => !!(get.byte(dataTags, 'thundering') ?? 0), [dataTags]);
  const difficulty= useMemo(() => get.byte(dataTags, 'Difficulty') ?? get.int(dataTags, 'Difficulty') ?? 1, [dataTags]);
  const gameType  = useMemo(() => get.int(dataTags, 'GameType') ?? 0, [dataTags]);

  const gameRules = useMemo(() => {
    const gr = dataTags['GameRules'];
    if (gr?.type !== TagType.Compound) return {} as Record<string, string>;
    return Object.fromEntries(
      Object.entries((gr as NbtCompound).tags)
        .filter(([, v]) => v.type === TagType.String)
        .map(([k, v]) => [k, (v as NbtString).value])
    );
  }, [dataTags]);

  function setStr(key: string, v: string)   { mutate(d => { d[key] = nbt.str(v); }); }
  function setInt(key: string, v: number)   { mutate(d => { d[key] = nbt.int(v); }); }
  function setByte(key: string, v: number)  { mutate(d => { d[key] = nbt.byte(v); }); }
  function setLong(key: string, v: bigint)  { mutate(d => { d[key] = nbt.long(v); }); }
  function setDayTime(v: number) {
    mutate(d => { d['DayTime'] = nbt.long(BigInt(v)); });
  }
  function setGameRule(rule: string, enabled: boolean) {
    mutate(d => {
      let gr = d['GameRules'];
      if (!gr || gr.type !== TagType.Compound) {
        gr = nbt.compound({});
        d['GameRules'] = gr;
      }
      (gr as NbtCompound).tags[rule] = nbt.str(enabled ? 'true' : 'false');
    });
  }

  const timeOfDay = (t: number) => {
    if (t < 1000 || t >= 23000) return 'Dawn';
    if (t < 6000) return 'Morning';
    if (t < 12000) return 'Afternoon';
    if (t < 13000) return 'Dusk';
    return 'Night';
  };

  const cardStyle = {
    background: '#161b22',
    border: '1px solid #30363d',
    borderRadius: 8,
  };

  const GAME_RULES: Array<{ key: string; label: string; desc: string }> = [
    { key: 'keepInventory',     label: 'Keep Inventory',     desc: 'Items kept on death' },
    { key: 'doMobSpawning',     label: 'Mob Spawning',       desc: 'Hostile/passive mobs spawn' },
    { key: 'mobGriefing',       label: 'Mob Griefing',       desc: 'Creepers & endermen can modify terrain' },
    { key: 'doFireTick',        label: 'Fire Spreading',     desc: 'Fire spreads to adjacent blocks' },
    { key: 'doDaylightCycle',   label: 'Daylight Cycle',     desc: 'Time of day advances' },
    { key: 'doMobLoot',         label: 'Mob Loot',           desc: 'Mobs drop items on death' },
    { key: 'doTileDrops',       label: 'Block Drops',        desc: 'Blocks drop items when broken' },
    { key: 'naturalRegeneration', label: 'Natural Regen',   desc: 'Health regenerates when food is full' },
  ];

  return (
    <Row gutter={[16, 16]}>
      {/* ── world info ─────────────────────────────────────────── */}
      <Col span={24}>
        <Card title={<span style={{ color: '#e6edf3' }}>World Info</span>} style={cardStyle} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <div style={{ marginBottom: 12 }}>
                <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 6 }}>World Name</div>
                <input
                  value={levelName}
                  onChange={e => setStr('LevelName', e.target.value)}
                  style={{
                    width: '100%', background: '#0d1117', border: '1px solid #30363d',
                    borderRadius: 6, padding: '6px 10px', color: '#e6edf3', fontSize: 14,
                    outline: 'none',
                  }}
                />
              </div>
            </Col>
            <Col xs={24} md={12}>
              <div>
                <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 6 }}>Seed</div>
                <input
                  value={seed.toString()}
                  onChange={e => {
                    try { setLong('RandomSeed', BigInt(e.target.value)); } catch { /* ignore non-numeric input */ }
                  }}
                  style={{
                    width: '100%', background: '#0d1117', border: '1px solid #30363d',
                    borderRadius: 6, padding: '6px 10px', color: '#4ade80',
                    fontFamily: 'monospace', fontSize: 13, outline: 'none',
                  }}
                />
              </div>
            </Col>
          </Row>
        </Card>
      </Col>

      {/* ── time & weather ────────────────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<span style={{ color: '#e6edf3' }}>Time &amp; Weather</span>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div className="flex justify-between mb-2">
                <Text style={{ color: '#6e7681', fontSize: 12 }}>Time of Day (0 – 24000)</Text>
                <Tag color="blue">{timeOfDay(dayTime)}</Tag>
              </div>
              <Slider
                value={dayTime} min={0} max={23999}
                onChange={setDayTime}
                trackStyle={{ background: dayTime < 13000 ? '#facc15' : '#3b82f6' }}
              />
              <div className="flex gap-2 flex-wrap">
                {[['Dawn', 0], ['Noon', 6000], ['Midnight', 18000]].map(([label, val]) => (
                  <button
                    key={String(val)}
                    onClick={() => setDayTime(Number(val))}
                    style={{
                      background: '#0d1117', border: '1px solid #30363d',
                      color: '#e6edf3', borderRadius: 4, padding: '2px 8px',
                      cursor: 'pointer', fontSize: 12,
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <Divider style={{ borderColor: '#30363d', margin: '4px 0' }} />

            <div className="flex justify-between items-center">
              <Text style={{ color: '#e6edf3' }}>Raining</Text>
              <Switch
                checked={raining}
                onChange={v => setByte('raining', v ? 1 : 0)}
                style={{ background: raining ? '#60a5fa' : undefined }}
              />
            </div>
            <div className="flex justify-between items-center">
              <Text style={{ color: '#e6edf3' }}>Thunderstorm</Text>
              <Switch
                checked={thundering}
                onChange={v => { setByte('thundering', v ? 1 : 0); if (v) setByte('raining', 1); }}
                style={{ background: thundering ? '#a78bfa' : undefined }}
              />
            </div>
          </Space>
        </Card>
      </Col>

      {/* ── difficulty & game mode ───────────────────────────────── */}
      <Col xs={24} md={12} style={{ display: 'flex', flexDirection: 'column' }}>
        <Card title={<span style={{ color: '#e6edf3' }}>Difficulty &amp; Mode</span>} style={{ ...cardStyle, flex: 1 }} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          <Space direction="vertical" style={{ width: '100%' }} size={16}>
            <div>
              <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 8 }}>Difficulty</div>
              <Select
                value={difficulty}
                style={{ width: '100%' }}
                onChange={v => setByte('Difficulty', v)}
                options={[
                  { value: 0, label: 'Peaceful' },
                  { value: 1, label: 'Easy' },
                  { value: 2, label: 'Normal' },
                  { value: 3, label: 'Hard' },
                ]}
              />
            </div>
            <div>
              <div style={{ color: '#6e7681', fontSize: 12, marginBottom: 8 }}>Default Game Mode</div>
              <Select
                value={gameType}
                style={{ width: '100%' }}
                onChange={v => setInt('GameType', v)}
                options={[
                  { value: 0, label: 'Survival' },
                  { value: 1, label: 'Creative' },
                  { value: 2, label: 'Adventure' },
                ]}
              />
            </div>
          </Space>
        </Card>
      </Col>

      {/* ── game rules ───────────────────────────────────────────── */}
      <Col span={24}>
        <Card title={<span style={{ color: '#e6edf3' }}>Game Rules</span>} style={cardStyle} styles={{ header: { borderBottom: '1px solid #30363d' } }}>
          {Object.keys(gameRules).length === 0 ? (
            <Text style={{ color: '#484f58' }}>No game rules found in level.dat.</Text>
          ) : (
            <Row gutter={[12, 12]}>
              {GAME_RULES.map(({ key, label, desc }) => {
                const val = gameRules[key];
                if (val === undefined) return null;
                const enabled = val === 'true';
                return (
                  <Col xs={24} sm={12} md={8} key={key}>
                    <div
                      style={{
                        background: '#0d1117',
                        border: `1px solid ${enabled ? '#4ade8033' : '#30363d'}`,
                        borderRadius: 6,
                        padding: '10px 12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 8,
                      }}
                    >
                      <div>
                        <div style={{ color: '#e6edf3', fontSize: 13, fontWeight: 500 }}>{label}</div>
                        <div style={{ color: '#484f58', fontSize: 11 }}>{desc}</div>
                      </div>
                      <Switch
                        size="small"
                        checked={enabled}
                        onChange={v => setGameRule(key, v)}
                        style={{ flexShrink: 0, background: enabled ? '#4ade80' : undefined }}
                      />
                    </div>
                  </Col>
                );
              })}
              {/* unknown game rules found in the save — show them as plain toggles */}
              {Object.entries(gameRules)
                .filter(([k]) => !GAME_RULES.some(r => r.key === k))
                .map(([key, val]) => {
                  const enabled = val === 'true';
                  return (
                    <Col xs={24} sm={12} md={8} key={key}>
                      <div
                        style={{
                          background: '#0d1117',
                          border: `1px solid ${enabled ? '#4ade8033' : '#30363d'}`,
                          borderRadius: 6,
                          padding: '10px 12px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Text style={{ color: '#e6edf3', fontSize: 12, fontFamily: 'monospace' }}>{key}</Text>
                        <Switch
                          size="small"
                          checked={enabled}
                          onChange={v => setGameRule(key, v)}
                          style={{ background: enabled ? '#4ade80' : undefined }}
                        />
                      </div>
                    </Col>
                  );
                })}
            </Row>
          )}
        </Card>
      </Col>
    </Row>
  );
}
