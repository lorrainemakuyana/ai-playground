from __future__ import annotations

import os
import re
from dataclasses import dataclass, field

# Matches <file path="some/path.ext">...contents...</file>
_FILE_RE = re.compile(
    r'<file\s+path=["\']([^"\']+)["\']>\n?(.*?)\n?</file>',
    re.DOTALL,
)

# Matches a START COMMAND section at the end of the output
_START_CMD_RE = re.compile(
    r'(?:##?\s*START COMMAND[^\n]*\n)(.*?)(?=\n##?|\Z)',
    re.DOTALL | re.IGNORECASE,
)


@dataclass
class ParsedProject:
    files: dict[str, str] = field(default_factory=dict)   # path → content
    start_command: str = ""


def parse_output(text: str) -> ParsedProject:
    """Extract <file> blocks and START COMMAND section from agent output."""
    result = ParsedProject()

    for match in _FILE_RE.finditer(text):
        path = os.path.normpath(match.group(1).strip().lstrip("/"))
        if path.startswith(".."):
            continue
        content = match.group(2)
        result.files[path] = content

    cmd_match = _START_CMD_RE.search(text)
    if cmd_match:
        result.start_command = cmd_match.group(1).strip()

    return result


def merge_outputs(outputs: list[str]) -> ParsedProject:
    """Merge file outputs from multiple agents. Later outputs win on conflict."""
    merged = ParsedProject()
    for output in outputs:
        parsed = parse_output(output)
        merged.files.update(parsed.files)
        if parsed.start_command:
            merged.start_command = parsed.start_command
    return merged


def detect_project_type(files: dict[str, str]) -> str:
    """Infer project type from the file tree."""
    paths = set(files.keys())
    if any(p == "package.json" or p.endswith("/package.json") for p in paths):
        pkg = next((v for k, v in files.items() if k == "package.json"), "")
        if "next" in pkg:
            return "nextjs"
        if "react" in pkg:
            return "react"
        return "node"
    if any(p == "requirements.txt" or p.endswith(".py") for p in paths):
        return "python"
    if any(p == "go.mod" or p.endswith(".go") for p in paths):
        return "go"
    if any(p == "Gemfile" or p.endswith(".rb") for p in paths):
        return "ruby"
    if any(p == "Cargo.toml" or p.endswith(".rs") for p in paths):
        return "rust"
    return "unknown"


_START_COMMANDS: dict[str, str] = {
    "nextjs":  "npm install\nnpm run dev",
    "react":   "npm install\nnpm start",
    "node":    "npm install\nnode index.js",
    "python":  "pip install -r requirements.txt\npython main.py",
    "go":      "go mod download\ngo run .",
    "ruby":    "bundle install\nruby app.rb",
    "rust":    "cargo build\ncargo run",
    "unknown": "# Install dependencies and run the entry point for your project",
}


def default_start_command(project_type: str) -> str:
    return _START_COMMANDS.get(project_type, _START_COMMANDS["unknown"])
