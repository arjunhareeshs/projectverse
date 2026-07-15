import json
import logging
from datetime import datetime
from typing import Any

from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langgraph.graph import END, START, StateGraph
from langgraph.types import interrupt

from app.agents.state import AgentState
from app.core.errors import UpstreamError
from app.core.identity import RequestIdentity, current_identity
from app.llm.provider import LLMProvider
from app.prompts import get_prompt_library
from app.memory.vault import Vault
from app.rag.query import get_rag_query
from app.tools.backend.teams_tools import list_team_members
from app.tools.backend.problem_tools import fetch_available_problems, claim_problem_statement, register_project
from app.integrations.events import current_event_sink

logger = logging.getLogger(__name__)


async def assemble_team_profile_node(state: AgentState) -> dict:
    identity = state['identity']
    team_id = identity.get('team_id')
    if not team_id:
        return {'scratch': {**state.get('scratch', {}), 'team_profile': 'No team ID associated with this identity.'}}
    
    token = current_identity.set(RequestIdentity(**identity))
    try:
        members_data = await list_team_members.coroutine(team_id=team_id)
        if 'error' in members_data:
            return {'scratch': {**state.get('scratch', {}), 'team_profile': f"Failed to retrieve team members: {members_data.get('detail')}"}}
        
        name = members_data.get('name', 'Unknown')
        description = members_data.get('description', 'None')
        domain = members_data.get('domain', 'None')
        
        profile_parts = [
            f"Team Name: {name}",
            f"Description: {description}",
            f"Domain: {domain}",
            "\nMembers and Skills:"
        ]
        
        for member in members_data.get('members', []):
            m_id = member.get('id')
            m_name = member.get('fullName', 'Unknown')
            m_role = member.get('teamRole', 'member')
            m_domain = member.get('ssgDomain', 'Unknown')
            m_dept = member.get('department', 'Unknown')
            
            skills = member.get('userSkills', [])
            skills_str = ", ".join([
                f"{s.get('skillName')} ({s.get('skillType')} rank {s.get('skillRank')}/{s.get('totalRanks')})"
                for s in skills
            ]) if skills else "None registered"
            
            interests = ""
            try:
                vault = Vault(m_id)
                if vault.exists('interests.md'):
                    interests = vault.read('interests.md').body.strip()
            except Exception:
                pass
            
            m_profile = f"- {m_name} ({m_role})\n  Domain: {m_domain} | Dept: {m_dept}\n  Skills: {skills_str}"
            if interests:
                m_profile += f"\n  Interests: {interests}"
            profile_parts.append(m_profile)
            
        team_profile = "\n".join(profile_parts)
        return {'scratch': {**state.get('scratch', {}), 'team_profile': team_profile}}
    except Exception as e:
        logger.exception("Error assembling team profile")
        return {'scratch': {**state.get('scratch', {}), 'team_profile': f"Error assembling profile: {str(e)}"}}
    finally:
        current_identity.reset(token)


async def fetch_candidates_node(state: AgentState) -> dict:
    team_profile = state['scratch'].get('team_profile', '')
    
    desc_lower = team_profile.lower()
    has_hw = 'domain: hardware' in desc_lower or 'ssg domain: hardware' in desc_lower
    has_sw = 'domain: software' in desc_lower or 'ssg domain: software' in desc_lower
    
    if has_hw and has_sw:
        type_val = 'hardware+software'
    elif has_hw:
        type_val = 'hardware'
    else:
        type_val = 'software'
        
    identity = state['identity']
    token = current_identity.set(RequestIdentity(**identity))
    try:
        candidates = await fetch_available_problems.coroutine(type_val=type_val)
        if isinstance(candidates, dict) and 'error' in candidates:
            logger.error(f"Error fetching candidates: {candidates.get('detail')}")
            candidates = []
        
        if not candidates and type_val == 'hardware+software':
            hw = await fetch_available_problems.coroutine(type_val='hardware')
            sw = await fetch_available_problems.coroutine(type_val='software')
            candidates = (hw if isinstance(hw, list) else []) + (sw if isinstance(sw, list) else [])
            
        if not candidates:
            all_cands = await fetch_available_problems.coroutine(type_val='')
            candidates = all_cands if isinstance(all_cands, list) else []
            
        excluded = state['scratch'].get('excluded_problems', [])
        candidates = [c for c in candidates if c['id'] not in excluded]
        
        return {'scratch': {**state.get('scratch', {}), 'candidates': candidates, 'inferred_type': type_val}}
    except Exception as e:
        logger.exception("Error fetching candidates")
        return {'scratch': {**state.get('scratch', {}), 'candidates': []}}
    finally:
        current_identity.reset(token)


def make_semantic_shortlist_node(llm_provider: LLMProvider):
    async def semantic_shortlist_node(state: AgentState) -> dict:
        team_profile = state['scratch'].get('team_profile', '')
        candidates = state['scratch'].get('candidates', [])
        if not candidates:
            return {'scratch': {**state.get('scratch', {}), 'shortlist': []}}
            
        available_ids = {c['id'] for c in candidates}
        rag = get_rag_query()
        rag_results = []
        try:
            nodes = rag.search(team_profile[:500], namespace='kb_problems', k=20)
            seen_ids = set()
            for node in nodes:
                p_id = node.metadata.get('doc_id') or node.metadata.get('problem_id')
                if p_id in available_ids and p_id not in seen_ids:
                    seen_ids.add(p_id)
                    matching_cand = next(c for c in candidates if c['id'] == p_id)
                    rag_results.append(matching_cand)
        except Exception:
            pass
            
        seen_ids = {r['id'] for r in rag_results}
        for c in candidates:
            if c['id'] not in seen_ids:
                rag_results.append(c)
                seen_ids.add(c['id'])
                
        top_candidates = rag_results[:10]
        candidates_str = "\n\n".join([
            f"ID: {c['id']}\nCode: {c['code']}\nTitle: {c['title']}\nDescription: {c['description']}\nRequired Skills: {', '.join(c.get('requiredSkills', []))}"
            for c in top_candidates
        ])
        
        prompt = get_prompt_library().render(
            "skills/problem_shortlist",
            team_profile=team_profile,
            candidates=candidates_str
        )
        
        response = await llm_provider.chat([SystemMessage(content=prompt)])
        res_text = response.content.strip()
        
        try:
            if '```json' in res_text:
                res_text = res_text.split('```json')[1].split('```')[0].strip()
            elif '```' in res_text:
                res_text = res_text.split('```')[1].split('```')[0].strip()
            data = json.loads(res_text)
            shortlist = data.get('shortlist', [])
            
            final_shortlist = []
            for idx, item in enumerate(shortlist):
                p_id = item.get('problem_id')
                problem = next((c for c in candidates if c['id'] == p_id), None)
                if problem:
                    cand_copy = dict(problem)
                    cand_copy['fit_reasoning'] = item.get('fit_reasoning')
                    cand_copy['rank'] = idx + 1
                    final_shortlist.append(cand_copy)
            
            return {'scratch': {**state.get('scratch', {}), 'shortlist': final_shortlist[:5]}}
        except Exception as e:
            logger.error(f"Failed to parse LLM shortlist: {e}")
            final_shortlist = []
            for idx, c in enumerate(top_candidates[:5]):
                cand_copy = dict(c)
                cand_copy['fit_reasoning'] = "Fits the team capability profile."
                cand_copy['rank'] = idx + 1
                final_shortlist.append(cand_copy)
            return {'scratch': {**state.get('scratch', {}), 'shortlist': final_shortlist}}
            
    return semantic_shortlist_node


def make_plan_node(llm_provider: LLMProvider):
    async def plan_node(state: AgentState) -> dict:
        team_profile = state['scratch'].get('team_profile', '')
        shortlist = state['scratch'].get('shortlist', [])
        shortlist_str = json.dumps(shortlist, indent=2)
        
        system_prompt = f"""You are the Captain's Project Advisor.
Your goal is to guide the captain in selecting the best project/problem statement for their team.

TEAM CAPABILITY PROFILE:
{team_profile}

CURRENT SHORTLIST OF 5 PROJECT STATEMENTS:
{shortlist_str}

IMPORTANT RULES:
1. Always present the 5 shortlist candidates clearly if they haven't been shown yet or if a new shortlist was generated.
2. Ground all advice in the team profile and the project descriptions.
3. Be professional, direct, and helpful.
4. Encourage the captain to choose a project from the list, or ask questions to refine the choice.
5. If the captain is ready to choose one (e.g. PROJ001), let them say so.
"""
        messages = [SystemMessage(content=system_prompt)] + state['messages']
        ai_msg = await llm_provider.chat(messages)
        return {'messages': [ai_msg]}
        
    return plan_node


async def converse_node(state: AgentState) -> dict:
    user_input = interrupt({
        'stage': 'converse',
        'shortlist': state['scratch'].get('shortlist', []),
        'prompt': 'Confirm your choice from the shortlist, ask questions, or request different projects.'
    })
    return {'messages': [HumanMessage(content=user_input)]}


async def classify_captain_message(messages: list, shortlist: list[dict], llm_provider: LLMProvider) -> dict:
    history_str = "\n".join([f"{type(m).__name__}: {m.content}" for m in messages[-5:]])
    shortlist_ids = [c['id'] for c in shortlist]
    
    prompt = f"""Analyze the captain's latest message in the context of the project statement selection conversation.

SHORTLIST CANDIDATES AVAILABLE:
{json.dumps(shortlist_ids)}

CONVERSATION HISTORY:
{history_str}

Classify the captain's intent into one of the following:
- SELECT: The user has selected a specific project statement from the shortlist to claim/register (e.g. "let's go with PROJ001", "I choose the blockchain project", "finalise project PROJ002").
- QUESTION: The user is asking questions about the projects, team capability, details of a project, etc.
- RESEARCH: The user wants to see more projects, different domains, hardware instead of software, or re-run the shortlist.

Return strict JSON with the following schema:
{{
  "intent": "SELECT" | "QUESTION" | "RESEARCH",
  "selected_problem_id": "<id of the selected problem, if intent is SELECT, else null>"
}}
Ensure selected_problem_id is one of the available shortlist candidate IDs.
"""
    
    response = await llm_provider.chat([SystemMessage(content=prompt)])
    res_text = response.content.strip()
    try:
        if '```json' in res_text:
            res_text = res_text.split('```json')[1].split('```')[0].strip()
        elif '```' in res_text:
            res_text = res_text.split('```')[1].split('```')[0].strip()
        data = json.loads(res_text)
        return data
    except Exception as e:
        logger.error(f"Failed to parse intent classification: {e}. Output was: {res_text}")
        last_content = messages[-1].content.lower()
        for p_id in shortlist_ids:
            if p_id.lower() in last_content:
                return {"intent": "SELECT", "selected_problem_id": p_id}
        if "hardware" in last_content or "software" in last_content or "different" in last_content or "more" in last_content:
            return {"intent": "RESEARCH", "selected_problem_id": None}
        return {"intent": "QUESTION", "selected_problem_id": None}


def make_classify_node(llm_provider: LLMProvider):
    async def classify_node(state: AgentState) -> dict:
        messages = state['messages']
        shortlist = state['scratch'].get('shortlist', [])
        classification = await classify_captain_message(messages, shortlist, llm_provider)
        return {
            'scratch': {
                **state.get('scratch', {}),
                'intent': classification.get('intent'),
                'selected_problem_id': classification.get('selected_problem_id')
            }
        }
    return classify_node


def make_uniqueness_node(llm_provider: LLMProvider):
    async def uniqueness_node(state: AgentState) -> dict:
        selected_id = state['scratch'].get('selected_problem_id')
        shortlist = state['scratch'].get('shortlist', [])
        
        problem = next((p for p in shortlist if p['id'] == selected_id), None)
        if not problem:
            problem = {'id': selected_id, 'title': 'Selected Project', 'description': 'Selected project.'}
            
        team_profile = state['scratch'].get('team_profile', '')
        
        prompt = get_prompt_library().render(
            "skills/problem_uniqueness",
            problem=f"ID: {problem.get('id')}\nTitle: {problem.get('title')}\nDescription: {problem.get('description')}",
            team_profile=team_profile
        )
        
        response = await llm_provider.chat([SystemMessage(content=prompt)])
        res_text = response.content.strip()
        
        thesis = {}
        try:
            if '```json' in res_text:
                res_text = res_text.split('```json')[1].split('```')[0].strip()
            elif '```' in res_text:
                res_text = res_text.split('```')[1].split('```')[0].strip()
            thesis = json.loads(res_text)
        except Exception:
            thesis = {
                "approach": "Standard implementation leveraging team Python/ML skills.",
                "method": "Execute in phases: database design, service setup, integration testing.",
                "value": "Provides a robust, scalable workflow tailored to user requirements.",
                "differentiation": "Avoids generic hardcoded implementations in favor of flexible services."
            }
            
        return {'scratch': {**state.get('scratch', {}), 'thesis': thesis}}
    return uniqueness_node


async def finalize_node(state: AgentState) -> dict:
    identity = state['identity']
    team_id = identity.get('team_id')
    user_id = identity.get('user_id')
    problem_id = state['scratch'].get('selected_problem_id')
    thesis = state['scratch'].get('thesis', {})
    
    if not team_id:
        err_msg = "Error: You must have a team_id associated with your user session to claim a project statement."
        return {'messages': [AIMessage(content=err_msg)]}
        
    token = current_identity.set(RequestIdentity(**identity))
    try:
        claim_result = await claim_problem_statement.coroutine(team_id=team_id, problem_id=problem_id)
        if isinstance(claim_result, dict) and 'error' in claim_result:
            return {'messages': [AIMessage(content=f"An error occurred claiming project: {claim_result.get('detail')}")]}
            
        reg_result = await register_project.coroutine(team_id=team_id, problem_id=problem_id, thesis=thesis)
        if isinstance(reg_result, dict) and 'error' in reg_result:
            # Handle conflict
            detail = str(reg_result.get('detail', ''))
            if 'conflict' in detail.lower() or '409' in detail:
                excluded = list(state['scratch'].get('excluded_problems', []))
                excluded.append(problem_id)
                conflict_msg = f"Another team has just claimed and taken `{problem_id}`. Let's find another project statement from the available pool."
                return {
                    'messages': [AIMessage(content=conflict_msg)],
                    'scratch': {
                        **state.get('scratch', {}),
                        'excluded_problems': excluded,
                        'selected_problem_id': None,
                        'intent': 'RESEARCH'
                    }
                }
            return {'messages': [AIMessage(content=f"An error occurred registering project: {detail}")]}
        
        project_md = f"""---
type: semantic
tags: [project, registration]
last_updated: {datetime.now().date().isoformat()}
---
# Finalized Project: [[{claim_result.get('title', 'Project')}]]
- ID: {problem_id}
- Code: {claim_result.get('code', problem_id)}
- Registration Date: {datetime.now().date().isoformat()}

## Uniqueness Thesis
- **Approach**: {thesis.get('approach', 'N/A')}
- **Method**: {thesis.get('method', 'N/A')}
- **Value**: {thesis.get('value', 'N/A')}
- **Differentiation**: {thesis.get('differentiation', 'N/A')}
"""
        # Write to captain's vault
        try:
            vault = Vault(user_id)
            vault.write('project.md', project_md, {'type': 'semantic', 'tags': ['project', 'registration']})
        except Exception as e:
            logger.error(f"Failed to write project.md in user vault: {e}")
            
        # Write to other team members' vaults
        try:
            members_data = await list_team_members.coroutine(team_id=team_id)
            if 'members' in members_data:
                for member in members_data['members']:
                    m_id = member.get('id')
                    if m_id and m_id != user_id:
                        try:
                            m_vault = Vault(m_id)
                            m_vault.write('project.md', project_md, {'type': 'semantic', 'tags': ['project', 'registration']})
                        except Exception as ve:
                            logger.error(f"Failed to write project.md to member vault {m_id}: {ve}")
        except Exception as e:
            logger.error(f"Failed to write project.md to team members: {e}")
            
        # Ingest into kb_teams RAG namespace
        try:
            rag = get_rag_query()
            vault = Vault(user_id)
            file_path = vault.path('project.md')
            rag.ingest_file(
                file_path=file_path,
                namespace='kb_teams',
                owner_type='team',
                owner_id=team_id,
                doc_type='project'
            )
            logger.info(f"Indexed project.md for team {team_id} into kb_teams")
        except Exception as e:
            logger.error(f"Failed to index project.md into kb_teams: {e}")
            
        event_sink = current_event_sink.get()
        if event_sink is not None:
            event_sink.append({
                'event': 'nav.to',
                'data': {'section': 'project'}
            })
            
        ans = f"Success! I have successfully claimed and registered the project **{claim_result.get('title')}** (Code: `{problem_id}`). Your team is now registered. Navigating you to the project dashboard..."
        return {
            'messages': [AIMessage(content=ans)],
            'scratch': {**state.get('scratch', {}), 'finalize_success': True}
        }
    except Exception as exc:
        return {'messages': [AIMessage(content=f"An error occurred: {str(exc)}")]}
    finally:
        current_identity.reset(token)


def route_after_classify(state: AgentState) -> str:
    intent = state['scratch'].get('intent')
    if intent == 'SELECT':
        return 'uniqueness'
    elif intent == 'RESEARCH':
        return 'candidates'
    else:
        return 'plan'


def route_after_finalize(state: AgentState) -> str:
    if state['scratch'].get('intent') == 'RESEARCH':
        return 'candidates'
    return END


def build_captain_graph(llm_provider: LLMProvider, checkpointer):
    graph = StateGraph(AgentState)
    
    graph.add_node('profile', assemble_team_profile_node)
    graph.add_node('candidates', fetch_candidates_node)
    graph.add_node('shortlist', make_semantic_shortlist_node(llm_provider))
    graph.add_node('plan', make_plan_node(llm_provider))
    graph.add_node('converse', converse_node)
    graph.add_node('classify', make_classify_node(llm_provider))
    graph.add_node('uniqueness', make_uniqueness_node(llm_provider))
    graph.add_node('finalize', finalize_node)
    
    graph.add_edge(START, 'profile')
    graph.add_edge('profile', 'candidates')
    graph.add_edge('candidates', 'shortlist')
    graph.add_edge('shortlist', 'plan')
    graph.add_edge('plan', 'converse')
    
    graph.add_edge('converse', 'classify')
    
    graph.add_conditional_edges(
        'classify',
        route_after_classify,
        {
            'uniqueness': 'uniqueness',
            'candidates': 'candidates',
            'plan': 'plan'
        }
    )
    
    graph.add_edge('uniqueness', 'finalize')
    
    graph.add_conditional_edges(
        'finalize',
        route_after_finalize,
        {
            'candidates': 'candidates',
            END: END
        }
    )
    
    return graph.compile(checkpointer=checkpointer)
