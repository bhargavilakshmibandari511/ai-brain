import structlog
import logging
import sys
from typing import Any, Dict

def setup_logging():
    """Configure structlog for JSON formatting in production and readable logs in dev."""
    
    # Check for Windows or non-interactive environments
    import os
    is_windows = os.name == 'nt'
    is_atty = sys.stderr.isatty()
    
    # Force simpler renderer if we suspect encoding issues on Windows
    # or if the user explicitly requested simple logs
    use_simple_renderer = os.getenv("SIMPLE_LOGS", "0") == "1" or (is_windows and not is_atty)

    if use_simple_renderer:
        renderer = structlog.processors.JSONRenderer() # JSON is safer for logs than rich console colors
    elif not is_atty:
        renderer = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=not is_windows) # Disable colors on older Windows CMD

    processors = [
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.StackInfoRenderer(),
        structlog.dev.set_exc_info,
        structlog.processors.TimeStamper(fmt="iso"),
        renderer
    ]

    structlog.configure(
        processors=processors,
        wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )

    # Patch standard logging to use structlog
    # On Windows, ensure the stream is wrapped or handled correctly for UTF-8 if possible
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=logging.INFO,
    )

def get_logger(name: str):
    return structlog.get_logger(name)
