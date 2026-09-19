#!/usr/bin/env python3

from __future__ import annotations

import importlib.util
import tempfile
import unittest
from pathlib import Path

from PIL import Image, ImageDraw


SCRIPT = Path(__file__).parents[1] / "scripts" / "validate_mode_b.py"
SPEC = importlib.util.spec_from_file_location("validate_mode_b", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class ValidateModeBTests(unittest.TestCase):
    def setUp(self) -> None:
        self.tempdir = tempfile.TemporaryDirectory()
        self.root = Path(self.tempdir.name)
        self.source = self.root / "source.png"
        self.transparent = self.root / "transparent.png"

    def tearDown(self) -> None:
        self.tempdir.cleanup()

    def make_pair(self) -> None:
        source = Image.new("RGB", (96, 96), (0, 255, 0))
        ImageDraw.Draw(source).rectangle((24, 20, 72, 78), fill=(230, 210, 175))
        source.save(self.source)

        transparent = Image.new("RGBA", (96, 96), (0, 0, 0, 0))
        ImageDraw.Draw(transparent).rectangle(
            (24, 20, 72, 78), fill=(230, 210, 175, 255)
        )
        transparent.save(self.transparent)

    def validate(self):
        return MODULE.validate(
            self.source,
            self.transparent,
            (0, 255, 0),
            border_band=4,
            background_tolerance=12,
            max_background_outlier_ratio=0.002,
            subject_distance=48,
            edge_margin=8,
            alpha_threshold=8,
            fringe_dominance=24,
            max_fringe_ratio=0.002,
        )

    def failed_checks(self, report) -> set[str]:
        return {
            str(check["name"])
            for check in report["checks"]
            if not check["passed"]
        }

    def test_clean_pair_passes(self) -> None:
        self.make_pair()
        self.assertTrue(self.validate()["passed"])

    def test_background_variation_fails(self) -> None:
        self.make_pair()
        source = Image.open(self.source)
        ImageDraw.Draw(source).rectangle((0, 0, 20, 5), fill=(0, 180, 70))
        source.save(self.source)
        self.assertIn("source.background_uniform", self.failed_checks(self.validate()))

    def test_nontransparent_corner_fails(self) -> None:
        self.make_pair()
        transparent = Image.open(self.transparent)
        transparent.putpixel((0, 0), (230, 210, 175, 255))
        transparent.save(self.transparent)
        self.assertIn("transparent.corners", self.failed_checks(self.validate()))

    def test_key_color_fringe_fails(self) -> None:
        self.make_pair()
        transparent = Image.open(self.transparent)
        draw = ImageDraw.Draw(transparent)
        draw.rectangle((20, 18, 23, 80), fill=(0, 255, 0, 128))
        transparent.save(self.transparent)
        self.assertIn("transparent.key_fringe", self.failed_checks(self.validate()))

    def test_subject_touching_border_fails(self) -> None:
        self.make_pair()
        source = Image.open(self.source)
        ImageDraw.Draw(source).rectangle((0, 30, 30, 60), fill=(230, 210, 175))
        source.save(self.source)
        transparent = Image.open(self.transparent)
        ImageDraw.Draw(transparent).rectangle(
            (0, 30, 30, 60), fill=(230, 210, 175, 255)
        )
        transparent.save(self.transparent)
        failed = self.failed_checks(self.validate())
        self.assertIn("source.subject_padding", failed)
        self.assertIn("transparent.subject_padding", failed)


if __name__ == "__main__":
    unittest.main()
