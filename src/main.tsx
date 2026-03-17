import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider, theme } from 'antd';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#4ade80',
          colorBgBase: '#0d1117',
          colorBgContainer: '#161b22',
          borderRadius: 6,
          fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif",
        },
      }}
    >
      <App />
    </ConfigProvider>
  </React.StrictMode>
);
