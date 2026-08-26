import { useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface Props {
  onClose: () => void;
  labelledBy: string;
  children: ReactNode;
}

const Modal = ({ onClose, labelledBy, children }: Props) => {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby={labelledBy}>
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default Modal;
