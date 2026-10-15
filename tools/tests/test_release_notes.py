"""Release-note bodies must preserve Markdown and select only one release."""
import importlib.util
from pathlib import Path
import unittest

MODULE_PATH = Path(__file__).resolve().parents[1] / "release_notes.py"


class ReleaseNotesTests(unittest.TestCase):
    def extract(self, text, version):
        spec = importlib.util.spec_from_file_location("release_notes", MODULE_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module.extract_notes(text, version)

    def test_target_release_preserves_separate_headings_and_bullets(self):
        changelog = "# Changelog\n\n## [Unreleased]\n\n### Added\n\n- Future feature.\n\n## [1.2.0] - 2026-01-02\n\n### Added\n\n- First feature.\n- Second feature.\n\n### Fixed\n\n- A real bug.\n\n## [1.1.0] - 2026-01-01\n\n### Added\n\n- Older feature.\n"
        self.assertEqual(self.extract(changelog, "1.2.0"), "### Added\n\n- First feature.\n- Second feature.\n\n### Fixed\n\n- A real bug.\n")

    def test_unreleased_and_last_release_do_not_leak_other_sections_or_link_footer(self):
        changelog = "# Changelog\n\n## [Unreleased]\n\n### Changed\n\n- Current change.\n\n## [1.0.0] - 2026-01-01\n\n### Added\n\n- Initial feature.\n\n[Unreleased]: https://example.invalid/compare\n[1.0.0]: https://example.invalid/release\n"
        self.assertEqual(self.extract(changelog, "Unreleased"), "### Changed\n\n- Current change.\n")
        self.assertEqual(self.extract(changelog, "1.0.0"), "### Added\n\n- Initial feature.\n")

    def test_missing_or_empty_release_fails_instead_of_publishing_wrong_notes(self):
        with self.assertRaises(ValueError):
            self.extract("## [Unreleased]\n\n### Added\n\n- Future feature.\n", "1.0.0")
        with self.assertRaises(ValueError):
            self.extract("## [1.0.0] - 2026-01-01\n\n## [0.9.0] - 2025-12-01\n\n- Old change.\n", "1.0.0")


if __name__ == "__main__":
    unittest.main()
