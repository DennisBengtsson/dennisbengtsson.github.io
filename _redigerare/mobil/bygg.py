#!/usr/bin/env python3
"""
bygg.py – gör om inlägg från telefonen till riktiga blogginlägg.

Körs av GitHub Actions i det privata repot "blogg-inkorg" (se inkorg-workflow.yml),
i två helt åtskilda steg:

  1. python3 bygg.py bilder <inkorg> <ut>
     Läser inkorgen, kontrollerar varje inlägg och gör om bilderna (krymper dem
     och tar bort all extra information som GPS-position). Det här steget
     hanterar bilder från telefonen och får därför ingen nyckel alls.

  2. python3 bygg.py publicera <förberett> <hemsida> <inkorg-repo>
     Kontrollerar allt en gång till, bygger inlägget med samma mall som
     redigeraren, lägger det på en egen gren i hemsidans repo och öppnar ett
     ändringsförslag (pull request). Ingenting publiceras förrän du godkänner
     förslaget i GitHub-appen. Sist tas inlägget bort ur inkorgen.

Telefonens textformat (enkelt, som ett sms):
  varje rad blir ett eget stycke
  ## Rubrik      ### Mindre rubrik      - punkt      1. numrerad punkt
  > citat        ---  (avdelare)        [bild-1]  (bilden på den platsen)
  **fet**  *kursiv*  [länktext](https://adress)  och adresser blir länkar
"""

import html
import json
import os
import re
import shutil
import subprocess
import sys
import urllib.request
from datetime import date

HAR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HAR))
import redigera  # noqa: E402  – samma mallar som redigeraren använder

ID = re.compile(r"^\d{4}-\d{2}-\d{2}-[a-z0-9-]{1,60}-[a-z0-9]{4,12}$")
BILD = re.compile(r"^bild-([1-9]|1\d|20)\.jpg$")
GRANS = {"titel": 150, "kategori": 60, "beskrivning": 300, "text": 100_000, "bildtext": 300}
MAX_BILDER = 20
MAX_BILDSIDA = 1600
MAX_JSON = 400_000
MAX_BILDFIL_IN = 25_000_000
MAX_BILDFIL_UT = 4_000_000


class Fel(Exception):
    pass


# ------------------------------------------------------------------ kontroll

def las_inlagg(mapp):
    """Läser och kontrollerar inlagg.json. Allt okänt tas bort, allt för långt kortas."""
    p = os.path.join(mapp, "inlagg.json")
    if not os.path.isfile(p) or os.path.islink(p) or os.path.getsize(p) > MAX_JSON:
        raise Fel("inlagg.json saknas eller är för stor")
    with open(p, encoding="utf-8") as f:
        d = json.load(f)
    if not isinstance(d, dict):
        raise Fel("inlagg.json har fel form")

    def text(nyckel, d=d):
        v = d.get(nyckel, "")
        v = v if isinstance(v, str) else ""
        v = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f‪-‮⁦-⁩]", "", v)
        return v.replace("\r\n", "\n").replace("\r", "\n").strip()[:GRANS[nyckel]]

    datum = d.get("datum", "")
    try:
        datum = date.fromisoformat(datum).isoformat() if isinstance(datum, str) else ""
    except ValueError:
        datum = ""
    ut = {
        "titel": " ".join(text("titel").split()) or "Nytt inlägg",
        "datum": datum or date.today().isoformat(),
        "kategori": " ".join(text("kategori").split()),
        "beskrivning": " ".join(text("beskrivning").split()),
        "text": text("text"),
        "bilder": [],
        "omslag": None,
    }
    bilder = d.get("bilder", [])
    for b in bilder if isinstance(bilder, list) else []:
        if not isinstance(b, dict) or not isinstance(b.get("fil"), str) or not BILD.match(b["fil"]):
            continue
        if any(x["fil"] == b["fil"] for x in ut["bilder"]):
            continue
        ut["bilder"].append({"fil": b["fil"], "text": " ".join(text("bildtext", {"bildtext": b.get("text", "")}).split())})
    ut["bilder"] = ut["bilder"][:MAX_BILDER]
    if isinstance(d.get("omslag"), str) and any(b["fil"] == d["omslag"] for b in ut["bilder"]):
        ut["omslag"] = d["omslag"]
    return ut


def inlagg_i(mapp):
    """Alla inläggsmappar med giltigt namn, äldst först."""
    if not os.path.isdir(mapp):
        return []
    return sorted(n for n in os.listdir(mapp) if ID.match(n) and os.path.isdir(os.path.join(mapp, n))
                  and not os.path.islink(os.path.join(mapp, n)))


# ------------------------------------------------------------------ steg 1: bilder

def steg_bilder(inkorg, ut):
    from PIL import Image, ImageOps
    Image.MAX_IMAGE_PIXELS = 60_000_000          # stoppar "bildbomber"
    os.makedirs(ut, exist_ok=True)
    klara = 0
    for id_ in inlagg_i(inkorg):
        kalla = os.path.join(inkorg, id_)
        try:
            d = las_inlagg(kalla)
            mal = os.path.join(ut, id_)
            os.makedirs(mal, exist_ok=True)
            for b in list(d["bilder"]):
                p = os.path.join(kalla, b["fil"])
                if not os.path.isfile(p) or os.path.islink(p) or os.path.getsize(p) > MAX_BILDFIL_IN:
                    d["bilder"].remove(b)
                    continue
                try:
                    with Image.open(p) as im:
                        if im.format not in ("JPEG", "PNG", "WEBP"):
                            raise Fel("inte en vanlig bild")
                        im = ImageOps.exif_transpose(im)      # rätt håll upp, sedan kastas EXIF
                        im = im.convert("RGB")
                        im.thumbnail((MAX_BILDSIDA, MAX_BILDSIDA))
                        ren = Image.new("RGB", im.size)       # helt ny bild: bara pixlarna följer med
                        ren.paste(im)
                        ren.save(os.path.join(mal, b["fil"]), "JPEG", quality=85, optimize=True, progressive=True)
                except Exception as e:                        # en trasig bild hoppas över, inlägget går vidare
                    print(f"{id_}: hoppar över {b['fil']}: {e}")
                    d["bilder"].remove(b)
            if d["omslag"] not in [b["fil"] for b in d["bilder"]]:
                d["omslag"] = None
            with open(os.path.join(mal, "inlagg.json"), "w", encoding="utf-8") as f:
                json.dump(d, f, ensure_ascii=False, indent=2)
            klara += 1
            print(f"förberett: {id_} ({len(d['bilder'])} bilder)")
        except Exception as e:                       # ett trasigt inlägg stoppar inte de andra
            print(f"hoppar över {id_}: {e}")
            shutil.rmtree(os.path.join(ut, id_), ignore_errors=True)
    print(f"{klara} inlägg förberedda")


# ------------------------------------------------------------------ text till HTML

LANK = re.compile(r"\[([^\]\n]{1,300})\]\((https?://[^\s)]{1,2000}|mailto:[^\s)]{1,300})\)|(https?://[^\s<>\"]{1,2000})")


def lank_ok(adress):
    return bool(re.match(r"^(https?://[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?|mailto:[^\s@]+@[^\s@]+)$", adress, re.I))


def betoning(s):
    """**fet** och *kursiv* i redan escapad text."""
    s = re.sub(r"\*\*(?=\S)(.+?)(?<=\S)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])", r"<em>\1</em>", s)
    s = re.sub(r"(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])", r"<em>\1</em>", s)
    return s


def rad_html(rad):
    ut, pos = [], 0
    for m in LANK.finditer(rad):
        ut.append(betoning(html.escape(rad[pos:m.start()], quote=False)))
        text, adress = (m.group(1), m.group(2)) if m.group(2) else (m.group(3), m.group(3))
        if not m.group(2):                                  # en adress mitt i texten: skiljetecken hör inte till den
            while adress and adress[-1] in ".,;:!?)":
                adress = adress[:-1]
            text = adress
            pos_slut = m.start() + len(adress)
        else:
            pos_slut = m.end()
        if lank_ok(adress):
            ut.append(f'<a href="{html.escape(adress, quote=True)}" rel="noopener noreferrer">'
                      f'{betoning(html.escape(text, quote=False))}</a>')
        else:
            ut.append(betoning(html.escape(rad[m.start():pos_slut], quote=False)))
        pos = pos_slut
    ut.append(betoning(html.escape(rad[pos:], quote=False)))
    return "".join(ut)


def text_till_html(text, bilder, bildadress):
    """Telefonens text blir HTML. All text escapas; bara våra egna taggar skapas."""
    bildtexter = {b["fil"]: b["text"] for b in bilder}
    anvanda, block, lista = [], [], None

    def figur(fil):
        alt = html.escape(bildtexter[fil], quote=True)
        rader = [f'<figure><img class="inlaggsbild" src="{bildadress(fil)}" alt="{alt}" data-redigera="bild">']
        if bildtexter[fil]:
            rader.append(f'<figcaption class="bildtext">{html.escape(bildtexter[fil], quote=False)}</figcaption>')
        return "".join(rader) + "</figure>"

    def stang():
        nonlocal lista
        if lista:
            block.append(f"<{lista[0]}>" + "".join(f"<li>{x}</li>" for x in lista[1]) + f"</{lista[0]}>")
            lista = None

    for rad in text.split("\n"):
        rad = rad.strip()
        m_ul, m_ol = re.match(r"^[-*•]\s+(.+)$", rad), re.match(r"^\d{1,3}[.)]\s+(.+)$", rad)
        if m_ul or m_ol:
            typ = "ul" if m_ul else "ol"
            if not lista or lista[0] != typ:
                stang()
                lista = (typ, [])
            lista[1].append(rad_html((m_ul or m_ol).group(1)))
            continue
        stang()
        if not rad:
            continue
        if m := re.fullmatch(r"\[(bild-\d{1,2})\]", rad):
            fil = m.group(1) + ".jpg"
            if fil in bildtexter and fil not in anvanda:
                block.append(figur(fil))
                anvanda.append(fil)
            continue
        if re.fullmatch(r"-{3,}|\*{3,}", rad):
            block.append("<hr>")
        elif m := re.match(r"^###\s+(.+)$", rad):
            block.append(f"<h3>{rad_html(m.group(1))}</h3>")
        elif m := re.match(r"^##?\s+(.+)$", rad):
            block.append(f"<h2>{rad_html(m.group(1))}</h2>")
        elif m := re.match(r"^>\s?(.+)$", rad):
            block.append(f"<blockquote>{rad_html(m.group(1))}</blockquote>")
        else:
            block.append(f"<p>{rad_html(rad)}</p>")
    stang()
    return block, anvanda, figur


def bygg_sida(d, sokvag, bildvagar):
    """Hela inläggssidan, med redigerarens mall."""
    r = "../"
    adr = lambda fil: html.escape(r + bildvagar[fil], quote=True)
    block, anvanda, figur = text_till_html(d["text"], d["bilder"], adr)
    omslag = d["omslag"]
    # bilder som inte står i texten hamnar sist (omslaget visas redan överst)
    for b in d["bilder"]:
        if b["fil"] not in anvanda and b["fil"] != omslag:
            block.append(figur(b["fil"]))
    if not block:
        block = ["<p></p>"]
    indrag = "\n                    "
    sida = redigera.inlagg_html(d["titel"], d["datum"], d["kategori"], d["beskrivning"])
    sida = sida.replace("<p>Skriv ditt inlägg här.</p>", indrag.join(block), 1)
    if omslag:
        alt = html.escape(next(b["text"] for b in d["bilder"] if b["fil"] == omslag), quote=True)
        bild = f'<img class="inlaggsbild" src="{adr(omslag)}" alt="{alt}" data-redigera="bild" data-falt="omslag">'
        sida = sida.replace('                <h1 class="mb-2 font-weight-bold"', f"                {bild}\n" + '                <h1 class="mb-2 font-weight-bold"', 1)
    # delningsinformation, som redigeraren lägger till när den sparar
    adress = f"{redigera.ADRESS}/{sokvag}"
    delbild = f"{redigera.ADRESS}/{bildvagar[omslag]}" if omslag else f"{redigera.ADRESS}/img/profile.jpg"
    meta = [("property", "og:type", "article"), ("property", "og:site_name", "Dennis Bengtsson"),
            ("property", "og:locale", "sv_SE"), ("property", "og:title", d["titel"]),
            ("property", "og:description", d["beskrivning"]), ("property", "og:url", adress),
            ("property", "og:image", delbild), ("name", "twitter:card", "summary_large_image")]
    rader = "".join(f'\n    <meta {a}="{b}" content="{html.escape(c, quote=True)}">' for a, b, c in meta)
    sida = re.sub(r'(<meta name="description" content="[^"]*">)', lambda m: m.group(1) + rader, sida, count=1)
    return sida


# ------------------------------------------------------------------ steg 2: publicera som förslag

def git(mapp, *arg, ok=False):
    r = subprocess.run(["git", *arg], cwd=mapp, capture_output=True, text=True)
    if r.returncode and not ok:
        raise Fel(f"git {' '.join(arg[:2])}: {r.stderr.strip() or r.stdout.strip()}")
    return r


def ledigt(mapp, bas, ext):
    namn, n = bas + ext, 2
    while os.path.exists(os.path.join(mapp, namn)):
        namn, n = f"{bas}-{n}{ext}", n + 1
    return namn


def kontrollera_bild(p):
    if not os.path.isfile(p) or os.path.islink(p) or os.path.getsize(p) > MAX_BILDFIL_UT:
        raise Fel(f"{os.path.basename(p)} saknas eller är för stor")
    with open(p, "rb") as f:
        if f.read(3) != b"\xff\xd8\xff":
            raise Fel(f"{os.path.basename(p)} är inte en JPEG")


def oppna_forslag(repo, gren, d, sokvag, bildvagar):
    """Skapar ändringsförslaget via GitHubs API. Texten i förslaget är det du läser i appen."""
    api = os.environ.get("GITHUB_API_URL", "https://api.github.com")
    nyckel = os.environ.get("SAJT_NYCKEL", "")
    if not nyckel:
        raise Fel("SAJT_NYCKEL saknas")
    ra = f"https://github.com/{repo}/blob/{gren}/"
    esc = lambda s: html.escape(s, quote=False)            # visa allt som text, precis som på sidan
    delar = [f"## {esc(d['titel'])}", f"{d['datum']} · {esc(d['kategori']) or 'ingen kategori'}"]
    if d["beskrivning"]:
        delar.append(f"_{esc(d['beskrivning'])}_")
    if d["omslag"]:
        delar.append(f"![omslag]({ra}{bildvagar[d['omslag']]}?raw=true)")
    rader, forra_punkt = [], False
    for rad in d["text"].split("\n"):
        rad = rad.strip()
        if not rad:
            continue
        if m := re.fullmatch(r"\[(bild-\d{1,2})\]", rad):
            rad = f"![{m.group(1)}]({ra}{bildvagar[m.group(1) + '.jpg']}?raw=true)" if m.group(1) + ".jpg" in bildvagar else ""
        else:
            rad = esc(rad)
        punkt = bool(re.match(r"^([-*•]|\d{1,3}[.)])\s", rad))
        rader.append(("\n" if punkt and forra_punkt else "\n\n") + rad)
        forra_punkt = punkt
    delar += ["---", "".join(rader).strip(), "---",
              f"Inlägget blir `{sokvag}`. Tryck **Merge** för att publicera, eller **Close** för att slänga det."]
    kropp = json.dumps({"title": f"Nytt inlägg: {d['titel']}", "head": gren, "base": "main",
                        "body": "\n\n".join(delar)[:60_000]}).encode()
    req = urllib.request.Request(f"{api}/repos/{repo}/pulls", data=kropp, method="POST", headers={
        "Authorization": f"Bearer {nyckel}", "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as svar:
        return json.load(svar).get("html_url", "")


def steg_publicera(forberett, sajt, inkorg_repo):
    repo = os.environ.get("SAJT_REPO", "DennisBengtsson/dennisbengtsson.github.io")
    git(sajt, "config", "user.name", "github-actions[bot]")
    git(sajt, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
    bas = git(sajt, "rev-parse", "HEAD").stdout.strip()
    klara = []
    for id_ in inlagg_i(forberett):
        mapp = os.path.join(forberett, id_)
        gren = f"mobil/{id_}"
        try:
            if git(sajt, "ls-remote", "--exit-code", "--heads", "origin", gren, ok=True).returncode == 0:
                print(f"{id_}: förslaget finns redan")
                klara.append(id_)
                continue
            d = las_inlagg(mapp)
            for b in d["bilder"]:
                kontrollera_bild(os.path.join(mapp, b["fil"]))
            git(sajt, "checkout", "-q", "-B", gren, bas)
            slug = redigera.slugga(d["titel"])[:50].strip("-") or "inlagg"
            sokvag = "blog/" + ledigt(os.path.join(sajt, "blog"), f"{d['datum']}-{slug}", ".html")
            bildvagar = {}
            for i, b in enumerate(d["bilder"], 1):
                namn = ledigt(os.path.join(sajt, "img"), f"{d['datum']}-{slug[:40]}-{i}", ".jpg")
                with open(os.path.join(mapp, b["fil"]), "rb") as f, open(os.path.join(sajt, "img", namn), "wb") as g:
                    g.write(f.read())
                bildvagar[b["fil"]] = "img/" + namn
            with open(os.path.join(sajt, sokvag), "w", encoding="utf-8", newline="\n") as f:
                f.write(bygg_sida(d, sokvag, bildvagar))
            lista_p = os.path.join(sajt, "json", "blog_posts.json")
            with open(lista_p, encoding="utf-8") as f:
                poster = json.load(f)
            poster.insert(0, {"title": d["titel"], "image": bildvagar.get(d["omslag"], ""), "date": d["datum"],
                              "category": d["kategori"], "description": d["beskrivning"], "link": sokvag})
            with open(lista_p, "w", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(poster, ensure_ascii=False, indent=2) + "\n")
            git(sajt, "add", "--", sokvag, "json/blog_posts.json", *bildvagar.values())
            git(sajt, "commit", "-q", "-m", f"Nytt inlägg från telefonen: {d['titel']}")
            git(sajt, "push", "-q", "origin", f"HEAD:refs/heads/{gren}")
            url = oppna_forslag(repo, gren, d, sokvag, bildvagar)
            print(f"{id_}: förslag öppnat {url}")
            klara.append(id_)
        except Exception as e:
            print(f"{id_}: misslyckades: {e}")
        finally:
            git(sajt, "checkout", "-q", "--detach", bas, ok=True)
    # töm inkorgen på det som är klart
    if klara and inkorg_repo:
        for id_ in klara:
            git(inkorg_repo, "rm", "-r", "-q", "--ignore-unmatch", f"inkorg/{id_}")
        if git(inkorg_repo, "diff", "--cached", "--quiet", ok=True).returncode:
            git(inkorg_repo, "config", "user.name", "github-actions[bot]")
            git(inkorg_repo, "config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com")
            git(inkorg_repo, "commit", "-q", "-m", f"Behandlat {len(klara)} inlägg")
            git(inkorg_repo, "push", "-q", "origin", "HEAD:main")
    misslyckade = len(inlagg_i(forberett)) - len(klara)
    if misslyckade:
        sys.exit(f"{misslyckade} inlägg kunde inte behandlas")


if __name__ == "__main__":
    if len(sys.argv) == 4 and sys.argv[1] == "bilder":
        steg_bilder(sys.argv[2], sys.argv[3])
    elif len(sys.argv) == 5 and sys.argv[1] == "publicera":
        steg_publicera(sys.argv[2], sys.argv[3], sys.argv[4])
    else:
        sys.exit(__doc__)
