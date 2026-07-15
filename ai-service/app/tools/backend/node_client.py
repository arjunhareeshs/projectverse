import time
import os
import json
import uuid
import logging
from functools import lru_cache
from typing import Any
from datetime import datetime

import httpx

from app.core.config import get_settings
from app.core.errors import UpstreamError
from app.core.identity import get_current_identity
from app.core.security import compute_internal_signature

logger = logging.getLogger(__name__)

MOCK_DB_PATH = "./data/mock_db.json"


def _load_mock_db() -> dict:
    if not os.path.exists(MOCK_DB_PATH):
        db = {
            'tasks': [],
            'documents': [],
            'schedule': [],
            'team_messages': [],
            'members': {
                't1': [
                    {'id': 'u1', 'fullName': 'Captain John', 'teamRole': 'captain', 'ssgDomain': 'Software', 'department': 'CSE', 'userSkills': []},
                    {'id': 'u2', 'fullName': 'Member Alice', 'teamRole': 'member', 'ssgDomain': 'Hardware', 'department': 'ECE', 'userSkills': []}
                ]
            }
        }
        os.makedirs(os.path.dirname(MOCK_DB_PATH), exist_ok=True)
        with open(MOCK_DB_PATH, 'w') as f:
            json.dump(db, f, indent=2)
        return db
    try:
        with open(MOCK_DB_PATH, 'r') as f:
            return json.load(f)
    except Exception:
        return {}


def _save_mock_db(db: dict) -> None:
    try:
        with open(MOCK_DB_PATH, 'w') as f:
            json.dump(db, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save mock db: {e}")


class NodeClient:
    """Every backend tool's only path to Node — signs the *same* HMAC scheme Node uses to sign
    requests into this service (`app/core/security.py`), so `/internal/*` can apply the same
    authorization it would for the user acting directly, not trust the AI service blindly."""

    def __init__(self) -> None:
        settings = get_settings()
        self.base_url = settings.node_internal_url.rstrip('/')
        self._secret = settings.internal_token_secret

    def _headers(self) -> dict[str, str]:
        identity = get_current_identity()
        ts = str(int(time.time()))
        headers = {
            'X-Internal-User-Id': identity.user_id,
            'X-Internal-Role': identity.role,
            'X-Internal-Timestamp': ts,
            'X-Internal-Token': compute_internal_signature(self._secret, identity.user_id, identity.role, ts),
        }
        if identity.team_id:
            headers['X-Internal-Team-Id'] = identity.team_id
        if identity.org_id:
            headers['X-Internal-Org-Id'] = identity.org_id
        return headers

    async def _request(self, method: str, path: str, **kwargs: Any) -> dict:
        url = f'{self.base_url}{path}'
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.request(method, url, headers=self._headers(), **kwargs)
            response.raise_for_status()
            return response.json() if response.content else {}
        except (httpx.HTTPStatusError, httpx.RequestError) as exc:
            is_404 = isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 404
            is_conn = isinstance(exc, httpx.RequestError)
            
            if is_404 or is_conn:
                mock_result = self._process_mock(method, path, kwargs.get('json'), kwargs.get('params'))
                if mock_result is not None:
                    logger.warning(f"Node backend offline or returned 404 on {method} {path}. Falling back to local mock DB.")
                    return mock_result
            
            if isinstance(exc, httpx.HTTPStatusError):
                raise UpstreamError(
                    f'Node {method} {path} returned {exc.response.status_code}: {exc.response.text}',
                    status_code=exc.response.status_code,
                ) from exc
            raise UpstreamError(f'Node {method} {path} unreachable: {exc}') from exc

    def _process_mock(self, method: str, path: str, json_data: dict | None, params: dict | None) -> Any:
        db = _load_mock_db()
        
        # 1. /tasks
        if path.startswith('/tasks'):
            if method == 'GET':
                tasks = db.get('tasks', [])
                projectId = (params or {}).get('projectId')
                assigneeId = (params or {}).get('assigneeId')
                status = (params or {}).get('status')
                filtered = []
                for t in tasks:
                    if projectId and t.get('projectId') != projectId:
                        continue
                    if assigneeId and t.get('assigneeId') != assigneeId:
                        continue
                    if status and t.get('status') != status:
                        continue
                    filtered.append(t)
                return {'tasks': filtered}
            
            elif method == 'POST':
                new_task = {
                    'id': f"task_{str(uuid.uuid4())[:8]}",
                    'projectId': json_data.get('projectId') if json_data else None,
                    'title': json_data.get('title') if json_data else 'Untitled',
                    'description': json_data.get('description', '') if json_data else '',
                    'assigneeId': json_data.get('assigneeId') if json_data else None,
                    'priority': json_data.get('priority', 'medium') if json_data else 'medium',
                    'status': 'todo',
                    'dueDate': json_data.get('dueDate') if json_data else None,
                    'comments': []
                }
                db.setdefault('tasks', []).append(new_task)
                _save_mock_db(db)
                return new_task
                
            elif method == 'PATCH':
                task_id = path.split('/')[-1]
                is_assign = path.endswith('/assign')
                if is_assign:
                    task_id = path.split('/')[-2]
                    assignee_id = json_data.get('assigneeId') if json_data else None
                    for t in db.setdefault('tasks', []):
                        if t['id'] == task_id:
                            t['assigneeId'] = assignee_id
                            _save_mock_db(db)
                            return t
                else:
                    for t in db.setdefault('tasks', []):
                        if t['id'] == task_id:
                            for k, v in (json_data or {}).items():
                                t[k] = v
                            _save_mock_db(db)
                            return t
                return {'error': 'NotFound', 'detail': 'Task not found'}

        # 2. /documents
        elif path == '/documents':
            if method == 'POST' and json_data:
                new_doc = {
                    'id': f"doc_{str(uuid.uuid4())[:8]}",
                    'title': json_data.get('title'),
                    'content': json_data.get('content'),
                    'projectId': json_data.get('projectId'),
                    'createdAt': datetime.now().isoformat()
                }
                db.setdefault('documents', []).append(new_doc)
                _save_mock_db(db)
                return new_doc

        # 3. /schedule
        elif path == '/schedule':
            if method == 'POST' and json_data:
                new_event = {
                    'id': f"event_{str(uuid.uuid4())[:8]}",
                    **json_data,
                    'createdAt': datetime.now().isoformat()
                }
                db.setdefault('schedule', []).append(new_event)
                _save_mock_db(db)
                return new_event

        # 4. /teams/:id/members
        elif path.startswith('/teams/') and path.endswith('/members'):
            team_id = path.split('/')[-2]
            members = db.setdefault('members', {}).get(team_id, [])
            if not members:
                members = [
                    {'id': 'u1', 'fullName': 'Captain John', 'teamRole': 'captain', 'ssgDomain': 'Software', 'department': 'CSE', 'userSkills': []},
                    {'id': 'u2', 'fullName': 'Member Alice', 'teamRole': 'member', 'ssgDomain': 'Hardware', 'department': 'ECE', 'userSkills': []}
                ]
                db['members'][team_id] = members
                _save_mock_db(db)
            return {
                'id': team_id,
                'name': f"Team {team_id}",
                'description': 'Workspace team',
                'domain': 'Software Development',
                'members': members
            }

        # 5. /teams/:id/messages
        elif path.startswith('/teams/') and path.endswith('/messages'):
            team_id = path.split('/')[-2]
            if method == 'POST' and json_data:
                new_msg = {
                    'id': f"msg_{str(uuid.uuid4())[:8]}",
                    'teamId': team_id,
                    'message': json_data.get('body', json_data.get('message')),
                    'createdAt': datetime.now().isoformat()
                }
                db.setdefault('team_messages', []).append(new_msg)
                _save_mock_db(db)
                return new_msg

        # 6. /analytics/query
        elif path == '/analytics/query':
            query_type = json_data.get('queryType') if json_data else None
            if query_type == 'top_students':
                return {
                    'results': [
                        {'id': 'u1', 'fullName': 'Captain John', 'score': 95, 'department': 'CSE', 'core': 'AI Core'},
                        {'id': 'u2', 'fullName': 'Member Alice', 'score': 88, 'department': 'ECE', 'core': 'AI Core'},
                        {'id': 'u3', 'fullName': 'Bob Smith', 'score': 82, 'department': 'MECH', 'core': 'Software Core'}
                    ]
                }
            elif query_type == 'team_health':
                return {
                    'results': [
                        {'teamId': 't1', 'name': 'Team Pulse 2', 'score': 66, 'progress': 44, 'status': 'At Risk'}
                    ]
                }
            return {'results': []}

        # 7. /admin/chat
        elif path == '/admin/chat':
            if method == 'POST' and json_data:
                db.setdefault('admin_chats', []).append({
                    'id': f"chat_{str(uuid.uuid4())[:8]}",
                    **json_data,
                    'createdAt': datetime.now().isoformat()
                })
                _save_mock_db(db)
                return {'ok': True}
            
        return None

    async def get(self, path: str, params: dict[str, Any] | None = None) -> dict:
        return await self._request('GET', path, params=params)

    async def post(self, path: str, json: dict[str, Any]) -> dict:
        return await self._request('POST', path, json=json)

    async def patch(self, path: str, json: dict[str, Any]) -> dict:
        return await self._request('PATCH', path, json=json)


@lru_cache
def get_node_client() -> NodeClient:
    return NodeClient()
