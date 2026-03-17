import { useRef, useState, useCallback } from 'react';
import { Spin } from 'antd';
import { InboxOutlined } from '@ant-design/icons';

interface Props {
  onFile: (file: File) => void;
  loading: boolean;
}

export default function FileDropZone({ onFile, loading }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  }, [onFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFile(file);
  }, [onFile]);

  return (
    <div
      onClick={() => !loading && inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={dragging ? 'drop-active' : ''}
      style={{
        width: 480,
        height: 200,
        border: `2px dashed ${dragging ? '#4ade80' : '#30363d'}`,
        borderRadius: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: loading ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
        background: dragging ? 'rgba(74,222,128,0.04)' : '#161b22',
        userSelect: 'none',
      }}
    >
      {loading ? (
        <Spin size="large" />
      ) : (
        <>
          <InboxOutlined style={{ fontSize: 48, color: dragging ? '#4ade80' : '#30363d', marginBottom: 12 }} />
          <div style={{ color: '#e6edf3', fontWeight: 600, marginBottom: 4 }}>
            Drop your save file here
          </div>
          <div style={{ color: '#6e7681', fontSize: 13 }}>
            or click to browse — <code>.ms</code> / <code>.dat</code>
          </div>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={handleChange}
      />
    </div>
  );
}
