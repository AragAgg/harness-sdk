"""Host execution environment used as the default when no sandbox is configured.

:class:`NotASandboxLocalEnvironment` runs commands, code, and file operations
directly on the host with **no isolation**. The deliberately blunt name (mirrored
from ``strands-ts/src/sandbox/not-a-sandbox-local-environment.ts``) is a warning:
this is the fallback an :class:`~strands.agent.agent.Agent` uses when no sandbox
is passed, not a security boundary.

Mirroring the TypeScript oracle, this extends :class:`~strands.sandbox.base.Sandbox`
directly: file operations use **native** :mod:`pathlib`/:mod:`os` calls, commands
use the host's native shell, and code runs through the selected interpreter.
"""

import os
import platform
import tempfile
from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from .base import Sandbox
from .constants import LANGUAGE_PATTERN
from .errors import SandboxPathNotFoundError
from .posix_shell import validate_env_keys
from .stream_process import _stream_process
from .types import ExecutionResult, FileInfo, SandboxEnvironment, StreamChunk

_IS_WINDOWS = platform.system() == "Windows"


class NotASandboxLocalEnvironment(Sandbox):
    """Run commands, code, and file operations on the host with no isolation.

    Used as the default execution environment when an :class:`Agent` is created
    without a ``sandbox``. Commands use ``sh`` on POSIX and PowerShell on Windows;
    code and file operations do not pass through a shell.

    .. warning::
        This provides **no isolation**. Commands run with the full privileges of
        the host process. Pass an explicit sandbox (e.g.
        :class:`~strands.sandbox.docker.DockerSandbox`) when isolation matters.
    """

    environment: SandboxEnvironment | None

    def __init__(self, cwd: str | os.PathLike[str] | None = None) -> None:
        """Create a host execution environment rooted at ``cwd``."""
        self.cwd = Path(cwd or os.getcwd()).resolve()
        self.environment = {
            "platform": platform.system(),
            "cwd": str(self.cwd),
            "shell": "PowerShell" if _IS_WINDOWS else "sh",
            "temp_dir": tempfile.gettempdir(),
        }

    def _resolve_path(self, path: str) -> Path:
        """Resolve ``path`` against this environment's working directory if relative."""
        return Path(path) if os.path.isabs(path) else self.cwd / path

    def _execution_cwd(self, cwd: str | None) -> str:
        return str(self._resolve_path(cwd)) if cwd is not None else str(self.cwd)

    async def execute_streaming(
        self,
        command: str,
        *,
        timeout: float | None = None,
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamChunk | ExecutionResult, None]:
        """Execute a command through the host's native shell, streaming output.

        Args:
            command: The shell command to execute.
            timeout: Maximum execution time in seconds. ``None`` means no timeout.
            cwd: Working directory for this command. Defaults to the process's
                current working directory.
            env: Environment variables added to the child process environment.
            **kwargs: Additional keyword arguments for forward compatibility.

        Yields:
            :class:`StreamChunk` objects for output, then a final
            :class:`ExecutionResult`.

        Raises:
            ValueError: If an environment variable name is invalid.
            SandboxTimeoutError: If execution exceeds ``timeout`` seconds.
        """
        validate_env_keys(env or {})
        target_cwd = self._execution_cwd(cwd)
        if not _IS_WINDOWS:
            async for chunk in _stream_process("sh", ["-c", command], timeout=timeout, cwd=target_cwd, env=env):
                yield chunk
            return

        script = "\n".join(
            (
                "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8",
                "$OutputEncoding = [System.Text.UTF8Encoding]::new($false)",
                command,
                "$ok = $?",
                "if (-not $ok) { if ($LASTEXITCODE) { exit $LASTEXITCODE } else { exit 1 } }",
            )
        )
        with tempfile.NamedTemporaryFile(suffix=".ps1", delete=False) as script_file:
            script_path = Path(script_file.name)
        script_path.write_text(script, encoding="utf-8-sig")
        try:
            async for chunk in _stream_process(
                "powershell.exe",
                ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", str(script_path)],
                timeout=timeout,
                cwd=target_cwd,
                env=env,
            ):
                yield chunk
        finally:
            script_path.unlink(missing_ok=True)

    async def execute_code_streaming(
        self,
        code: str,
        language: str,
        *,
        timeout: float | None = None,
        cwd: str | None = None,
        env: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> AsyncGenerator[StreamChunk | ExecutionResult, None]:
        """Execute code on the host by feeding it directly to an interpreter.

        Args:
            code: The source code to execute.
            language: The interpreter to use (e.g., ``"python3"``, ``"node"``).
            timeout: Maximum execution time in seconds. ``None`` means no timeout.
            cwd: Working directory for execution. Defaults to the process's current
                working directory.
            env: Environment variables added to the child process environment.
            **kwargs: Additional keyword arguments for forward compatibility.

        Yields:
            :class:`StreamChunk` objects for output, then a final
            :class:`ExecutionResult`.

        Raises:
            ValueError: If ``language`` contains invalid characters or an environment
                variable name is invalid.
            SandboxTimeoutError: If execution exceeds ``timeout`` seconds.
        """
        if not LANGUAGE_PATTERN.fullmatch(language):
            raise ValueError(f"language parameter contains invalid characters: {language}")
        validate_env_keys(env or {})
        async for chunk in _stream_process(
            language,
            [],
            timeout=timeout,
            enoent_message=f"Language interpreter not found: {language}",
            cwd=self._execution_cwd(cwd),
            env=env,
            input_data=code.encode(),
        ):
            yield chunk

    async def read_file(self, path: str, **kwargs: Any) -> bytes:
        """Read a file from the host filesystem as raw bytes.

        Args:
            path: Path to the file. Relative paths resolve against the current
                working directory.
            **kwargs: Additional keyword arguments for forward compatibility.

        Returns:
            The file contents as raw bytes.

        Raises:
            FileNotFoundError: If the file does not exist.
            OSError: If the file cannot be read.
        """
        return self._resolve_path(path).read_bytes()

    async def write_file(self, path: str, content: bytes, **kwargs: Any) -> None:
        """Write raw bytes to a file on the host, creating parent directories.

        Args:
            path: Path to the file. Relative paths resolve against the current
                working directory.
            content: The content to write.
            **kwargs: Additional keyword arguments for forward compatibility.

        Raises:
            OSError: If the file cannot be written.
        """
        full_path = self._resolve_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        full_path.write_bytes(content)

    async def remove_file(self, path: str, **kwargs: Any) -> None:
        """Remove a file from the host filesystem.

        Args:
            path: Path to the file. Relative paths resolve against the current
                working directory.
            **kwargs: Additional keyword arguments for forward compatibility.

        Raises:
            FileNotFoundError: If the file does not exist.
        """
        self._resolve_path(path).unlink()

    async def list_files(self, path: str, **kwargs: Any) -> list[FileInfo]:
        """List directory contents from the host filesystem, sorted by name.

        Unlike the shell-based base implementation, this reports native ``is_dir``
        and ``size`` metadata. If an entry's metadata cannot be read, it is still
        listed with ``is_dir``/``size`` left as ``None``.

        Args:
            path: Path to the directory. Relative paths resolve against the
                current working directory.
            **kwargs: Additional keyword arguments for forward compatibility.

        Returns:
            A list of :class:`FileInfo` entries for the directory contents.

        Raises:
            SandboxPathNotFoundError: If the directory does not exist or ``path``
                is not a directory. Permission and other errors propagate so
                callers can surface them.
        """
        full_path = self._resolve_path(path)
        results: list[FileInfo] = []
        try:
            scanner = os.scandir(full_path)
        except (FileNotFoundError, NotADirectoryError) as e:
            # A missing path (or a file where a directory was expected) is non-existence;
            # permission and other errors propagate so callers can surface them.
            raise SandboxPathNotFoundError(path) from e
        with scanner as entries:
            for entry in sorted(entries, key=lambda e: e.name):
                try:
                    stat = entry.stat()
                    results.append(FileInfo(name=entry.name, is_dir=entry.is_dir(), size=stat.st_size))
                except OSError:
                    results.append(FileInfo(name=entry.name))
        return results
