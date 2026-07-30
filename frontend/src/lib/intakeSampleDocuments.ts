export interface IntakeSampleDocument {
  id: string;
  label: string;
  filename: string;
  content: string;
}

export const INTAKE_SAMPLE_DOCUMENTS: IntakeSampleDocument[] = [
  {
    id: "privacy_policy",
    label: "Privacy policy",
    filename: "example-privacy-policy.txt",
    content: `Example Privacy Policy — Acme Analytics Ltd

Acme Analytics Ltd ("we") is the controller for personal data processed through our SaaS analytics platform.

We process customer account data, usage logs, and support emails for users in the EU, UK, and US. Data is stored on AWS in the EU (Frankfurt). We use subprocessors for email delivery and customer support tooling.

Contact: privacy@acme-analytics.example`,
  },
  {
    id: "product_spec",
    label: "Product specifications",
    filename: "example-product-specifications.txt",
    content: `Product: InsightHub Platform
Provider: Acme Analytics Ltd

InsightHub is a B2B SaaS dashboard for retail operators. It aggregates sales and inventory feeds, supports role-based access, and offers optional ML-based demand forecasting for enterprise tenants.

Markets: EU and UK. Hosted in EU cloud infrastructure.`,
  },
  {
    id: "terms_of_service",
    label: "Terms of service",
    filename: "example-terms-of-service.txt",
    content: `Terms of Service — InsightHub

These terms govern use of the InsightHub platform operated by Acme Analytics Ltd, established in Ireland.

Business customers in the EU and EEA subscribe under annual contracts. The service includes web access, API integrations, and standard support.`,
  },
  {
    id: "dpa",
    label: "Data processing agreements",
    filename: "example-data-processing-agreement.txt",
    content: `Data Processing Agreement (excerpt)

Acme Analytics Ltd acts as processor for customer-uploaded datasets. Processing purposes: hosting, analytics, and reporting. Categories of data subjects: customers' end users and employees. Personal data may include identifiers, transaction metadata, and support correspondence.

Subprocessors are listed in Annex II. Data remains in the EEA unless otherwise agreed.`,
  },
];

export function downloadIntakeSample(doc: IntakeSampleDocument): void {
  const blob = new Blob([doc.content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = doc.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
