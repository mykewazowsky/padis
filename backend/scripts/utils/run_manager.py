"""
PipelineRunManager — tracks pipeline execution state in the runs table.

Degrades gracefully: if DATABASE_URL is missing or the DB is unreachable,
all methods become no-ops and the pipeline continues unaffected.

The monitoring run created here is always is_active=FALSE.
The ETL step's own run_all.py is responsible for setting is_active=TRUE
on the final data run.
"""

import time


class PipelineRunManager:
    def __init__(
        self,
        operator_name: str = "operator",
        hazard: str = "multi",
        source: str = "local",
    ) -> None:
        self._operator_name = operator_name
        self._hazard = hazard
        self._source = source
        self._run_id: int | None = None
        self._conn = None
        self._available = False

    # -------------------------------------------------------------------------
    # PUBLIC API
    # -------------------------------------------------------------------------

    def start(self) -> None:
        """Open DB connection and insert a monitoring run record."""
        try:
            from backend.scripts.utils.db import get_conn

            self._conn = get_conn()
            cur = self._conn.cursor()
            run_name = f"{self._hazard}_{self._operator_name}_{int(time.time())}"
            cur.execute(
                """
                INSERT INTO runs
                    (run_name, status, is_active, operator_name, source, step, progress, message)
                VALUES
                    (%s, 'running', FALSE, %s, %s, 'init', 0, 'Pipeline dimulai')
                RETURNING id
                """,
                (run_name, self._operator_name, self._source),
            )
            self._run_id = cur.fetchone()[0]
            self._conn.commit()
            cur.close()
            self._available = True
            print(f"  [RUN] #{self._run_id} dibuat  operator={self._operator_name}  hazard={self._hazard}")
        except Exception as e:
            print(f"  [RUN] DB tidak tersedia, monitoring dinonaktifkan: {e}")
            self._available = False

    def update(self, step: str, progress: int, message: str = "") -> None:
        """Update step / progress / message for the current run."""
        if not self._available:
            return
        try:
            cur = self._conn.cursor()
            cur.execute(
                "UPDATE runs SET step=%s, progress=%s, message=%s WHERE id=%s",
                (step, progress, message, self._run_id),
            )
            self._conn.commit()
            cur.close()
        except Exception as e:
            print(f"  [RUN] update gagal (non-fatal): {e}")
            self._available = False

    def finish(self, success: bool = True, message: str = "") -> None:
        """Mark run success or failed; close the DB connection."""
        if not self._available:
            return
        status = "success" if success else "failed"
        try:
            cur = self._conn.cursor()
            cur.execute(
                "UPDATE runs SET status=%s, progress=%s, message=%s WHERE id=%s",
                (status, 100 if success else None, message or status, self._run_id),
            )
            self._conn.commit()
            cur.close()
            print(f"  [RUN] #{self._run_id} selesai: {status}")
        except Exception as e:
            print(f"  [RUN] finish gagal (non-fatal): {e}")
        finally:
            self._close()

    # -------------------------------------------------------------------------
    # PRIVATE
    # -------------------------------------------------------------------------

    def _close(self) -> None:
        if self._conn:
            try:
                self._conn.close()
            except Exception:
                pass
            self._conn = None
        self._available = False
