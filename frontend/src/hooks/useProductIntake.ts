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

function intakeSnapshotKey(
  intake: ProductIntakeState,
  description: string,
  files: File[],
): string {
  return JSON.stringify({
    intake,
    description,
    files: files.map((f) => `${f.name}:${f.size}`),
  });
}

function factsSnapshot(facts: KgFact[]): string {
  return JSON.stringify(
    facts.map((f) => ({
      id: f.id,
      value: f.value,
      predicate: f.predicate,
      args: f.args,
    })),
  );
}

function graphSnapshot(nodes: KgNode[], edges: KgEdge[]): string {
  return JSON.stringify({ nodes, edges });
}

export function useProductIntake(playbookId?: string) {
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
      if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
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

  const applySuggestedIntake = useCallback((kg: ProductKgResponse, allowProductFields = false) => {
    if (kg.suggested_intake && Object.keys(kg.suggested_intake).length) {
      const s = { ...kg.suggested_intake };
      // Product name/summary are answered on their own step — don't backfill
      // them from organisation/markets (or other) structured answers.
      if (!allowProductFields) {
        delete s.productName;
        delete s.productSummary;
      }
      setIntake((prev) => {
        const next = applyDerivedDataAi(mergeIntakeState(prev, { ...narrativeFromStructured(s), ...s }));
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });
      const found: string[] = [];
      if (allowProductFields && s.productSummary) found.push("product description");
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

  const lastParseKeyRef = useRef("");
  const parseInFlightRef = useRef(false);
  const kgNodesRef = useRef(kgNodes);
  const kgEdgesRef = useRef(kgEdges);
  const kgFactsRef = useRef(kgFacts);
  kgNodesRef.current = kgNodes;
  kgEdgesRef.current = kgEdges;
  kgFactsRef.current = kgFacts;

  const runParse = useCallback(async (): Promise<boolean> => {
    if (!hasStructuredIntake(intake, files.length, 0)) {
      if (kgNodesRef.current.length || kgEdgesRef.current.length || kgFactsRef.current.length) {
        setKgNodes([]);
        setKgEdges([]);
        setKgFacts([]);
      }
      lastParseKeyRef.current = "";
      return false;
    }

    const parseKey = intakeSnapshotKey(intake, description, files);
    if (parseKey === lastParseKeyRef.current || parseInFlightRef.current) {
      return true;
    }

    parseInFlightRef.current = true;
    setParsing(true);
    setError(null);
    try {
      const kg = await parseProduct({
        intake,
        description: description.trim() || undefined,
        files: files.length ? files : undefined,
        playbook_id: playbookId || undefined,
      });

      const nextNodes = kg.nodes ?? [];
      const nextEdges = kg.edges ?? [];
      const nextFacts = mapFacts(kg.facts);
      const nextGraphKey = graphSnapshot(nextNodes, nextEdges);
      const prevGraphKey = graphSnapshot(kgNodesRef.current, kgEdgesRef.current);

      if (nextGraphKey !== prevGraphKey) {
        setKgNodes(nextNodes);
        setKgEdges(nextEdges);
      }
      if (factsSnapshot(nextFacts) !== factsSnapshot(kgFactsRef.current)) {
        setKgFacts(nextFacts);
      }

      applySuggestedIntake(kg, files.length > 0);
      if (kg.spec && files.length > 0) {
        const parsed = specFromParse(kg.spec);
        setSpec((s) => ({ ...parsed, selectedLaws: s.selectedLaws }));
        setIntake((prev) => {
          const patch: Partial<ProductIntakeState> = {};
          const parsedName = parsed.name.trim();
          if (
            !prev.productName.trim() &&
            parsedName &&
            parsedName.toLowerCase() !== "unnamed product"
          ) {
            patch.productName = parsedName;
          }
          if (!prev.productSummary.trim() && parsed.summary.trim()) {
            patch.productSummary = parsed.summary;
          }
          if (!Object.keys(patch).length) return prev;
          const next = applyDerivedDataAi({ ...prev, ...patch });
          return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
        });
      } else if (kg.spec) {
        const parsed = specFromParse(kg.spec);
        setSpec((s) => ({
          ...s,
          markets: parsed.markets?.length ? parsed.markets : s.markets,
          processesPersonalData:
            parsed.processesPersonalData !== "unknown"
              ? parsed.processesPersonalData
              : s.processesPersonalData,
          euLink: parsed.euLink !== "unknown" ? parsed.euLink : s.euLink,
          aiSystem: parsed.aiSystem !== "unknown" ? parsed.aiSystem : s.aiSystem,
        }));
      }

      lastParseKeyRef.current = parseKey;
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not build graph");
      return false;
    } finally {
      parseInFlightRef.current = false;
      setParsing(false);
    }
  }, [applySuggestedIntake, description, files, intake, playbookId]);

  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleParse = useCallback(() => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    parseTimer.current = setTimeout(() => {
      void runParse();
    }, 900);
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
    setKgFacts,
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
