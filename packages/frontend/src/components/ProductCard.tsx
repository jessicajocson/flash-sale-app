import productImage from "../assets/product-shoe.jpg";
import { formatCountdownParts } from "../utils/format";
import type { SaleStatusResponse } from "../interfaces";

interface Props {
  status: SaleStatusResponse | null;
  timeRemainingMs: number;
  loading: boolean;
  error: boolean;
  hasPurchased: boolean;
  securedEmail: string;
  onResetIdentity: () => void;
  onBuyClick: () => void;
}

const COMPARE_AT_MULTIPLIER = 1.65;

const ProductCard = ({
  status,
  timeRemainingMs,
  loading,
  error,
  hasPurchased,
  securedEmail,
  onResetIdentity,
  onBuyClick,
}: Props) => {
  const item = status?.item ?? null;
  const saleStatus = status?.status;
  const stockRemaining = status?.stockRemaining ?? 0;
  const unreachable = !loading && !item;
  const stale = error && !unreachable;

  const soldOut = saleStatus === "active" && stockRemaining <= 0;
  const canBuy = !!item && saleStatus === "active" && !soldOut && !hasPurchased;
  const stockPercent =
    item && item.originalStock > 0
      ? Math.max(0, Math.min(100, Math.round((stockRemaining / item.originalStock) * 100)))
      : 0;
  const lowStock = item ? stockRemaining <= Math.max(10, item.originalStock * 0.15) : false;

  const showCountdown = !!item && (saleStatus === "upcoming" || (saleStatus === "active" && !soldOut));
  const countdown = formatCountdownParts(timeRemainingMs);

  const pillVariant = saleStatus === "active" && soldOut ? "soldout" : saleStatus;
  const livePillLabel =
    saleStatus === "upcoming"
      ? "Starts soon"
      : saleStatus === "active"
        ? soldOut
          ? "Sold out"
          : null
        : saleStatus === "ended"
          ? "Sale ended"
          : null;

  const buttonLabel = !item
    ? unreachable
      ? "Unavailable"
      : "Loading…"
    : hasPurchased
      ? "Already secured"
      : saleStatus === "upcoming"
        ? "Not open yet"
        : saleStatus === "ended"
          ? "Sale ended"
          : soldOut
            ? "Sold out"
            : "Buy now →";

  const priceValue = item ? (typeof item.price === "string" ? parseFloat(item.price) : item.price) : 0;
  const compareAtPrice = priceValue * COMPARE_AT_MULTIPLIER;
  const [nameLead, nameAccent] = item ? item.name.split(" — ") : ["", ""];

  return (
    <>
      <div className="sale-header">
        {livePillLabel && (
          <span className={`live-pill live-pill--${pillVariant}`}>
            <span className="live-dot" aria-hidden="true" />
            {livePillLabel}
          </span>
        )}
        <h1 className="sale-heading">
          Flash <span>Sale</span>
        </h1>
      </div>

      {showCountdown && (
        <div className="countdown-boxes">
          <div className="countdown-unit">
            <span className="countdown-value">{countdown.hours}</span>
            <span className="countdown-label">Hrs</span>
          </div>
          <span className="countdown-colon">:</span>
          <div className="countdown-unit">
            <span className="countdown-value">{countdown.minutes}</span>
            <span className="countdown-label">Min</span>
          </div>
          <span className="countdown-colon">:</span>
          <div className="countdown-unit">
            <span className="countdown-value">{countdown.seconds}</span>
            <span className="countdown-label">Sec</span>
          </div>
        </div>
      )}

      <div className="product-card">
        <div className="product-image-wrap">
          <img src={productImage} alt={item?.name ?? "Featured product"} className="product-image" />
          <div className="product-image-fade" aria-hidden="true" />
          {saleStatus && (
            <span className={`status-badge status-badge--${saleStatus}`}>
              {saleStatus === "upcoming" && "Upcoming"}
              {saleStatus === "active" && (soldOut ? "Sold out" : "On sale")}
              {saleStatus === "ended" && "Ended"}
            </span>
          )}
          {item && (
            <div className="price-overlay">
              <span className="price-overlay-now">${Math.round(priceValue)}</span>
              <span className="price-overlay-was">${Math.round(compareAtPrice)}</span>
            </div>
          )}
        </div>

        <div className="product-info">
          {item ? (
            <h2 className="item-name">
              {nameLead}
              {nameAccent && (
                <>
                  <br />
                  <span className="item-name-accent">{nameAccent}</span>
                </>
              )}
            </h2>
          ) : (
            <div className="skeleton skeleton-title" aria-hidden="true" />
          )}

          {item ? (
            <p className="item-description">
              Retro-inspired mesh runner in a limited sunset colorway — lightweight cushioning, built
              for everyday miles.
            </p>
          ) : (
            <div className="skeleton skeleton-price" aria-hidden="true" />
          )}

          {item && saleStatus === "active" && !soldOut && (
            <div className="stock-meter">
              <div className="stock-meter-row">
                <span className="stock-meter-label">Stock remaining</span>
                <span className={`stock-count${lowStock ? " stock-count--low" : ""}`}>
                  {stockRemaining} / {item.originalStock} left
                </span>
              </div>
              <div className="stock-bar">
                <div className="stock-bar-fill" style={{ width: `${stockPercent}%` }} />
              </div>
            </div>
          )}

          {item && saleStatus === "active" && soldOut && (
            <p className="status-line">Every unit has been claimed.</p>
          )}
          {item && saleStatus === "ended" && <p className="status-line">This sale has ended.</p>}
          {!item && loading && <p className="status-line">Checking sale status…</p>}
          {unreachable && (
            <p className="status-line status-line--error">
              Could not connect to the server. Retrying…
            </p>
          )}
          {stale && (
            <p className="status-line status-line--error">
              Showing last known status — having trouble reaching the server. Retrying…
            </p>
          )}

          <button type="button" className="buy-button" disabled={!canBuy} onClick={onBuyClick}>
            {buttonLabel}
          </button>

          {hasPurchased && (
            <p className="identity-hint">
              Secured as {securedEmail}. Not you?{" "}
              <button type="button" className="reset-identity-link" onClick={onResetIdentity}>
                Reset
              </button>
            </p>
          )}
          <p className="card-footnote">One item per person, while supplies last.</p>
        </div>
      </div>
    </>
  );
};

export default ProductCard;
