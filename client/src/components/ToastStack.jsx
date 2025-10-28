import { useEffect } from 'react';
import { useChat } from '../context/ChatContext.jsx';

const ToastStack = () => {
  const {
    state: { toasts },
  } = useChat();

  if (!toasts.length) {
    return null;
  }

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
};

const ToastItem = ({ toast }) => {
  const { actions } = useChat();

  useEffect(() => {
    const timer = setTimeout(() => actions.dismissToast(toast.id), 5000);
    return () => clearTimeout(timer);
  }, [toast.id, actions]);

  return (
    <div className="toast">
      <div className="toast-body">
        {toast.title ? <strong>{toast.title}</strong> : null}
        <span>{toast.message}</span>
      </div>
      <button
        type="button"
        className="toast-dismiss"
        onClick={() => actions.dismissToast(toast.id)}
        aria-label="Dismiss notification"
      >
        ×
      </button>
    </div>
  );
};

export default ToastStack;
