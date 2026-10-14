"""Read optional runtime metadata declared by a sandbox."""

from __future__ import annotations

import re
from typing import Any

_POWERSHELL = re.compile(r"^(powershell|pwsh)", re.IGNORECASE)


def described_environment(sandbox: Any) -> dict[str, str | None]:
    """Return valid string values from a sandbox's optional environment descriptor."""
    described = getattr(sandbox, "environment", None)

    def pick(key: str) -> str | None:
        value = described.get(key) if isinstance(described, dict) else getattr(described, key, None)
        return value if isinstance(value, str) and value else None

    return {
        "platform": pick("platform"),
        "cwd": pick("cwd"),
        "shell": pick("shell"),
        "temp_dir": pick("temp_dir"),
    }


def is_powershell(shell: str | None) -> bool:
    """Return whether ``shell`` identifies Windows PowerShell or pwsh."""
    return shell is not None and _POWERSHELL.match(shell) is not None
