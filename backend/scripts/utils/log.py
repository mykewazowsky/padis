"""
Minimal colored logging helper for the PADIS pipeline.

All output goes to stdout except error(), which writes to stderr.
Colors are applied only when stdout is a real terminal (isatty),
so piped output and log files remain plain text.

Format: [STEP] message  — only the [STEP] prefix is colored.
"""

import sys

_USE_COLOR = sys.stdout.isatty()
_RESET  = "\033[0m"
_GREEN  = "\033[32m"
_RED    = "\033[31m"
_YELLOW = "\033[33m"
_CYAN   = "\033[36m"
_BOLD   = "\033[1m"
_DIM    = "\033[2m"


def _col(code: str, text: str) -> str:
    return f"{code}{text}{_RESET}" if _USE_COLOR else text


def info(step: str, msg: str = "") -> None:
    prefix = _col(_CYAN, f"[{step}]")
    print(f"{prefix} {msg}" if msg else prefix)


def ok(step: str, msg: str = "") -> None:
    prefix = _col(_GREEN, f"[{step}]")
    print(f"{prefix} {msg}" if msg else prefix)


def warn(step: str, msg: str = "") -> None:
    prefix = _col(_YELLOW, f"[{step}]")
    print(f"{prefix} {msg}" if msg else prefix)


def error(step: str, msg: str = "") -> None:
    prefix = _col(_RED, f"[{step}]")
    print(f"{prefix} {msg}" if msg else prefix, file=sys.stderr)


def progress(n: int, total: int, msg: str = "") -> None:
    prefix = _col(_DIM, f"[{n}/{total}]")
    print(f"  {prefix} {msg}" if msg else f"  {prefix}")


def header(title: str) -> None:
    bar = "─" * (len(title) + 4)
    b = _col(_BOLD, bar)
    t = _col(_BOLD, f"  {title}")
    print(f"\n{b}\n{t}\n{b}")
