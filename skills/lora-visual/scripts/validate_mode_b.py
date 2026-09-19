#!/usr/bin/env python3
"""Validate a Mode B keyed source and optional transparent PNG.

Checks:
  - keyed border uniformity and optional expected key color
  - subject padding in the keyed source
  - RGBA output and transparent corners
  - key-color fringe in partially transparent edge pixels
  - subject padding in the transparent output

Exit status is 0 on pass, 1 on validation failure, and 2 on input errors.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from statistics import median

from PIL import Image


Color = tuple[int, int, int]


def _distance(color: Color, key: Color) -> int:
    return max(abs(color[index] - key[index]) for index in range(3))


def _parse_hex_color(value: str) -> Color:
    raw = value.removeprefix("#")
    if len(raw) != 6:
        raise argparse.ArgumentTypeError("expected color in #RRGGBB form")
    try:
        return tuple(int(raw[index : index + 2], 16) for index in (0, 2, 4))
    except ValueError as exc:
        raise argparse.ArgumentTypeError("expected color in #RRGGBB form") from exc


def _hex(color: Color) -> str:
    return f"#{color[0]:02X}{color[1]:02X}{color[2]:02X}"


def _border_pixels(image: Image.Image, band: int) -> list[Color]:
    rgb = image.convert("RGB")
    pixels = rgb.load()
    width, height = rgb.size
    band = max(1, min(band, width // 2, height // 2))
    samples: list[Color] = []

    for y in range(band):
        for x in range(width):
            samples.append(pixels[x, y])
            samples.append(pixels[x, height - 1 - y])
    for x in range(band):
        for y in range(band, height - band):
            samples.append(pixels[x, y])
            samples.append(pixels[width - 1 - x, y])
    return samples


def _sample_key(samples: list[Color]) -> Color:
    return tuple(
        int(round(median(sample[channel] for sample in samples)))
        for channel in range(3)
    )


def _mask_bbox_from_key(
    image: Image.Image,
    key: Color,
    subject_distance: int,
) -> tuple[int, int, int, int] | None:
    rgb = image.convert("RGB")
    width, height = rgb.size
    source = rgb.load()
    mask = Image.new("L", rgb.size, 0)
    target = mask.load()
    for y in range(height):
        for x in range(width):
            if _distance(source[x, y], key) >= subject_distance:
                target[x, y] = 255
    return mask.getbbox()


def _mask_bbox_from_alpha(
    image: Image.Image,
    alpha_threshold: int,
) -> tuple[int, int, int, int] | None:
    alpha = image.getchannel("A")
    mask = alpha.point(lambda value: 255 if value > alpha_threshold else 0)
    return mask.getbbox()


def _bbox_has_padding(
    bbox: tuple[int, int, int, int] | None,
    size: tuple[int, int],
    margin: int,
) -> bool:
    if bbox is None:
        return False
    left, top, right, bottom = bbox
    width, height = size
    return (
        left >= margin
        and top >= margin
        and right <= width - margin
        and bottom <= height - margin
    )


def _key_channels(key: Color) -> list[int]:
    strongest = max(key)
    if strongest < 128:
        return []
    return [
        index
        for index, value in enumerate(key)
        if value >= strongest - 16 and value >= 128
    ]


def _key_dominance(color: Color, key: Color) -> int:
    key_channels = _key_channels(key)
    if not key_channels:
        return 0
    other_channels = [index for index in range(3) if index not in key_channels]
    key_strength = min(color[index] for index in key_channels)
    other_strength = max((color[index] for index in other_channels), default=0)
    return key_strength - other_strength


def validate(
    source_path: Path,
    transparent_path: Path | None,
    expected_key: Color | None,
    border_band: int,
    background_tolerance: int,
    max_background_outlier_ratio: float,
    subject_distance: int,
    edge_margin: int,
    alpha_threshold: int,
    fringe_dominance: int,
    max_fringe_ratio: float,
) -> dict[str, object]:
    source = Image.open(source_path).convert("RGB")
    border = _border_pixels(source, border_band)
    sampled_key = _sample_key(border)
    reference_key = expected_key or sampled_key
    border_distances = [_distance(pixel, sampled_key) for pixel in border]
    background_outliers = sum(
        distance > background_tolerance for distance in border_distances
    )
    background_outlier_ratio = background_outliers / max(1, len(border_distances))
    expected_key_distance = (
        _distance(sampled_key, expected_key) if expected_key is not None else 0
    )
    source_bbox = _mask_bbox_from_key(source, sampled_key, subject_distance)

    checks: list[dict[str, object]] = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"name": name, "passed": passed, "detail": detail})

    add(
        "source.background_uniform",
        background_outlier_ratio <= max_background_outlier_ratio,
        (
            f"sampled={_hex(sampled_key)} border_max_distance="
            f"{max(border_distances, default=0)} outliers={background_outliers}/"
            f"{len(border_distances)} ({background_outlier_ratio:.4%})"
        ),
    )
    if expected_key is not None:
        add(
            "source.expected_key",
            expected_key_distance <= background_tolerance,
            (
                f"expected={_hex(expected_key)} sampled={_hex(sampled_key)} "
                f"distance={expected_key_distance}"
            ),
        )
    add(
        "source.subject_padding",
        _bbox_has_padding(source_bbox, source.size, edge_margin),
        f"bbox={source_bbox} required_margin={edge_margin}px size={source.size}",
    )

    if transparent_path is not None:
        transparent = Image.open(transparent_path)
        is_rgba = transparent.mode == "RGBA"
        add(
            "transparent.rgba",
            is_rgba,
            f"mode={transparent.mode}",
        )
        if is_rgba:
            width, height = transparent.size
            corners = [
                transparent.getpixel((0, 0))[3],
                transparent.getpixel((width - 1, 0))[3],
                transparent.getpixel((0, height - 1))[3],
                transparent.getpixel((width - 1, height - 1))[3],
            ]
            add(
                "transparent.corners",
                corners == [0, 0, 0, 0],
                f"corner_alpha={corners}",
            )
            transparent_bbox = _mask_bbox_from_alpha(transparent, alpha_threshold)
            add(
                "transparent.subject_padding",
                _bbox_has_padding(transparent_bbox, transparent.size, edge_margin),
                (
                    f"bbox={transparent_bbox} required_margin={edge_margin}px "
                    f"size={transparent.size}"
                ),
            )

            fringe_pixels = 0
            partial_pixels = 0
            pixel_data = (
                transparent.get_flattened_data()
                if hasattr(transparent, "get_flattened_data")
                else transparent.getdata()
            )
            for red, green, blue, alpha in pixel_data:
                if alpha_threshold < alpha < 255:
                    partial_pixels += 1
                    if _key_dominance((red, green, blue), reference_key) >= fringe_dominance:
                        fringe_pixels += 1
            fringe_ratio = fringe_pixels / max(1, partial_pixels)
            add(
                "transparent.key_fringe",
                fringe_ratio <= max_fringe_ratio,
                (
                    f"key={_hex(reference_key)} fringe_pixels={fringe_pixels}/"
                    f"{partial_pixels} ({fringe_ratio:.4%})"
                ),
            )

    return {
        "passed": all(bool(check["passed"]) for check in checks),
        "source": str(source_path),
        "transparent": str(transparent_path) if transparent_path else None,
        "sampled_key": _hex(sampled_key),
        "checks": checks,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Opaque chroma-key source image")
    parser.add_argument(
        "transparent",
        type=Path,
        nargs="?",
        help="Optional transparent PNG produced from the source",
    )
    parser.add_argument("--expected-key", type=_parse_hex_color)
    parser.add_argument("--border-band", type=int, default=6)
    parser.add_argument("--background-tolerance", type=int, default=12)
    parser.add_argument("--max-background-outlier-ratio", type=float, default=0.002)
    parser.add_argument("--subject-distance", type=int, default=48)
    parser.add_argument("--edge-margin", type=int, default=8)
    parser.add_argument("--alpha-threshold", type=int, default=8)
    parser.add_argument("--fringe-dominance", type=int, default=24)
    parser.add_argument("--max-fringe-ratio", type=float, default=0.002)
    parser.add_argument("--json", action="store_true", help="Emit JSON only")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if not args.source.is_file():
        raise SystemExit(f"Source image not found: {args.source}")
    if args.transparent is not None and not args.transparent.is_file():
        raise SystemExit(f"Transparent image not found: {args.transparent}")
    if args.border_band < 1 or args.edge_margin < 1:
        raise SystemExit("border-band and edge-margin must be positive")
    if not 0 <= args.max_background_outlier_ratio <= 1:
        raise SystemExit("max-background-outlier-ratio must be between 0 and 1")
    if not 0 <= args.max_fringe_ratio <= 1:
        raise SystemExit("max-fringe-ratio must be between 0 and 1")

    report = validate(
        args.source,
        args.transparent,
        args.expected_key,
        args.border_band,
        args.background_tolerance,
        args.max_background_outlier_ratio,
        args.subject_distance,
        args.edge_margin,
        args.alpha_threshold,
        args.fringe_dominance,
        args.max_fringe_ratio,
    )
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        for check in report["checks"]:
            status = "PASS" if check["passed"] else "FAIL"
            print(f"{status}  {check['name']}: {check['detail']}")
        print("MODE-B VALIDATION PASSED" if report["passed"] else "MODE-B VALIDATION FAILED")
    raise SystemExit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
