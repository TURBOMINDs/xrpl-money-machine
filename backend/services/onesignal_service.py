"""OneSignal service: real REST API + safe degradation.

Three operating modes (auto-detected per call):
  1) MOCK     — `ONESIGNAL_MOCK_MODE=true`. Logs locally only.
  2) DEGRADED — mock_mode=false but REST key missing. Logs + warns.
  3) LIVE     — mock_mode=false AND REST key set. Sends real REST call.

Public helpers:
  send_to_players(player_ids, heading, content, data)
  send_to_external_ids(external_user_ids, heading, content, data)
  broadcast(heading, content, data)        # all subscribed users
  mock_log()
"""
import logging
from typing import Any, Dict, List, Optional

import httpx

from config import settings

log = logging.getLogger('onesignal')

ONESIGNAL_BASE = 'https://onesignal.com/api/v1'


class OneSignalService:
    def __init__(self):
        self._mock_log: List[Dict[str, Any]] = []

    @property
    def app_id(self) -> str:
        return settings.ONESIGNAL_APP_ID or ''

    @property
    def rest_key(self) -> str:
        return settings.ONESIGNAL_REST_API_KEY or ''

    @property
    def mode(self) -> str:
        if settings.ONESIGNAL_MOCK_MODE:
            return 'mock'
        if not self.app_id or self.app_id.startswith('mock'):
            return 'mock'
        if not self.rest_key or self.rest_key.startswith('mock'):
            return 'degraded'
        return 'live'

    async def _post_notification(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        headers = {
            'Authorization': f'Basic {self.rest_key}',
            'Content-Type': 'application/json',
            'accept': 'application/json',
        }
        async with httpx.AsyncClient(timeout=10) as hc:
            r = await hc.post(f'{ONESIGNAL_BASE}/notifications', headers=headers, json=payload)
            try:
                body = r.json()
            except Exception:
                body = {'raw': r.text}
            if r.status_code >= 400:
                log.warning(f'OneSignal send failed: {r.status_code} {body}')
                return {'error': body, 'status_code': r.status_code}
            return body

    async def send_to_players(
        self,
        player_ids: List[str],
        heading: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self._send(
            target={'include_player_ids': player_ids},
            heading=heading, content=content, data=data,
            mock_label=f'players={player_ids}',
        )

    async def send_to_external_ids(
        self,
        external_user_ids: List[str],
        heading: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        # Modern OneSignal v16 uses include_aliases with external_id alias
        target = {
            'include_aliases': {'external_id': external_user_ids},
            'target_channel': 'push',
        }
        return await self._send(
            target=target,
            heading=heading, content=content, data=data,
            mock_label=f'external_ids={external_user_ids}',
        )

    async def broadcast(
        self,
        heading: str,
        content: str,
        data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        return await self._send(
            target={'included_segments': ['Subscribed Users']},
            heading=heading, content=content, data=data,
            mock_label='broadcast',
        )

    async def _send(
        self,
        target: Dict[str, Any],
        heading: str,
        content: str,
        data: Optional[Dict[str, Any]],
        mock_label: str,
    ) -> Dict[str, Any]:
        mode = self.mode
        if mode in ('mock', 'degraded'):
            entry = {
                'heading': heading,
                'content': content,
                'data': data or {},
                'target': target,
                'mode': mode,
            }
            self._mock_log.append(entry)
            level = log.warning if mode == 'degraded' else log.info
            level(f'[{mode} onesignal] {heading}: {content} → {mock_label}')
            return {'id': f'{mode}_{len(self._mock_log)}', mode: True}

        # LIVE
        payload = {
            'app_id': self.app_id,
            'headings': {'en': heading},
            'contents': {'en': content},
            'data': data or {},
            'web_push_topic': 'xrpl-umm',
            **target,
        }
        return await self._post_notification(payload)

    def mock_log(self) -> List[Dict[str, Any]]:
        return list(self._mock_log)


onesignal_service = OneSignalService()
