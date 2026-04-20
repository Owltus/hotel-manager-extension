"""Build a ZIP package of the extension for addons.mozilla.org submission.

Usage:
    python build.py

Creates `hotel-manager-extension-vX.Y.Z.zip` with manifest.json at the root.
Excludes dev files (.claude, .git, *.zip, build.py itself, __pycache__).
"""

import json
import os
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SCRIPT_NAME = Path(__file__).name

# Fichiers/dossiers à inclure dans le ZIP. Tout le reste est ignoré.
INCLUDE = [
    "manifest.json",
    "background",
    "content-scripts",
    "icons",
    "lib",
    "popup",
]

# Motifs à exclure partout (fichiers cachés OS, backups, caches).
EXCLUDE_FILES = {".DS_Store", "Thumbs.db", "desktop.ini"}
EXCLUDE_SUFFIXES = (".pyc", ".pyo", ".log", ".tmp", ".bak")
EXCLUDE_DIRS = {"__pycache__", ".git", ".svn", ".idea", ".vscode"}


def should_skip(path: Path) -> bool:
    if path.name in EXCLUDE_FILES:
        return True
    if path.suffix in EXCLUDE_SUFFIXES:
        return True
    if any(part in EXCLUDE_DIRS for part in path.parts):
        return True
    return False


def read_version() -> str:
    manifest_path = ROOT / "manifest.json"
    if not manifest_path.is_file():
        sys.exit(f"Erreur : {manifest_path} introuvable.")
    with manifest_path.open(encoding="utf-8") as f:
        return json.load(f)["version"]


def collect_files() -> list[Path]:
    files: list[Path] = []
    for entry_name in INCLUDE:
        entry = ROOT / entry_name
        if not entry.exists():
            print(f"  [skip] {entry_name} (absent)")
            continue
        if entry.is_file():
            if not should_skip(entry):
                files.append(entry)
        else:
            for sub in entry.rglob("*"):
                if sub.is_file() and not should_skip(sub):
                    files.append(sub)
    return files


def main() -> None:
    version = read_version()
    zip_name = f"hotel-manager-extension-v{version}.zip"
    zip_path = ROOT / zip_name

    if zip_path.exists():
        zip_path.unlink()

    files = collect_files()
    if not any(f.name == "manifest.json" and f.parent == ROOT for f in files):
        sys.exit("Erreur : manifest.json absent de la racine.")

    print(f"Packaging v{version} — {len(files)} fichiers")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for f in files:
            arcname = f.relative_to(ROOT).as_posix()
            zf.write(f, arcname)
            print(f"  + {arcname}")

    size_kb = zip_path.stat().st_size / 1024
    print(f"\nOK : {zip_name} ({size_kb:.1f} KB)")
    print(f"Chemin complet : {zip_path}")


if __name__ == "__main__":
    main()
