def create_run(cur, name="manual_run"):
    cur.execute("""
        INSERT INTO runs (run_name, status, is_active)
        VALUES (%s, 'running', FALSE)
        RETURNING id
    """, (name,))
    return cur.fetchone()[0]


def finish_run(cur, run_id):
    # nonaktifkan semua run lama
    cur.execute("UPDATE runs SET is_active = FALSE")

    # aktifkan run baru
    cur.execute("""
        UPDATE runs
        SET status = 'success', is_active = TRUE
        WHERE id = %s
    """, (run_id,))
