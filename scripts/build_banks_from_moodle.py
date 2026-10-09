#!/usr/bin/env python3
"""
Convierte los 12 bancos Moodle XML (los mismos que están en Splavia) a los
bancos JSON que usa el examen autoalojado, para que ambos examenes sean idénticos.

Uso:
    python3 scripts/build_banks_from_moodle.py "<carpeta con los XML>"

Entrada (en la carpeta):
    UoL_{A1,A2,B1,B2}_50_Moodle*.xml          (multichoice, uno por pregunta)
    Reading_{A1,A2,B1,B2}_Cloze_Moodle*.xml   (Cloze: texto + N preguntas)
    Listening_{A1,A2,B1,B2}_Cloze_Moodle*.xml (Cloze: audio + N preguntas)
    Si existe la variante *_CON_IMAGENES se usa esa.

Salida:
    data/uol_bank.json, data/reading_bank.json, data/listening_bank.json
        -> PÚBLICOS. Nunca contienen la respuesta correcta ni el guion del audio.
    img/*.png                -> imágenes de Reading y UoL
    answer_key_PRIVADO_NO_SUBIR.json (raíz del repo, está en .gitignore)
        -> se carga UNA vez desde admin.html (queda en Firestore, solo lectura autenticada).
"""
import base64
import html
import json
import os
import re
import sys
import xml.etree.ElementTree as ET

LEVELS = ["A1", "A2", "B1", "B2"]
REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))

CLOZE_RE = re.compile(r"\{(\d+):MULTICHOICE[_A-Z]*:((?:\\.|[^}])*)\}")


def pick(folder, prefix, level, middle):
    """Archivo del banco; prefiere la variante *_CON_IMAGENES."""
    base = f"{prefix}_{level}_{middle}"
    for name in (f"{base}_CON_IMAGENES.xml", f"{base}.xml"):
        p = os.path.join(folder, name)
        if os.path.exists(p):
            return p
    raise FileNotFoundError(f"No encuentro {base}[_CON_IMAGENES].xml en {folder}")


def unescape_cloze(s):
    return re.sub(r"\\([\\~:=#{}\"'])", r"\1", s)


def split_options(raw):
    """'a~=b~c' -> (['a','b','c'], 1). Respeta \\~ escapado."""
    parts = re.split(r"(?<!\\)~", raw)
    options, correct = [], None
    for i, p in enumerate(parts):
        if p.startswith("="):
            p = p[1:]
            if correct is not None:
                raise ValueError(f"Dos respuestas correctas en: {raw}")
            correct = i
        elif p.startswith("%100%"):
            p = p[5:]
            correct = i
        options.append(unescape_cloze(p).strip())
    if correct is None:
        raise ValueError(f"Sin respuesta correcta en: {raw}")
    return options, correct


ORDERED_WORDS = (
    "monday tuesday wednesday thursday friday saturday sunday january february march april may june "
    "july august september october november december one two three four five six seven eight nine ten "
    "eleven twelve first second third fourth"
).split()
FIXED_PHRASES = ("both", "all of", "none of", "neither", "all the", "any of the above")


def keep_order(options):
    """Opciones que tienen un orden natural (horas, números, días) o referencias
    cruzadas ('both', 'all of the above') no se reordenan."""
    low = [o.lower() for o in options]
    if any(any(f in o for f in FIXED_PHRASES) for o in low):
        return True
    def orderable(o):
        return bool(re.search(r"\d", o)) or any(w in re.findall(r"[a-z]+", o) for w in ORDERED_WORDS)
    return all(orderable(o) for o in low)


def shuffled(qid, options, correct):
    """Mezcla determinista (misma por ítem en cada build). Corrige el sesgo del
    banco Moodle, donde la respuesta correcta caía casi siempre en la opción b."""
    if keep_order(options):
        return options, correct
    import random
    rng = random.Random(qid)
    idx = list(range(len(options)))
    rng.shuffle(idx)
    return [options[i] for i in idx], idx.index(correct)


def strip_tags(h):
    h = re.sub(r"<br\s*/?>", " ", h)
    h = re.sub(r"<[^>]+>", "", h)
    return html.unescape(h).strip()


def save_images(question_el, out_dir):
    names = []
    for f in question_el.iter("file"):
        name = f.get("name")
        data = base64.b64decode(f.text or "")
        os.makedirs(out_dir, exist_ok=True)
        with open(os.path.join(out_dir, name), "wb") as fh:
            fh.write(data)
        names.append(name)
    return names


def qtext(q):
    return q.find("questiontext/text").text or ""


def qname(q):
    return q.find("name/text").text or ""


# ------------------------------------------------------------------ UoL
UOL_CATEGORY = {"G": "Gramatica", "V": "Vocabulario", "C": "Colocaciones", "P": "Preposiciones"}


def build_uol(folder, key, img_dir):
    items = []
    for lvl in LEVELS:
        root = ET.parse(pick(folder, "UoL", lvl, "50_Moodle")).getroot()
        for q in root.findall("question"):
            if q.get("type") != "multichoice":
                continue
            qid = qname(q).strip()
            h = qtext(q)
            m_ctx = re.search(r'<p[^>]*font-style:italic[^>]*>(.*?)</p>', h, re.S)
            m_stem = re.search(r'<p[^>]*font-weight:bold[^>]*>(.*?)</p>', h, re.S)
            m_img = re.search(r'<img[^>]*src="@@PLUGINFILE@@/([^"]+)"[^>]*>', h)
            if not m_stem:
                raise ValueError(f"{qid}: no encuentro el enunciado")
            options, correct = [], None
            for i, a in enumerate(q.findall("answer")):
                options.append(strip_tags(a.find("text").text or ""))
                if float(a.get("fraction")) == 100:
                    correct = i
            if correct is None or len(options) != 4:
                raise ValueError(f"{qid}: opciones inválidas")
            options, correct = shuffled(qid, options, correct)
            save_images(q, img_dir)
            cat = UOL_CATEGORY.get(qid.split("-")[-1][0], "Otro")
            item = {
                "id": qid, "skill": "UoL", "level": lvl, "category": cat,
                "context": strip_tags(m_ctx.group(1)) if m_ctx else None,
                "stem": strip_tags(m_stem.group(1)),
                "options": options,
            }
            if m_img:
                item["image"] = f"img/{m_img.group(1)}"
            items.append(item)
            key[qid] = {"correct": correct, "skill": "UoL", "level": lvl, "category": cat}
    return items


# ------------------------------------------------------------------ Reading / Listening
def parse_questions(html_text):
    """Devuelve [(stem, options, correct)] en el orden en que aparecen."""
    out = []
    for m in CLOZE_RE.finditer(html_text):
        before = html_text[: m.start()]
        # el enunciado es el texto del <span> que contiene el campo
        span_start = before.rfind("<span")
        stem_html = before[span_start:]
        stem = strip_tags(stem_html).strip()
        options, correct = split_options(m.group(2))
        out.append((stem, options, correct))
    return out


def build_reading(folder, key, img_dir):
    groups = []
    for lvl in LEVELS:
        root = ET.parse(pick(folder, "Reading", lvl, "Cloze_Moodle")).getroot()
        for q in root.findall("question"):
            if q.get("type") != "cloze":
                continue
            name = qname(q).strip()
            m = re.match(r"(A1|A2|B1|B2)_Reading_Text(\d+)_(.*)", name)
            if not m:
                raise ValueError(f"Nombre de texto inesperado: {name}")
            tnum, title = int(m.group(2)), m.group(3).strip()
            h = qtext(q)
            # columna izquierda = texto/imagen; derecha = preguntas
            cells = re.findall(r"<td[^>]*>(.*?)</td>", h, re.S)
            if len(cells) != 2:
                raise ValueError(f"{name}: estructura de tabla inesperada")
            left = cells[0]
            image = None
            m_img = re.search(r'<img[^>]*src="@@PLUGINFILE@@/([^"]+)"', left)
            paragraphs = [strip_tags(p) for p in re.findall(r"<p[^>]*>(.*?)</p>", left, re.S)]
            paragraphs = [p for p in paragraphs if p]
            if m_img:
                image = f"img/{m_img.group(1)}"
                save_images(q, img_dir)
            if not image and not paragraphs:
                raise ValueError(f"{name}: texto vacío")
            gid = f"{lvl}_R_T{tnum:02d}"
            qs = []
            for i, (stem, options, correct) in enumerate(parse_questions(cells[1]), start=1):
                qid = f"{gid}_Q{i}"
                options, correct = shuffled(qid, options, correct)
                qs.append({"id": qid, "stem": stem, "options": options})
                key[qid] = {"correct": correct, "skill": "Reading", "level": lvl, "category": "Reading"}
            groups.append({
                "id": gid, "skill": "Reading", "level": lvl, "title": title,
                "paragraphs": paragraphs, "image": image, "questions": qs
            })
    return groups


def build_listening(folder, key):
    groups = []
    for lvl in LEVELS:
        root = ET.parse(pick(folder, "Listening", lvl, "Cloze_Moodle")).getroot()
        for q in root.findall("question"):
            if q.get("type") != "cloze":
                continue
            name = qname(q).strip()
            m = re.match(r"(A1|A2|B1|B2)_Listening_([AB][12]L\d+)_(.*)", name)
            if not m:
                raise ValueError(f"Nombre de audio inesperado: {name}")
            audio_id, title = m.group(2), m.group(3).strip()
            qs = []
            for i, (stem, options, correct) in enumerate(parse_questions(qtext(q)), start=1):
                qid = f"{audio_id}_Q{i}"
                options, correct = shuffled(qid, options, correct)
                qs.append({"id": qid, "stem": stem, "options": options})
                key[qid] = {"correct": correct, "skill": "Listening", "level": lvl, "category": "Listening"}
            groups.append({
                "id": audio_id, "skill": "Listening", "level": lvl,
                "title": title, "audio_id": audio_id, "questions": qs
            })
    return groups


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    folder = sys.argv[1]
    img_dir = os.path.join(REPO, "img")
    key = {}
    uol = build_uol(folder, key, img_dir)
    reading = build_reading(folder, key, img_dir)
    listening = build_listening(folder, key)

    os.makedirs(os.path.join(REPO, "data"), exist_ok=True)
    for name, data in (("uol", uol), ("reading", reading), ("listening", listening)):
        with open(os.path.join(REPO, "data", f"{name}_bank.json"), "w", encoding="utf8") as f:
            json.dump(data, f, ensure_ascii=False, indent=1)
    with open(os.path.join(REPO, "answer_key_PRIVADO_NO_SUBIR.json"), "w", encoding="utf8") as f:
        json.dump(key, f, ensure_ascii=False, indent=1)

    print(f"UoL: {len(uol)} ítems | Reading: {len(reading)} textos, "
          f"{sum(len(g['questions']) for g in reading)} preguntas | "
          f"Listening: {len(listening)} audios, {sum(len(g['questions']) for g in listening)} preguntas")
    print(f"Clave privada: {len(key)} entradas -> answer_key_PRIVADO_NO_SUBIR.json")


if __name__ == "__main__":
    main()
