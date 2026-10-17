/*
 * Skriv – en liten skrivapp för telefonen.
 *
 * Så fungerar det:
 *   - Inläggen skickas till det privata repot "blogg-inkorg" på GitHub, aldrig direkt
 *     till hemsidan. Där bygger GitHub inlägget och öppnar ett ändringsförslag som du
 *     godkänner i GitHub-appen ("Merge"). Först då publiceras det.
 *   - Nyckeln till inkorgen och alla utkast sparas krypterade (AES-GCM) på telefonen.
 *     Krypteringsnyckeln kommer från telefonens passkey (fingeravtryck/ansikte, via
 *     WebAuthn PRF) och finns bara i minnet medan appen är upplåst. Telefoner som inte
 *     klarar det får ett långt lösenord i stället (PBKDF2, 600 000 varv).
 *   - Bilder ritas om i webbläsaren innan de sparas: de krymps till högst 1600 px och
 *     all extra information (GPS-position, kameramodell, tid) försvinner. GitHub gör
 *     om dem en gång till innan de hamnar på hemsidan.
 *   - Ingen text tolkas någonsin som HTML (sidan förbjuder det också via Trusted Types).
 */
(() => {
    "use strict";

    const AGARE = "DennisBengtsson";
    const INKORG = "blogg-inkorg";
    const SAJT = "dennisbengtsson.github.io";
    const API = "https://api.github.com";
    const MAX_BILDER = 20;
    const MAX_SIDA = 1600;
    const LAS_EFTER_INAKTIV = 15 * 60 * 1000;
    const LAS_EFTER_DOLD = 5 * 60 * 1000;

    const $ = (id) => document.getElementById(id);
    const te = new TextEncoder();
    const td = new TextDecoder();
    const PRF_SALT = te.encode("skriv.dennisbengtsson.github.io/prf/v1");
    const VALV = "skriv.valv";

    /* ------------------------------------------------------------ små verktyg */

    const el = (tagg, attr = {}, ...barn) => {
        const e = document.createElement(tagg);
        for (const [k, v] of Object.entries(attr)) {
            if (v === null || v === undefined || v === false) continue;
            if (k === "class") e.className = v;
            else e.setAttribute(k, v === true ? "" : v);
        }
        for (const b of barn.flat()) {
            if (b === null || b === undefined || b === false) continue;
            e.append(b instanceof Node ? b : document.createTextNode(String(b)));
        }
        return e;
    };

    const b64 = {
        av(buf) {
            const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
            let s = "";
            for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000));
            return btoa(s);
        },
        till(s) {
            const bin = atob(s);
            const u = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
            return u;
        },
        text(s) { return b64.av(te.encode(s)); }
    };
    const slump = (n) => crypto.getRandomValues(new Uint8Array(n));
    const slumpord = (n) => Array.from(slump(n), (x) => "abcdefghijklmnopqrstuvwxyz0123456789"[x % 36]).join("");
    const idag = () => new Date().toLocaleDateString("sv-SE");
    const slugga = (t) => t.toLowerCase().replace(/[åä]/g, "a").replace(/ö/g, "o").replace(/é/g, "e")
        .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    const ord = (t) => (t.match(/\S+/g) || []).length;
    const tid = (ms) => new Date(ms).toLocaleString("sv-SE", { dateStyle: "short", timeStyle: "short" });

    const status = (id, text, fel = false) => {
        const s = $(id);
        s.textContent = text || "";
        s.classList.toggle("fel", !!fel);
    };

    /* ------------------------------------------------------------ kryptering */

    let nyckel = null;   // AES-nyckeln; finns bara i minnet medan appen är upplåst
    let token = null;    // nyckeln till inkorgen; likaså

    async function krypt(obj, k = nyckel) {
        const iv = slump(12);
        const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, k, te.encode(JSON.stringify(obj)));
        return { iv: b64.av(iv), data: b64.av(data) };
    }

    async function dekrypt(p, k = nyckel) {
        const r = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.till(p.iv) }, k, b64.till(p.data));
        return JSON.parse(td.decode(r));
    }

    async function nyckelFranPrf(prf, salt) {
        const bas = await crypto.subtle.importKey("raw", prf, "HKDF", false, ["deriveKey"]);
        return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt, info: te.encode("skriv-v1") },
            bas, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }

    async function nyckelFranLosen(losen, salt) {
        const bas = await crypto.subtle.importKey("raw", te.encode(losen.normalize("NFC")), "PBKDF2", false, ["deriveKey"]);
        return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 600000 },
            bas, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
    }

    /* ------------------------------------------------------------ passkey (WebAuthn PRF) */

    async function prfStods() {
        if (!window.PublicKeyCredential || !navigator.credentials) return false;
        try {
            if (PublicKeyCredential.getClientCapabilities) {
                const f = await PublicKeyCredential.getClientCapabilities();
                if (f && f["extension:prf"] === false) return false;
            }
            if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
                !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())) return false;
        } catch (e) { /* okänt: vi försöker ändå */ }
        return true;
    }

    async function hamtaPrf(id) {
        const svar = await navigator.credentials.get({
            publicKey: {
                challenge: slump(32),
                allowCredentials: [{ type: "public-key", id }],
                userVerification: "required",
                timeout: 120000,
                extensions: { prf: { eval: { first: PRF_SALT } } }
            }
        });
        const r = svar.getClientExtensionResults();
        if (!r.prf || !r.prf.results || !r.prf.results.first) throw new Error("ingen-prf");
        return r.prf.results.first;
    }

    /** Skapar en passkey på telefonen. Returnerar null om telefonen inte klarar PRF. */
    async function skapaPasskey() {
        const cred = await navigator.credentials.create({
            publicKey: {
                rp: { name: "Skriv – Dennis Bengtsson" },
                user: { id: slump(16), name: "Skriv", displayName: "Skriv (bloggen)" },
                challenge: slump(32),
                pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
                authenticatorSelection: { authenticatorAttachment: "platform", residentKey: "required", userVerification: "required" },
                timeout: 120000,
                extensions: { prf: { eval: { first: PRF_SALT } } }
            }
        });
        const ext = cred.getClientExtensionResults();
        if (!ext.prf || (ext.prf.enabled === false && !ext.prf.results)) return null;
        const id = new Uint8Array(cred.rawId);
        return { id, prf: (ext.prf.results && ext.prf.results.first) || null };
    }

    /* ------------------------------------------------------------ lagring */

    const lasValv = () => { try { return JSON.parse(localStorage.getItem(VALV)); } catch (e) { return null; } };
    const sparaValv = (v) => localStorage.setItem(VALV, JSON.stringify(v));

    function oppnaDb() {
        return new Promise((ok, fel) => {
            const r = indexedDB.open("skriv", 1);
            r.onupgradeneeded = () => {
                r.result.createObjectStore("utkast", { keyPath: "id" });
                r.result.createObjectStore("skickat", { keyPath: "id" });
            };
            r.onsuccess = () => ok(r.result);
            r.onerror = () => fel(r.error);
        });
    }

    async function dbGor(lager, lage, fn) {
        const db = await oppnaDb();
        return new Promise((ok, fel) => {
            const t = db.transaction(lager, lage);
            const r = fn(t.objectStore(lager));
            t.oncomplete = () => { db.close(); ok(r ? r.result : undefined); };
            t.onerror = () => { db.close(); fel(t.error); };
        });
    }

    const allaKrypterade = async (lager) => {
        const rader = await dbGor(lager, "readonly", (s) => s.getAll()) || [];
        const ut = [];
        for (const r of rader) {
            try { ut.push({ id: r.id, ...(await dekrypt(r)) }); } catch (e) { /* från ett gammalt lås */ }
        }
        return ut;
    };
    const sparaKrypterad = async (lager, id, obj) => {
        const k = await krypt(obj);
        await dbGor(lager, "readwrite", (s) => s.put({ id, ...k }));
    };
    const taBort = (lager, id) => dbGor(lager, "readwrite", (s) => s.delete(id));

    /* ------------------------------------------------------------ GitHub */

    class GHFel extends Error {
        constructor(status, text) { super(text); this.status = status; }
    }

    async function gh(sokvag, { metod = "GET", kropp, inloggad = true } = {}) {
        const huvud = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
        if (inloggad) huvud.Authorization = `Bearer ${token}`;
        if (kropp) huvud["Content-Type"] = "application/json";
        let r;
        try {
            r = await fetch(API + sokvag, { method: metod, headers: huvud, body: kropp ? JSON.stringify(kropp) : undefined,
                cache: "no-store", referrerPolicy: "no-referrer", credentials: "omit" });
        } catch (e) {
            throw new GHFel(0, "Ingen kontakt med GitHub. Utkastet är sparat – försök igen när du har nät.");
        }
        if (!r.ok) {
            const text = {
                401: "Nyckeln fungerar inte längre (den kan ha gått ut). Byt nyckel under Inställningar.",
                403: "Nyckeln får inte skriva i inkorgen. Kontrollera behörigheten på GitHub.",
                404: "Hittar inte inkorgen. Kontrollera att nyckeln gäller repot " + INKORG + ".",
                409: "Inkorgen är tom. Lägg till en README i repot på GitHub först."
            }[r.status] || `GitHub svarade med fel ${r.status}.`;
            throw new GHFel(r.status, text);
        }
        return r.status === 204 ? null : r.json();
    }

    /** Lägger alla filer i inkorgen i en och samma ändring. */
    async function skickaFiler(filer, meddelande) {
        const repo = `/repos/${AGARE}/${INKORG}`;
        const blobbar = [];
        for (const f of filer) {
            const b = await gh(`${repo}/git/blobs`, { metod: "POST", kropp: { content: f.b64, encoding: "base64" } });
            blobbar.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha });
        }
        for (let forsok = 0; forsok < 3; forsok++) {
            const ref = await gh(`${repo}/git/ref/heads/main`);
            const bas = await gh(`${repo}/git/commits/${ref.object.sha}`);
            const trad = await gh(`${repo}/git/trees`, { metod: "POST", kropp: { base_tree: bas.tree.sha, tree: blobbar } });
            const commit = await gh(`${repo}/git/commits`, { metod: "POST", kropp: { message: meddelande, tree: trad.sha, parents: [ref.object.sha] } });
            try {
                await gh(`${repo}/git/refs/heads/main`, { metod: "PATCH", kropp: { sha: commit.sha, force: false } });
                return;
            } catch (e) {
                if (e.status !== 422 && e.status !== 409) throw e;   // någon annan hann före: försök igen
            }
        }
        throw new GHFel(0, "Inkorgen var upptagen. Försök igen om en stund.");
    }

    /** Hemsidans repo är öppet, så ändringsförslagen kan läsas utan nyckel. */
    async function oppnaForslag() {
        try {
            const r = await fetch(`${API}/repos/${AGARE}/${SAJT}/pulls?state=open&per_page=50`,
                { headers: { Accept: "application/vnd.github+json" }, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
            if (!r.ok) return null;
            const l = await r.json();
            return Array.isArray(l) ? l.filter((p) => p && p.head && /^mobil\//.test(p.head.ref)) : null;
        } catch (e) { return null; }
    }

    async function forslagFor(id) {
        try {
            const r = await fetch(`${API}/repos/${AGARE}/${SAJT}/pulls?state=all&head=${AGARE}:mobil/${encodeURIComponent(id)}`,
                { headers: { Accept: "application/vnd.github+json" }, cache: "no-store", credentials: "omit", referrerPolicy: "no-referrer" });
            if (!r.ok) return null;
            const l = await r.json();
            return Array.isArray(l) && l[0] ? l[0] : null;
        } catch (e) { return null; }
    }

    const githubLank = (u) => (typeof u === "string" && u.startsWith("https://github.com/") ? u : null);

    /* ------------------------------------------------------------ vyer */

    const VYER = ["installera", "last", "lista", "skriv", "skickat", "installningar"];
    let vy = null;

    function visa(namn, rubrik = "Skriv") {
        if (vy === "skriv" && namn !== "skriv") stangPreview();
        vy = namn;
        for (const v of VYER) $(`vy-${v}`).hidden = v !== namn;
        $("rubrik").textContent = rubrik;
        $("tillbaka").hidden = !["skriv", "skickat", "installningar"].includes(namn);
        $("las").hidden = !nyckel || namn === "last";
        window.scrollTo(0, 0);
    }

    function tillLista() {
        if (["skriv", "skickat", "installningar"].includes(vy) && history.state && history.state.skriv) {
            history.back();      // popstate tar oss till listan
        } else {
            visaLista();
        }
    }

    function djupare(namn, rubrik) {
        history.pushState({ skriv: namn }, "");
        visa(namn, rubrik);
    }

    window.addEventListener("popstate", () => {
        if (!nyckel) return;
        if (vy === "skriv") sparaNu();
        visaLista();
    });

    /* ------------------------------------------------------------ installera och lås */

    let losenLage = false;
    let steg = "nyckel";          // nyckel -> skapa -> (bekrafta) -> klar, eller nyckel -> losen
    let vantandeId = null;

    function sattSteg(nytt, text) {
        steg = nytt;
        $("inst-nyckel").disabled = nytt !== "nyckel";
        $("inst-losen").hidden = nytt !== "losen";
        $("inst-ok").textContent = { nyckel: "Kontrollera nyckeln", skapa: "Lås med fingeravtryck",
            bekrafta: "Bekräfta låset", losen: "Lås med lösenord" }[nytt];
        if (text !== undefined) status("inst-status", text);
    }

    async function klarMedValv(valv) {
        Object.assign(valv, await krypt({ token }));
        sparaValv(valv);
        $("inst-nyckel").value = $("inst-losen1").value = $("inst-losen2").value = "";
        vantandeId = null;
        sattSteg("nyckel", "");
        senastAktiv = Date.now();
        visaLista();
    }

    async function installera() {
        const knapp = $("inst-ok");
        knapp.disabled = true;
        try {
            if (steg === "nyckel") {
                const t = $("inst-nyckel").value.trim();
                if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) {
                    return status("inst-status", "Det ser inte ut som en nyckel från GitHub (den börjar med github_pat_).", true);
                }
                status("inst-status", "Kontrollerar nyckeln …");
                token = t;
                let repo;
                try {
                    repo = await gh(`/repos/${AGARE}/${INKORG}`);
                } catch (e) {
                    token = null;
                    if (e.status === 401) throw new Error("GitHub godtog inte nyckeln. Kontrollera att du har kopierat hela.");
                    throw e;
                }
                if (!repo.private) {
                    token = null;
                    return status("inst-status", `Repot ${INKORG} är öppet för alla. Gör det privat på GitHub först.`, true);
                }
                return sattSteg(losenLage ? "losen" : "skapa", losenLage
                    ? "Nyckeln fungerar. Välj ett lösenord som låser appen."
                    : "Nyckeln fungerar. Tryck på knappen och använd fingret eller ansiktet.");
            }
            if (steg === "skapa") {
                // WebAuthn måste anropas direkt när man trycker, därför inget annat före
                let pk;
                try {
                    pk = await skapaPasskey();
                } catch (e) {
                    if (e && e.name === "NotAllowedError") return status("inst-status", "Avbrutet. Tryck igen för att försöka på nytt.", true);
                    pk = null;
                }
                if (!pk) {
                    losenLage = true;
                    return sattSteg("losen", "Telefonen kan inte låsa appen med fingret. Välj ett lösenord i stället.");
                }
                if (!pk.prf) {
                    vantandeId = pk.id;
                    return sattSteg("bekrafta", "Låset är skapat. Tryck en gång till och använd fingret för att bekräfta.");
                }
                const salt = slump(16);
                nyckel = await nyckelFranPrf(pk.prf, salt);
                return await klarMedValv({ v: 1, typ: "passkey", id: b64.av(pk.id), salt: b64.av(salt) });
            }
            if (steg === "bekrafta") {
                let prf;
                try {
                    prf = await hamtaPrf(vantandeId);
                } catch (e) {
                    if (e && e.name === "NotAllowedError") return status("inst-status", "Avbrutet. Tryck igen.", true);
                    losenLage = true;
                    return sattSteg("losen", "Telefonen kan inte låsa appen med fingret. Välj ett lösenord i stället.");
                }
                const salt = slump(16);
                nyckel = await nyckelFranPrf(prf, salt);
                return await klarMedValv({ v: 1, typ: "passkey", id: b64.av(vantandeId), salt: b64.av(salt) });
            }
            if (steg === "losen") {
                const l1 = $("inst-losen1").value, l2 = $("inst-losen2").value;
                if (l1.length < 12) return status("inst-status", "Lösenordet behöver vara minst 12 tecken.", true);
                if (l1 !== l2) return status("inst-status", "Lösenorden är inte likadana.", true);
                status("inst-status", "Skapar låset …");
                const salt = slump(16);
                nyckel = await nyckelFranLosen(l1, salt);
                return await klarMedValv({ v: 1, typ: "losen", salt: b64.av(salt) });
            }
        } catch (e) {
            nyckel = null;
            status("inst-status", e.message || "Något gick fel.", true);
        } finally {
            knapp.disabled = false;
        }
    }

    let felforsok = 0;

    async function lasUpp() {
        const valv = lasValv();
        if (!valv) return start();
        const knapp = $("last-ok");
        knapp.disabled = true;
        status("last-status", "");
        try {
            const salt = b64.till(valv.salt);
            let k;
            if (valv.typ === "passkey") {
                k = await nyckelFranPrf(await hamtaPrf(b64.till(valv.id)), salt);
            } else {
                const l = $("last-losenfalt").value;
                if (!l) throw new Error("Skriv lösenordet.");
                await new Promise((r) => setTimeout(r, Math.min(8000, 400 * 2 ** felforsok)));
                k = await nyckelFranLosen(l, salt);
            }
            const innehall = await dekrypt(valv, k);
            nyckel = k;
            token = innehall.token;
            felforsok = 0;
            $("last-losenfalt").value = "";
            senastAktiv = Date.now();
            visaLista();
        } catch (e) {
            felforsok++;
            const avbrutet = e && (e.name === "NotAllowedError" || e.name === "AbortError");
            status("last-status", avbrutet ? "Avbrutet. Tryck på Lås upp för att försöka igen."
                : e.message === "Skriv lösenordet." ? e.message
                : valv.typ === "losen" ? "Fel lösenord." : "Kunde inte låsa upp. Försök igen.", true);
        } finally {
            knapp.disabled = false;
        }
    }

    async function las() {
        if (vy === "skriv") await sparaNu();
        stangPreview();
        nyckel = null;
        token = null;
        aktuellt = null;
        rensaBildadresser();
        $("utkastlista").replaceChildren();
        $("vantarlista").replaceChildren();
        if (history.state && history.state.skriv) history.replaceState(null, "");
        visaLast();
    }

    function visaLast() {
        const valv = lasValv();
        $("last-losen").hidden = !valv || valv.typ !== "losen";
        status("last-status", "");
        visa("last");
    }

    let senastAktiv = Date.now();
    let doldSedan = 0;
    for (const h of ["pointerdown", "keydown", "input"]) addEventListener(h, () => { senastAktiv = Date.now(); }, { passive: true });
    setInterval(() => { if (nyckel && Date.now() - senastAktiv > LAS_EFTER_INAKTIV) las(); }, 30000);
    document.addEventListener("visibilitychange", () => {
        if (document.hidden) {
            doldSedan = Date.now();
            if (vy === "skriv") sparaNu();
        } else if (nyckel && Date.now() - doldSedan > LAS_EFTER_DOLD) {
            las();
        }
    });

    /* ------------------------------------------------------------ listan */

    async function visaLista() {
        visa("lista", "Skriv");
        const utkast = (await allaKrypterade("utkast")).sort((a, b) => b.andrad - a.andrad);
        const ul = $("utkastlista");
        ul.replaceChildren(...(utkast.length ? utkast.map((u) => el("li", {},
            el("button", { type: "button", "data-id": u.id },
                el("span", { class: "titel" }, u.titel || "Utan rubrik"),
                el("span", { class: "info" }, `Ändrat ${tid(u.andrad)} · ${ord(u.text)} ord`
                    + (u.bilder.length ? ` · ${u.bilder.length} ${u.bilder.length === 1 ? "bild" : "bilder"}` : "")))))
            : [el("li", { class: "tom" }, "Inga utkast.")]));
        visaVantande();
    }

    async function visaVantande() {
        const ul = $("vantarlista");
        const skickat = (await allaKrypterade("skickat")).sort((a, b) => b.tid - a.tid);
        const forslag = await oppnaForslag();
        const rader = [];
        for (const s of skickat) {
            const p = forslag && forslag.find((f) => f.head.ref === `mobil/${s.id}`);
            if (p) { await taBort("skickat", s.id); continue; }
            if (forslag && Date.now() - s.tid > 3 * 60 * 1000) {
                const f = await forslagFor(s.id);          // stängt eller redan publicerat?
                if (f) { await taBort("skickat", s.id); continue; }
            }
            const gammalt = Date.now() - s.tid > 30 * 60 * 1000;
            rader.push(el("li", {}, el("a", { href: `https://github.com/${AGARE}/${INKORG}/actions`, target: "_blank", rel: "noopener noreferrer" },
                el("span", { class: "titel" }, s.titel || "Utan rubrik"),
                el("span", { class: "info" }, gammalt ? "Har fastnat? Tryck för att se vad som hände på GitHub."
                    : `Skickat ${tid(s.tid)} · GitHub förbereder …`))));
        }
        for (const p of forslag || []) {
            const href = githubLank(p.html_url);
            if (!href) continue;
            rader.push(el("li", {}, el("a", { href, target: "_blank", rel: "noopener noreferrer" },
                el("span", { class: "titel" }, String(p.title || "").replace(/^Nytt inlägg: /, "")),
                el("span", { class: "info" }, "Klart att granska – tryck för att öppna i GitHub"))));
        }
        if (!rader.length) rader.push(el("li", { class: "tom" }, forslag === null ? "Kunde inte nå GitHub just nu." : "Inget väntar."));
        if (vy === "lista") ul.replaceChildren(...rader);
    }

    /* ------------------------------------------------------------ skriva */

    let aktuellt = null;
    let sparTimer = null;
    let bildadresser = [];      // miniatyrerna
    let forhandsadresser = [];  // förhandsvisningen

    const nyttUtkast = () => ({ id: "u-" + slumpord(12), titel: "", text: "", kategori: "", besk: "", datum: idag(),
        bilder: [], omslag: null, andrad: Date.now() });

    function oppna(u) {
        aktuellt = u;
        $("s-titel").value = u.titel;
        $("s-text").value = u.text;
        $("s-kategori").value = u.kategori;
        $("s-besk").value = u.besk;
        $("s-datum").value = u.datum;
        status("s-status", "");
        $("s-skicka").disabled = false;
        ritaBilder();
        djupare("skriv", u.titel ? "Redigera" : "Nytt inlägg");
        fyllKategorier();
    }

    function lasFalt() {
        if (!aktuellt) return;
        aktuellt.titel = $("s-titel").value;
        aktuellt.text = $("s-text").value;
        aktuellt.kategori = $("s-kategori").value;
        aktuellt.besk = $("s-besk").value;
        aktuellt.datum = $("s-datum").value || idag();
    }

    function andrat() {
        lasFalt();
        clearTimeout(sparTimer);
        sparTimer = setTimeout(sparaNu, 700);
    }

    async function sparaNu() {
        clearTimeout(sparTimer);
        if (!aktuellt || !nyckel) return;
        lasFalt();
        const tomt = !aktuellt.titel.trim() && !aktuellt.text.trim() && !aktuellt.bilder.length;
        if (tomt) return;
        aktuellt.andrad = Date.now();
        const { id, ...resten } = aktuellt;
        try { await sparaKrypterad("utkast", id, resten); } catch (e) { status("s-status", "Kunde inte spara utkastet på telefonen.", true); }
    }

    for (const id of ["s-titel", "s-text", "s-kategori", "s-besk", "s-datum"]) $(id).addEventListener("input", andrat);

    async function fyllKategorier() {
        try {
            const r = await fetch("../json/blog_posts.json", { cache: "no-cache" });
            const l = r.ok ? await r.json() : [];
            const k = [...new Set((Array.isArray(l) ? l : []).map((p) => p && p.category).filter((x) => typeof x === "string" && x))].sort();
            $("kategorier").replaceChildren(...k.map((x) => el("option", { value: x })));
        } catch (e) { /* utan nät: inga förslag */ }
    }

    /* --- texten */

    const falt = $("s-text");

    function infoga(text, start = falt.selectionStart, slut = falt.selectionEnd, markor = "end") {
        falt.focus();
        falt.setRangeText(text, start, slut, markor);
        falt.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function radensStart() {
        return falt.value.lastIndexOf("\n", falt.selectionStart - 1) + 1;
    }

    function vaxla(prefix, monster) {
        const start = radensStart();
        const rad = falt.value.slice(start).split("\n")[0];
        const m = rad.match(monster);
        if (m) infoga("", start, start + m[0].length);
        else infoga(prefix, start, start);
    }

    function omge(fore, efter = fore) {
        const { selectionStart: a, selectionEnd: b } = falt;
        const valt = falt.value.slice(a, b);
        infoga(fore + valt + efter, a, b);
        if (!valt) falt.setSelectionRange(a + fore.length, a + fore.length);
    }

    function egenRad(text) {
        const a = falt.selectionStart;
        const fore = a > 0 && falt.value[a - 1] !== "\n" ? "\n" : "";
        const efter = falt.value[falt.selectionEnd] === "\n" ? "" : "\n";
        infoga(fore + text + efter);
    }

    $("vy-skriv").querySelector(".verktyg").addEventListener("click", (h) => {
        const k = h.target.closest("button[data-gor]");
        if (!k) return;
        const gor = k.dataset.gor;
        if (gor === "visa") return vaxlaPreview();
        if (!$("forhand").hidden) stangPreview();
        if (gor === "bild") return $("s-filer").click();
        if (gor === "rubrik") return vaxla("## ", /^#{2,3}\s+/);
        if (gor === "punkt") return vaxla("- ", /^[-*•]\s+/);
        if (gor === "fet") return omge("**");
        if (gor === "kursiv") return omge("*");
        if (gor === "lank") {
            const adress = (prompt("Adress till sidan (https://…)") || "").trim();
            if (!adress) return falt.focus();
            if (!/^https:\/\/[^\s]+\.[^\s]+$/.test(adress)) {
                status("s-status", "Länken behöver börja med https://", true);
                return falt.focus();
            }
            const valt = falt.value.slice(falt.selectionStart, falt.selectionEnd) || "länk";
            infoga(`[${valt.replace(/[[\]\n]/g, "")}](${adress})`);
        }
    });

    /* --- bilder */

    async function forberedBild(fil) {
        let bild;
        try {
            bild = await createImageBitmap(fil, { imageOrientation: "from-image" });
        } catch (e) {
            bild = await new Promise((ok, fel) => {
                const i = new Image();
                const u = URL.createObjectURL(fil);
                i.onload = () => { URL.revokeObjectURL(u); ok(i); };
                i.onerror = () => { URL.revokeObjectURL(u); fel(new Error("Kunde inte läsa bilden.")); };
                i.src = u;
            });
        }
        const s = Math.min(1, MAX_SIDA / Math.max(bild.width, bild.height));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(bild.width * s));
        c.height = Math.max(1, Math.round(bild.height * s));
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(bild, 0, 0, c.width, c.height);
        if (bild.close) bild.close();
        const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
        if (!blob) throw new Error("Kunde inte göra om bilden.");
        return b64.av(await blob.arrayBuffer());
    }

    $("s-filer").addEventListener("change", async (h) => {
        const filer = [...h.target.files];
        h.target.value = "";
        if (!aktuellt || !filer.length) return;
        for (const fil of filer) {
            if (aktuellt.bilder.length >= MAX_BILDER) { status("s-status", `Högst ${MAX_BILDER} bilder per inlägg.`, true); break; }
            status("s-status", "Förbereder bilden …");
            try {
                const data = await forberedBild(fil);
                const n = Math.max(0, ...aktuellt.bilder.map((b) => b.n)) + 1;
                aktuellt.bilder.push({ n, data, text: "" });
                if (aktuellt.omslag === null && aktuellt.bilder.length === 1) aktuellt.omslag = n;
                else egenRad(`[bild-${n}]`);
            } catch (e) {
                status("s-status", e.message || "Kunde inte läsa bilden.", true);
                continue;
            }
            status("s-status", "");
        }
        ritaBilder();
        andrat();
    });

    function rensaBildadresser() {
        bildadresser.forEach((u) => URL.revokeObjectURL(u));
        bildadresser = [];
    }

    const bildadress = (b, lista = bildadresser) => {
        const u = URL.createObjectURL(new Blob([b64.till(b.data)], { type: "image/jpeg" }));
        lista.push(u);
        return u;
    };

    function ritaBilder() {
        rensaBildadresser();
        const ruta = $("s-bilder");
        if (!aktuellt) return ruta.replaceChildren();
        ruta.replaceChildren(...aktuellt.bilder.map((b) => {
            const text = el("input", { type: "text", value: b.text, placeholder: "Bildtext (valfri)", maxlength: "300", "aria-label": `Bildtext för bild ${b.n}` });
            text.addEventListener("input", () => { b.text = text.value; andrat(); });
            const omslag = el("input", { type: "radio", name: "omslag", checked: aktuellt.omslag === b.n });
            omslag.addEventListener("change", () => { aktuellt.omslag = b.n; andrat(); ritaBilder(); });
            const bort = el("button", { type: "button", class: "ta-bort" }, "Ta bort");
            bort.addEventListener("click", () => {
                aktuellt.bilder = aktuellt.bilder.filter((x) => x !== b);
                if (aktuellt.omslag === b.n) aktuellt.omslag = null;
                falt.value = falt.value.replace(new RegExp(`^\\[bild-${b.n}\\]\\n?`, "gm"), "");
                ritaBilder();
                andrat();
            });
            return el("div", { class: "bild" },
                el("img", { src: bildadress(b), alt: "" }),
                el("div", {},
                    el("span", { class: "namn" }, aktuellt.omslag === b.n ? `Bild ${b.n} · omslag överst i inlägget` : `Bild ${b.n} · [bild-${b.n}] i texten`),
                    text,
                    el("div", { class: "rad" }, el("label", {}, omslag, "Omslag"), bort)));
        }));
    }

    /* --- förhandsvisning: samma regler som GitHub använder när inlägget byggs (bygg.py) */

    const LANK = /\[([^\]\n]{1,300})\]\((https?:\/\/[^\s)]{1,2000}|mailto:[^\s)]{1,300})\)|(https?:\/\/[^\s<>"]{1,2000})/g;
    const LANK_OK = /^(https?:\/\/[a-z0-9.-]+\.[a-z]{2,}(?::\d+)?(?:[/?#]\S*)?|mailto:[^\s@]+@[^\s@]+)$/i;
    const BETONING = /\*\*(?=\S)(.+?)(?<=\S)\*\*|(?<![\p{L}\p{N}_*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}_*])|(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu;

    function betoning(s) {
        const ut = [];
        let pos = 0;
        for (const m of s.matchAll(BETONING)) {
            ut.push(s.slice(pos, m.index));
            ut.push(m[1] !== undefined ? el("strong", {}, betoning(m[1])) : el("em", {}, betoning(m[2] ?? m[3])));
            pos = m.index + m[0].length;
        }
        ut.push(s.slice(pos));
        return ut.filter((x) => x !== "");
    }

    function rad(s) {
        const ut = [];
        let pos = 0;
        for (const m of s.matchAll(LANK)) {
            ut.push(...betoning(s.slice(pos, m.index)));
            let text, adress, slut;
            if (m[2]) {
                text = m[1]; adress = m[2]; slut = m.index + m[0].length;
            } else {
                adress = m[3].replace(/[.,;:!?)]+$/, "");
                text = adress; slut = m.index + adress.length;
            }
            if (LANK_OK.test(adress)) ut.push(el("a", { href: adress, target: "_blank", rel: "noopener noreferrer" }, betoning(text)));
            else ut.push(...betoning(s.slice(m.index, slut)));
            pos = slut;
        }
        ut.push(...betoning(s.slice(pos)));
        return ut;
    }

    function textTillDom(u) {
        const bilder = new Map(u.bilder.map((b) => [b.n, b]));
        const anvanda = new Set();
        const block = [];
        let lista = null;
        const figur = (b) => el("figure", {}, el("img", { src: bildadress(b, forhandsadresser), alt: b.text }), b.text && el("figcaption", {}, b.text));
        const stang = () => { if (lista) { block.push(lista); lista = null; } };
        for (let r of u.text.split("\n")) {
            r = r.trim();
            const mu = r.match(/^[-*•]\s+(.+)$/), mo = r.match(/^\d{1,3}[.)]\s+(.+)$/);
            if (mu || mo) {
                const typ = mu ? "ul" : "ol";
                if (!lista || lista.tagName.toLowerCase() !== typ) { stang(); lista = el(typ); }
                lista.append(el("li", {}, rad((mu || mo)[1])));
                continue;
            }
            stang();
            if (!r) continue;
            let m;
            if ((m = r.match(/^\[bild-(\d{1,2})\]$/))) {
                const b = bilder.get(Number(m[1]));
                if (b && !anvanda.has(b.n)) { block.push(figur(b)); anvanda.add(b.n); }
            } else if (/^(-{3,}|\*{3,})$/.test(r)) block.push(el("hr"));
            else if ((m = r.match(/^###\s+(.+)$/))) block.push(el("h3", {}, rad(m[1])));
            else if ((m = r.match(/^##?\s+(.+)$/))) block.push(el("h2", {}, rad(m[1])));
            else if ((m = r.match(/^>\s?(.+)$/))) block.push(el("blockquote", {}, rad(m[1])));
            else block.push(el("p", {}, rad(r)));
        }
        stang();
        for (const b of u.bilder) if (!anvanda.has(b.n) && b.n !== u.omslag) block.push(figur(b));
        const omslag = bilder.get(u.omslag);
        return [omslag && el("img", { src: bildadress(omslag, forhandsadresser), alt: omslag.text }), el("h1", {}, u.titel.trim() || "Utan rubrik"),
            el("p", { class: "dampad liten" }, `${u.datum}${u.kategori.trim() ? " · " + u.kategori.trim() : ""}`), ...block];
    }

    function vaxlaPreview() {
        if (!$("forhand").hidden) return stangPreview();
        lasFalt();
        $("forhand").replaceChildren(...textTillDom(aktuellt).filter(Boolean));
        $("forhand").hidden = false;
        falt.hidden = true;
        $("visaknapp").setAttribute("aria-pressed", "true");
    }

    function stangPreview() {
        $("forhand").hidden = true;
        $("forhand").replaceChildren();
        forhandsadresser.forEach((u) => URL.revokeObjectURL(u));
        forhandsadresser = [];
        falt.hidden = false;
        $("visaknapp").setAttribute("aria-pressed", "false");
    }

    /* --- skicka */

    async function skicka() {
        lasFalt();
        const u = aktuellt;
        if (!u.titel.trim()) return status("s-status", "Inlägget behöver en rubrik.", true);
        if (!u.text.trim() && !u.bilder.length) return status("s-status", "Inlägget är tomt.", true);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(u.datum)) u.datum = idag();
        const knapp = $("s-skicka");
        knapp.disabled = true;
        await sparaNu();
        try {
            const id = `${u.datum}-${slugga(u.titel).slice(0, 40).replace(/-+$/, "") || "inlagg"}-${slumpord(6)}`;
            const inlagg = {
                version: 1, titel: u.titel.trim(), datum: u.datum, kategori: u.kategori.trim(), beskrivning: u.besk.trim(),
                text: u.text, omslag: u.omslag !== null ? `bild-${u.omslag}.jpg` : null,
                bilder: u.bilder.map((b) => ({ fil: `bild-${b.n}.jpg`, text: b.text.trim() }))
            };
            const filer = [{ path: `inkorg/${id}/inlagg.json`, b64: b64.text(JSON.stringify(inlagg, null, 2)) },
                ...u.bilder.map((b) => ({ path: `inkorg/${id}/bild-${b.n}.jpg`, b64: b.data }))];
            status("s-status", u.bilder.length ? "Skickar text och bilder …" : "Skickar …");
            await skickaFiler(filer, `Inlägg från telefonen: ${inlagg.titel}`);
            await sparaKrypterad("skickat", id, { titel: inlagg.titel, tid: Date.now() });
            await taBort("utkast", u.id);
            aktuellt = null;
            visaSkickat(id);
        } catch (e) {
            status("s-status", e.message || "Något gick fel. Utkastet är sparat.", true);
        } finally {
            knapp.disabled = false;
        }
    }

    let bevakning = 0;

    function visaSkickat(id) {
        history.replaceState({ skriv: "skickat" }, "");
        visa("skickat", "Skickat");
        $("sk-granska").hidden = true;
        $("sk-text").textContent = "GitHub förbereder inlägget. Det brukar ta någon minut – du kan stänga appen under tiden.";
        const min = ++bevakning;
        const start = Date.now();
        const titta = async () => {
            if (min !== bevakning || vy !== "skickat") return;
            const p = await forslagFor(id);
            const href = p && githubLank(p.html_url);
            if (href) {
                await taBort("skickat", id);
                $("sk-text").textContent = "Klart! Läs igenom inlägget i GitHub-appen och tryck på Merge för att publicera det.";
                $("sk-granska").href = href;
                $("sk-granska").hidden = false;
                return;
            }
            if (Date.now() - start > 5 * 60 * 1000) {
                $("sk-text").textContent = "Det tar längre tid än vanligt. Inlägget finns i inkorgen – titta under Väntar i listan senare.";
                return;
            }
            setTimeout(titta, 8000);
        };
        setTimeout(titta, 15000);
    }

    /* ------------------------------------------------------------ inställningar */

    async function bytNyckel() {
        const t = $("ny-nyckel").value.trim();
        if (!/^(github_pat_|ghp_)[A-Za-z0-9_]{20,}$/.test(t)) return status("ny-nyckel-status", "Det ser inte ut som en nyckel från GitHub.", true);
        const gammal = token;
        token = t;
        try {
            status("ny-nyckel-status", "Kontrollerar …");
            await gh(`/repos/${AGARE}/${INKORG}`);
            const valv = lasValv();
            Object.assign(valv, await krypt({ token }));
            sparaValv(valv);
            $("ny-nyckel").value = "";
            status("ny-nyckel-status", "Den nya nyckeln är sparad.");
        } catch (e) {
            token = gammal;
            status("ny-nyckel-status", e.message, true);
        }
    }

    async function raderaAllt() {
        if (!confirm("Ta bort nyckeln, låset och alla utkast från telefonen?")) return;
        localStorage.removeItem(VALV);
        await new Promise((ok) => { const r = indexedDB.deleteDatabase("skriv"); r.onsuccess = r.onerror = r.onblocked = ok; });
        nyckel = token = aktuellt = null;
        history.replaceState(null, "");
        start();
    }

    /* ------------------------------------------------------------ knappar och start */

    $("inst-ok").addEventListener("click", installera);
    $("last-ok").addEventListener("click", lasUpp);
    $("last-losenfalt").addEventListener("keydown", (h) => { if (h.key === "Enter") lasUpp(); });
    $("las").addEventListener("click", las);
    $("tillbaka").addEventListener("click", tillLista);
    $("nytt").addEventListener("click", () => oppna(nyttUtkast()));
    $("utkastlista").addEventListener("click", async (h) => {
        const k = h.target.closest("button[data-id]");
        if (!k) return;
        const u = (await allaKrypterade("utkast")).find((x) => x.id === k.dataset.id);
        if (u) oppna(u);
    });
    $("s-skicka").addEventListener("click", skicka);
    $("s-radera").addEventListener("click", async () => {
        if (!aktuellt || !confirm("Slänga det här utkastet?")) return;
        await taBort("utkast", aktuellt.id);
        aktuellt = null;
        tillLista();
    });
    $("sk-klar").addEventListener("click", tillLista);
    $("installningar").addEventListener("click", () => { status("ny-nyckel-status", ""); djupare("installningar", "Inställningar"); });
    $("ny-nyckel-ok").addEventListener("click", bytNyckel);
    $("radera-allt").addEventListener("click", raderaAllt);

    async function start() {
        if (!window.isSecureContext || !crypto.subtle || !window.indexedDB) {
            visa("installera");
            return status("inst-status", "Den här webbläsaren saknar det som behövs för att låsa appen säkert.", true);
        }
        if (lasValv()) return visaLast();
        losenLage = !(await prfStods());
        token = null;
        sattSteg("nyckel", "");
        visa("installera", "Kom igång");
    }

    // appen fungerar utan nät (utkasten), och kan läggas på hemskärmen
    if ("serviceWorker" in navigator) {
        const policy = window.trustedTypes && trustedTypes.createPolicy("skriv", {
            createScriptURL: (u) => { if (u === "sw.js") return u; throw new TypeError("otillåten adress"); }
        });
        navigator.serviceWorker.register(policy ? policy.createScriptURL("sw.js") : "sw.js").catch(() => {});
    }

    start();
})();
