from langchain_core.tools import StructuredTool

from app.tools.backend.analytics_tools import db_query
from app.tools.backend.documents_tools import create_document
from app.tools.backend.navigation_tools import navigate_to, open_panel
from app.tools.backend.notifications_tools import (
    broadcast_notification, create_notification, mark_notification_read, read_notifications
)
from app.tools.backend.posting_tools import post_team_message
from app.tools.backend.projects_tools import get_project, list_projects
from app.tools.backend.schedule_tools import create_schedule_event
from app.tools.backend.tasks_tools import assign_task, create_task, list_tasks, move_kanban_card, update_task
from app.tools.backend.teams_tools import list_team_members, list_teams
from app.tools.backend.problem_tools import fetch_available_problems, claim_problem_statement, register_project
from app.tools.memory_tools import memory_read, memory_traverse, memory_write
from app.tools.playwright_tools import ui_action
from app.tools.rag_tools import rag_search
from app.tools.web.image_tools import image_search
from app.tools.web.search_tools import web_search

# Admin: read/analyze/chat only — no write, navigation-into-others'-work, or delegation tools.
# This list is the actual enforcement of "admin has no write tools" — the system prompt (Stage 2)
# says so too, but a prompt is a suggestion the model could ignore; this is structural.
_ADMIN_TOOLS: list[StructuredTool] = [rag_search, memory_traverse, db_query, web_search, image_search, open_panel]

# Student/captain: the full operating-agent toolset.
_STUDENT_CAPTAIN_TOOLS: list[StructuredTool] = [
    rag_search, memory_read, memory_write, web_search, image_search, ui_action,
    create_task, update_task, assign_task, move_kanban_card, list_tasks,
    read_notifications, mark_notification_read, create_notification, broadcast_notification,
    create_schedule_event,
    post_team_message, create_document, navigate_to, list_team_members, list_teams, get_project, list_projects,
    fetch_available_problems, claim_problem_statement, register_project,
]


class ToolRegistry:
    """`for_role` is what makes role scoping structurally true — not just documented in a prompt."""

    def for_role(self, role: str, intent: str | None = None) -> list[StructuredTool]:
        tools = list(_ADMIN_TOOLS) if role.upper() == 'ADMIN' else list(_STUDENT_CAPTAIN_TOOLS)
        return self._filter_by_intent(tools, intent)

    def _filter_by_intent(self, tools: list[StructuredTool], intent: str | None) -> list[StructuredTool]:
        # Intent-scoped narrowing (e.g. only exposing schedule tools mid-scheduling-conversation)
        # is a Stage 8 agent-graph concern once real intents exist — this is the seam for it, not
        # a placeholder pretending to do something it doesn't yet.
        return tools


_registry = ToolRegistry()


def get_tool_registry() -> ToolRegistry:
    return _registry
