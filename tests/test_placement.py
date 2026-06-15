"""Tests for the placement engine: grid alignment, strategies, and synthetic fields."""

from __future__ import annotations

import pytest
from shapely.geometry import box
from shapely.ops import unary_union

from trialfield_core.geometry.placement import (
    RepBlock,
    place_block_2x2,
    place_free,
    place_linear,
    place_staggered,
    place_trial,
)

# ---------------------------------------------------------------------------
# Common test parameters
# ---------------------------------------------------------------------------

SWATH = 60.0    # ft per strip
PLOT_L = 400.0  # ft plot length (u-axis)
N_STRIPS = 6    # treatments per rep
V_REF = 0.0


# ---------------------------------------------------------------------------
# Helper: the hard grid-alignment constraint
# ---------------------------------------------------------------------------

def _assert_grid_aligned(blocks: list[RepBlock], swath: float, v_ref: float = 0.0) -> None:
    """Every block's v_south and v_north must land exactly on the swath grid."""
    for block in blocks:
        for v in (block.v_south, block.v_north):
            offset = (v - v_ref) % swath
            err = min(offset, swath - offset)
            assert err < 1e-6, (
                f"Rep {block.rep}: v={v} is not on swath grid "
                f"(swath={swath}, v_ref={v_ref})"
            )


def _assert_no_block_overlap(blocks: list[RepBlock]) -> None:
    """No two blocks should overlap in 2D (u × v) space."""
    from shapely.geometry import box as _box

    rects = [(b, _box(b.u_west, b.v_south, b.u_east, b.v_north)) for b in blocks]
    for i, (b1, r1) in enumerate(rects):
        for b2, r2 in rects[i + 1:]:
            area = r1.intersection(r2).area
            assert area < 1e-6, (
                f"Reps {b1.rep} and {b2.rep} physically overlap "
                f"(intersection area = {area:.1f} sq ft)"
            )


def _assert_no_v_overlap(blocks: list[RepBlock]) -> None:
    """No two blocks share any v-strip (single-column strategies only)."""
    sorted_blocks = sorted(blocks, key=lambda b: b.v_south)
    for a, b in zip(sorted_blocks, sorted_blocks[1:]):
        if a.v_north > b.v_south + 1e-6:
            pytest.fail(
                f"Blocks overlap in v: rep {a.rep} ends at {a.v_north}, "
                f"rep {b.rep} starts at {b.v_south}"
            )


# ---------------------------------------------------------------------------
# Hard constraint: every strategy must produce grid-aligned edges
# ---------------------------------------------------------------------------

def test_all_strategies_grid_aligned_wide_tall_field():
    """All four strategies produce grid-aligned v edges on a field large enough for all.

    linear/staggered/free need 4 reps × 6 strips × 60 ft = 1440 ft of v-space.
    block_2x2 needs 2 rows × 360 ft = 720 ft v and 800 ft u.
    A 1000 × 1500 field satisfies both.
    """
    field = box(0, 0, 1000, 1500)
    for strategy in (place_block_2x2, place_linear, place_staggered, place_free):
        blocks = strategy(
            field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
        )
        assert blocks is not None, f"{strategy.__name__} returned None on 1000×1500 field"
        _assert_grid_aligned(blocks, SWATH, V_REF)


def test_grid_aligned_nonzero_v_ref():
    """Grid alignment holds for arbitrary non-zero v_ref."""
    v_ref = 37.5
    field = box(0, 0, 1200, 1200)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH,
        plot_length_ft=PLOT_L, v_ref=v_ref
    )
    _assert_grid_aligned(blocks, SWATH, v_ref)


def test_grid_aligned_spray_trial():
    """Spray trial: 3 strips (N=3), 300 ft plot, 3 reps → grid-aligned."""
    field = box(0, 0, 800, 1200)
    blocks = place_trial(
        field, n_reps=3, n_strips=3, swath_width_ft=SWATH, plot_length_ft=300.0
    )
    _assert_grid_aligned(blocks, SWATH)
    assert len(blocks) == 3


def test_grid_aligned_ground_speed_trial():
    """Ground speed: 2 strips, 800 ft plot, 4 reps → grid-aligned."""
    field = box(0, 0, 1800, 1200)
    blocks = place_trial(
        field, n_reps=4, n_strips=2, swath_width_ft=SWATH, plot_length_ft=800.0
    )
    _assert_grid_aligned(blocks, SWATH)
    assert len(blocks) == 4


# ---------------------------------------------------------------------------
# Square field — block_2x2 is the preferred strategy
# ---------------------------------------------------------------------------

def test_square_field_block_2x2_preferred():
    """Wide square field: place_trial uses block_2x2 (2 reps share v-band)."""
    field = box(0, 0, 1200, 1200)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 4
    # block_2x2 produces exactly 2 pairs with identical (v_south, v_north)
    v_ranges = [(b.v_south, b.v_north) for b in blocks]
    assert v_ranges[0] == v_ranges[1], "first two reps must share a v-band"
    assert v_ranges[2] == v_ranges[3], "last two reps must share a v-band"
    assert v_ranges[0] != v_ranges[2], "the two rows must be at different v levels"


def test_square_field_plot_dimensions():
    """Every block is exactly PLOT_L wide and N_STRIPS × SWATH tall."""
    field = box(0, 0, 1200, 1200)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    for block in blocks:
        assert abs(block.width_ft - PLOT_L) < 1e-6
        assert abs(block.height_ft - N_STRIPS * SWATH) < 1e-6


def test_square_field_blocks_within_field():
    """All block rectangles lie inside the square field boundary."""
    field = box(0, 0, 1200, 1200)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    for block in blocks:
        block_rect = box(block.u_west, block.v_south, block.u_east, block.v_north)
        assert field.contains(block_rect) or field.covers(block_rect), (
            f"Block for rep {block.rep} extends outside the field"
        )


def test_two_reps_single_row():
    """2 reps on a wide field → block_2x2 places them side by side in one row."""
    field = box(0, 0, 1200, 600)
    blocks = place_trial(
        field, n_reps=2, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 2
    assert blocks[0].v_south == blocks[1].v_south  # same row
    _assert_grid_aligned(blocks, SWATH)


# ---------------------------------------------------------------------------
# Narrow strip field — forces linear strategy
# ---------------------------------------------------------------------------

def test_narrow_strip_block_2x2_fails():
    """Field narrower than 2 × PLOT_L: block_2x2 returns None."""
    field = box(0, 0, 450, 2000)
    assert place_block_2x2(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    ) is None


def test_narrow_strip_linear_succeeds():
    """place_trial falls back to linear on a 450 ft wide field."""
    field = box(0, 0, 450, 2000)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 4
    _assert_grid_aligned(blocks, SWATH)
    _assert_no_block_overlap(blocks)


def test_narrow_strip_all_same_u_column():
    """Linear layout: all blocks have the same u_west (single column)."""
    field = box(0, 0, 450, 2000)
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    u_wests = [round(b.u_west, 6) for b in blocks]
    assert len(set(u_wests)) == 1, f"Expected one u column, got: {u_wests}"


def test_narrow_strip_stacked_south_to_north():
    """Linear blocks are stacked with no v-gap between them."""
    field = box(0, 0, 450, 2000)
    blocks = sorted(
        place_trial(
            field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
        ),
        key=lambda b: b.v_south,
    )
    for a, b in zip(blocks, blocks[1:]):
        assert abs(a.v_north - b.v_south) < 1e-6, (
            f"Gap between stacked reps: {a.v_north} ≠ {b.v_south}"
        )


# ---------------------------------------------------------------------------
# Staggered strategy
# ---------------------------------------------------------------------------

def test_staggered_alternates_u_positions():
    """place_staggered alternates u position: even reps west, odd reps east."""
    field = box(0, 0, 1000, 2000)
    blocks = place_staggered(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert blocks is not None
    # Rep 1 (idx 0) left, rep 2 (idx 1) right, rep 3 (idx 2) left, rep 4 (idx 3) right
    assert blocks[0].u_west < blocks[1].u_west, "rep 1 should be left of rep 2"
    assert blocks[2].u_west < blocks[3].u_west, "rep 3 should be left of rep 4"
    assert blocks[0].u_west == pytest.approx(blocks[2].u_west, abs=1e-6)
    _assert_grid_aligned(blocks, SWATH)


def test_staggered_one_rep_per_v_band():
    """Each staggered rep occupies a unique v-band."""
    field = box(0, 0, 1000, 2000)
    blocks = place_staggered(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert blocks is not None
    _assert_no_v_overlap(blocks)


def test_staggered_odd_reps():
    """place_staggered handles odd rep counts (unlike block_2x2)."""
    field = box(0, 0, 1000, 2000)
    assert place_block_2x2(
        field, n_reps=3, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    ) is None
    blocks = place_staggered(
        field, n_reps=3, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert blocks is not None
    assert len(blocks) == 3
    _assert_grid_aligned(blocks, SWATH)


# ---------------------------------------------------------------------------
# Free strategy
# ---------------------------------------------------------------------------

def test_free_places_all_reps():
    """place_free places all reps on a field large enough for sequential placement."""
    field = box(0, 0, 1000, 1500)  # 1500 ft > 4 × 6 × 60 = 1440 ft needed
    blocks = place_free(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert blocks is not None
    assert len(blocks) == 4
    _assert_grid_aligned(blocks, SWATH)


def test_free_no_block_overlap():
    """place_free never produces physically overlapping blocks."""
    field = box(0, 0, 1000, 1500)
    blocks = place_free(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert blocks is not None
    _assert_no_block_overlap(blocks)


# ---------------------------------------------------------------------------
# L-shaped / irregular field — generalization tests
# ---------------------------------------------------------------------------

def _upside_down_l_field():
    """Narrow bottom (500 ft wide) + wide top (1000 ft wide).

    block_2x2 fails because bottom rows are too narrow.
    linear/staggered/free succeed.
    """
    narrow_bottom = box(0, 0, 500, 720)   # 12 strips × 60 ft
    wide_top = box(0, 720, 1000, 1440)    # 12 strips × 60 ft
    return unary_union([narrow_bottom, wide_top])


def test_l_shaped_block_2x2_fails():
    """block_2x2 fails on an inverted-L field (bottom rows too narrow for 2 blocks)."""
    field = _upside_down_l_field()
    result = place_block_2x2(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert result is None


def test_l_shaped_place_trial_succeeds():
    """place_trial succeeds on the inverted-L field (falls back past block_2x2)."""
    field = _upside_down_l_field()
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 4
    _assert_grid_aligned(blocks, SWATH)
    _assert_no_block_overlap(blocks)


def test_l_shaped_blocks_fit_available_width():
    """Every block's u extent fits within the available field width at its v level."""
    from shapely.geometry import box as _box

    field = _upside_down_l_field()
    blocks = place_trial(
        field, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    for block in blocks:
        band = _box(-1e9, block.v_south, 1e9, block.v_north)
        clipped = field.intersection(band)
        u_min, _, u_max, _ = clipped.bounds
        assert block.u_west >= u_min - 1e-3, f"Rep {block.rep} extends west of field"
        assert block.u_east <= u_max + 1e-3, f"Rep {block.rep} extends east of field"


# ---------------------------------------------------------------------------
# Odd rep counts via place_trial
# ---------------------------------------------------------------------------

def test_place_trial_three_reps():
    """3 reps: block_2x2 skipped; linear/staggered succeed."""
    field = box(0, 0, 1200, 1200)
    blocks = place_trial(
        field, n_reps=3, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 3
    _assert_grid_aligned(blocks, SWATH)


def test_place_trial_six_reps():
    """6 reps (even): block_2x2 places 3 rows × 2 columns."""
    field = box(0, 0, 1200, 2400)
    blocks = place_trial(
        field, n_reps=6, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 6
    _assert_grid_aligned(blocks, SWATH)
    _assert_no_block_overlap(blocks)


def test_place_trial_eight_reps():
    """8 reps (max): block_2x2 succeeds if field is tall enough."""
    field = box(0, 0, 1200, 3000)
    blocks = place_trial(
        field, n_reps=8, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
    )
    assert len(blocks) == 8
    _assert_grid_aligned(blocks, SWATH)


# ---------------------------------------------------------------------------
# Failure cases
# ---------------------------------------------------------------------------

def test_field_too_small_raises():
    """Field too small for any strategy raises RuntimeError."""
    tiny = box(0, 0, 50, 50)
    with pytest.raises(RuntimeError, match="No layout strategy"):
        place_trial(
            tiny, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
        )


def test_all_strategies_return_none_for_tiny_field():
    """Individual strategies return None (not raise) when they cannot fit."""
    tiny = box(0, 0, 50, 50)
    for strategy in (place_block_2x2, place_linear, place_staggered, place_free):
        result = strategy(
            tiny, n_reps=4, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
        )
        assert result is None, f"{strategy.__name__} should return None, not raise"


def test_block_2x2_requires_even_reps():
    """place_block_2x2 returns None for odd n_reps."""
    field = box(0, 0, 1200, 1200)
    for odd in (1, 3, 5, 7):
        assert place_block_2x2(
            field, n_reps=odd, n_strips=N_STRIPS, swath_width_ft=SWATH, plot_length_ft=PLOT_L
        ) is None, f"Expected None for n_reps={odd}"
