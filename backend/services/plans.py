"""Subscription tier definitions."""
TIER_DEFS = {
    'basic': {
        'id': 'basic',
        'name': 'Basic Access',
        'usd_price': 10.0,
        'amm_slots': 5,
        'swaps_per_24h': 2,
        'features': [
            '5 AMM tracking slots',
            '2 swaps / 24h',
            'Live alerts feed',
            '3-day free trial',
        ],
        'badge': '3 DAY FREE TRIAL',
    },
    'plus': {
        'id': 'plus',
        'name': 'Plus Access',
        'usd_price': 15.0,
        'amm_slots': 15,
        'swaps_per_24h': 5,
        'features': [
            '15 AMM tracking slots',
            '5 swaps / 24h',
            'Priority alerts',
            'Rank-based filters',
        ],
        'badge': None,
    },
    'ultimate': {
        'id': 'ultimate',
        'name': 'Ultimate Pro',
        'usd_price': 25.0,
        'amm_slots': 50,
        'swaps_per_24h': 15,
        'features': [
            '50 AMM tracking slots',
            '15 swaps / 24h',
            'Whale rank intelligence',
            'OneSignal priority pushes',
        ],
        'badge': 'ELITE',
    },
}


def get_tier(tier_id: str):
    return TIER_DEFS.get(tier_id)


def slots_for(tier_id: str | None) -> int:
    if not tier_id:
        return 1
    t = TIER_DEFS.get(tier_id)
    return t['amm_slots'] if t else 1
