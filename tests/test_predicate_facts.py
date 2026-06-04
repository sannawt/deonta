from logic.predicate_facts import graph_to_predicate_facts, validate_predicate_facts
from logic.kg_schema import graph_edge, graph_node


def test_graph_to_predicate_facts_from_market_and_personal_data():
    scenario = graph_node(node_id="sc1", node_type="Scenario", label="CVSCAN", source="parse")
    market = graph_node(node_id="mk1", node_type="Market", label="EU", source="parse")
    datum = graph_node(
        node_id="dt1",
        node_type="Datum",
        label="CV data",
        properties={"personal_data": "yes"},
        source="parse",
    )
    person = graph_node(
        node_id="ps1",
        node_type="Actor",
        label="Applicant",
        properties={"natural_person": "yes"},
        source="parse",
    )
    edges = [
        graph_edge(from_id="sc1", to_id="mk1", edge_type="OPERATES_IN"),
        graph_edge(from_id="sc1", to_id="dt1", edge_type="PROCESSES_DATA"),
        graph_edge(from_id="dt1", to_id="ps1", edge_type="CONCERNS"),
    ]
    facts = graph_to_predicate_facts([scenario, market, datum, person], edges, case_id="sc1")
    preds = {f["predicate"] for f in facts}
    assert "market" in preds or "established_in" in preds
    assert "natural_person" in preds or "concerns" in preds


def test_validate_predicate_facts_drops_unknown():
    out = validate_predicate_facts(
        [
            {"predicate": "not_a_real_predicate", "args": ["x"]},
            {"predicate": "processing", "args": ["sc1"]},
        ]
    )
    assert len(out) == 1
    assert out[0]["predicate"] == "processing"
