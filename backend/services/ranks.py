"""Whale rank classification per problem statement screenshots."""
from typing import Optional, Tuple

RANK_DEFS = [
    ('humpback', 100_000, None, '100,000+ XRP'),
    ('whale', 50_000, 99_999, '50,000-99,999 XRP'),
    ('shark', 25_000, 49_999, '25,000-49,999 XRP'),
    ('orca', 7_000, 24_999, '7,000-24,999 XRP'),
    ('dolphin', 5_000, 6_999, '5,000-6,999 XRP'),
    ('octopus', 2_000, 4_999, '2,000-4,999 XRP'),
    ('crab', 500, 1_999, '500-1,999 XRP'),
    ('shrimp', 1, 499, '1-499 XRP'),
]


def classify_rank(xrp_balance: float) -> str:
    if xrp_balance is None:
        return 'shrimp'
    if xrp_balance >= 100_000:
        return 'humpback'
    if xrp_balance >= 50_000:
        return 'whale'
    if xrp_balance >= 25_000:
        return 'shark'
    if xrp_balance >= 7_000:
        return 'orca'
    if xrp_balance >= 5_000:
        return 'dolphin'
    if xrp_balance >= 2_000:
        return 'octopus'
    if xrp_balance >= 500:
        return 'crab'
    return 'shrimp'


def rank_threshold(rank: str) -> Tuple[float, Optional[float]]:
    for r, mn, mx, _ in RANK_DEFS:
        if r == rank:
            return mn, mx
    return 0.0, None


def all_ranks():
    return [{'rank': r, 'min': mn, 'max': mx, 'label': label} for r, mn, mx, label in RANK_DEFS]
