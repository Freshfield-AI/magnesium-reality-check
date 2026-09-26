from html.parser import HTMLParser
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
TEMPLATE = (ROOT / 'template.html').read_text()


class Elements(HTMLParser):
    def __init__(self):
        super().__init__()
        self.items = []

    def handle_starttag(self, tag, attrs):
        self.items.append((tag, dict(attrs)))


class DemoContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        p = Elements()
        p.feed(TEMPLATE)
        cls.items = p.items

    def element(self, element_id):
        found = [(tag, attrs) for tag, attrs in self.items if attrs.get('id') == element_id]
        self.assertEqual(len(found), 1, f'Expected exactly one #{element_id}')
        return found[0]

    def test_primary_action_opens_the_guided_reveal(self):
        tag, attrs = self.element('reveal-start')
        self.assertEqual(tag, 'button')
        self.assertEqual(attrs['type'], 'button')
        self.assertIn("Show me what's actually in it", TEMPLATE)
        self.assertIn("getElementById('reveal-start').addEventListener('click'", TEMPLATE)
        self.element('reveal')
        self.assertRegex(TEMPLATE, r'\.reveal-start\s*\{[^}]*min-height:\s*(?:6[0-9]|[7-9][0-9])px')

    def test_hero_passes_retailer_grunt_test(self):
        hero = re.search(r'<section class="hero".*?</section>', TEMPLATE, flags=re.S)
        assert hero is not None
        self.assertIn('magnesium glycinate', hero.group(0).lower())
        self.assertIn('unbuffered', hero.group(0).lower())
        self.assertIn('Know the source', hero.group(0))
        self.assertIn('what the label tells you', hero.group(0))
        self.assertIn('opening order', hero.group(0).lower())
        self.assertNotIn("What's behind the", hero.group(0))

    def test_reveal_names_the_source_split_without_diagnosing_deception(self):
        stage = re.search(r'id="reveal-label".*?</article>', TEMPLATE, flags=re.S)
        assert stage is not None
        visible = re.sub(r'<[^>]+>', '', stage.group(0)).lower()
        self.assertIn('how much', visible)
        self.assertIn('from each source', visible)
        self.assertIn('unknown', visible)
        self.assertNotIn('deceiv', visible)
        self.assertNotIn('does nothing', visible)
        self.assertIn('this label openly lists', visible)
        self.assertNotIn('glycine appears separately', visible)
        freshfield = re.search(r'id="reveal-freshfield".*?</article>', TEMPLATE, flags=re.S)
        assert freshfield is not None
        self.assertIn('no head-to-head study', freshfield.group(0).lower())

    def test_real_label_reveal_discloses_oxide_and_source(self):
        self.element('reveal-turn')
        self.element('reveal-label')
        visible_text = re.sub(r'<[^>]+>', '', TEMPLATE)
        self.assertIn('Magnesium (magnesium bis-glycinate, magnesium oxide)', visible_text)
        self.assertIn('https://canprev.ca/products/magnesium-bis-glycinate-200-gentle-3-2/', TEMPLATE)
        self.assertIn('disclosed', TEMPLATE.lower())
        self.assertNotIn('hidden oxide', TEMPLATE.lower())

    def test_balchem_explains_original_and_buffered_without_equating_traacs_to_unbuffered(self):
        self.element('balchem-evidence')
        self.assertIn('Original', TEMPLATE)
        self.assertIn('Buffered', TEMPLATE)
        self.assertIn('https://balchem.com/hnh/resources/which-magnesium-to-choose/', TEMPLATE)
        self.assertIn('https://balchem.com/hnh/products/mn/mg/magnesium-bisglycinate-chelate/', TEMPLATE)
        self.assertIn('TRAACS™', TEMPLATE)
        self.assertIn('trademarks of Balchem Corporation or its subsidiaries', TEMPLATE)

    def test_main_reveal_separates_absorbed_dose_from_optional_study_rates(self):
        tag, _ = self.element('reveal-absorption')
        self.assertEqual(tag, 'article')
        stage = re.search(r'id="reveal-absorption".*?</article>', TEMPLATE, flags=re.S)
        assert stage is not None
        main = re.sub(r'<details\b.*?</details>', '', stage.group(0), flags=re.S)
        main_text = re.sub(r'<[^>]+>', ' ', main).lower()
        self.assertIn('not 200 mg absorbed', main_text)
        self.assertIn('cannot be calculated from the label', main_text)
        self.assertNotIn('4%', main_text)
        self.assertNotIn('22.8%', main_text)
        self.assertNotIn('23.5%', main_text)
        evidence = re.search(r'<details[^>]*id="absorption-evidence".*?</details>', stage.group(0), flags=re.S)
        assert evidence is not None
        self.assertIn('4%', evidence.group(0))
        self.assertIn('23.5%', evidence.group(0))
        self.assertIn('22.8%', evidence.group(0))
        self.assertIn('https://europepmc.org/article/MED/11794633', evidence.group(0))
        self.assertIn('https://europepmc.org/article/MED/7815675', evidence.group(0))
        self.assertIn('https://europepmc.org/article/MED/29123461', evidence.group(0))

    def test_nonaccusatory_copy_and_footer_attribution(self):
        self.assertNotIn('oxide padding', TEMPLATE.lower())
        self.assertNotIn('What if it says TRAACS?', TEMPLATE)
        footer = re.search(r'<footer>(.*?)</footer>', TEMPLATE, flags=re.S)
        assert footer is not None
        self.assertIn('Albion™ and TRAACS™ are trademarks of Balchem Corporation or its subsidiaries', footer.group(1))
        meta = re.search(r'<meta name="description" content="(.*?)">', TEMPLATE)
        assert meta is not None
        self.assertNotIn('TRAACS', meta.group(1))
        self.assertNotIn('buffered chelate', meta.group(1))
        self.assertNotIn('canprev.ca/products/magnesium-bis%C2%B7glycinate-140-extra-gentle-2/', TEMPLATE)
        public_copy = re.sub(r'<details\b.*?</details>', '', TEMPLATE, flags=re.S).lower()
        self.assertNotRegex(public_copy, r'better absorbed|more absorbable|superior absorption')

    def test_freshfield_is_product_proof_not_a_fill_estimate(self):
        self.element('reveal-freshfield')
        self.assertIn('121 mg', TEMPLATE)
        self.assertIn('two capsules', TEMPLATE.lower())
        self.assertIn('unbuffered', TEMPLATE.lower())
        self.assertNotIn('It depends on the fill', TEMPLATE)
        self.assertNotIn('likely pure', TEMPLATE.lower())
        self.assertNotIn('4x better', TEMPLATE.lower())
        self.assertIn('What your team can say:', TEMPLATE)
        self.assertIn('lower elemental number', TEMPLATE)
        self.assertIn('We chose one source', TEMPLATE)
        self.assertIn('no oxide blend', TEMPLATE.lower())
        self.assertNotIn("We won't pretend", TEMPLATE)
        self.assertIn('no head-to-head study', TEMPLATE.lower())

    def test_calculator_defaults_to_unknown_200mg_example(self):
        self.element('elemental')
        self.assertRegex(TEMPLATE, r'id="elemental" value="200"')
        self.assertNotIn('id="freshfield-example"', TEMPLATE)
        self.assertIn('not a test of another product', TEMPLATE.lower())
        self.element('result-assumption')
        self.element('result-claim-label')
        self.element('result-claim')
        self.element('result-maximum')
        self.element('result-gap')
        self.element('row-ceiling')
        self.element('result-choice')
        self.element('calc-details')
        self.assertIn('Separate Freshfield product fact, not this estimate', TEMPLATE)
        self.assertIn('Want one stated magnesium source?', TEMPLATE)
        self.assertIn('not an oxide estimate for any named product', TEMPLATE)
        self.assertIn('Generic size-00 example', TEMPLATE)
        self.assertIn('another magnesium source', TEMPLATE.lower())
        self.assertIn('Math.floor(perCap-maxElemental)', TEMPLATE)
        self.assertNotIn('.result[data-status=possible] .verdict { color:#236b48; }', TEMPLATE)
        self.assertNotIn("verdict = 'Check the full label'", TEMPLATE)

    def test_offline_and_seller_led_close_remain(self):
        self.assertIn("serviceWorker.register('./sw.js')", TEMPLATE)
        self.element('order-button')
        self.assertIn('seller', TEMPLATE.lower())
        self.assertNotIn('<form action=', TEMPLATE.lower())
        self.assertFalse(re.search(r'(?i)price=|credit.card|checkout', TEMPLATE))


if __name__ == '__main__':
    unittest.main()
