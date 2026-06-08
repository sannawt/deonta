"""Tests for EU document title parsing."""

from __future__ import annotations

from logic.law_title_format import (
    catalog_code_from_number,
    classify_document_tier,
    clean_document_title,
    extract_official_number,
    extract_short_name,
    extract_topic_keywords,
    finalize_display_short,
    format_legal_instrument,
    format_product_ui_label,
    generate_short_handle,
    infer_catalog_code,
    is_noise_document,
    is_uuid_slug,
    normalize_title_spacing,
    parse_document_display,
    should_exclude_tier,
    title_summary,
    _sanitize_keyword_phrase,
)
from logic.legal_db import law_by_code


def test_extract_official_number_from_regulation_title():
    title = (
        "Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "of 27 April 2016 on the protection of natural persons with regard to the "
        "processing of personal data (General Data Protection Regulation)"
    )
    assert extract_official_number(title) == "2016/679"


def test_extract_short_name_gdpr():
    title = (
        "Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "(General Data Protection Regulation)"
    )
    assert extract_short_name(title) == "GDPR"


def test_infer_catalog_code_from_number():
    assert catalog_code_from_number("2016/679") == "gdpr"
    assert catalog_code_from_number("2022/2065") == "dsa"
    assert infer_catalog_code("Some unrelated title", "2016/679") == "gdpr"


def test_infer_catalog_code_from_title_keywords():
    title = "Regulation on the General Data Protection Regulation implementation"
    assert infer_catalog_code(title, "") == "gdpr"


def test_clean_document_title_strips_boilerplate():
    raw = "Regulation (EU) 2022/2065 (Digital Services Act) (Text with EEA relevance)"
    cleaned = clean_document_title(raw)
    assert "Text with EEA relevance" not in cleaned
    assert "Digital Services Act" in cleaned


def test_title_summary_omits_trailing_short_name_paren():
    title = (
        "Commission Implementing Decision EU 2023/1795 pursuant to Regulation (EU) 2016/679 "
        "(General Data Protection Regulation)"
    )
    summary = title_summary(title)
    assert "(General Data Protection Regulation)" not in summary
    assert "2023/1795" in summary


def test_normalize_title_spacing():
    raw = "Commission Implementing Decision EU 2023/1795of 10 July 2023pursuant to Regulation"
    assert "1795 of" in normalize_title_spacing(raw)
    assert "Councilof" not in normalize_title_spacing("Parliament and of the Councilof 16 December")


def test_extract_topic_keywords_gdpr():
    title = (
        "Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "of 27 April 2016 on the protection of natural persons with regard to the "
        "processing of personal data (General Data Protection Regulation)"
    )
    topics = extract_topic_keywords(title, catalog_code="gdpr")
    assert "personal data" in topics
    assert "data processing" in topics
    assert "Regulation (EU)" not in topics


def test_extract_topic_keywords_edip():
    title = (
        "Regulation (EU) 2025/2643 of the European Parliament and of the Council"
        "of 16 December 2025establishing the European Defence Industry Programme and "
        "a framework of measures to ensure the timely availability and supply of defence products "
        "(EDIP Regulation)"
    )
    assert extract_short_name(title) == "EDIP"
    topics = extract_topic_keywords(title)
    assert "defence" in topics.lower() or "supply" in topics.lower()


def test_parse_document_display_uses_short_and_keywords():
    title = (
        "Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "of 27 April 2016 on the protection of natural persons with regard to the "
        "processing of personal data (General Data Protection Regulation)"
    )
    display = parse_document_display(title)
    assert display["short"] == "GDPR"
    assert display["label"] == "GDPR"
    assert display["number"] == "2016/679"
    assert "personal data" in display["description"]
    assert "Regulation (EU) 2016/679 of the European Parliament" in display["full_title"]


def test_uk_gdpr_implementing_regulation():
    title = (
        "Commission Implementing Regulation (EU) 2021/1772 of 28 June 2021 "
        "pursuant to Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "on the adequate protection of personal data by the United Kingdom4800)"
    )
    display = parse_document_display(title)
    assert display["short"] not in {"EU Regulation", "EU Directive", "Impl. Regulation", ""}
    assert display["number"] == "2021/1772"
    assert display["catalog_code"] == "gdpr"
    assert display["document_tier"] == "implementing"
    assert "personal data" in display["description"]
    assert "United Kingdom4800" not in display["full_title"]
    assert "United Kingdom)" in display["full_title"]
    assert len(display["short"]) < 20


def test_extract_short_name_blocks_generic_parentheticals():
    recast = (
        "Council Regulation (EU) 2019/1111 of 25 June 2019 on jurisdiction, "
        "the recognition and enforcement of decisions in matrimonial matters "
        "and the matters of parental responsibility, and on international child abduction(recast)"
    )
    short = extract_short_name(recast)
    assert short not in {"recast", "codification"}
    assert len(short.split()) <= 3

    codification = (
        "Directive (EU) 2017/1132 of the European Parliament and of the Council "
        "of 14 June 2017relating to certain aspects of company law(codification)"
    )
    assert extract_short_name(codification) == "Company Law"


def test_extract_short_name_avoids_regulation_number_duplicate():
    title = (
        "Regulation (EU) 2018/1725 of the European Parliament and of the Council "
        "of 23 October 2018 on the protection of natural persons with regard to the "
        "processing of personal data by the Union institutions, bodies, offices and agencies"
    )
    short = extract_short_name(title)
    assert "2018/1725" not in short
    assert len(short.split()) <= 3


def test_extract_topic_keywords_max_three_words():
    title = (
        "Regulation (EU) 2024/3015 of the European Parliament and of the Council "
        "of 27 November 2024 on prohibiting products made with forced labour on the Union market"
    )
    keywords = extract_topic_keywords(title).split(", ")
    assert keywords
    for kw in keywords:
        assert len(kw.split()) <= 3, kw


def test_generate_short_handle_from_subject():
    title = (
        "Council Regulation (EU) 2019/1111 of 25 June 2019 on jurisdiction, "
        "the recognition and enforcement of decisions in matrimonial matters "
        "and the matters of parental responsibility, and on international child abduction(recast)"
    )
    handle = generate_short_handle(title)
    assert handle not in {"recast", "codification", "Council Regulation"}
    assert len(handle.split()) <= 3


def test_normalize_title_spacing_fixes_common_artifacts():
    assert "2017 relating" in normalize_title_spacing(
        "Directive (EU) 2017/1132 of 14 June 2017relating to certain aspects"
    )
    assert "2018 on" in normalize_title_spacing(
        "Regulation (EU) 2018/1725 of 23 October 2018on the protection"
    )
    assert "United Kingdom)" in normalize_title_spacing(
        "adequate protection of personal data by the United Kingdom4800)"
    )


def test_parse_document_display_for_implementing_decision():
    title = (
        "Commission Implementing Decision EU 2023/1795of 10 July 2023pursuant to "
        "Regulation (EU) 2016/679 of the European Parliament and of the Council on the "
        "adequate level of protection of personal data under the EU-US Data Privacy Framework"
    )
    display = parse_document_display(title)
    assert display["catalog_code"] == "gdpr"
    assert display["number"] == "2023/1795"
    assert display["short"] not in {"EU Regulation", "EU Directive", "Impl. Decision", ""}
    assert "personal data" in display["description"].lower() or display["short"] == "Personal Data"


def test_is_uuid_slug():
    assert is_uuid_slug("fb2caf66_7ba3_11ef_bbbe_01aa75ed71a1")
    assert not is_uuid_slug("GDPR")


def test_ehds_not_linked_to_cra_via_amending_clause():
    title = (
        "Regulation (EU) 2025/327 of the European Parliament and of the Council "
        "of 11 February 2025 on the European Health Data Space and amending "
        "Directive 2011/24/EU and Regulation (EU) 2024/2847"
    )
    display = parse_document_display(title)
    assert display["catalog_code"] != "cra"
    assert display["short"] == "EHDS"
    assert "cybersecurity" not in display["description"]


def test_financial_budget_handle():
    title = (
        "Regulation (EU, Euratom) 2024/2509 of the European Parliament and of the Council "
        "of 23 September 2024 on the financial rules applicable to the general budget "
        "of the Union(recast)"
    )
    assert extract_short_name(title) in {"EU Budget", "Financial Rules"}


def test_sanitize_keyword_rejects_junk():
    assert _sanitize_keyword_phrase("regulation (eu") == ""
    assert _sanitize_keyword_phrase("be made") == ""
    assert _sanitize_keyword_phrase("oj l") == ""


def test_classify_document_tier():
    assert classify_document_tier(
        "Commission Implementing Decision (EU) 2021/1772 pursuant to Regulation (EU) 2016/679"
    ) == "implementing"
    assert classify_document_tier(
        "Regulation (EU) 2016/679 on the protection of personal data"
    ) == "primary"
    assert classify_document_tier(
        "Decision of the Management Board of ENISA on internal rules concerning personal data"
    ) == "internal"


def test_finalize_display_short_avoids_generic_instrument():
    title = (
        "Directive (EU) 2017/1132 of the European Parliament and of the Council "
        "of 14 June 2017 relating to certain aspects of company law(codification)"
    )
    assert finalize_display_short(title, "EU Directive") == "Company Law"


def test_should_exclude_tier_primary_only():
    assert should_exclude_tier("primary", include_secondary=False, is_catalog_primary=False) is False
    assert should_exclude_tier("council", include_secondary=False, is_catalog_primary=False) is True
    assert should_exclude_tier("implementing", include_secondary=False, is_catalog_primary=False) is True
    assert should_exclude_tier("internal", include_secondary=True, is_catalog_primary=False) is True
    assert should_exclude_tier("implementing", include_secondary=True, is_catalog_primary=False) is False
    assert should_exclude_tier("unknown", include_secondary=True, is_catalog_primary=False) is True
    assert should_exclude_tier("council", include_secondary=False, is_catalog_primary=True) is False


def test_is_noise_document():
    assert is_noise_document(
        "Council Regulation (EU) 2022/2065 concerning restrictive measures in view of the situation in Ukraine"
    )
    assert is_noise_document("Draft Commission Implementing Regulation on widgets")
    assert not is_noise_document(
        "Regulation (EU) 2016/679 on the protection of personal data"
    )


def test_format_product_ui_label_from_catalog():
    title = (
        "Regulation (EU) 2016/679 of the European Parliament and of the Council "
        "(General Data Protection Regulation)"
    )
    row = law_by_code("gdpr")
    assert format_product_ui_label(title, catalog_code="gdpr", catalog_row=row) == (
        "Personal data protection"
    )


def test_format_product_ui_label_delegated_red_cybersecurity():
    title = (
        "Commission Delegated Regulation (EU) 2022/30 supplementing Directive 2014/53/EU "
        "with regard to the application of essential requirements for radio equipment"
    )
    assert format_product_ui_label(title, document_tier="delegated") == (
        "Cybersecurity for connected radio equipment"
    )


def test_format_legal_instrument_primary_regulation():
    title = (
        "Regulation (EU) 2024/2847 of the European Parliament and of the Council "
        "on horizontal cybersecurity requirements for products with digital elements "
        "(Cyber Resilience Act)"
    )
    row = law_by_code("cra")
    assert format_legal_instrument(
        title, catalog_code="cra", document_tier="primary", catalog_row=row
    ) == "Cyber Resilience Act, Regulation (EU) 2024/2847"


def test_format_legal_instrument_directive_red():
    title = (
        "Directive 2014/53/EU of the European Parliament and of the Council "
        "on the harmonisation of the laws of the Member States relating to radio equipment"
    )
    row = law_by_code("red")
    assert format_legal_instrument(
        title, catalog_code="red", document_tier="primary", catalog_row=row
    ) == "Radio Equipment Directive 2014/53/EU"


def test_format_legal_instrument_delegated_under_parent():
    title = (
        "Commission Delegated Regulation (EU) 2022/30 supplementing Directive 2014/53/EU "
        "with regard to the application of essential requirements for radio equipment"
    )
    assert format_legal_instrument(title, document_tier="delegated") == (
        "Commission Delegated Regulation (EU) 2022/30 under RED"
    )
