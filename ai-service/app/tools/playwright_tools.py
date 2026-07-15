"""Playwright UI automation tool for the AI agent.

`ui_action` — the only Playwright entry point for the agent. It:
  1. Acquires (or reuses) the headed per-user browser session.
  2. Executes an ordered list of *steps* (navigate, click, fill, submit, etc.)
  3. Emits a `tool.progress` SSE frame after every step so the user sees live
     breadcrumb updates in the ChatDock.
  4. Verifies the goal by reading a DOM element after all steps complete.
  5. Retries the whole sequence up to `max_tries` times with exponential backoff.

Replaces the old read-only `playwright_browse` tool.
"""
import asyncio
import json
import logging
from typing import Any

from playwright.async_api import Page, TimeoutError as PWTimeout

from app.browser.auth_bridge import get_browser_jwt
from app.browser.session import APP_BASE_URL, get_or_create_session
from app.core.identity import get_current_identity
from app.integrations.events import emit_ui_event
from app.tools.base import audited_tool

logger = logging.getLogger(__name__)

# ── Step helpers ─────────────────────────────────────────────────────────────

STEP_TIMEOUT_MS = 8_000  # default per-step timeout


async def _execute_step(page: Page, step: dict[str, Any], emit_progress) -> str:
    """Execute one step descriptor and return a short status string."""
    stype = step.get("type", "").lower()
    selector = step.get("selector", "")
    value = step.get("value", "")
    url = step.get("url", "")
    timeout = step.get("timeout", STEP_TIMEOUT_MS)

    if stype == "navigate":
        destination = url if url.startswith("http") else f"{APP_BASE_URL}{url}"
        await page.goto(destination, wait_until="domcontentloaded", timeout=timeout)
        emit_progress(stype, selector or url, "done")
        return f"navigated to {destination}"

    elif stype == "click":
        await page.locator(selector).first.click(timeout=timeout)
        emit_progress(stype, selector, "done")
        return f"clicked {selector}"

    elif stype == "fill":
        await page.locator(selector).first.fill(value, timeout=timeout)
        emit_progress(stype, selector, "done")
        return f"filled {selector} with '{value}'"

    elif stype == "select":
        await page.locator(selector).first.select_option(value, timeout=timeout)
        emit_progress(stype, selector, "done")
        return f"selected '{value}' in {selector}"

    elif stype == "submit":
        # Prefer pressing Enter on the selector; fallback to clicking it.
        if selector:
            try:
                await page.locator(selector).first.press("Enter", timeout=timeout)
            except Exception:
                await page.locator(selector).first.click(timeout=timeout)
        else:
            await page.keyboard.press("Enter")
        emit_progress(stype, selector or "form", "done")
        return f"submitted {selector or 'form'}"

    elif stype == "wait_for":
        await page.locator(selector).first.wait_for(state="visible", timeout=timeout)
        emit_progress(stype, selector, "done")
        return f"element visible: {selector}"

    elif stype == "read_text":
        text = await page.locator(selector).first.inner_text(timeout=timeout)
        emit_progress(stype, selector, "done")
        return f"text content: {text[:300]}"

    elif stype == "screenshot":
        path = step.get("path", "/tmp/pv_screenshot.png")
        await page.screenshot(path=path)
        emit_progress(stype, path, "done")
        return f"screenshot saved to {path}"

    elif stype == "wait_ms":
        ms = int(step.get("ms", 1000))
        await asyncio.sleep(ms / 1000)
        emit_progress("wait", str(ms) + "ms", "done")
        return f"waited {ms}ms"

    else:
        raise ValueError(f"Unknown step type: '{stype}'")


# ── ui_action tool ────────────────────────────────────────────────────────────

@audited_tool
async def ui_action(
    steps: list[dict],
    goal_description: str = "",
    verify_selector: str = "",
    max_tries: int = 3,
) -> dict:
    """Execute an ordered sequence of browser UI steps against the ProjectVerse
    frontend (localhost:7333) using a headed (visible) Chromium session.

    Each step is a dict with at minimum a `type` field:
      - navigate  : {type, url}
      - click     : {type, selector}
      - fill      : {type, selector, value}
      - select    : {type, selector, value}
      - submit    : {type, selector?}
      - wait_for  : {type, selector}
      - read_text : {type, selector}
      - screenshot: {type, path?}
      - wait_ms   : {type, ms}

    `goal_description` is a human-readable description of what success looks like
    (returned in the result so the agent can confirm to the user).
    `verify_selector` is an optional CSS selector that must be visible on the page
    after all steps complete — used as a hard DOM verification checkpoint.
    `max_tries` is the retry budget (default 3) before giving up.

    Emits `tool.progress` SSE events after every step so the user sees live
    breadcrumb updates in the ChatDock while the browser is running.
    """
    if not steps:
        return {"error": "no_steps", "detail": "steps list is empty"}

    identity = get_current_identity()
    user_id = identity.user_id

    # Fetch a short-lived JWT and ensure the browser is open and authenticated
    jwt = await get_browser_jwt()
    page = await get_or_create_session(user_id, jwt)

    # Convenience closure so steps can emit progress without importing events directly
    def emit_progress(step_type: str, target: str, status: str) -> None:
        emit_ui_event("tool.progress", {
            "step_type": step_type,
            "target": target,
            "status": status,
        })

    last_error: str = ""
    step_results: list[str] = []

    for attempt in range(1, max_tries + 1):
        step_results = []
        try:
            for idx, step in enumerate(steps):
                emit_progress(
                    step.get("type", "step"),
                    step.get("selector") or step.get("url") or f"step {idx + 1}",
                    "running",
                )
                result_str = await _execute_step(page, step, emit_progress)
                step_results.append(result_str)

            # DOM verification checkpoint
            if verify_selector:
                try:
                    await page.locator(verify_selector).first.wait_for(
                        state="visible", timeout=5000
                    )
                    emit_progress("verify", verify_selector, "done")
                except PWTimeout:
                    raise ValueError(
                        f"Verification failed: '{verify_selector}' not visible after steps."
                    )

            return {
                "success": True,
                "attempts": attempt,
                "goal": goal_description,
                "steps_completed": step_results,
            }

        except Exception as exc:
            last_error = str(exc)
            logger.warning(
                "ui_action attempt %d/%d failed for user %s: %s",
                attempt, max_tries, user_id, last_error,
            )
            emit_ui_event("tool.progress", {
                "step_type": "retry",
                "target": f"attempt {attempt}/{max_tries}",
                "status": "failed",
            })
            if attempt < max_tries:
                await asyncio.sleep(1.5 ** attempt)  # exponential backoff

    return {
        "success": False,
        "attempts": max_tries,
        "goal": goal_description,
        "steps_completed": step_results,
        "error": last_error,
    }
