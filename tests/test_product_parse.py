from logic.product_parse import extract_product_name, parse_description


def test_extract_name_called_typo():
    text = (
        "I have AI product that I use to screen job applicants cv. "
        "its call CVSCAN"
    )
    assert extract_product_name(text) == "CVSCAN"


def test_extract_name_its_called():
    assert extract_product_name("It's called ComplianceTwin and sells in the EU") == "ComplianceTwin"


def test_extract_name_quoted():
    assert extract_product_name('We built "Resume Radar" for HR teams') == "Resume Radar"


def test_parse_description_product_node_label():
    text = "I have AI product that screens CVs. its call CVSCAN"
    parsed = parse_description(text)
    product = next(n for n in parsed["nodes"] if n["type"] == "Product")
    assert product["label"] == "CVSCAN"
    assert parsed["name"] == "CVSCAN"
    assert parsed["markets"] == []
    assert parsed["euLink"] == "unknown"


def test_parse_description_defaults_your_product_label():
    text = (
        "We manufacture a smart rooftop internet antenna kit for wireless broadband. "
        "The product includes an outdoor antenna and a cloud dashboard."
    )
    parsed = parse_description(text)
    product = next(n for n in parsed["nodes"] if n["type"] == "Product")
    assert product["label"] == "Your product"
    assert parsed["name"] == ""


def test_sell_to_eu_does_not_set_eu_link():
    text = (
        "We are a US company planning to sell the product to EU internet providers "
        "and municipalities. Uses AI to steer the signal."
    )
    parsed = parse_description(text)
    assert "EU" in parsed["markets"]
    assert parsed["euLink"] == "unknown"


def test_does_not_use_whole_sentence_as_name():
    text = (
        "I have AI product that I use the screen job applicants cv and process personal data"
    )
    assert extract_product_name(text) == ""
