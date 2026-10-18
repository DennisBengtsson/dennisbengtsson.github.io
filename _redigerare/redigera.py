#!/usr/bin/env python3
"""
Redigeraren för plankbengtsson.se

Starta:  dubbelklicka på "Starta redigeraren.bat"  (eller: py redigera.py)
Öppnas:  http://127.0.0.1:8010/_redigerare/

Programmet visar hemsidan som den ser ut och låter dig ändra texter, bilder,
sidor, blogginlägg, kontaktuppgifter och loppisens varor direkt i webbläsaren.
Allt sparas som vanliga filer i hemsidans mapp, och "Publicera" skickar upp
ändringarna till GitHub med git.

Utkast: sidor och inlägg som inte är aktiva ligger i mappen _utkast. Mappar som
börjar med understreck publiceras aldrig av GitHub Pages, så utkasten syns bara
här i redigeraren. Samma sak gäller _redigerare.

Säkerhet:
  - lyssnar bara på din egen dator (127.0.0.1), aldrig på nätverket
  - varje start får en hemlig nyckel som alla anrop måste ha, så att andra
    webbsidor du besöker inte kan skicka kommandon hit
  - kan bara skriva till hemsidans egna sidor, datafiler och bildmappen
  - sparar en kopia av varje fil innan den skrivs över (_redigerare/historik)

Kräver bara Python 3.
"""

import html
import io
import json
import os
import re
import secrets
import shutil
import subprocess
import sys
import threading
import webbrowser
import zipfile
from datetime import date, datetime
from glob import glob
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import parse_qs, unquote, urlparse

HAR = os.path.dirname(os.path.abspath(__file__))
ROT = os.path.dirname(HAR)                       # hemsidans mapp
UTKAST = "_utkast"                               # inaktiva sidor och inlägg
HISTORIK = os.path.join(HAR, "historik")
PORT = int(os.environ.get("REDIGERA_PORT", 8010))
NYCKEL = secrets.token_urlsafe(24)
ADRESS = "https://plankbengtsson.se"
MAX_BACKUPER = 300

KARNSIDOR = [  # sidor som hemsidans skript räknar med; de kan inte raderas
    ("index.html", "Hem"), ("about.html", "Om mig"), ("contact.html", "Kontakt"),
    ("blog.html", "Blogg"), ("bilder.html", "Bildgalleri"), ("market.html", "Loppis"), ("sok.html", "Sök"),
]
SIDA = re.compile(r"^(?:[\w-]+\.html|blog/[\w-]+\.html)$")
DATAFILER = {"data.json", "json/blog_posts.json", "data/products.json"}
BILDTYPER = {".jpg": b"\xff\xd8", ".jpeg": b"\xff\xd8", ".png": b"\x89PNG", ".gif": b"GIF8", ".webp": b"RIFF"}
MIME = {".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".woff2": "font/woff2", ".ttf": "font/ttf",
        ".ico": "image/x-icon", ".txt": "text/plain; charset=utf-8", ".md": "text/plain; charset=utf-8"}


# ------------------------------------------------------------------ filer

def full(sokvag):
    """Gör om en sökväg i hemsidan till en riktig sökväg, och vägrar allt utanför."""
    p = os.path.realpath(os.path.join(ROT, *sokvag.split("/")))
    if not (p == ROT or p.startswith(ROT + os.sep)):
        raise ValueError("otillåten sökväg")
    return p


def ar_aktiv(sokvag):
    return os.path.exists(full(sokvag))


def var_finns(sokvag):
    """En sida ligger antingen på sin vanliga plats (aktiv) eller i _utkast (inaktiv)."""
    if SIDA.match(sokvag) and not ar_aktiv(sokvag) and os.path.exists(full(f"{UTKAST}/{sokvag}")):
        return full(f"{UTKAST}/{sokvag}")
    return full(sokvag)


def las(sokvag):
    with open(var_finns(sokvag), encoding="utf-8") as f:
        return f.read()


def backup(sokvag):
    p = var_finns(sokvag)
    if not os.path.exists(p):
        return
    os.makedirs(HISTORIK, exist_ok=True)
    namn = datetime.now().strftime("%Y%m%d-%H%M%S-%f") + "__" + sokvag.replace("/", "__")
    shutil.copy2(p, os.path.join(HISTORIK, namn))
    for g in sorted(os.listdir(HISTORIK))[:-MAX_BACKUPER]:
        os.remove(os.path.join(HISTORIK, g))


def skriv_till(p, innehall):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="\n") as f:
        f.write(innehall)
    os.replace(tmp, p)


def skriv(sokvag, innehall, ny_som_utkast=False):
    if not (SIDA.match(sokvag) or sokvag in DATAFILER or sokvag == f"{UTKAST}/blog_posts.json"):
        raise ValueError(f"får inte skriva till {sokvag}")
    if len(innehall) > 3_000_000:
        raise ValueError("filen är för stor")
    if sokvag.endswith(".json"):
        json.loads(innehall)  # vägra trasig JSON
    elif not innehall.lstrip().lower().startswith("<!doctype html"):
        raise ValueError("det ser inte ut som en HTML-sida")
    backup(sokvag)
    p = var_finns(sokvag)
    if ny_som_utkast and not os.path.exists(p):
        p = full(f"{UTKAST}/{sokvag}")
    skriv_till(p, innehall)


def las_json(sokvag, standard):
    try:
        with open(full(sokvag), encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, ValueError):
        return standard


def skriv_json(sokvag, data, indrag=2):
    skriv(sokvag, json.dumps(data, ensure_ascii=False, indent=indrag) + "\n")


def titel_i(sokvag):
    try:
        m = re.search(r"<title>(.*?)</title>", las(sokvag), re.S)
        return html.unescape(m.group(1)).split(" – ")[0].strip() if m else sokvag
    except OSError:
        return sokvag


def slugga(t):
    t = t.lower().replace("å", "a").replace("ä", "a").replace("ö", "o").replace("é", "e")
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-")


# ------------------------------------------------------------------ mallar

CSP = ("default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; "
       "connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests")


def sidhuvud(titel, beskrivning, r):
    return f"""<!DOCTYPE html>
<html lang="sv">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Content-Security-Policy" content="{CSP}">
    <meta name="referrer" content="no-referrer">
    <title>{html.escape(titel)} – Dennis Bengtsson</title>
    <meta name="description" content="{html.escape(beskrivning, quote=True)}">
    <link rel="stylesheet" href="{r}vendor/bootstrap-4.6.2/bootstrap.min.css">
    <link rel="stylesheet" href="{r}vendor/fontawesome-6.7.2/css/all.min.css">
    <link rel="stylesheet" href="{r}css/opensans.css">
    <link rel="stylesheet" href="{r}css/style.css">
</head>
<body>
    <div class="wrapper">
        <div id="sidebar-container"></div>

        <div class="content">
            <div id="header-container"></div>
"""


def sidfot(r, skript):
    rader = "\n".join(f'    <script src="{r}{s}"></script>' for s in
                      ["vendor/jquery-3.7.1.min.js", "vendor/bootstrap-4.6.2/bootstrap.bundle.min.js", "js/main.js", *skript])
    return f"""
            <div id="footer-container"></div>
        </div>
    </div>

    <a href="#" class="back-to-top" aria-label="Till toppen"><i class="fa fa-angle-double-up" aria-hidden="true"></i></a>

{rader}
</body>
</html>
"""


def rubrik(titel, smulor, r):
    delar = []
    for i, (text, href) in enumerate(smulor):
        if i:
            delar.append('                            <h4 class="m-0 text-white px-2 brodsmula" aria-hidden="true">/</h4>')
        inre = f'<a class="text-white" href="{r}{href}">{html.escape(text)}</a>' if href else html.escape(text)
        delar.append(f'                            <h4 class="m-0 text-white brodsmula">{inre}</h4>')
    smulrader = "\n".join(delar)
    return f"""
            <!-- Sidrubrik -->
            <div class="container py-2 px-2 bg-primary mb-4 shadow-sm rounded-bottom">
                <div class="row py-3 px-4">
                    <div class="col-sm-6 text-center text-md-left">
                        <h1 class="mb-3 mb-md-0 text-white text-uppercase font-weight-bold sidrubrik" data-redigera="text">{html.escape(titel)}</h1>
                    </div>
                    <div class="col-sm-6 text-center text-md-right">
                        <nav class="d-inline-flex pt-2" aria-label="Du är här">
{smulrader}
                        </nav>
                    </div>
                </div>
            </div>
"""


def textsida_html(titel):
    """En ny sida: sidrubrik och en textruta som fungerar som ett blogginlägg (rubriker, bilder, listor …)."""
    return (sidhuvud(titel, "", "") + rubrik(titel, [("Hem", "index.html"), (titel, None)], "") + """
            <!-- Innehåll -->
            <div class="container bg-white p-4 p-lg-5 shadow-sm rounded mb-5">
                <div class="inlaggstext" data-redigera="fri">
                    <p>Skriv sidans text här.</p>
                </div>
            </div>
""" + sidfot("", ["js/blog.js", "js/lightbox.js"]))


def soksida_html():
    return (sidhuvud("Sök", "Sök bland inläggen och sidorna.", "") + rubrik("Sök", [("Hem", "index.html"), ("Sök", None)], "") + """
            <!-- Sök: fylls av js/sok.js -->
            <div class="container bg-white p-4 p-lg-5 shadow-sm rounded mb-5">
                <label class="sr-only" for="sokfalt">Sök</label>
                <input type="search" id="sokfalt" class="sokfalt" placeholder="Sök efter ett ord …" autocomplete="off">
                <p id="sokinfo" class="sokinfo" aria-live="polite" data-dynamisk></p>
                <div id="sokresultat" data-dynamisk></div>
            </div>
""" + sidfot("", ["js/sok.js"]))


def inlagg_html(titel, datum, kategori, beskrivning):
    """Ett nytt, tomt inlägg med exakt samma uppbyggnad som de befintliga."""
    t, k = html.escape(titel), html.escape(kategori)
    r = "../"
    return (sidhuvud(titel, beskrivning, r)
            + rubrik("Blogg", [("Hem", "index.html"), ("Blogg", "blog.html"), ("Inlägg", None)], r) + f"""
            <!-- Inlägget -->
            <article class="container bg-white p-4 p-lg-5 shadow-sm rounded mb-5">
                <h1 class="mb-2 font-weight-bold" data-redigera="text" data-falt="titel">{t}</h1>
                <div class="d-flex mb-4">
                    <small class="mr-3 text-muted"><i class="fa fa-calendar-alt" aria-hidden="true"></i> <time datetime="{datum}" data-falt="datum">{datum}</time></small>
                    <small class="mr-2 text-muted"><i class="fa fa-folder" aria-hidden="true"></i> <span data-falt="kategori">{k}</span></small>
                </div>

                <div class="inlaggstext" data-redigera="fri">
                    <p>Skriv ditt inlägg här.</p>
                </div>

                <nav class="inlaggsnavigering" aria-label="Fler inlägg" data-dynamisk>
                    <a class="btn btn-sm btn-outline-primary" href="{r}blog.html"><i class="fa fa-angle-left" aria-hidden="true"></i> Tillbaka till bloggen</a>
                    <div>
                        <a class="btn btn-sm btn-outline-primary prev-post">Föregående inlägg</a>
                        <a class="btn btn-sm btn-outline-primary next-post">Nästa inlägg</a>
                    </div>
                </nav>
            </article>
""" + sidfot(r, ["js/blog.js", "js/lightbox.js"]))


# ------------------------------------------------------------------ sidor och inlägg

def alla_inlagg():
    """Aktiva inlägg ligger i json/blog_posts.json, utkast i _utkast/blog_posts.json (publiceras aldrig)."""
    aktiva = [dict(p, aktiv=True) for p in las_json("json/blog_posts.json", [])]
    utkast = [dict(p, aktiv=False) for p in las_json(f"{UTKAST}/blog_posts.json", [])]
    return aktiva + utkast


def spara_inlaggslistor(poster):
    rena = lambda ps: [{k: v for k, v in p.items() if k != "aktiv"} for p in ps]
    skriv_json("json/blog_posts.json", rena([p for p in poster if p.get("aktiv")]))
    skriv_json(f"{UTKAST}/blog_posts.json", rena([p for p in poster if not p.get("aktiv")]))


def uppdatera_inlaggsinfo(info):
    sokvag = info.get("sokvag", "")
    poster = alla_inlagg()
    post = next((p for p in poster if p.get("link") == sokvag), None)
    if not post:
        post = {"link": sokvag, "aktiv": ar_aktiv(sokvag)}
        poster.insert(0, post)
    for nyckel in ("title", "date", "category", "description", "image", "serie"):
        if nyckel in info:
            varde = str(info[nyckel] or "").strip()[:300]
            if nyckel == "serie" and not varde:
                post.pop("serie", None)
            else:
                post[nyckel] = varde
    spara_inlaggslistor(poster)


def menyn():
    return las_json("data.json", {}).get("menu", [])


def satt_menyval(sokvag, med, namn=None):
    d = las_json("data.json", {})
    meny = [m for m in d.get("menu", []) if m.get("url") != sokvag]
    if med:
        meny.append({"label": namn or titel_i(sokvag), "url": sokvag, "dataPage": sokvag.removesuffix(".html")})
    if meny != d.get("menu", []):
        d["menu"] = meny
        skriv("data.json", json.dumps(d, ensure_ascii=False, indent=4) + "\n")


def satt_menyordning(ordning):
    """Ny ordning för menyn. Listan måste innehålla exakt samma menyval som nu, bara i en annan ordning."""
    d = las_json("data.json", {})
    meny = d.get("menu", [])
    urls = [m.get("url") for m in meny]
    if not isinstance(ordning, list) or sorted(map(str, ordning)) != sorted(map(str, urls)) or len(set(urls)) != len(urls):
        raise ValueError("Menyn har ändrats under tiden. Ladda om redigeraren och försök igen.")
    d["menu"] = [next(m for m in meny if m.get("url") == u) for u in ordning]
    if d["menu"] != meny:
        skriv("data.json", json.dumps(d, ensure_ascii=False, indent=4) + "\n")


def satt_aktiv(sokvag, aktiv):
    if not SIDA.match(sokvag):
        raise ValueError("okänd sida")
    if sokvag == "index.html" and not aktiv:
        raise ValueError("Startsidan måste vara aktiv.")
    fran, till = (full(f"{UTKAST}/{sokvag}"), full(sokvag)) if aktiv else (full(sokvag), full(f"{UTKAST}/{sokvag}"))
    if os.path.exists(fran):
        if os.path.exists(till):
            raise ValueError("Det finns redan en fil med det namnet.")
        os.makedirs(os.path.dirname(till), exist_ok=True)
        os.replace(fran, till)
    if sokvag.startswith("blog/"):
        poster = alla_inlagg()
        for p in poster:
            if p.get("link") == sokvag:
                p["aktiv"] = aktiv
        spara_inlaggslistor(poster)
    if not aktiv:
        satt_menyval(sokvag, False)


def ledigt_namn(bas, mapp=""):
    bas = slugga(bas) or "sida"
    namn, n = f"{bas}.html", 2
    while os.path.exists(full(mapp + namn)) or os.path.exists(full(f"{UTKAST}/{mapp}{namn}")):
        namn, n = f"{bas}-{n}.html", n + 1
    return mapp + namn


def ny_sida(titel, kopia_av=None):
    titel = (titel or "").strip()[:80] or "Ny sida"
    sokvag = ledigt_namn(titel)
    if kopia_av:
        if not SIDA.match(kopia_av) or kopia_av.startswith("blog/"):
            raise ValueError("kan bara kopiera vanliga sidor")
        innehall = las(kopia_av)
        innehall = re.sub(r"<title>.*?</title>", f"<title>{html.escape(titel)} – Dennis Bengtsson</title>", innehall, count=1, flags=re.S)
        innehall = re.sub(r'(<h1 class="[^"]*sidrubrik"[^>]*>).*?(</h1>)', lambda m: m.group(1) + html.escape(titel) + m.group(2),
                          innehall, count=1, flags=re.S)
    else:
        innehall = textsida_html(titel)
    skriv(sokvag, innehall, ny_som_utkast=True)
    return sokvag


def radera_sida(sokvag):
    if not SIDA.match(sokvag):
        raise ValueError("okänd sida")
    if sokvag in dict(KARNSIDOR):
        raise ValueError("Den här sidan behövs av hemsidan och kan inte tas bort. Gör den inaktiv i stället.")
    backup(sokvag)
    p = var_finns(sokvag)
    if os.path.exists(p):
        os.remove(p)
    if sokvag.startswith("blog/"):
        spara_inlaggslistor([p for p in alla_inlagg() if p.get("link") != sokvag])
    satt_menyval(sokvag, False)


def nytt_inlagg(titel):
    titel = (titel or "").strip()[:150] or "Nytt inlägg"
    nummer = []
    for mapp in ("blog", f"{UTKAST}/blog"):
        if os.path.isdir(full(mapp)):
            nummer += [int(m.group(1)) for f in os.listdir(full(mapp)) if (m := re.fullmatch(r"post(\d+)\.html", f))]
    sokvag = f"blog/post{max(nummer, default=0) + 1}.html"
    idag = date.today().isoformat()
    skriv(sokvag, inlagg_html(titel, idag, "", ""), ny_som_utkast=True)
    poster = alla_inlagg()
    poster.insert(0, {"title": titel, "image": "", "date": idag, "category": "", "description": "", "link": sokvag, "aktiv": False})
    spara_inlaggslistor(poster)
    return sokvag


def sidlista():
    menyurl = {m.get("url") for m in menyn()}
    kanda = dict(KARNSIDOR)
    filer = set()
    for mapp in ("", f"{UTKAST}/"):
        if os.path.isdir(full(mapp or ".")):
            filer |= {f for f in os.listdir(full(mapp or ".")) if f.endswith(".html")}
    ordning = [s for s, _ in KARNSIDOR] + sorted(f for f in filer if f not in kanda)
    return [{"sokvag": s, "namn": kanda.get(s) or titel_i(s), "aktiv": ar_aktiv(s), "iMenyn": s in menyurl,
             "karna": s in kanda} for s in ordning if s in filer]


def inlaggslista():
    poster = [p for p in alla_inlagg() if p.get("link") and os.path.exists(var_finns(p["link"]))]
    kanda = {p["link"] for p in poster}
    for mapp in ("blog", f"{UTKAST}/blog"):
        if os.path.isdir(full(mapp)):
            for f in sorted(os.listdir(full(mapp))):
                s = f"blog/{f}"
                if f.endswith(".html") and s not in kanda:
                    poster.append({"link": s, "title": titel_i(s), "date": "", "aktiv": ar_aktiv(s)})
                    kanda.add(s)
    return [{"sokvag": p["link"], "titel": p.get("title"), "datum": p.get("date", ""), "kategori": p.get("category", ""),
             "serie": p.get("serie", ""), "aktiv": p.get("aktiv", True)} for p in poster]


# ------------------------------------------------------------------ bilder, historik, kopia

def spara_bild(namn, data):
    bas, ext = os.path.splitext(os.path.basename(namn))
    ext = ext.lower()
    if ext not in BILDTYPER:
        raise ValueError("bara jpg, png, webp och gif kan laddas upp")
    if not data.startswith(BILDTYPER[ext]):
        raise ValueError("filen är inte en riktig bild")
    if len(data) > 15_000_000:
        raise ValueError("bilden är för stor (max 15 MB)")
    os.makedirs(full("img"), exist_ok=True)
    bas = slugga(bas) or "bild"
    fil, n = bas + ext, 2
    while os.path.exists(full("img/" + fil)):
        fil, n = f"{bas}-{n}{ext}", n + 1
    with open(full("img/" + fil), "wb") as f:
        f.write(data)
    return "img/" + fil


def bildlista():
    ut = []
    if os.path.isdir(full("img")):
        for f in os.listdir(full("img")):
            if os.path.splitext(f)[1].lower() in (*BILDTYPER, ".svg"):
                ut.append({"sokvag": "img/" + f, "tid": os.path.getmtime(full("img/" + f))})
    return sorted(ut, key=lambda b: -b["tid"])


def historik(sokvag):
    if not os.path.isdir(HISTORIK):
        return []
    slut = "__" + sokvag.replace("/", "__")
    ut = []
    for namn in sorted(os.listdir(HISTORIK), reverse=True):
        if namn.endswith(slut):
            t = datetime.strptime(namn[:15], "%Y%m%d-%H%M%S")
            ut.append({"namn": namn, "tid": t.strftime("%Y-%m-%d %H:%M"), "storlek": os.path.getsize(os.path.join(HISTORIK, namn))})
    return ut


def historikfil(namn):
    if not re.fullmatch(r"\d{8}-\d{6}-\d{6}__[\w.-]+", namn) or not os.path.isfile(os.path.join(HISTORIK, namn)):
        raise ValueError("okänd version")
    with open(os.path.join(HISTORIK, namn), encoding="utf-8") as f:
        return f.read()


def aterstall(namn, sokvag):
    innehall = historikfil(namn)
    if not namn.endswith("__" + sokvag.replace("/", "__")):
        raise ValueError("versionen hör inte till den här sidan")
    skriv(sokvag, innehall)


def sakerhetskopia():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for rot, mappar, filer in os.walk(ROT):
            mappar[:] = [m for m in mappar if m not in (".git", "__pycache__") and os.path.join(rot, m) != HISTORIK]
            for f in filer:
                if f.endswith(".tmp"):
                    continue
                p = os.path.join(rot, f)
                z.write(p, os.path.relpath(p, ROT))
    return buf.getvalue()


# ------------------------------------------------------------------ git

def hitta_git():
    g = shutil.which("git")
    if g:
        return g
    # GitHub Desktop har en egen git som inte ligger i PATH
    lokal = os.environ.get("LOCALAPPDATA", "")
    kandidater = sorted(glob(os.path.join(lokal, "GitHubDesktop", "app-*", "resources", "app", "git", "cmd", "git.exe")))
    return kandidater[-1] if kandidater else None


def git(*arg, tid=120):
    g = hitta_git()
    if not g:
        raise RuntimeError("Hittar inte git på datorn. Installera Git eller publicera med GitHub Desktop.")
    miljo = dict(os.environ, GIT_TERMINAL_PROMPT="0")
    r = subprocess.run([g, *arg], cwd=ROT, capture_output=True, text=True, encoding="utf-8",
                       errors="replace", timeout=tid, env=miljo)
    return r.returncode, (r.stdout + r.stderr).strip()


def git_status():
    if not os.path.isdir(os.path.join(ROT, ".git")):
        return {"finns": False, "orsak": "Mappen är inte ett git-repo."}
    if not hitta_git():
        return {"finns": False, "orsak": "Git saknas på datorn."}
    kod, ut = git("status", "--porcelain", "-uall", tid=30)
    if kod:
        return {"finns": False, "orsak": ut}
    filer = [rad[3:] for rad in ut.splitlines() if rad.strip()]
    return {"finns": True, "andringar": filer}


def sla_ihop_inlaggslistor():
    """Under en rebase: båda sidor har ändrat json/blog_posts.json (t.ex. ett inlägg från telefonen
    och ett från datorn). Behåll datorns lista och lägg till de inlägg som bara finns på GitHub."""
    def version(nr):
        kod, ut = git("show", f":{nr}:json/blog_posts.json")
        if kod:
            return []
        try:
            d = json.loads(ut)
            return d if isinstance(d, list) else []
        except ValueError:
            return []
    github, datorn = version(2), version(3)          # 2 = det som redan finns på GitHub, 3 = din ändring
    kanda = {p.get("link") for p in datorn if isinstance(p, dict)}
    nya = [p for p in github if isinstance(p, dict) and p.get("link") not in kanda]
    with open(full("json/blog_posts.json"), "w", encoding="utf-8", newline="\n") as f:
        f.write(json.dumps(nya + datorn, ensure_ascii=False, indent=2) + "\n")
    git("add", "json/blog_posts.json")


def hamta_fran_github():
    """Hämtar det som publicerats någon annanstans (t.ex. inlägg från telefonen) och lägger
    dina egna ändringar ovanpå. Returnerar (ok, logg)."""
    kod, ut = git("pull", "--rebase", "--no-autostash")
    if not kod:
        return True, ut
    pagar = lambda: any(os.path.isdir(os.path.join(ROT, ".git", d)) for d in ("rebase-merge", "rebase-apply"))
    if not pagar():
        return False, ut + "\n\nKunde inte hämta från GitHub. Är datorn ansluten till nätet?"
    for _ in range(100):                              # en rebase kan stanna en gång per egen ändring
        kod, konflikter = git("diff", "--name-only", "--diff-filter=U")
        filer = {f.strip() for f in konflikter.splitlines() if f.strip()}
        if not filer or filer != {"json/blog_posts.json"}:
            break
        sla_ihop_inlaggslistor()
        kod, ut2 = git("-c", "core.editor=true", "rebase", "--continue")
        if not kod:
            return True, "Hämtade nya inlägg från GitHub och slog ihop dem med dina."
    git("rebase", "--abort")
    return False, (ut + "\n\nKunde inte slå ihop ändringarna från GitHub automatiskt. Ingenting är förlorat. "
                   "Öppna mappen i GitHub Desktop eller VS Code och lös det där, eller be om hjälp.")


def publicera(meddelande):
    meddelande = (meddelande or "").strip()[:200] or "Uppdaterat hemsidan"
    logg = []
    for steg in (("add", "-A"), ("commit", "-m", meddelande)):
        kod, ut = git(*steg)
        logg.append(ut)
        if kod and not (steg[0] == "commit" and "nothing to commit" in ut):
            return {"ok": False, "logg": "\n".join(logg)}
    ok, ut = hamta_fran_github()                      # inlägg från telefonen kan ha publicerats under tiden
    logg.append(ut)
    if not ok:
        return {"ok": False, "logg": "\n".join(x for x in logg if x)}
    kod, ut = git("push")
    logg.append(ut)
    return {"ok": kod == 0, "logg": "\n".join(x for x in logg if x)}


def hamta_vid_start():
    """När redigeraren startar: hämta nya inlägg från GitHub, men bara om inget är ändrat här."""
    try:
        if not hitta_git() or not os.path.isdir(os.path.join(ROT, ".git")):
            return
        kod, ut = git("status", "--porcelain", tid=30)
        if kod or ut.strip():
            return
        kod, ut = git("pull", "--ff-only", "-q", tid=60)
        if not kod:
            print("  Hämtade det senaste från GitHub (t.ex. inlägg från telefonen).\n")
    except Exception:
        pass


# ------------------------------------------------------------------ server

class Hanterare(BaseHTTPRequestHandler):
    server_version = "Redigeraren"

    def log_message(self, *a):
        pass

    def svara(self, kod, data, typ="application/json; charset=utf-8", extra=None):
        if isinstance(data, (dict, list)):
            data = json.dumps(data, ensure_ascii=False)
        if isinstance(data, str):
            data = data.encode("utf-8")
        self.send_response(kod)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (extra or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(data)

    def kontrollera(self, api):
        """Bara anrop till 127.0.0.1/localhost, och API-anrop måste ha nyckeln."""
        vard = (self.headers.get("Host") or "").lower()
        if vard not in (f"127.0.0.1:{PORT}", f"localhost:{PORT}"):
            self.svara(403, {"fel": "fel värd"})
            return False
        if api and not secrets.compare_digest(self.headers.get("X-Nyckel", ""), NYCKEL):
            self.svara(403, {"fel": "fel nyckel – ladda om redigeraren"})
            return False
        return True

    def do_GET(self):
        u = urlparse(self.path)
        vag, q = unquote(u.path), {k: v[0] for k, v in parse_qs(u.query).items()}
        api = vag.startswith("/api/")
        if not self.kontrollera(api):
            return
        try:
            if vag in ("/_redigerare", "/_redigerare/"):
                with open(os.path.join(HAR, "redigerare.html"), encoding="utf-8") as f:
                    return self.svara(200, f.read().replace("{{NYCKEL}}", NYCKEL), "text/html; charset=utf-8")
            if vag.startswith("/_redigerare/version/"):
                # en gammal version att titta på, med <base> så att bilder och stilar hittas
                namn = vag.rsplit("/", 1)[1]
                innehall = historikfil(namn)
                sokvag = namn.split("__", 1)[1].replace("__", "/")
                mapp = "/" + sokvag.rsplit("/", 1)[0] + "/" if "/" in sokvag else "/"
                innehall = innehall.replace("<head>", f'<head>\n    <base href="{mapp}">', 1)
                return self.svara(200, innehall, "text/html; charset=utf-8")
            if vag == "/api/lista":
                return self.svara(200, {"sidor": sidlista(), "inlagg": inlaggslista(), "git": git_status(), "adress": ADRESS,
                                        "meny": [{"namn": m.get("label", ""), "sokvag": m.get("url", "")} for m in menyn()]})
            if vag == "/api/fil":
                sokvag = q.get("sokvag", "")
                if not (SIDA.match(sokvag) or sokvag in DATAFILER or sokvag == f"{UTKAST}/blog_posts.json"):
                    return self.svara(403, {"fel": "får inte läsa den filen här"})
                return self.svara(200, {"innehall": las(sokvag), "aktiv": ar_aktiv(sokvag)})
            if vag == "/api/bilder":
                return self.svara(200, bildlista())
            if vag == "/api/git":
                return self.svara(200, git_status())
            if vag == "/api/historik":
                return self.svara(200, historik(q.get("sokvag", "")))
            if vag == "/api/inlagg-alla":
                return self.svara(200, alla_inlagg())
            if vag == "/api/sakerhetskopia":
                namn = f"hemsidan-{date.today().isoformat()}.zip"
                return self.svara(200, sakerhetskopia(), "application/zip",
                                  {"Content-Disposition": f'attachment; filename="{namn}"'})
            return self.servera(vag)
        except Exception as e:
            return self.svara(500, {"fel": str(e)})

    def servera(self, vag):
        if vag == "/":
            vag = "/index.html"
        delar = [d for d in vag.split("/") if d]
        if any(d.startswith(".") for d in delar) or delar[:2] == ["_redigerare", "historik"] or vag.endswith(".py"):
            return self.svara(404, "Finns inte", "text/plain; charset=utf-8")
        sokvag = "/".join(delar)
        try:
            p = var_finns(sokvag) if SIDA.match(sokvag) else full(sokvag)   # utkast visas på sin vanliga adress
        except ValueError:
            return self.svara(404, "Finns inte", "text/plain; charset=utf-8")
        if os.path.isdir(p):
            p = os.path.join(p, "index.html")
        if not os.path.isfile(p):
            return self.svara(404, "Finns inte", "text/plain; charset=utf-8")
        with open(p, "rb") as f:
            self.svara(200, f.read(), MIME.get(os.path.splitext(p)[1].lower(), "application/octet-stream"))

    def do_POST(self):
        vag = unquote(urlparse(self.path).path)
        if not self.kontrollera(True):
            return
        langd = int(self.headers.get("Content-Length", 0))
        if langd > 20_000_000:
            return self.svara(413, {"fel": "för stort"})
        kropp = self.rfile.read(langd)
        try:
            if vag == "/api/bild":
                namn = unquote(self.headers.get("X-Filnamn", "bild.jpg"))
                return self.svara(200, {"sokvag": spara_bild(namn, kropp)})
            d = json.loads(kropp or b"{}")
            if vag == "/api/spara":
                for fil in d.get("filer", []):           # flera filer i ett anrop
                    skriv(fil["sokvag"], fil["innehall"])
                if d.get("inlagg"):
                    uppdatera_inlaggsinfo(d["inlagg"])
                return self.svara(200, {"ok": True})
            if vag == "/api/sidstatus":
                sokvag = d.get("sokvag", "")
                if "aktiv" in d:
                    satt_aktiv(sokvag, bool(d["aktiv"]))
                if "meny" in d:
                    if d["meny"] and not ar_aktiv(sokvag):
                        raise ValueError("Gör sidan aktiv innan den läggs i menyn.")
                    satt_menyval(sokvag, bool(d["meny"]), d.get("namn"))
                return self.svara(200, {"ok": True})
            if vag == "/api/menyordning":
                satt_menyordning(d.get("ordning"))
                return self.svara(200, {"ok": True})
            if vag == "/api/ny-sida":
                return self.svara(200, {"sokvag": ny_sida(d.get("titel"), d.get("kopiaAv"))})
            if vag == "/api/radera-sida":
                radera_sida(d.get("sokvag", ""))
                return self.svara(200, {"ok": True})
            if vag == "/api/nytt-inlagg":
                return self.svara(200, {"sokvag": nytt_inlagg(d.get("titel"))})
            if vag == "/api/aterstall":
                aterstall(d.get("namn", ""), d.get("sokvag", ""))
                return self.svara(200, {"ok": True})
            if vag == "/api/publicera":
                return self.svara(200, publicera(d.get("meddelande")))
            return self.svara(404, {"fel": "okänt anrop"})
        except subprocess.TimeoutExpired:
            return self.svara(504, {"fel": "git svarade inte i tid. Prova att publicera med GitHub Desktop."})
        except Exception as e:
            return self.svara(400, {"fel": str(e)})


def main():
    # söksidan skapas första gången, så att den finns att lägga i menyn
    hamta_vid_start()
    if not os.path.exists(var_finns("sok.html")):
        skriv("sok.html", soksida_html())
    server = ThreadingHTTPServer(("127.0.0.1", PORT), Hanterare)
    adress = f"http://127.0.0.1:{PORT}/_redigerare/"
    print(f"\n  Redigeraren är igång: {adress}\n  Hemsidans mapp: {ROT}\n  Stäng med Ctrl+C eller genom att stänga fönstret.\n")
    if "--ingen-webblasare" not in sys.argv:
        threading.Timer(0.7, lambda: webbrowser.open(adress)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Hej då!")


if __name__ == "__main__":
    main()
