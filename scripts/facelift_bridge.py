#!/usr/bin/env python3
"""Bridge between artist-site-factory (TypeScript) and the site-facelift package (PyPI: site-facelift).

site-facelift's console script only accepts a single URL (`facelift <url>`) and runs its whole
redesign pipeline. The factory needs three of its building blocks individually, so this bridge
imports them directly:

  selftest   import check; prints the installed version and prompt sizes
  crawl      bounded crawl of one site with facelift.crawler's helpers (validate_seed,
             fetch_to_disk, extract_html_links/assets, extract_css_assets) — facelift's own
             crawl_site() is unbounded, so the loop lives here
  validate   facelift.prompts.VALIDATION_PROMPT run through facelift.claude_runner.run_claude
             inside a generated project (writes the validation report)
  cleanup    facelift.prompts.CLEANUP_PROMPT, same mechanism (applies obvious fixes and writes
             the deferred-decisions log)

Every subcommand prints exactly one JSON object on the last line of stdout.
Always invoked as:  <venv python> -I -X utf8 scripts/facelift_bridge.py <subcommand> ...
"""
from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from collections import deque
from pathlib import Path


def _emit(obj: dict) -> None:
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def _logger() -> logging.Logger:
    logger = logging.getLogger("facelift-bridge")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stderr)
        handler.setFormatter(logging.Formatter("%(message)s"))
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
    return logger


def cmd_selftest(_args: argparse.Namespace) -> int:
    import facelift.claude_runner  # noqa: F401
    import facelift.crawler  # noqa: F401
    import facelift.sentinel  # noqa: F401
    from facelift import prompts

    try:
        from importlib.metadata import version

        installed = version("site-facelift")
    except Exception:  # pragma: no cover - metadata missing
        installed = "unknown"
    _emit(
        {
            "ok": True,
            "version": installed,
            "validationPromptChars": len(prompts.VALIDATION_PROMPT),
            "cleanupPromptChars": len(prompts.CLEANUP_PROMPT),
        }
    )
    return 0


def _looks_like_html(path: Path) -> bool:
    if path.suffix.lower() in {".html", ".htm"} or path.name == "index.html":
        return True
    if path.suffix:
        return False
    try:
        head = path.read_bytes()[:512].lower()
    except OSError:
        return False
    return b"<html" in head or b"<!doctype html" in head


def cmd_crawl(args: argparse.Namespace) -> int:
    from facelift import crawler

    dest = Path(args.dest)
    dest.mkdir(parents=True, exist_ok=True)
    try:
        seed = crawler.validate_seed(args.url)
    except Exception as exc:  # SeedError, network errors
        _emit({"ok": False, "error": str(exc), "pages": 0, "files": 0})
        return 0

    queue: deque[str] = deque([seed])
    seen = {seed}
    pages = assets = errors = 0

    def enqueue(url: str) -> None:
        url = url.split("#", 1)[0]
        if url and url not in seen and crawler.is_same_host_strict(url, seed):
            seen.add(url)
            queue.append(url)

    while queue and (pages < args.max_pages or assets < args.max_assets):
        url = queue.popleft()
        local = crawler.url_to_local_path(url, dest)
        expected_page = local.suffix.lower() in {".html", ".htm"} or not local.suffix or local.name == "index.html"
        if expected_page and pages >= args.max_pages:
            continue
        if not expected_page and assets >= args.max_assets:
            continue
        try:
            newly = crawler.fetch_to_disk(url, dest)
        except Exception:
            errors += 1
            continue
        if newly and args.delay > 0:
            time.sleep(args.delay)
        if not local.exists():
            continue
        if _looks_like_html(local):
            pages += 1
            body = local.read_text(encoding="utf-8", errors="replace")
            for link in crawler.extract_html_links(body, base_url=url):
                enqueue(link)
            for asset in crawler.extract_html_assets(body, base_url=url):
                enqueue(asset)
        else:
            assets += 1
            if local.suffix.lower() == ".css":
                body = local.read_text(encoding="utf-8", errors="replace")
                for asset in crawler.extract_css_assets(body, base_url=url):
                    enqueue(asset)

    _emit({"ok": True, "seed": seed, "pages": pages, "assets": assets, "files": pages + assets, "errors": errors})
    return 0


_CLAUDE_SESSION_VARS = (
    "CLAUDECODE",
    "CLAUDE_CODE_ENTRYPOINT",
    "CLAUDE_CODE_SESSION_ID",
    "CLAUDE_CODE_CHILD_SESSION",
    "CLAUDE_CODE_SESSION_ATTENDED",
    "CLAUDE_CODE_MESSAGING_SOCKET",
    "CLAUDE_CODE_MESSAGING_TOKEN",
    "CLAUDE_CODE_EXECPATH",
    "CLAUDE_PID",
    "CLAUDE_AGENT_SDK_VERSION",
)


def _strip_nested_claude_env() -> None:
    # facelift launches `claude -p` headlessly, as from a normal terminal. When the factory itself was
    # started from a Claude Code session, that session's markers would tie the headless run to it, so
    # drop them (the factory also passes a clean environment; this covers direct bridge invocations).
    # CLAUDE_EFFORT / ANTHROPIC_MODEL are left alone: the factory sets them deliberately for the review.
    for key in _CLAUDE_SESSION_VARS:
        os.environ.pop(key, None)


def _run_prompt(prompt: str, run_root: Path, expected: Path) -> int:
    _strip_nested_claude_env()
    from facelift.claude_runner import run_claude

    try:
        run_claude(prompt=prompt, cwd=run_root, logger=_logger())
    except Exception as exc:
        _emit({"ok": False, "error": str(exc)})
        return 0
    _emit({"ok": expected.exists(), "report": str(expected)})
    return 0


def cmd_validate(args: argparse.Namespace) -> int:
    from facelift.prompts import VALIDATION_PROMPT

    prompt = VALIDATION_PROMPT.format(site_output_dir=args.site_dir, validation_report_path=args.report)
    if args.dry_run:
        _emit({"ok": True, "dryRun": True, "prompt": prompt})
        return 0
    run_root = Path(args.run_root)
    return _run_prompt(prompt, run_root, run_root / args.report)


def cmd_cleanup(args: argparse.Namespace) -> int:
    from facelift.prompts import CLEANUP_PROMPT

    prompt = CLEANUP_PROMPT.format(
        validation_report_path=args.report,
        site_output_dir=args.site_dir,
        deferred_decisions_path=args.deferred,
    )
    if args.dry_run:
        _emit({"ok": True, "dryRun": True, "prompt": prompt})
        return 0
    run_root = Path(args.run_root)
    return _run_prompt(prompt, run_root, run_root / args.deferred)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="facelift_bridge")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("selftest")

    crawl = sub.add_parser("crawl")
    crawl.add_argument("--url", required=True)
    crawl.add_argument("--dest", required=True)
    crawl.add_argument("--max-pages", type=int, default=1)
    crawl.add_argument("--max-assets", type=int, default=40)
    crawl.add_argument("--delay", type=float, default=0.5)

    for name in ("validate", "cleanup"):
        p = sub.add_parser(name)
        p.add_argument("--run-root", required=True)
        p.add_argument("--site-dir", default=".")
        p.add_argument("--report", required=True)
        if name == "cleanup":
            p.add_argument("--deferred", required=True)
        p.add_argument("--dry-run", action="store_true")

    args = parser.parse_args(argv)
    handlers = {"selftest": cmd_selftest, "crawl": cmd_crawl, "validate": cmd_validate, "cleanup": cmd_cleanup}
    try:
        return handlers[args.command](args)
    except Exception as exc:  # never crash the factory with a traceback-only exit
        _emit({"ok": False, "error": f"{type(exc).__name__}: {exc}"})
        return 0


if __name__ == "__main__":
    sys.exit(main())
