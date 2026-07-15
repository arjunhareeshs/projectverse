"""Per-user singleton headed Chromium browser session.

One browser per user_id — launched on first `ui_action` call, kept alive across
tool invocations in the same session, auto-closed after IDLE_TIMEOUT_SECONDS of
no activity.  `headed=True` means the window is fully visible on screen so the
user can watch the agent navigate in real time.
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field

from playwright.async_api import Browser, BrowserContext, Page, Playwright, async_playwright

logger = logging.getLogger(__name__)

IDLE_TIMEOUT_SECONDS = 300  # 5 minutes
APP_BASE_URL = "http://localhost:7333"


@dataclass
class _Session:
    playwright: Playwright
    browser: Browser
    context: BrowserContext
    page: Page
    last_used: float = field(default_factory=time.monotonic)

    async def close(self) -> None:
        try:
            await self.context.close()
        except Exception:
            pass
        try:
            await self.browser.close()
        except Exception:
            pass
        try:
            await self.playwright.stop()
        except Exception:
            pass


# Global session store: user_id -> _Session
_sessions: dict[str, _Session] = {}
_lock = asyncio.Lock()


async def get_or_create_session(user_id: str, jwt: str | None = None) -> Page:
    """Return the existing page for `user_id`, or launch a new headed browser.

    If `jwt` is provided and this is a new session, it is injected into the
    browser's localStorage (`pv_token`) before the first navigation so the
    React app treats the session as authenticated.
    """
    async with _lock:
        session = _sessions.get(user_id)

        # Close stale session if idle
        if session is not None:
            idle = time.monotonic() - session.last_used
            if idle > IDLE_TIMEOUT_SECONDS:
                logger.info("Browser session for %s idle %.0fs — closing", user_id, idle)
                await session.close()
                session = None
                _sessions.pop(user_id, None)

        if session is None:
            logger.info("Launching headed browser for user %s", user_id)
            pw = await async_playwright().start()
            browser = await pw.chromium.launch(
                headless=False,          # ← visible window
                slow_mo=120,            # slight slow-mo so human eye can follow
                args=["--start-maximized"],
            )
            context = await browser.new_context(
                viewport=None,           # respect the maximized window
                no_viewport=True,
            )
            page = await context.new_page()

            # Inject auth token before first navigation if provided
            if jwt:
                # Navigate to a blank page first so localStorage can be set
                await page.goto(APP_BASE_URL, wait_until="domcontentloaded", timeout=15000)
                await page.evaluate(f"localStorage.setItem('pv_token', '{jwt}')")
                logger.info("JWT injected into browser localStorage for user %s", user_id)

            session = _Session(playwright=pw, browser=browser, context=context, page=page)
            _sessions[user_id] = session

        session.last_used = time.monotonic()
        return session.page


async def close_session(user_id: str) -> None:
    """Explicitly close and destroy the browser session for a user."""
    async with _lock:
        session = _sessions.pop(user_id, None)
        if session:
            await session.close()
            logger.info("Browser session closed for user %s", user_id)


async def touch_session(user_id: str) -> None:
    """Update the last-used timestamp to prevent idle eviction."""
    async with _lock:
        session = _sessions.get(user_id)
        if session:
            session.last_used = time.monotonic()
