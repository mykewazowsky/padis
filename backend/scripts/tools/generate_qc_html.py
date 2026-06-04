"""generate_qc_html.py — Visualisasi HTML QC Report run_id=49"""
import warnings; warnings.filterwarnings('ignore')
import pandas as pd, numpy as np, json, os

RUN_ID  = 49
QC_DIR  = 'backend/data/output/QC'
OUT     = 'C:/Users/Asus/Downloads/QC_Report_run49.html'

# ── Load data ────────────────────────────────────────────────────────────────
fl_sum = pd.read_csv('%s/QC_Flood_summary_run%d.csv'       % (QC_DIR, RUN_ID))
dr_sum = pd.read_csv('%s/QC_Drought_summary_run%d.csv'     % (QC_DIR, RUN_ID))
mu_sum = pd.read_csv('%s/QC_Multihazard_summary_run%d.csv' % (QC_DIR, RUN_ID))
fl_det = pd.read_csv('%s/QC_Flood_run%d.csv'               % (QC_DIR, RUN_ID))
dr_det = pd.read_csv('%s/QC_Drought_run%d.csv'             % (QC_DIR, RUN_ID))
mu_det = pd.read_csv('%s/QC_Multihazard_run%d.csv'         % (QC_DIR, RUN_ID))


# ── Helpers ──────────────────────────────────────────────────────────────────
HAZARD_MAP   = {'fl': 'Flood', 'dr': 'Drought', 'mu': 'Multihazard'}
SCENARIO_MAP = {'nc': 'Nonclimate (Baseline)', 'cl': 'Climate (Projection)'}
METRIC_MAP   = {'mean': 'Mean Zonal', 'lop': 'LOP', 'loss': 'Loss (Rp)'}

def label_parts(field):
    p = field.split('_')
    return (HAZARD_MAP.get(p[0], p[0]),
            SCENARIO_MAP.get(p[1], p[1]),
            METRIC_MAP.get(p[2], p[2]),
            p[3].upper())

def status_class(pct):
    if pct <= 1.0:  return 'status-good'
    if pct <= 5.0:  return 'status-ok'
    if pct <= 15.0: return 'status-warn'
    return 'status-bad'

def badge(pct):
    if pct <= 1.0:  return '<span class="badge good">Baik</span>'
    if pct <= 5.0:  return '<span class="badge ok">OK</span>'
    if pct <= 15.0: return '<span class="badge warn">Perlu Cek</span>'
    return '<span class="badge bad">Anomali</span>'

def build_summary_table(df):
    rows = []
    for _, r in df.iterrows():
        try:    _, sc, mt, rp = label_parts(r['field'])
        except: sc, mt, rp = r['field'], '', ''
        cls = status_class(r['mean_pct_err'])
        rows.append(
            '<tr class="%s"><td>%s</td><td>%s</td><td>%s</td>'
            '<td class="num">%d / %d</td><td class="num">%.1f%%</td>'
            '<td class="num">%.6f</td><td class="num">%.3f%%</td>'
            '<td class="num">%.2f%%</td><td>%s</td></tr>' % (
                cls, sc, mt, rp,
                int(r['exact_n']), int(r['n_compared']),
                r['exact_pct'], r['mean_absdiff'],
                r['mean_pct_err'], r['max_pct_err'],
                badge(r['mean_pct_err'])))
    return '\n'.join(rows)

def build_chart(df):
    labels, vals, colors = [], [], []
    for _, r in df.iterrows():
        try:    _, sc, mt, rp = label_parts(r['field'])
        except: sc, mt, rp = '', r['field'], ''
        labels.append('%s | %s | %s' % (sc[:3], mt[:4], rp))
        vals.append(round(float(r['mean_pct_err']), 3))
        p = r['mean_pct_err']
        colors.append(
            'rgba(34,197,94,.75)'  if p <= 1 else
            'rgba(250,204,21,.75)' if p <= 5 else
            'rgba(251,146,60,.75)' if p <= 15 else
            'rgba(239,68,68,.75)')
    return json.dumps(labels), json.dumps(vals), json.dumps(colors)

def build_worst_table(det, limit=20):
    abs_cols = [c for c in det.columns if c.startswith('absdiff_')]
    if not abs_cols:
        return '<tr><td colspan="4">-</td></tr>'
    det2 = det.copy()
    det2['_w'] = det2[abs_cols].max(axis=1)
    top = det2.nlargest(limit, '_w')[['id_k', 'kab_kota', 'prov'] + abs_cols[:6]]
    rows = []
    for _, r in top.iterrows():
        chips = ' '.join(
            '<span class="chip">%s: %.4f</span>' % (c.replace('absdiff_', ''), r[c])
            for c in abs_cols[:4] if pd.notna(r[c]) and r[c] > 0)
        rows.append('<tr><td>%s</td><td>%s</td><td>%s</td><td class="chips">%s</td></tr>' % (
            r['id_k'], r['kab_kota'], r['prov'], chips or '-'))
    return '\n'.join(rows)

def ovr(df):
    return {
        'mean_err': round(float(df['mean_pct_err'].mean()), 2),
        'max_err':  round(float(df['mean_pct_err'].max()), 2),
        'exact':    round(float(df['exact_pct'].mean()), 1),
        'anomaly':  int((df['mean_pct_err'] > 15).sum()),
    }

fl_o  = ovr(fl_sum)
dr_o  = ovr(dr_sum)
mu_o  = ovr(mu_sum)

fl_tbl   = build_summary_table(fl_sum)
dr_tbl   = build_summary_table(dr_sum)
mu_tbl   = build_summary_table(mu_sum)
fl_worst = build_worst_table(fl_det)
dr_worst = build_worst_table(dr_det)
mu_worst = build_worst_table(mu_det)

fl_lbl, fl_val, fl_col = build_chart(fl_sum)
dr_lbl, dr_val, dr_col = build_chart(dr_sum)
mu_lbl, mu_val, mu_col = build_chart(mu_sum)

def card_status(o):
    if o['anomaly'] == 0:
        return '<span style="color:#15803d;font-size:12px;font-weight:600">Tidak ada anomali ✓</span>'
    return '<span class="anomaly-badge">%d field anomali</span>' % o['anomaly']

def tab_section(tab_id, chart_id, tbl, worst):
    return '''
  <div id="tab-{tid}" class="tab-content {act}">
    <div class="chart-wrap"><canvas id="{cid}"></canvas></div>
    <hr class="divider">
    <h2>Detail per Field</h2>
    <div class="tbl-wrap"><table>
      <thead><tr>
        <th>Skenario</th><th>Metrik</th><th>RP</th>
        <th class="num">Exact (n/%)</th><th class="num">Exact %%</th>
        <th class="num">Mean |diff|</th><th class="num">Mean %% Err</th>
        <th class="num">Max %% Err</th><th>Status</th>
      </tr></thead>
      <tbody>{tbl}</tbody>
    </table></div>
    <hr class="divider">
    <h2>Top 20 Wilayah &mdash; Selisih Terbesar</h2>
    <div class="tbl-wrap"><table>
      <thead><tr><th>ID</th><th>Wilayah</th><th>Provinsi</th><th>Field (abs diff)</th></tr></thead>
      <tbody>{worst}</tbody>
    </table></div>
  </div>'''.format(tid=tab_id, cid=chart_id,
                   act='active' if tab_id == 'flood' else '',
                   tbl=tbl, worst=worst)

html = '''\
<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QC Report PADIS — Run ID {run_id}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
<style>
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:system-ui,-apple-system,sans-serif;background:#f1f5f9;color:#1e293b;font-size:14px;line-height:1.5}}
.header{{background:linear-gradient(135deg,#1e3a8a,#0369a1);color:#fff;padding:28px 40px}}
.header h1{{font-size:22px;font-weight:700;margin-bottom:4px}}
.header p{{opacity:.75;font-size:13px}}
.container{{max-width:1320px;margin:0 auto;padding:24px 20px}}

.cards{{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px}}
.card{{background:#fff;border-radius:12px;padding:20px 22px;box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0}}
.card-label{{font-size:11px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:#94a3b8;margin-bottom:8px}}
.card-title{{font-size:17px;font-weight:700;margin-bottom:12px}}
.card-flood{{color:#0369a1}}.card-drought{{color:#b45309}}.card-multi{{color:#7c3aed}}
.metric{{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;border-bottom:1px solid #f1f5f9}}
.metric:last-of-type{{border:none}}
.metric span:first-child{{color:#64748b;font-size:12.5px}}
.metric strong{{font-size:15px;font-weight:700}}
.card-foot{{margin-top:12px;padding-top:10px;border-top:2px solid #f1f5f9}}
.anomaly-badge{{display:inline-block;background:#fef2f2;color:#b91c1c;padding:3px 10px;border-radius:20px;font-size:11.5px;font-weight:600}}

.legend{{display:flex;gap:18px;margin-bottom:16px;flex-wrap:wrap;align-items:center}}
.leg{{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#475569}}
.dot{{width:10px;height:10px;border-radius:50%;flex-shrink:0}}
.g{{background:#22c55e}}.o{{background:#facc15}}.w{{background:#fb923c}}.b{{background:#ef4444}}

.tabs{{display:flex;gap:3px;margin-bottom:0}}
.tab{{padding:10px 22px;border-radius:8px 8px 0 0;cursor:pointer;font-size:13.5px;font-weight:500;
      background:#e2e8f0;color:#475569;border:none;transition:.12s}}
.tab.active{{background:#fff;color:#1e40af;font-weight:700;box-shadow:0 -2px 0 #1e40af inset}}
.tab-content{{display:none;background:#fff;border-radius:0 12px 12px 12px;padding:24px 26px;
              box-shadow:0 1px 3px rgba(0,0,0,.08);border:1px solid #e2e8f0}}
.tab-content.active{{display:block}}

.chart-wrap{{height:240px;margin-bottom:8px}}
h2{{font-size:14px;font-weight:600;color:#0f172a;margin-bottom:14px}}
.divider{{border:none;border-top:1px solid #e2e8f0;margin:22px 0}}

.tbl-wrap{{overflow-x:auto}}
table{{width:100%;border-collapse:collapse;font-size:12.5px}}
th{{background:#f8fafc;padding:9px 11px;text-align:left;font-weight:600;border-bottom:2px solid #e2e8f0;
    color:#475569;white-space:nowrap;font-size:12px}}
td{{padding:7px 11px;border-bottom:1px solid #f1f5f9;vertical-align:middle}}
tr:hover td{{background:#f8fafc}}
.num{{text-align:right;font-family:ui-monospace,monospace;font-size:12px}}

.status-warn td{{background:#fffbeb!important}}
.status-bad td{{background:#fef2f2!important}}

.badge{{display:inline-block;padding:2px 9px;border-radius:20px;font-size:11px;font-weight:600}}
.badge.good{{background:#dcfce7;color:#15803d}}
.badge.ok{{background:#fef9c3;color:#854d0e}}
.badge.warn{{background:#fed7aa;color:#c2410c}}
.badge.bad{{background:#fecaca;color:#b91c1c}}

.chips{{display:flex;flex-wrap:wrap;gap:4px}}
.chip{{background:#f1f5f9;color:#475569;padding:2px 7px;border-radius:4px;font-size:11px;font-family:monospace;white-space:nowrap}}
</style>
</head>
<body>
<div class="header">
  <h1>Quality Control Report &mdash; PADIS</h1>
  <p>Run ID: <strong>{run_id}</strong> &ensp;&bull;&ensp; DB Supabase vs Perhitungan QGIS &ensp;&bull;&ensp; Flood &bull; Drought &bull; Multihazard</p>
</div>
<div class="container">

<div class="cards">
  <div class="card">
    <div class="card-label">Ringkasan</div>
    <div class="card-title card-flood">Banjir (Flood)</div>
    <div class="metric"><span>Mean error rata-rata</span><strong>{fl_me}%</strong></div>
    <div class="metric"><span>Max error field</span><strong>{fl_mx}%</strong></div>
    <div class="metric"><span>Exact match rata-rata</span><strong>{fl_ex}%</strong></div>
    <div class="card-foot">{fl_st}</div>
  </div>
  <div class="card">
    <div class="card-label">Ringkasan</div>
    <div class="card-title card-drought">Kekeringan (Drought)</div>
    <div class="metric"><span>Mean error rata-rata</span><strong>{dr_me}%</strong></div>
    <div class="metric"><span>Max error field</span><strong>{dr_mx}%</strong></div>
    <div class="metric"><span>Exact match rata-rata</span><strong>{dr_ex}%</strong></div>
    <div class="card-foot">{dr_st}</div>
  </div>
  <div class="card">
    <div class="card-label">Ringkasan</div>
    <div class="card-title card-multi">Multihazard</div>
    <div class="metric"><span>Mean error rata-rata</span><strong>{mu_me}%</strong></div>
    <div class="metric"><span>Max error field</span><strong>{mu_mx}%</strong></div>
    <div class="metric"><span>Exact match rata-rata</span><strong>{mu_ex}%</strong></div>
    <div class="card-foot">{mu_st}</div>
  </div>
</div>

<div class="legend">
  <span style="font-size:12.5px;font-weight:600;color:#475569">Keterangan:</span>
  <div class="leg"><div class="dot g"></div>Baik (&le;1%)</div>
  <div class="leg"><div class="dot o"></div>OK (&le;5%)</div>
  <div class="leg"><div class="dot w"></div>Perlu Cek (&le;15%)</div>
  <div class="leg"><div class="dot b"></div>Anomali (&gt;15%)</div>
</div>

<div class="tabs">
  <button class="tab active" onclick="showTab('flood',this)">&#9928; Flood</button>
  <button class="tab" onclick="showTab('drought',this)">&#9728; Drought</button>
  <button class="tab" onclick="showTab('multi',this)">&#9889; Multihazard</button>
</div>

{tab_flood}
{tab_drought}
{tab_multi}

</div>
<script>
function showTab(id,el){{
  document.querySelectorAll('.tab-content').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  el.classList.add('active');
}}
function mkChart(id,labels,data,colors){{
  new Chart(document.getElementById(id),{{
    type:'bar',
    data:{{labels,datasets:[{{label:'Mean % Err',data,backgroundColor:colors,borderRadius:5}}]}},
    options:{{responsive:true,maintainAspectRatio:false,
      plugins:{{legend:{{display:false}},
        tooltip:{{callbacks:{{label:ctx=>ctx.parsed.y.toFixed(3)+'%'}}}}}},
      scales:{{
        x:{{ticks:{{font:{{size:10}},maxRotation:55,minRotation:45}}}},
        y:{{beginAtZero:true,ticks:{{callback:v=>v+'%'}},
           title:{{display:true,text:'Mean % Error',font:{{size:11}}}}}}
      }}
    }}
  }});
}}
mkChart('chartFlood',   {fl_lbl},{fl_val},{fl_col});
mkChart('chartDrought', {dr_lbl},{dr_val},{dr_col});
mkChart('chartMulti',   {mu_lbl},{mu_val},{mu_col});
</script>
</body>
</html>'''.format(
    run_id=RUN_ID,
    fl_me=fl_o['mean_err'], fl_mx=fl_o['max_err'], fl_ex=fl_o['exact'], fl_st=card_status(fl_o),
    dr_me=dr_o['mean_err'], dr_mx=dr_o['max_err'], dr_ex=dr_o['exact'], dr_st=card_status(dr_o),
    mu_me=mu_o['mean_err'], mu_mx=mu_o['max_err'], mu_ex=mu_o['exact'], mu_st=card_status(mu_o),
    tab_flood  =tab_section('flood',   'chartFlood',   fl_tbl, fl_worst),
    tab_drought=tab_section('drought', 'chartDrought', dr_tbl, dr_worst),
    tab_multi  =tab_section('multi',   'chartMulti',   mu_tbl, mu_worst),
    fl_lbl=fl_lbl, fl_val=fl_val, fl_col=fl_col,
    dr_lbl=dr_lbl, dr_val=dr_val, dr_col=dr_col,
    mu_lbl=mu_lbl, mu_val=mu_val, mu_col=mu_col,
)

with open(OUT, 'w', encoding='utf-8') as f:
    f.write(html)

print('Saved: %s  (%.1f KB)' % (OUT, os.path.getsize(OUT)/1024))
