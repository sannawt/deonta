import type { ProductRecord } from "../lib/productStore";
import { ProductPage } from "../components/product/ProductPage";
import { ProductsLibrary } from "../components/product/ProductsLibrary";

interface Props {
  products: ProductRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNewProduct: () => void;
}

export function ProductsPage({ products, activeId, onSelect, onNewProduct }: Props) {
  const active = products.find((p) => p.id === activeId) ?? products[0] ?? null;

  return (
    <div className="ct-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1 className="ct-page-title">My products</h1>
        <button type="button" className="ct-btn-primary" onClick={onNewProduct}>
          New product
        </button>
      </div>
      <ProductsLibrary products={products} onOpen={onSelect} />
      {active ? (
        <div style={{ marginTop: 16 }}>
          <ProductPage product={active} />
        </div>
      ) : (
        <div className="empty" style={{ marginTop: 24 }}>
          No products yet. Start the product workflow to create an applicability record.
        </div>
      )}
    </div>
  );
}
