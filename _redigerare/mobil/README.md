# Skriv från telefonen

En enkel skrivapp för telefonen: **https://plankbengtsson.se/skriv/**

**Telefonen** → privat inkorg på GitHub (inlägget byggs, bilderna rensas) → ändringsförslag → **du trycker Merge** → publicerat

- **Telefonen kan aldrig ändra hemsidan.** Dess nyckel får bara lägga saker i inkorgen.
- **Inget publiceras utan dig.** Du godkänner varje inlägg i GitHub-appen (Merge).
- **Appen är låst med fingeravtryck/ansikte** (passkey). Nyckeln och utkasten är krypterade på telefonen.
- **Bilder rensas två gånger** – på telefonen och hos GitHub – så att GPS-position och kamerainfo aldrig följer med.

## Installera (en gång, ca 10 minuter)

Gör stegen på datorn, utom steg 6.

**1. Publicera hemsidan** med redigeraren som vanligt, så att `/skriv/` och byggskriptet finns på GitHub.

**2. Skapa inkorgen.** På github.com: **+** → *New repository*
- Repository name: `blogg-inkorg`
- Välj **Private**
- Kryssa i **Add a README file** → *Create repository*

Dubbelklicka sedan på **`Skapa inkorgen.bat`** i den här mappen. Det lägger in det som behövs i inkorgen.

**3. Nyckel för GitHub (hemsidan).** På github.com: din bild → *Settings* → *Developer settings* →
*Personal access tokens* → **Fine-grained tokens** → *Generate new token*
- Token name: `Inkorgen till hemsidan`
- Expiration: 1 år (skriv upp datumet)
- Repository access: **Only select repositories** → `dennisbengtsson.github.io`
- Permissions → Repository permissions:
  **Contents: Read and write**, **Pull requests: Read and write**
- *Generate token* och kopiera den.

**4. Lägg nyckeln hos GitHub.** Gå till repot `blogg-inkorg` → *Settings* → *Secrets and variables* → *Actions* →
*New repository secret*
- Name: `SAJT_NYCKEL`
- Secret: klistra in nyckeln från steg 3 → *Add secret*

Nyckeln finns nu bara hos GitHub. Du behöver inte spara den någon annanstans.

**5. Nyckel för telefonen.** Skapa en till fine-grained token, som i steg 3 men:
- Token name: `Skrivappen`
- Repository access: **Only select repositories** → **`blogg-inkorg`** (inte hemsidan!)
- Permissions: **Contents: Read and write** (inget annat)

Kopiera den, och skicka den till telefonen på ett säkert sätt (t.ex. via din lösenordshanterare),
eller skapa den direkt i telefonens webbläsare.

**6. På telefonen.** Öppna **plankbengtsson.se/skriv/** i Chrome (Android) eller Safari (iPhone).
- Lägg till på hemskärmen: Chrome-menyn → *Lägg till på startskärmen* / Safari → Dela → *Lägg till på hemskärmen*
- Öppna appen från hemskärmen, klistra in nyckeln från steg 5 → *Kontrollera nyckeln* → *Lås med fingeravtryck*
- Installera **GitHub-appen** och logga in, så kan du godkänna inlägg med ett tryck.

**7. Bra att slå på** i hemsidans repo → *Settings* → *General*: **Automatically delete head branches**
(tar bort förslagets gren när du har publicerat).

## Att skriva

| Skriv så här          | Blir                          |
|-----------------------|-------------------------------|
| en vanlig rad         | ett stycke                    |
| `## Rubrik`           | rubrik                        |
| `- punkt`             | punktlista                    |
| `1. punkt`            | numrerad lista                |
| `> text`              | citat                         |
| `**fet**` `*kursiv*`  | **fet** *kursiv*              |
| `[text](https://…)`   | länk (adresser blir länkar av sig själva) |
| `[bild-2]`            | bild nummer 2 på den platsen  |
| `---`                 | avdelare                      |

Första bilden blir omslag överst i inlägget (går att ändra). Bilder som inte står i texten hamnar sist.
Ett datum framåt i tiden gör inlägget schemalagt, precis som i redigeraren.

## När något strular

- **"Nyckeln fungerar inte längre"** – den har gått ut. Skapa en ny (steg 5) och lägg in den under
  *Inställningar* i appen. Låset och utkasten behålls.
- **Inlägget fastnar på "GitHub förbereder"** – öppna `blogg-inkorg` → *Actions* och se vad som stod.
  Oftast har nyckeln i steg 3 gått ut: skapa en ny och byt `SAJT_NYCKEL` (steg 4).
- **Tappat telefonen** – ta bort nyckeln `Skrivappen` under *Fine-grained tokens* på GitHub. Klart.
  Den som har telefonen kan ändå inte publicera något utan ditt GitHub-konto.
- **Datorns redigerare** hämtar automatiskt hem inlägg från telefonen när den startar och innan den publicerar.

## Filer

- `/skriv/` – appen (ren HTML/JS, inga hemligheter)
- `_redigerare/mobil/bygg.py` – gör om inkorgens inlägg till riktiga inlägg (körs av GitHub)
- `_redigerare/mobil/inkorg/` och `inkorg-workflow.yml` – det som läggs i repot `blogg-inkorg`
  (arbetsflödet hamnar i `.github/workflows/inkorg.yml` där)
- `_redigerare/mobil/Skapa inkorgen.bat` – lägger in det i repot
