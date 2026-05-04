"""PADIS operational CLI.

Run with:
  python -m backend.scripts.cli.padis check
"""

from __future__ import annotations

import argparse
import os
import shutil
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
import webbrowser
from pathlib import Path
from typing import Iterable


VALID_MODES = ("analysis", "full", "preprocess", "web")
VALID_HAZARDS = ("drought", "flood", "multi")

BACKEND_URL = "http://127.0.0.1:5000"
BACKEND_HOST = "127.0.0.1"
BACKEND_PORT = 5000
FRONTEND_URL = "http://localhost:3000"
ADMIN_URL = f"{FRONTEND_URL}/admin"


class CheckReport:
    def __init__(self) -> None:
        self.failures: list[str] = []
        self.warnings: list[str] = []

    @property
    def ok(self) -> bool:
        return not self.failures and not self.warnings

    @property
    def failed(self) -> bool:
        return bool(self.failures)

    def ok_line(self, message: str) -> None:
        print(f"  [OK] {message}")

    def warn(self, message: str) -> None:
        self.warnings.append(message)
        print(f"  [WARN] {message}")

    def fail(self, message: str) -> None:
        self.failures.append(message)
        print(f"  [FAIL] {message}")

    def exit_code(self) -> int:
        if self.failures:
            return 1
        if self.warnings:
            return 2
        return 0


def find_project_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "backend" / "run.py").is_file() and (
            parent / "frontend" / "package.json"
        ).is_file():
            return parent
    raise RuntimeError("Project root PADIS tidak ditemukan.")


def read_env_file(path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not path.is_file():
        return values

    for raw_line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")
    return values


def ensure_dirs(paths: Iterable[Path]) -> None:
    for path in paths:
        path.mkdir(parents=True, exist_ok=True)
        print(f"  [OK] {path}")


def required_dirs(root: Path) -> list[Path]:
    return [
        root / "backend" / "data",
        root / "backend" / "data" / "raw",
        root / "backend" / "data" / "processed",
        root / "backend" / "data" / "output",
        root / "backend" / "data" / "output" / "zonal",
        root / "backend" / "data" / "output" / "analysis",
    ]


def run_checked(args: list[str], cwd: Path) -> int:
    print(f"  [RUN] {' '.join(args)}")
    completed = subprocess.run(args, cwd=str(cwd), check=False)
    return completed.returncode


def check_project(root: Path, *, verbose: bool = True) -> CheckReport:
    report = CheckReport()

    if verbose:
        print("PADIS CHECK")
        print(f"Project root: {root}")
        print()

    print("Files")
    backend_run = root / "backend" / "run.py"
    backend_main = root / "backend" / "scripts" / "main.py"
    backend_requirements = root / "backend" / "requirements.txt"
    frontend_package = root / "frontend" / "package.json"
    backend_env = root / "backend" / ".env"
    frontend_env = root / "frontend" / ".env.local"

    for path, label in [
        (backend_run, "backend/run.py"),
        (backend_main, "backend/scripts/main.py"),
        (backend_requirements, "backend/requirements.txt"),
        (frontend_package, "frontend/package.json"),
    ]:
        if path.is_file():
            report.ok_line(f"{label} ditemukan")
        else:
            report.fail(f"{label} tidak ditemukan")

    if backend_env.is_file():
        report.ok_line("backend/.env ditemukan")
    else:
        report.warn("backend/.env belum ada")

    if frontend_env.is_file():
        report.ok_line("frontend/.env.local ditemukan")
    else:
        report.warn("frontend/.env.local belum ada")

    print()
    print("Environment")
    backend_values = read_env_file(backend_env)
    frontend_values = read_env_file(frontend_env)

    if backend_values.get("DATABASE_URL"):
        report.ok_line("DATABASE_URL terkonfigurasi")
    else:
        report.warn("DATABASE_URL belum terkonfigurasi di backend/.env")

    frontend_base = frontend_values.get("NEXT_PUBLIC_API_BASE_URL")
    if frontend_base:
        report.ok_line("NEXT_PUBLIC_API_BASE_URL terkonfigurasi")
        if "5000" not in frontend_base:
            report.warn(
                "NEXT_PUBLIC_API_BASE_URL tidak terlihat mengarah ke port backend 5000"
            )
    else:
        report.warn("NEXT_PUBLIC_API_BASE_URL belum terkonfigurasi di frontend/.env.local")

    origins = backend_values.get("FRONTEND_ORIGINS", "")
    if "localhost:3000" in origins or "127.0.0.1:3000" in origins:
        report.ok_line("FRONTEND_ORIGINS memuat localhost frontend")
    else:
        report.warn("FRONTEND_ORIGINS belum memuat http://localhost:3000")

    print()
    print("Tools")
    report.ok_line(f"Python: {sys.executable}")

    npm = shutil.which("npm")
    if npm:
        report.ok_line(f"npm: {npm}")
    else:
        report.fail("npm tidak ditemukan di PATH")

    print()
    print("Folders")
    for path in required_dirs(root):
        if path.exists():
            report.ok_line(f"{path.relative_to(root)} ada")
        else:
            report.warn(f"{path.relative_to(root)} belum ada")

    if (root / "frontend" / "node_modules").is_dir():
        report.ok_line("frontend/node_modules ada")
    else:
        report.warn("frontend/node_modules belum ada; jalankan padis install --with-deps")

    print()
    if report.failed:
        print("Result: NOT READY")
    elif report.warnings:
        print("Result: PARTIAL READY")
    else:
        print("Result: READY")

    return report


def wait_for_url(url: str, timeout: float = 45.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with urllib.request.urlopen(url, timeout=2):
                return True
        except urllib.error.HTTPError:
            return True
        except (urllib.error.URLError, TimeoutError, OSError):
            time.sleep(1)
    return False


def is_tcp_port_open(host: str, port: int, timeout: float = 1.0) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except OSError:
        return False


def wait_for_tcp_port(host: str, port: int, timeout: float = 45.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        if is_tcp_port_open(host, port):
            return True
        time.sleep(1)
    return False


def wait_for_backend(timeout: float = 45.0) -> bool:
    if wait_for_url(BACKEND_URL, timeout=5):
        return True
    return wait_for_tcp_port(BACKEND_HOST, BACKEND_PORT, timeout=timeout)


def terminate_process(proc: subprocess.Popen | None, label: str) -> None:
    if proc is None or proc.poll() is not None:
        return
    print(f"  [STOP] {label}")
    proc.terminate()
    try:
        proc.wait(timeout=8)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=5)


def build_env() -> dict[str, str]:
    env = os.environ.copy()
    env.setdefault("PYTHONIOENCODING", "utf-8")
    env.setdefault("PYTHONUNBUFFERED", "1")
    return env


def cmd_install(args: argparse.Namespace) -> int:
    root = find_project_root()
    print("PADIS INSTALL")
    print(f"Project root: {root}")
    print()

    print("Membuat folder dasar")
    ensure_dirs(required_dirs(root))

    print()
    report = check_project(root, verbose=False)

    if not args.with_deps:
        print()
        print("Dependency tidak di-install otomatis.")
        print("Gunakan --with-deps untuk menjalankan pip install dan npm install.")
        return report.exit_code()

    print()
    print("Install dependencies")
    pip_code = run_checked(
        [sys.executable, "-m", "pip", "install", "-r", "backend/requirements.txt"],
        cwd=root,
    )
    if pip_code != 0:
        print(f"  [FAIL] pip install gagal dengan kode {pip_code}")
        return pip_code

    npm = shutil.which("npm")
    if not npm:
        print("  [FAIL] npm tidak ditemukan di PATH")
        return 1

    npm_code = run_checked([npm, "install"], cwd=root / "frontend")
    if npm_code != 0:
        print(f"  [FAIL] npm install gagal dengan kode {npm_code}")
        return npm_code

    print()
    print("Install complete.")
    return 0


def cmd_check(_args: argparse.Namespace) -> int:
    root = find_project_root()
    return check_project(root).exit_code()


def cmd_start(args: argparse.Namespace) -> int:
    if args.backend_only and args.frontend_only:
        print("[FAIL] Pilih salah satu saja: --backend-only atau --frontend-only")
        return 3

    root = find_project_root()
    npm = shutil.which("npm")
    backend_proc: subprocess.Popen | None = None
    frontend_proc: subprocess.Popen | None = None

    print("PADIS START")
    print(f"Project root: {root}")
    print()

    if not args.frontend_only:
        print("[1/3] Starting backend")
        backend_proc = subprocess.Popen(
            [sys.executable, "-m", "backend.run"],
            cwd=str(root),
            env=build_env(),
        )
        if wait_for_backend():
            print(f"  [OK] Backend ready: {BACKEND_URL}")
        else:
            print(
                f"  [WARN] Backend belum merespons dan port {BACKEND_PORT} belum terbuka"
            )

    if not args.backend_only:
        if not npm:
            terminate_process(backend_proc, "backend")
            print("[FAIL] npm tidak ditemukan di PATH")
            return 1

        print("[2/3] Starting frontend")
        frontend_proc = subprocess.Popen(
            [npm, "run", "dev"],
            cwd=str(root / "frontend"),
            env=build_env(),
        )
        if wait_for_url(FRONTEND_URL, timeout=60):
            print(f"  [OK] Frontend ready: {FRONTEND_URL}")
        else:
            print(f"  [WARN] Frontend belum merespons di {FRONTEND_URL}")

    if not args.no_open and not args.backend_only:
        print("[3/3] Opening admin")
        webbrowser.open(ADMIN_URL)
        print(f"  [OK] {ADMIN_URL}")
    elif args.backend_only:
        print("[3/3] Browser tidak dibuka karena --backend-only")
    else:
        print("[3/3] Browser tidak dibuka karena --no-open")

    print()
    print("PADIS local dev berjalan. Tekan Ctrl+C untuk berhenti.")

    try:
        while True:
            exited: list[str] = []
            if backend_proc is not None and backend_proc.poll() is not None:
                exited.append(f"backend exited ({backend_proc.returncode})")
            if frontend_proc is not None and frontend_proc.poll() is not None:
                exited.append(f"frontend exited ({frontend_proc.returncode})")
            if exited:
                print("[WARN] " + "; ".join(exited))
                return 1
            time.sleep(1)
    except KeyboardInterrupt:
        print()
        print("Menghentikan PADIS local dev...")
        terminate_process(frontend_proc, "frontend")
        terminate_process(backend_proc, "backend")
        print("Selesai.")
        return 0


def cmd_run(args: argparse.Namespace) -> int:
    root = find_project_root()

    print("PADIS RUN")
    print(f"Mode     : {args.mode}")
    print(f"Hazard   : {args.hazard}")
    print(f"Operator : {args.operator}")
    if args.mode == "full" and args.hazard == "multi":
        print()
        print("[WARN] mode full + hazard multi tidak menjalankan preprocess/zonal.")
        print("[WARN] Multi-hazard memakai output flood dan drought yang sudah ada.")
    print()

    command = [
        sys.executable,
        "-m",
        "backend.scripts.main",
        "--mode",
        args.mode,
        "--hazard",
        args.hazard,
        "--operator",
        args.operator,
    ]
    print(f"[RUN] {' '.join(command)}")
    completed = subprocess.run(command, cwd=str(root), env=build_env(), check=False)
    return completed.returncode


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="padis",
        description="PADIS operational CLI untuk setup, readiness, local dev, dan pipeline.",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    install = sub.add_parser("install", help="Setup folder dasar dan cek dependency/env.")
    install.add_argument(
        "--with-deps",
        action="store_true",
        help="Jalankan pip install dan npm install. Default hanya cek dan buat folder.",
    )
    install.set_defaults(func=cmd_install)

    check = sub.add_parser("check", help="Readiness check dasar.")
    check.set_defaults(func=cmd_check)

    start = sub.add_parser(
        "start",
        help="Start backend + frontend localhost dan buka /admin.",
    )
    start.add_argument("--no-open", action="store_true", help="Jangan buka browser.")
    start.add_argument("--backend-only", action="store_true", help="Start backend saja.")
    start.add_argument("--frontend-only", action="store_true", help="Start frontend saja.")
    start.set_defaults(func=cmd_start)

    run = sub.add_parser("run", help="Jalankan pipeline existing dari terminal.")
    run.add_argument("--mode", choices=VALID_MODES, default="full")
    run.add_argument("--hazard", choices=VALID_HAZARDS, default="flood")
    run.add_argument("--operator", default="operator")
    run.set_defaults(func=cmd_run)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    try:
        return int(args.func(args))
    except RuntimeError as exc:
        print(f"[FAIL] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
