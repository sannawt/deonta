import type { ProductRecord } from "../../lib/productStore";
import { AssessmentResults } from "./AssessmentResults";

interface Props {
  product: ProductRecord;
}

export function ProductPage({ product }: Props) {
  const resp = product.lastAssessment?.response ?? null;

  return (
    <div className="ct-block">
      <h2 className="ct-card-title">{product.label}</h2>
      <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
        {product.spec.summary || "No description"}
      </p>
      {resp ? (
        <AssessmentResults
          productId={product.id}
          productLabel={product.label}
          response={resp}
        />
      ) : (
        <div className="empty">No assessment yet. Run the product workflow.</div>
      )}
    </div>
  );
}

