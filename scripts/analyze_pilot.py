"""
Análisis estadístico del piloto — Teoría Clásica de Tests (CTT)

USO:
    pip install pandas numpy --break-system-packages
    python3 analyze_pilot.py piloto_respuestas_2026-XX-XX.csv

PRODUCE:
    - item_stats.csv      → p-value y discriminación por ítem (ya lo ves en vivo
                             en admin.html, pero aquí queda un archivo para el
                             panel Bookmark / documentación)
    - reliability.csv     → alfa de Cronbach APROXIMADO por destreza

NOTA IMPORTANTE sobre el alfa de Cronbach en este piloto:
    Como cada persona ve una selección ALEATORIA distinta de ítems (igual que
    pasará en Moodle), no todos respondieron exactamente los mismos ítems.
    Esto rompe el supuesto clásico de "misma prueba para todos" que usa la
    fórmula estándar de alfa. Aquí se calcula un alfa "de caso disponible"
    (pairwise), que es una aproximación razonable con muestras chicas como
    esta, pero no reemplaza el análisis que Moodle hará después con miles
    de respuestas reales por ítem. Trátalo como una señal, no como un
    número definitivo.
"""

import sys
import pandas as pd
import numpy as np

if len(sys.argv) < 2:
    print("Uso: python3 analyze_pilot.py <archivo_respuestas.csv>")
    sys.exit(1)

df = pd.read_csv(sys.argv[1])

print(f"Filas cargadas: {len(df)}")
print(f"Sesiones (personas): {df['session_id'].nunique()}")
print(f"Ítems distintos respondidos: {df['item_id'].nunique()}")
print()

# ---------------------------------------------------------------
# 1) p-value y discriminación punto-biserial por ítem
# ---------------------------------------------------------------
rows = []
for item_id, g in df.groupby("item_id"):
    n = len(g)
    p = g["correct"].mean()
    correct_scores = g.loc[g["correct"] == 1, "final_score"]
    wrong_scores = g.loc[g["correct"] == 0, "final_score"]
    sd_total = df.drop_duplicates("session_id")["final_score"].std()

    if len(correct_scores) > 0 and len(wrong_scores) > 0 and sd_total and sd_total > 0:
        q = 1 - p
        disc = ((correct_scores.mean() - wrong_scores.mean()) / sd_total) * np.sqrt(p * q)
    else:
        disc = np.nan

    flag = ""
    if p > 0.9 or p < 0.2:
        flag += "dificultad_extrema "
    if not np.isnan(disc) and disc < 0.10:
        flag += "discriminacion_baja"

    rows.append({
        "item_id": item_id,
        "skill": g["skill"].iloc[0],
        "level": g["level"].iloc[0],
        "category": g["category"].iloc[0],
        "n": n,
        "p_value": round(p, 3),
        "discriminacion": round(disc, 3) if not np.isnan(disc) else None,
        "flag": flag.strip()
    })

item_stats = pd.DataFrame(rows).sort_values("item_id")
item_stats.to_csv("item_stats.csv", index=False)
print(f"→ item_stats.csv escrito ({len(item_stats)} ítems)")
print(f"   Ítems marcados para revisar: {(item_stats['flag'] != '').sum()}")
print()

# ---------------------------------------------------------------
# 2) Alfa de Cronbach aproximado por destreza (pairwise / caso disponible)
# ---------------------------------------------------------------
def cronbach_alpha_pairwise(sub_df):
    """
    Alfa aproximado cuando no todos respondieron los mismos ítems.
    Construye la matriz persona x ítem (con NaN donde no respondió) y
    calcula alfa con las varianzas/covarianzas disponibles.
    """
    matrix = sub_df.pivot_table(index="session_id", columns="item_id", values="correct")
    item_vars = matrix.var(axis=0, skipna=True)
    total_scores = matrix.sum(axis=1, skipna=True)
    total_var = total_scores.var(skipna=True)
    k = matrix.shape[1]
    if k <= 1 or total_var == 0 or np.isnan(total_var):
        return None, k
    alpha = (k / (k - 1)) * (1 - item_vars.sum() / total_var)
    return round(alpha, 3), k

reliability_rows = []
for skill, g in df.groupby("skill"):
    alpha, k = cronbach_alpha_pairwise(g)
    reliability_rows.append({"skill": skill, "n_items_en_banco_usado": k, "alfa_aprox": alpha})

reliability = pd.DataFrame(reliability_rows)
reliability.to_csv("reliability.csv", index=False)
print("→ reliability.csv escrito")
print(reliability.to_string(index=False))
print()
print("Regla práctica: alfa >= 0.70 es aceptable para un examen de UBICACIÓN")
print("(no de certificación). Si alguna destreza queda muy por debajo, revisa")
print("primero los ítems marcados en item_stats.csv de esa destreza.")
