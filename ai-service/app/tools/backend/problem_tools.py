import os
import json
import logging
from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from app.core.errors import UpstreamError
from app.tools.backend.node_client import get_node_client
from app.tools.base import audited_tool

logger = logging.getLogger(__name__)

EXCEL_PATH = r"c:\SSG projects\ProjectVerse\ProjectVerse Ai\data\Final Groups and Project Registration.xlsx"
JSON_DB_PATH = r"c:\SSG projects\ProjectVerse\ProjectVerse Ai\ai-service\data\problems_db.json"


def init_mock_db() -> None:
    if os.path.exists(JSON_DB_PATH):
        return
    logger.info("Initializing local mock problems database from Excel...")
    try:
        if not os.path.exists(EXCEL_PATH):
            raise FileNotFoundError(f"Excel file not found at {EXCEL_PATH}")

        df = pd.read_excel(EXCEL_PATH, sheet_name='Project Registrations')
        problems = []
        for index, row in df.iterrows():
            proj_title = str(row.get('Project Title', '')).strip()
            proj_desc = str(row.get('Project Description', '')).strip()
            proj_id = str(row.get('Final Project ID', row.get('Project ID', ''))).strip()
            if not proj_title or not proj_id or proj_id.lower() == 'nan':
                continue
            
            # Extract skills
            skills = []
            for col in df.columns:
                if 'Skill Set' in col:
                    skill_val = str(row.get(col, '')).strip()
                    if skill_val and skill_val.lower() != 'nan':
                        skills.append(skill_val)
            
            # Classify type
            desc_lower = proj_desc.lower()
            if 'sensor' in desc_lower or 'hardware' in desc_lower or 'iot' in desc_lower:
                if 'software' in desc_lower or 'app' in desc_lower or 'web' in desc_lower:
                    ptype = 'hardware+software'
                else:
                    ptype = 'hardware'
            else:
                ptype = 'software'
            
            problems.append({
                'id': proj_id,
                'code': proj_id,
                'title': proj_title,
                'description': proj_desc,
                'domain': 'AI' if 'ai' in desc_lower or 'learning' in desc_lower else 'General',
                'core': 'AI Core' if 'ai' in desc_lower or 'learning' in desc_lower else 'General Core',
                'sector': 'Technology',
                'type': ptype,
                'difficulty': 'Medium',
                'requiredSkills': skills,
                'sourceOrg': 'BITS Sathy',
                'status': 'available',
                'claimedByTeamId': None,
                'claimedAt': None,
                'lockExpiresAt': None,
                'uniquenessNotes': None,
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat()
            })
        
        os.makedirs(os.path.dirname(JSON_DB_PATH), exist_ok=True)
        with open(JSON_DB_PATH, 'w') as f:
            json.dump(problems, f, indent=2)
        logger.info(f"Mock database initialized with {len(problems)} problem statements.")
    except Exception as e:
        logger.exception("Failed to initialize mock database from Excel. Using fallback problems.")
        fallback_problems = [
            {
                'id': 'PROJ001',
                'code': 'PROJ001',
                'title': 'AI-Powered Crop Yield Predictor',
                'description': 'Predict crop yield based on soil and weather data using machine learning algorithms and IoT sensor inputs.',
                'domain': 'Agriculture',
                'core': 'AI Core',
                'sector': 'AgriTech',
                'type': 'hardware+software',
                'difficulty': 'Medium',
                'requiredSkills': ['Machine Learning', 'Python', 'IoT', 'Data Science'],
                'sourceOrg': 'BITS Sathy',
                'status': 'available',
                'claimedByTeamId': None,
                'claimedAt': None,
                'lockExpiresAt': None,
                'uniquenessNotes': None,
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat()
            },
            {
                'id': 'PROJ002',
                'code': 'PROJ002',
                'title': 'Secure Medical Record Portal',
                'description': 'A blockchain-based medical record portal to securely store and share patient health records with cryptographic audit logs.',
                'domain': 'Healthcare',
                'core': 'Software Core',
                'sector': 'MedTech',
                'type': 'software',
                'difficulty': 'Hard',
                'requiredSkills': ['Blockchain', 'Cryptography', 'Full-Stack Software Development', 'React'],
                'sourceOrg': 'MedNet',
                'status': 'available',
                'claimedByTeamId': None,
                'claimedAt': None,
                'lockExpiresAt': None,
                'uniquenessNotes': None,
                'createdAt': datetime.now().isoformat(),
                'updatedAt': datetime.now().isoformat()
            }
        ]
        os.makedirs(os.path.dirname(JSON_DB_PATH), exist_ok=True)
        with open(JSON_DB_PATH, 'w') as f:
            json.dump(fallback_problems, f, indent=2)


def load_mock_problems() -> list[dict]:
    init_mock_db()
    try:
        with open(JSON_DB_PATH, 'r') as f:
            problems = json.load(f)
        now = datetime.now()
        updated = False
        for p in problems:
            if p.get('status') == 'claimed' and p.get('lockExpiresAt'):
                try:
                    expires = datetime.fromisoformat(p['lockExpiresAt'])
                    if now > expires:
                        p['status'] = 'available'
                        p['claimedByTeamId'] = None
                        p['claimedAt'] = None
                        p['lockExpiresAt'] = None
                        updated = True
                except Exception:
                    pass
        if updated:
            save_mock_problems(problems)
        return problems
    except Exception:
        return []


def save_mock_problems(problems: list[dict]) -> None:
    try:
        with open(JSON_DB_PATH, 'w') as f:
            json.dump(problems, f, indent=2)
    except Exception as e:
        logger.error(f"Failed to save mock problems: {e}")


def query_mock_problems(status: str | None = None, domain: str | None = None, core: str | None = None, sector: str | None = None, type_val: str | None = None) -> list[dict]:
    problems = load_mock_problems()
    filtered = []
    for p in problems:
        if status and p.get('status') != status:
            continue
        if domain and p.get('domain') != domain:
            continue
        if core and p.get('core') != core:
            continue
        if sector and p.get('sector') != sector:
            continue
        if type_val and p.get('type') != type_val:
            continue
        filtered.append(p)
    return filtered


def claim_mock_problem(problem_id: str, team_id: str) -> dict:
    problems = load_mock_problems()
    for p in problems:
        if p['id'] == problem_id:
            if p['status'] in ('claimed', 'taken') and p['claimedByTeamId'] != team_id:
                if p['status'] == 'claimed' and p.get('lockExpiresAt'):
                    try:
                        expires = datetime.fromisoformat(p['lockExpiresAt'])
                        if datetime.now() < expires:
                            return {'error': 'Conflict', 'detail': 'Problem already claimed or registered.'}
                    except Exception:
                        pass
                else:
                    return {'error': 'Conflict', 'detail': 'Problem already taken.'}
            
            p['status'] = 'claimed'
            p['claimedByTeamId'] = team_id
            p['claimedAt'] = datetime.now().isoformat()
            p['lockExpiresAt'] = (datetime.now() + timedelta(minutes=5)).isoformat()
            save_mock_problems(problems)
            return p
    return {'error': 'NotFound', 'detail': f'Problem {problem_id} not found.'}


def register_mock_problem(problem_id: str, team_id: str, uniqueness_notes: str) -> dict:
    problems = load_mock_problems()
    for p in problems:
        if p['id'] == problem_id:
            if p['status'] == 'taken' and p['claimedByTeamId'] != team_id:
                return {'error': 'Conflict', 'detail': 'Problem already taken.'}
            p['status'] = 'taken'
            p['claimedByTeamId'] = team_id
            p['claimedAt'] = p.get('claimedAt') or datetime.now().isoformat()
            p['lockExpiresAt'] = None
            p['uniquenessNotes'] = uniqueness_notes
            save_mock_problems(problems)
            return p
    return {'error': 'NotFound', 'detail': f'Problem {problem_id} not found.'}


@audited_tool
async def fetch_available_problems(domain: str = '', core: str = '', sector: str = '', type_val: str = '') -> list[dict]:
    """Fetch available problem statements filtered by parameters."""
    client = get_node_client()
    params = {'status': 'available'}
    if domain: params['domain'] = domain
    if core: params['core'] = core
    if sector: params['sector'] = sector
    if type_val: params['type'] = type_val
    try:
        result = await client.get('/problems', params=params)
        return result.get('problems', [])
    except UpstreamError as exc:
        if exc.status_code == 404:
            return query_mock_problems(status='available', domain=domain or None, core=core or None, sector=sector or None, type_val=type_val or None)
        raise


@audited_tool
async def claim_problem_statement(team_id: str, problem_id: str) -> dict:
    """Atomic claim_problem_statement tool. Attempts to claim a problem statement for a team.
    Returns the problem statement object if successful, or a conflict error dictionary."""
    client = get_node_client()
    try:
        return await client.post(f'/problems/{problem_id}/claim', {'teamId': team_id})
    except UpstreamError as exc:
        if exc.status_code == 404:
            res = claim_mock_problem(problem_id, team_id)
            if 'error' in res:
                raise UpstreamError(res['detail'], status_code=409 if res['error'] == 'Conflict' else 404)
            return res
        raise


@audited_tool
async def register_project(team_id: str, problem_id: str, thesis: dict) -> dict:
    """Register a project based on a claimed problem statement with a uniqueness thesis."""
    client = get_node_client()
    try:
        return await client.post(f'/problems/{problem_id}/register', {'teamId': team_id, 'thesis': thesis})
    except UpstreamError as exc:
        if exc.status_code == 404:
            notes = json.dumps(thesis)
            res = register_mock_problem(problem_id, team_id, notes)
            if 'error' in res:
                raise UpstreamError(res['detail'], status_code=409 if res['error'] == 'Conflict' else 404)
            return res
        raise
