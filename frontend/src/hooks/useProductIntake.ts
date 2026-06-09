import { useCallback, useRef, useState } from "react";
import {
  applyDerivedDataAi,
  EMPTY_INTAKE,
  hasStructuredIntake,
  intakeToDescription,
  mapMissingPredicates,
  mergeIntakeState,
  narrativeFromStructured,
  type IntakeFieldSources,
  type MissingPredicateHint,
  type ProductIntakeState,
} from "../lib/kgIntakeSchema";
import {
  parseProduct,
  type KgEdge,
  type KgFact,
  type KgNode,
  type ProductKgResponse,
} from "../lib/api";
import { ensureAccountId } from "../lib/account";
import type { ProductSpec } from "../lib/productStore";

function specFromParse(spec: ProductKgResponse["spec"]): ProductSpec {
  return {
    name: spec.name || "",
    summary: spec.summary || "",
    markets: spec.markets || [],
    processesPersonalData:
      (spec.processesPersonalData as ProductSpec["processesPersonalData"]) || "unknown",
    euLink: (spec.euLink as ProductSpec["euLink"]) || "unknown",
    aiSystem: (spec.aiSystem as ProductSpec["aiSystem"]) || "unknown",
    selectedLaws: [],
  };
}

function mapFacts(facts: ProductKgResponse["facts"]): KgFact[] {
  return (facts ?? []).map((f) => ({
    id: f.id,
    label: f.label,
    value: f.value,
    source: f.provenance || f.source,
    predicate: f.predicate,
    args: f.args,
  }));
}

export function useProductIntake() {
  const [intake, setIntake] = useState<ProductIntakeState>(EMPTY_INTAKE);
  const [fieldSources, setFieldSources] = useState<IntakeFieldSources>({});
  const [missingPredicates, setMissingPredicates] = useState<MissingPredicateHint[]>([]);
  const [extractSummary, setExtractSummary] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [kgNodes, setKgNodes] = useState<KgNode[]>([]);
  const [kgEdges, setKgEdges] = useState<KgEdge[]>([]);
  const [kgFacts, setKgFacts] = useState<KgFact[]>([]);
  const [spec, setSpec] = useState<ProductSpec>(specFromParse({
    name: "",
    summary: "",
    markets: [],
    processesPersonalData: "unknown",
    euLink: "unknown",
    aiSystem: "unknown",
  }));
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState(false);

  const description = intakeToDescription(intake);
  const hasInput = hasStructuredIntake(intake, files.length, kgFacts.length);

  const patchIntake = useCallback((patch: Partial<ProductIntakeState>) => {
    setIntake((prev) => {
      const next = applyDerivedDataAi({ ...prev, ...patch });
      setFieldSources((sources) => {
        const cleared = { ...sources };
        for (const key of Object.keys(patch)) {
          delete cleared[key];
        }
        return cleared;
      });
      return next;
    });
    setReviewed(false);
  }, []);

  const applySuggestedIntake = useCallback((kg: ProductKgResponse) => {
    if (kg.suggested_intake && Object.keys(kg.suggested_intake).length) {
      const s = kg.suggested_intake;
      setIntake((prev) =>
        applyDerivedDataAi(mergeIntakeState(prev, { ...narrativeFromStructured(s), ...s })),
      );
      const found: string[] = [];
      if (s.productSummary) found.push("product description");
      if (s.organisationName || s.actorRoles?.length) found.push("organisation");
      if (s.markets?.length) found.push("markets");
      if (s.dataFlowDescription || s.processesPersonalData === "yes") found.push("data flows");
      if (s.aiUsageDescription || s.hasAi === "yes") found.push("AI usage");
      if (found.length) setExtractSummary(found);
    }
    if (kg.field_sources) {
      setFieldSources((prev) => ({ ...kg.field_sources, ...prev }));
    }
    if (kg.missing_predicates?.length) {
      setMissingPredicates(mapMissingPredicates(kg.missing_predicates));
    }
  }, []);

  const runParse = useCallback(async (): Promise<boolean> => {
    if (!hasStructuredIntake(intake, files.length, 0)) {
      setKgNodes([]);
      setKgEdges([]);
      setKgFacts([]);
      return false;
    }
    setParsing(true);
    setError(null);
    try {
      await ensureAccountId();
      const kg = await parseProduct({
        intake,
        description: description.trim() || undefined,
        files: files.length ? files : undefined,
      });
      applySuggestedIntake(kg);
      setKgNodes(kg.nodes ?? []);
      setKgEdges(kg.edges ?? []);
      setKgFacts(mapFacts(kg.facts));
      if (kg.spec) {
        setSpec((s) => ({ ...specFromParse(kg.spec), selectedLaws: s.selectedLaws }));
      }
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build graph");
      return false;
    } finally {
      setParsing(false);
    }
  }, [applySuggestedIntake, description, files, intake]);

  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleParse = useCallback(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      void runParse();
    }, 700);
  }, [runParse]);

  return {
    intake,
    setIntake,
    patchIntake,
    fieldSources,
    missingPredicates,
    extractSummary,
    setExtractSummary,
    files,
    setFiles,
    kgNodes,
    kgEdges,
    kgFacts,
    spec,
    setSpec,
    parsing,
    error,
    setError,
    description,
    hasInput,
    reviewed,
    setReviewed,
    runParse,
    scheduleParse,
    applySuggestedIntake,
  };
}
