"""OneSignal service (mock + real)."""
import logging
from typing import Any, Dict, List, Optional

import httpx

from config import settings

log = logging.getLogger('onesignal')

ONESIGNAL_BASE = 'https://onesignal.com/api/v1'


class OneSignalService:
    def __init__(self):
        self.app_id = settings.ONESIGNAL_APP_ID
        self.rest_key = settings.ONESIGNAL_REST_API_KEY
        self.mock = settings.ONESIGNAL_MOCK_MODE
        self._mock_log: List[Dict[str, Any]] = []

    async def send_to_players(
        self,
        player_ids: List[str],
        heading: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        if self.mock or not player_ids:
            entry = {'heading': heading, 'content': content, 'data': data or {}, 'players': player_ids, 'mock': True}
            self._mock_log.append(entry)
            log.info(f'[MOCK onesignal] {heading}: {content} → players={player_ids}')
            return {'id': f'mock_{len(self._mock_log)}', 'recipients': len(player_ids), 'mock': True}

        payload = {
            'app_id': self.app_id,
            'include_player_ids': player_ids,
            'headings': {'en': heading},
            'contents': {'en': content},
            'data': data or {},
            'web_push_topic': 'xrpl-umm',
        }
        headers = {
            'Authorization': f'Basic {self.rest_key}',
            'Content-Type': 'application/json',
        }
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(f'{ONESIGNAL_BASE}/notifications', headers=headers, json=payload)
            if r.status_code != 200:
                log.warning(f'OneSignal send failed: {r.status_code} {r.text}')
                return {'error': r.text}
            return r.json()

    def mock_log(self) -> List[Dict[str, Any]]:
        return list(self._mock_log)


onesignal_service = OneSignalService()
