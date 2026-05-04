"""
PipelineRunManager — tracks pipeline execution state in the runs table.

Degrades gracefully: if DATABASE_URL is missing or the DB is unreachable,
all methods become no-ops and the pipeline continues unaffected.

The monitoring run created here is always is_active=FALSE.
The ETL step's own run_all.py is responsible for setting is_active=TRUE
on the final data run.
"""

import time
from backend.scripts.utils import log


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
        self._last_progress: int = 0  # tracks last successful progress for failure reporting

    # -------------------------------------------------------------------------
    # PUBLIC API
    # -------------------------------------------------------------------------

    @property
    def run_id(self) -> "int | None":
        return self._run_id

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
            log.info("RUN", f"#{self._run_id} dibuat  operator={self._operator_name}  hazard={self._hazard}")
        except Exception as e:
            log.warn("RUN", f"DB tidak tersedia, monitoring dinonaktifkan: {e}")
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
            self._last_progress = progress
        except Exception as e:
            log.warn("RUN", f"Update gagal (non-fatal): {e}")
            self._available = False

    def finish(self, success: bool = True, message: str = "") -> None:
        """
        Mark run success or failed; close the DB connection.

        Attempts a fresh connection if the existing one was lost (_available=False),
        so a transient DB failure during update() does not permanently prevent
        the final status from being written.
        """
        if self._run_id is None:
            return  # start() never succeeded — nothing to finalise

        if not self._available:
            self._try_reconnect()

        status = "success" if success else "failed"
        final_progress = 100 if success else self._last_progress
        try:
            cur = self._conn.cursor()
            cur.execute(
                """
                UPDATE runs
                SET    status      = %s,
                       progress    = %s,
                       message     = %s,
                       finished_at = NOW()
                WHERE  id = %s
                """,
                (status, final_progress, message or status, self._run_id),
            )
            self._conn.commit()
            cur.close()
            log.ok("RUN", f"#{self._run_id} selesai: {status}")
        except Exception as e:
            log.warn("RUN", f"Finish gagal (non-fatal): {e}")
        finally:
            self._close()

    def _try_reconnect(self) -> None:
        """Attempt a fresh DB connection for finish(). Silent on failure."""
        try:
            from backend.scripts.utils.db import get_conn
            self._close()
            self._conn = get_conn()
            self._available = True
        except Exception as e:
            log.warn("RUN", f"Reconnect gagal, finish tidak dapat ditulis: {e}")

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
