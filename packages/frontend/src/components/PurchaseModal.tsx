import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import Modal from "./Modal";
import { fetchCsrfToken, submitPurchase } from "../utils/requests/flash-sale.request";
import { toApiFailure } from "../utils/fetch";
import type { useUserId } from "../auth/useUserId";

interface Feedback {
  tone: "success" | "error" | "info";
  message: string;
}

const AUTO_CLOSE_MS = 10_000;

interface Props {
  itemName: string;
  price: string;
  userIdState: ReturnType<typeof useUserId>;
  onClose: () => void;
  onPurchased: () => void;
}

const PurchaseModal = ({ itemName, price, userIdState, onClose, onPurchased }: Props) => {
  const { userId, setUserId, trimmedUserId, isValidUserId, hasPurchased, setHasPurchased } =
    userIdState;
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  async function handleBuy(e: FormEvent) {
    e.preventDefault();

    if (!isValidUserId) {
      setFeedback({
        tone: "error",
        message: "Enter a valid email address.",
      });
      return;
    }

    setLoading(true);
    setFeedback(null);

    try {
      const { token } = await fetchCsrfToken();
      const result = await submitPurchase(trimmedUserId, token);
      setHasPurchased(true);
      setFeedback({ tone: "success", message: result.message });
      onPurchased();
    } catch (error) {
      const failure = toApiFailure(error);

      if (/already purchased/i.test(failure.message)) {
        setHasPurchased(true);
        setFeedback({ tone: "info", message: "You've already secured this item." });
      } else if (failure.errorCode === "RATE_LIMITED") {
        setFeedback({
          tone: "info",
          message: "You're going a bit fast — wait a few seconds and try again.",
        });
      } else if (failure.errorCode === "CIRCUIT_OPEN" || failure.errorCode === "LOAD_SHED") {
        setFeedback({
          tone: "info",
          message: "Demand is very high right now — please try again in a moment.",
        });
      } else if (failure.errorCode === "INVALID_CSRF") {
        setFeedback({ tone: "error", message: "Your session expired — please try again." });
      } else {
        setFeedback({ tone: "error", message: failure.message });
      }

      onPurchased();
    } finally {
      setLoading(false);
    }
  }

  const secured = feedback?.tone === "success" || (hasPurchased && feedback?.tone === "info");

  useEffect(() => {
    if (!secured) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [secured, onClose]);

  return (
    <Modal onClose={onClose} labelledBy="purchase-modal-title">
      <div className="modal-top-row">
        {!secured && <span className="modal-eyebrow">Secure checkout</span>}
        <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
          &times;
        </button>
      </div>

      {secured ? (
        <div className="purchase-result">
          <div className="purchase-result-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 id="purchase-modal-title" className="modal-title">
            {feedback?.tone === "success" ? "Purchase successful!" : "You're in!"}
          </h2>
          <p className="feedback-line feedback-line--success">{feedback?.message}</p>
          <p className="purchase-result-meta">
            {itemName} · {price}
          </p>
          <button type="button" className="buy-button buy-button--secondary" onClick={onClose}>
            Okay
          </button>
          <p className="purchase-result-hint">This closes automatically in a few seconds.</p>
        </div>
      ) : (
        <>
          <h2 id="purchase-modal-title" className="modal-title">
            Claim your pair
          </h2>
          <p className="modal-subtitle">
            {itemName} · {price}
          </p>

          <form className="purchase-form" onSubmit={handleBuy} noValidate>
            <label className="field-label" htmlFor="userId">
              Email address
            </label>
            <input
              id="userId"
              className="text-input"
              type="email"
              placeholder="you@example.com"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={loading}
              autoComplete="email"
              autoFocus
            />

            <div className="feedback" aria-live="polite">
              {feedback && (
                <p className={`feedback-line feedback-line--${feedback.tone}`}>{feedback.message}</p>
              )}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="buy-button buy-button--outline"
                onClick={onClose}
                disabled={loading}
              >
                Cancel
              </button>
              <button type="submit" className="buy-button" disabled={loading}>
                {loading ? "Processing…" : "Confirm purchase"}
              </button>
            </div>

            <p className="modal-footnote">🔒 Secure · One item per person · While supplies last</p>
          </form>
        </>
      )}
    </Modal>
  );
};

export default PurchaseModal;
