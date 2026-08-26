import { useState } from "react";
import { useSaleStatus } from "./store/hooks/useSaleStatus";
import { useTheme } from "./store/hooks/useTheme";
import { useUserId } from "./auth/useUserId";
import ProductCard from "./components/ProductCard";
import PurchaseModal from "./components/PurchaseModal";
import { formatPrice } from "./utils/format";

const App = () => {
  const { data, timeRemainingMs, loading, refresh } = useSaleStatus();
  const userIdState = useUserId();
  const { theme, toggleTheme } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <main className="page">
      <button
        type="button"
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
          </svg>
        )}
      </button>

      <ProductCard
        status={data}
        timeRemainingMs={timeRemainingMs}
        loading={loading}
        hasPurchased={userIdState.hasPurchased}
        securedEmail={userIdState.trimmedUserId}
        onResetIdentity={userIdState.resetUserId}
        onBuyClick={() => setIsModalOpen(true)}
      />
      <p className="footnote">All sales final. Ships within 3–5 business days.</p>

      {isModalOpen && (
        <PurchaseModal
          itemName={data?.item?.name ?? "this item"}
          price={data?.item ? formatPrice(data.item.price) : ""}
          userIdState={userIdState}
          onClose={() => setIsModalOpen(false)}
          onPurchased={refresh}
        />
      )}
    </main>
  );
};

export default App;
