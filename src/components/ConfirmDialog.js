'use client';

import { useEffect } from 'react';
import './ConfirmDialog.css';

export default function ConfirmDialog({
  isOpen,
  title = '提示',
  message,
  confirmText = '确定',
  cancelText = '取消',
  onConfirm,
  onCancel,
  type = 'danger' // 'default' | 'danger'
}) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  return (
    <div 
      className={`confirm-modal-overlay ${isOpen ? 'open' : ''}`} 
      onClick={onCancel}
    >
      <div 
        className="confirm-modal-card" 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
      >
        <div className="confirm-modal-content">
          <h3 id="confirm-dialog-title" className="confirm-modal-title">
            {title}
          </h3>
          <p id="confirm-dialog-message" className="confirm-modal-message">
            {message}
          </p>
        </div>
        <div className="confirm-modal-divider"></div>
        <div className="confirm-modal-actions">
          <button 
            id="confirm-dialog-cancel-btn"
            className="confirm-modal-btn cancel" 
            onClick={onCancel}
          >
            {cancelText}
          </button>
          <div className="confirm-modal-btn-divider"></div>
          <button
            id="confirm-dialog-confirm-btn"
            className={`confirm-modal-btn ${type === 'danger' ? 'confirm-danger' : 'confirm-default'}`}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
