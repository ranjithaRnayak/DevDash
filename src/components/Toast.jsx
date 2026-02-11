import { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

let toastIdCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((toast) => {
    const id = `toast-${Date.now()}-${++toastIdCounter}`;
    setToasts((prev) => [...prev, { ...toast, id }]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div style={styles.container}>
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }) {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (toast.duration !== 0) {
      const timer = setTimeout(() => {
        setIsExiting(true);
        setTimeout(onDismiss, 300);
      }, toast.duration || 8000);
      return () => clearTimeout(timer);
    }
  }, [toast.duration, onDismiss]);

  const handleDismiss = () => {
    setIsExiting(true);
    toast.onDismiss?.();
    setTimeout(onDismiss, 300);
  };

  const iconMap = {
    PRCreated: '🔀',
    DraftPRCreated: '📝',
    PipelineSucceeded: '✅',
    info: 'ℹ️',
  };

  return (
    <div style={{ ...styles.toast, ...(isExiting ? styles.toastExiting : {}) }}>
      <div style={styles.toastContent}>
        <span style={styles.icon}>{iconMap[toast.type] || iconMap.info}</span>
        <div style={styles.textContent}>
          <div style={styles.title}>{toast.title}</div>
          <div style={styles.description}>{toast.description}</div>
          <div style={styles.author}>by {toast.author}</div>
        </div>
      </div>
      <div style={styles.actions}>
        {toast.url && (
          <a
            href={toast.url}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.viewButton}
          >
            View
          </a>
        )}
        <button onClick={handleDismiss} style={styles.dismissButton}>
          Dismiss
        </button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    position: 'fixed',
    bottom: '20px',
    right: '20px',
    zIndex: 9999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    maxWidth: '400px',
  },
  toast: {
    background: '#1e1e1e',
    border: '1px solid #333',
    borderRadius: '8px',
    padding: '12px 16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    animation: 'slideIn 0.3s ease-out',
    transition: 'all 0.3s ease',
  },
  toastExiting: {
    opacity: 0,
    transform: 'translateX(100%)',
  },
  toastContent: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '12px',
  },
  icon: {
    fontSize: '20px',
    flexShrink: 0,
  },
  textContent: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: '#fff',
    fontWeight: 600,
    fontSize: '14px',
    marginBottom: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  description: {
    color: '#aaa',
    fontSize: '12px',
    marginBottom: '2px',
  },
  author: {
    color: '#666',
    fontSize: '11px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    marginTop: '10px',
    justifyContent: 'flex-end',
  },
  viewButton: {
    background: '#0078d4',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  dismissButton: {
    background: 'transparent',
    color: '#888',
    border: '1px solid #444',
    borderRadius: '4px',
    padding: '6px 12px',
    fontSize: '12px',
    cursor: 'pointer',
  },
};

const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100%);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
`;
document.head.appendChild(styleSheet);

export default ToastProvider;
