import { useState, useCallback, useEffect } from 'react';
import { Layout, Tabs, Button, Typography, Space, Tag, message, Tooltip, Modal } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import {
  DownloadOutlined,
  ReloadOutlined,
  DatabaseOutlined,
  UserOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import type { LoadedSave } from './lib/containers';
import { loadSaveFile, buildSaveBytes } from './lib/containers';
import { cloneNbt } from './lib/nbt';
import FileDropZone from './components/FileDropZone';
import InventoryTab from './components/InventoryTab';
import PlayerStatsTab from './components/PlayerStatsTab';
import WorldTab from './components/WorldTab';

const { Header, Content, Footer } = Layout;
const { Title, Text, Link } = Typography;

const BACKUP_ACK_KEY = 'lce_backup_acknowledged';

export default function App() {
  const [loaded, setLoaded] = useState<LoadedSave | null>(null);
  const [loading, setLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [msgApi, contextHolder] = message.useMessage();
  const [showBackupModal, setShowBackupModal] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem(BACKUP_ACK_KEY)) {
      setShowBackupModal(true);
    }
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const save = await loadSaveFile(file);
      setLoaded(save);
      setDirty(false);
      msgApi.success(`Loaded ${file.name} — ${save.container?.entries.length ?? 1} embedded file(s)`);
    } catch (err) {
      msgApi.error(String(err));
    } finally {
      setLoading(false);
    }
  }, [msgApi]);

  const handleDownload = useCallback(() => {
    if (!loaded) return;
    try {
      const bytes = buildSaveBytes(loaded);
      const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = loaded.filename;
      a.click();
      URL.revokeObjectURL(url);
      setDirty(false);
      msgApi.success(`Downloaded ${loaded.filename}`);
    } catch (err) {
      msgApi.error(`Save failed: ${err}`);
    }
  }, [loaded, msgApi]);

  const updatePlayerNbt = useCallback((updater: (s: LoadedSave) => LoadedSave) => {
    setLoaded(prev => prev ? updater(prev) : prev);
    setDirty(true);
  }, []);

  const updateLevelNbt = useCallback((updater: (s: LoadedSave) => LoadedSave) => {
    setLoaded(prev => prev ? updater(prev) : prev);
    setDirty(true);
  }, []);

  const handleReset = useCallback(() => {
    setLoaded(null);
    setDirty(false);
  }, []);

  const tabItems = loaded ? [
    {
      key: 'inventory',
      label: <span style={{ fontFamily: 'Mojangles, sans-serif' }}><DatabaseOutlined /> Inventory</span>,
      children: (
        <InventoryTab
          loaded={loaded}
          onUpdate={updatePlayerNbt}
        />
      ),
    },
    {
      key: 'player',
      label: <span style={{ fontFamily: 'Mojangles, sans-serif' }}><UserOutlined /> Player Stats</span>,
      children: (
        <PlayerStatsTab
          loaded={loaded}
          onUpdate={updatePlayerNbt}
        />
      ),
    },
    ...(loaded.levelNbt ? [{
      key: 'world',
      label: <span style={{ fontFamily: 'Mojangles, sans-serif' }}><GlobalOutlined /> World</span>,
      children: (
        <WorldTab
          loaded={loaded}
          onUpdate={updateLevelNbt}
        />
      ),
    }] : []),
  ] : [];

  return (
    <Layout className="min-h-screen" style={{ background: '#0d1117' }}>
      {contextHolder}

      <Modal
        open={showBackupModal}
        closable={false}
        maskClosable={false}
        footer={null}
        styles={{ mask: { backdropFilter: 'blur(4px)' } }}
        style={{ top: '30%' }}
      >
        <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
          <WarningOutlined style={{ fontSize: 36, color: '#f59e0b', marginBottom: 12 }} />
          <Title level={4} style={{ marginBottom: 12 }}>Back up your saves first</Title>
          <Text style={{ display: 'block', color: '#6e7681', marginBottom: 20, lineHeight: 1.7 }}>
            Editing save data directly can corrupt your world if something goes wrong.
            Before making any changes, copy your save files to a safe location.
          </Text>
          <Button
            type="primary"
            size="large"
            style={{ width: '100%' }}
            onClick={() => {
              localStorage.setItem(BACKUP_ACK_KEY, '1');
              setShowBackupModal(false);
            }}
          >
            I've backed up my saves — continue
          </Button>
        </div>
      </Modal>

      <Header
        style={{
          background: '#161b22',
          borderBottom: '1px solid #30363d',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
        }}
      >
        <Space align="center" size={10}>
          <img src="/assets/hud/MinecraftIcon.png" alt="Minecraft"
            style={{ width: 32, height: 32, imageRendering: 'pixelated', objectFit: 'contain', display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%' }}
            onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
          <Title level={5} style={{ margin: 0, color: '#4ade80', letterSpacing: 0.5, fontFamily: 'Mojangles, sans-serif' }}>
            LCE Save Editor
          </Title>
          {loaded && (
            <Tag color="geekblue" style={{ fontFamily: 'monospace', fontSize: 11 }}>
              {loaded.filename}
            </Tag>
          )}
          {dirty && <Tag color="gold">Unsaved changes</Tag>}
        </Space>

        {loaded && (
          <Space>
            <Tooltip title="Load a different file">
              <Button
                icon={<ReloadOutlined />}
                size="small"
                onClick={handleReset}
                style={{ borderColor: '#30363d' }}
              >
                New File
              </Button>
            </Tooltip>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              size="small"
              onClick={handleDownload}
              style={{ background: dirty ? '#4ade80' : undefined }}
            >
              Download{dirty ? ' *' : ''}
            </Button>
          </Space>
        )}
      </Header>

      <Content style={{ padding: '24px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>
        {!loaded ? (
          <div className="flex flex-col items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
            <div className="mb-6 text-center">
              <Title level={3} style={{ color: '#e6edf3', marginBottom: 8 }}>
                Open a Minecraft LCE save file
              </Title>
              <Text style={{ color: '#6e7681' }}>
                Supports <code>.ms</code> container saves and plain player <code>.dat</code> files
              </Text>
            </div>
            <FileDropZone onFile={handleFile} loading={loading} />
            <div style={{ marginTop: 12, color: '#484f58', fontSize: 12 }}>
              Default save location: <code style={{ color: '#6e7681' }}>.\Windows64\GameHDD\</code>
            </div>
            <div className="mt-8 grid grid-cols-3 gap-4 text-center" style={{ maxWidth: 600 }}>
              {[
                { img: '/assets/hud/HUD/hotbar_item_back.png', label: 'Edit Inventory', desc: 'Damage, count, enchants, repair all, give items' },
                { img: '/assets/hud/HUD/Health_Full.png',      label: 'Player Stats',   desc: 'Health, hunger, XP, position, game mode' },
                { img: '/assets/hud/SaveChest.png',             label: 'World Settings', desc: 'Time, weather, difficulty, game rules, seed' },
              ].map(f => (
                <div
                  key={f.label}
                  style={{
                    background: '#161b22',
                    border: '1px solid #30363d',
                    borderRadius: 8,
                    padding: '16px 12px',
                  }}
                >
                  <div style={{ marginBottom: 8 }}>
                    <img src={f.img} alt={f.label} style={{ height: "32px", objectFit: 'contain', imageRendering: 'pixelated', display: 'inline-block', verticalAlign: 'middle', maxWidth: '100%' }} />
                  </div>
                  <div style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4, fontSize: 13, fontFamily: 'Mojangles, sans-serif' }}>{f.label}</div>
                  <div style={{ color: '#6e7681', fontSize: 12 }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Tabs
            defaultActiveKey="inventory"
            items={tabItems}
            style={{ minHeight: 'calc(100vh - 120px)' }}
          />
        )}
      </Content>

      <Footer style={{
        background: '#0d1117',
        borderTop: '1px solid #21262d',
        padding: '14px 24px',
        textAlign: 'center',
      }}>
        <Text style={{ color: '#484f58', fontSize: 11, lineHeight: 1.8, display: 'block' }}>
          <Link href="https://github.com/justinrest/lce-save-editor" target="_blank" style={{ fontSize: 11, color: '#484f58', textDecoration: 'underline' }}>
            source on github
          </Link>
          {' · '}game assets sourced from the{' '}
          <Link href="https://archive.org/details/minecraft-legacy-console-edition-source-code" target="_blank" style={{ fontSize: 11, color: '#484f58', textDecoration: 'underline' }}>
            Minecraft LCE
          </Link>
          {' '}via the Internet Archive.
          All Minecraft assets, names, and intellectual property are the copyright of Mojang Studios / Microsoft.
          This tool is an unofficial fan project and is not affiliated with or endorsed by Mojang or Microsoft.
        </Text>
      </Footer>
    </Layout>
  );
}

// re-export cloneNbt so components can import it from App if they want
export { cloneNbt };
