"""generate_qc_report.py — QC report: run_id=49 DB vs QGIS XLSX"""
import warnings; warnings.filterwarnings('ignore')
import os, sys
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parents[3]))

for line in open('backend/.env'):
    line = line.strip()
    if line and not line.startswith('#') and '=' in line:
        k, v = line.split('=', 1)
        os.environ.setdefault(k.strip(), v.strip())

import pandas as pd
import numpy as np
import psycopg2

OUT_DIR  = 'backend/data/output/QC'
RUN_ID   = 49
W_FLOOD  = 0.678
W_DROUGHT = 0.322
RPS      = [25, 50, 100, 250]

os.makedirs(OUT_DIR, exist_ok=True)

# ── Vulnerability functions ──────────────────────────────────────────────────
def lop_flood(x):
    if pd.isna(x) or x <= 0:
        return np.nan
    y = 0.29 * np.log(x) + 0.52
    return max(0.0, y)

def lop_drought(x):
    if pd.isna(x):
        return np.nan
    y = -0.8381*x**3 + 0.8967*x**2 + 0.9064*x - 0.0106
    return max(0.0, min(1.0, y))

# ── Parse XLSX ───────────────────────────────────────────────────────────────
COL_MAP = {
    10: ('baseline',   'mean', 'rp25'),   11: ('baseline',   'mean', 'rp50'),
    12: ('baseline',   'mean', 'rp100'),  13: ('baseline',   'mean', 'rp250'),
    14: ('baseline',   'lop',  'rp25'),   15: ('baseline',   'lop',  'rp50'),
    16: ('baseline',   'lop',  'rp100'),  17: ('baseline',   'lop',  'rp250'),
    18: ('projection', 'mean', 'rp25'),   19: ('projection', 'mean', 'rp50'),
    20: ('projection', 'mean', 'rp100'),  21: ('projection', 'mean', 'rp250'),
    22: ('projection', 'lop',  'rp25'),   23: ('projection', 'lop',  'rp50'),
    24: ('projection', 'lop',  'rp100'),  25: ('projection', 'lop',  'rp250'),
    26: ('loss',       'baseline',   'rp25'),  27: ('loss', 'baseline',   'rp50'),
    28: ('loss',       'baseline',   'rp100'), 29: ('loss', 'baseline',   'rp250'),
    30: ('loss',       'projection', 'rp25'),  31: ('loss', 'projection', 'rp50'),
    32: ('loss',       'projection', 'rp100'), 33: ('loss', 'projection', 'rp250'),
}

def load_xlsx(path):
    raw  = pd.read_excel(path, sheet_name='QGIS', header=None)
    data = raw.iloc[3:].reset_index(drop=True)
    data.columns = range(len(data.columns))
    df = pd.DataFrame()
    df['id_k']     = data[0].astype(str).str.strip().str.zfill(4)
    df['kab_kota'] = data[1].astype(str).str.strip()
    df['id_prov']  = data[3].astype(str).str.strip().str.zfill(2)
    df['prov']     = data[4].astype(str).str.strip()
    for ci, (cat, sub, rp) in COL_MAP.items():
        df['qgis_%s_%s_%s' % (cat, sub, rp)] = pd.to_numeric(data[ci], errors='coerce')
    return df

print('Loading XLSX...')
xl_flood   = load_xlsx('C:/Users/Asus/Downloads/QC_Banjir.xlsx')
xl_drought = load_xlsx('C:/Users/Asus/Downloads/QC_Kekeringan.xlsx')
print('  flood=%d  drought=%d' % (len(xl_flood), len(xl_drought)))

# ── DB data ──────────────────────────────────────────────────────────────────
print('Loading DB run_id=%d...' % RUN_ID)
conn = psycopg2.connect(os.environ['DATABASE_URL'])
cur  = conn.cursor()

cur.execute('''
    SELECT z.id_kabkota, h.name, s.name, r.rp, z.mean_value
    FROM zonal_kabupaten z
    JOIN hazards h ON h.id = z.hazard_id
    JOIN scenarios s ON s.id = z.scenario_id
    JOIN return_periods r ON r.id = z.rp_id
    WHERE z.run_id = %s
''', (RUN_ID,))
zonal = pd.DataFrame(cur.fetchall(), columns=['id_raw','hazard','scenario','rp','mean'])
zonal['id_k'] = zonal['id_raw'].str.replace('.','',regex=False).str.zfill(4)

cur.execute('''
    SELECT l.id_kabkota, h.name, s.name, r.rp, l.loss
    FROM losses l
    JOIN hazards h ON h.id = l.hazard_id
    JOIN scenarios s ON s.id = l.scenario_id
    JOIN return_periods r ON r.id = l.rp_id
    WHERE l.run_id = %s
''', (RUN_ID,))
losses_db = pd.DataFrame(cur.fetchall(), columns=['id_raw','hazard','scenario','rp','loss'])
losses_db['id_k'] = losses_db['id_raw'].str.replace('.','',regex=False).str.zfill(4)
cur.close(); conn.close()
print('  zonal=%d  losses=%d' % (len(zonal), len(losses_db)))

# ── Pivot helpers ────────────────────────────────────────────────────────────
def pivot_db(df, hazard, scenario, val_col, prefix):
    sub = df[(df.hazard == hazard) & (df.scenario == scenario)][['id_k', 'rp', val_col]]
    piv = sub.pivot_table(index='id_k', columns='rp', values=val_col).reset_index()
    piv.columns = ['id_k'] + ['%s_rp%d' % (prefix, c) for c in piv.columns[1:]]
    return piv

def add_diff(df, qcol, dcol, label):
    df['diff_%s'    % label] = (df[dcol] - df[qcol]).round(6)
    df['absdiff_%s' % label] = (df[dcol] - df[qcol]).abs().round(6)
    df['pct_%s'     % label] = ((df[dcol] - df[qcol]) / df[qcol].replace(0, np.nan) * 100).round(4)

def summary_row(df, qcol, dcol, label):
    ad = df['absdiff_%s' % label].dropna()
    pc = df['pct_%s' % label].abs().dropna()
    n  = len(ad)
    return {
        'field'       : label,
        'n_compared'  : n,
        'exact_n'     : int((ad < 0.001).sum()),
        'exact_pct'   : round((ad < 0.001).sum() / max(n, 1) * 100, 1),
        'mean_absdiff': round(float(ad.mean()), 6),
        'max_absdiff' : round(float(ad.max()), 6),
        'mean_pct_err': round(float(pc.mean()), 4),
        'max_pct_err' : round(float(pc.max()), 4),
    }

# ════════════════════════════════════════════════════════════════════════════
# QC FLOOD
# ════════════════════════════════════════════════════════════════════════════
print('Building QC_Flood...')

db_fl_nc_mean = pivot_db(zonal,    'flood', 'nonclimate', 'mean', 'db_fl_nc_mean')
db_fl_cl_mean = pivot_db(zonal,    'flood', 'climate',    'mean', 'db_fl_cl_mean')
db_fl_nc_loss = pivot_db(losses_db,'flood', 'nonclimate', 'loss', 'db_fl_nc_loss')
db_fl_cl_loss = pivot_db(losses_db,'flood', 'climate',    'loss', 'db_fl_cl_loss')

fl = xl_flood.copy()
for piv in [db_fl_nc_mean, db_fl_cl_mean, db_fl_nc_loss, db_fl_cl_loss]:
    fl = fl.merge(piv, on='id_k', how='left')

sum_rows_fl = []
for rp in RPS:
    # Compute DB LOP from DB mean
    fl['db_fl_nc_lop_rp%d' % rp] = fl['db_fl_nc_mean_rp%d' % rp].apply(lop_flood)
    fl['db_fl_cl_lop_rp%d' % rp] = fl['db_fl_cl_mean_rp%d' % rp].apply(lop_flood)

    for sc, sc_xl in [('nc','baseline'), ('cl','projection')]:
        for metric, qkey, dkey in [
            ('mean', 'qgis_%s_mean_rp%d'  % (sc_xl, rp), 'db_fl_%s_mean_rp%d' % (sc, rp)),
            ('lop',  'qgis_%s_lop_rp%d'   % (sc_xl, rp), 'db_fl_%s_lop_rp%d'  % (sc, rp)),
            ('loss', 'qgis_loss_%s_rp%d'  % (sc_xl, rp), 'db_fl_%s_loss_rp%d' % (sc, rp)),
        ]:
            label = 'fl_%s_%s_rp%d' % (sc, metric, rp)
            add_diff(fl, qkey, dkey, label)
            sum_rows_fl.append(summary_row(fl, qkey, dkey, label))

fl.to_csv('%s/QC_Flood_run%d.csv'         % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
pd.DataFrame(sum_rows_fl).to_csv('%s/QC_Flood_summary_run%d.csv' % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
print('  Saved: QC_Flood_run%d.csv (%d rows, %d cols)' % (RUN_ID, len(fl), len(fl.columns)))

# ════════════════════════════════════════════════════════════════════════════
# QC DROUGHT
# ════════════════════════════════════════════════════════════════════════════
print('Building QC_Drought...')

db_dr_nc_mean = pivot_db(zonal,    'drought', 'nonclimate', 'mean', 'db_dr_nc_mean')
db_dr_cl_mean = pivot_db(zonal,    'drought', 'climate',    'mean', 'db_dr_cl_mean')
db_dr_nc_loss = pivot_db(losses_db,'drought', 'nonclimate', 'loss', 'db_dr_nc_loss')
db_dr_cl_loss = pivot_db(losses_db,'drought', 'climate',    'loss', 'db_dr_cl_loss')

dr = xl_drought.copy()
for piv in [db_dr_nc_mean, db_dr_cl_mean, db_dr_nc_loss, db_dr_cl_loss]:
    dr = dr.merge(piv, on='id_k', how='left')

sum_rows_dr = []
for rp in RPS:
    dr['db_dr_nc_lop_rp%d' % rp] = dr['db_dr_nc_mean_rp%d' % rp].apply(lop_drought)
    dr['db_dr_cl_lop_rp%d' % rp] = dr['db_dr_cl_mean_rp%d' % rp].apply(lop_drought)

    for sc, sc_xl in [('nc','baseline'), ('cl','projection')]:
        for metric, qkey, dkey in [
            ('mean', 'qgis_%s_mean_rp%d'  % (sc_xl, rp), 'db_dr_%s_mean_rp%d' % (sc, rp)),
            ('lop',  'qgis_%s_lop_rp%d'   % (sc_xl, rp), 'db_dr_%s_lop_rp%d'  % (sc, rp)),
            ('loss', 'qgis_loss_%s_rp%d'  % (sc_xl, rp), 'db_dr_%s_loss_rp%d' % (sc, rp)),
        ]:
            label = 'dr_%s_%s_rp%d' % (sc, metric, rp)
            add_diff(dr, qkey, dkey, label)
            sum_rows_dr.append(summary_row(dr, qkey, dkey, label))

dr.to_csv('%s/QC_Drought_run%d.csv'         % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
pd.DataFrame(sum_rows_dr).to_csv('%s/QC_Drought_summary_run%d.csv' % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
print('  Saved: QC_Drought_run%d.csv (%d rows, %d cols)' % (RUN_ID, len(dr), len(dr.columns)))

# ════════════════════════════════════════════════════════════════════════════
# QC MULTIHAZARD (derive from XLSX flood + drought)
# ════════════════════════════════════════════════════════════════════════════
print('Building QC_Multihazard...')

db_mu_nc_loss = pivot_db(losses_db,'multihazard','nonclimate','loss','db_mu_nc_loss')
db_mu_cl_loss = pivot_db(losses_db,'multihazard','climate',   'loss','db_mu_cl_loss')

mu = xl_flood[['id_k','kab_kota','id_prov','prov']].copy()

# Compute QGIS multihazard from XLSX flood + drought
fl_loss_cols = {rp: ('qgis_loss_baseline_rp%d'%rp, 'qgis_loss_projection_rp%d'%rp) for rp in RPS}
dr_loss_cols = {rp: ('qgis_loss_baseline_rp%d'%rp, 'qgis_loss_projection_rp%d'%rp) for rp in RPS}

fl_sub = xl_flood[['id_k']  + ['qgis_loss_baseline_rp%d'%r  for r in RPS] +
                               ['qgis_loss_projection_rp%d'%r for r in RPS]]
dr_sub = xl_drought[['id_k'] + ['qgis_loss_baseline_rp%d'%r  for r in RPS] +
                                ['qgis_loss_projection_rp%d'%r for r in RPS]]

mu = mu.merge(fl_sub.rename(columns={'qgis_loss_baseline_rp%d'%r: 'fl_nc_rp%d'%r for r in RPS} |
                                     {'qgis_loss_projection_rp%d'%r: 'fl_cl_rp%d'%r for r in RPS}),
              on='id_k', how='left')
mu = mu.merge(dr_sub.rename(columns={'qgis_loss_baseline_rp%d'%r: 'dr_nc_rp%d'%r for r in RPS} |
                                     {'qgis_loss_projection_rp%d'%r: 'dr_cl_rp%d'%r for r in RPS}),
              on='id_k', how='left')

for rp in RPS:
    mu['qgis_mu_nc_loss_rp%d'%rp] = (mu['fl_nc_rp%d'%rp] * W_FLOOD +
                                       mu['dr_nc_rp%d'%rp] * W_DROUGHT)
    mu['qgis_mu_cl_loss_rp%d'%rp] = (mu['fl_cl_rp%d'%rp] * W_FLOOD +
                                       mu['dr_cl_rp%d'%rp] * W_DROUGHT)

mu = mu.merge(db_mu_nc_loss, on='id_k', how='left')
mu = mu.merge(db_mu_cl_loss, on='id_k', how='left')

sum_rows_mu = []
for rp in RPS:
    for sc in ['nc','cl']:
        qkey  = 'qgis_mu_%s_loss_rp%d'  % (sc, rp)
        dkey  = 'db_mu_%s_loss_rp%d'    % (sc, rp)
        label = 'mu_%s_loss_rp%d'       % (sc, rp)
        add_diff(mu, qkey, dkey, label)
        sum_rows_mu.append(summary_row(mu, qkey, dkey, label))

mu.to_csv('%s/QC_Multihazard_run%d.csv'         % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
pd.DataFrame(sum_rows_mu).to_csv('%s/QC_Multihazard_summary_run%d.csv' % (OUT_DIR, RUN_ID), index=False, encoding='utf-8-sig')
print('  Saved: QC_Multihazard_run%d.csv (%d rows, %d cols)' % (RUN_ID, len(mu), len(mu.columns)))

# ════════════════════════════════════════════════════════════════════════════
# MASTER SUMMARY PRINT
# ════════════════════════════════════════════════════════════════════════════
print()
print('='*72)
print('  MASTER SUMMARY  run_id=%d  vs QGIS XLSX' % RUN_ID)
print('='*72)
print('  %-32s  %7s  %8s  %8s  %12s' % ('Field','Exact%','Mean%err','Max%err','MaxAbsDiff'))
print('-'*72)

for hazard_label, sum_rows in [('FLOOD', sum_rows_fl), ('DROUGHT', sum_rows_dr), ('MULTI', sum_rows_mu)]:
    print('  -- %s --' % hazard_label)
    for row in sum_rows:
        print('  %-32s  %6.1f%%  %7.2f%%  %7.2f%%  %12.2f' % (
            row['field'], row['exact_pct'], row['mean_pct_err'],
            row['max_pct_err'], row['max_absdiff']))

print('='*72)
print()
print('Output tersimpan di: %s' % OUT_DIR)
for f in sorted(os.listdir(OUT_DIR)):
    size = os.path.getsize(os.path.join(OUT_DIR, f))
    print('  %-45s  %6d KB' % (f, size//1024))
