from logic.legal_links import dedupe_provision_ids, eurlex_url_for_provision, format_provision_label


def test_format_gdpr_article():
    assert format_provision_label("GDPR_A3.2.a") == "Art. 3(2)(a)"


def test_format_ai_act_recital():
    assert format_provision_label("AIAct_R25") == "Recital 25"


def test_eurlex_gdpr_article_url():
    url = eurlex_url_for_provision("GDPR_A27.1")
    assert url is not None
    assert "2016/679" in url
    assert "art_27" in url


def test_dedupe_keeps_most_specific_subparagraph():
    out = dedupe_provision_ids(["AIAct_A2.1", "AIAct_A2.1.d", "AIAct_A2.7"])
    assert len(out) == 2
    assert "AIAct_A2.1.d" in out
    assert "AIAct_A2.7" in out
    assert "AIAct_A2.1" not in out


def test_eurlex_ai_act_recital_url():
    url = eurlex_url_for_provision("AIAct_R25")
    assert url is not None
    assert "2024/1689" in url
    assert "rec_25" in url
