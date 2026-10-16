# dennisbengtsson.github.io

Min personliga hemsida. Statisk HTML på GitHub Pages – ingen server, inga formulär, inga kakor.

## Så hänger det ihop

| Fil / mapp | Vad den gör |
|---|---|
| `index.html`, `about.html`, `contact.html`, `blog.html`, `bilder.html`, `market.html` | Sidorna |
| `blog/postN.html` | Ett blogginlägg per fil |
| `data.json` | Namn, kontaktuppgifter, sociala länkar, meny och nyhetsflöden |
| `json/blog_posts.json` | Listan över blogginlägg (nyaste först) |
| `data/products.json` | Varorna på loppisen |
| `css/style.css` | All egen design. Inga stilar ligger i HTML-filerna |
| `js/main.js` | Meny, sidopanel och sidfot på alla sidor |
| `js/blog.js` | Blogglistan och knapparna Föregående/Nästa |
| `js/feed.js`, `js/market.js`, `js/lightbox.js`, `js/sok.js` | Nyhetskarusell, loppis, ljuslåda, sökning |
| `_utkast/` | Utkast – bara på din dator |
| `_redigerare/` | Redigeraren (körs bara på din dator) |
| `vendor/` | Bootstrap 4.6, jQuery och Font Awesome – lokalt, inget hämtas från andra servrar |

## Redigera sidan

Dubbelklicka på **`_redigerare/Starta redigeraren.bat`**, så öppnas redigeraren i webbläsaren.
Låt det svarta fönstret vara öppet medan du arbetar.

- **Sidorna** visas som de ser ut. Klicka i en text och skriv, klicka på en bild för att byta den.
  För musen över ett kort, en listrad eller en galleribild för att flytta, kopiera eller ta bort den.
- **Blogginlägg:** *+ Nytt inlägg* skapar ett inlägg. Verktygsraden har rubrik, fet, kursiv, länk, listor, citat och bild.
  Titel, datum, kategori, sammanfattning och omslagsbild ställs in i panelen till höger.
- **Sidor:** *+ Ny* skapar en ny sida, tom eller som kopia av en befintlig. I listan slår du på och av
  **●** (aktiv, syns på nätet) och **☰** (finns i menyn) för varje sida. Inaktiva sidor och inlägg är utkast
  som ligger i `_utkast` och bara syns i redigeraren. De laddas inte upp till GitHub.
- **I texten:** skriv **/** för snabbkommandon: rubrik, lista, citat, bild, galleri, video eller karta
  (YouTube, Vimeo, OpenStreetMap), fotnot och avdelare.
- **Inlägg:** serie, kategori, sammanfattning och omslagsbild i panelen till höger. Ett datum framåt i tiden
  schemalägger inlägget. Tre rubriker eller fler ger automatiskt en innehållsförteckning.
- **Autosparning:** stänger du av misstag får du frågan om du vill återställa det du skrev.
- **🕘 Tidigare versioner** visar och återställer äldre versioner av sidan. **⤢ Fokusläge** döljer allt utom texten.
- **Statistik**, **Säkerhetskopia** (hela hemsidan som en zip-fil) och delningsbild när någon delar en länk.
- **Uppgifter och meny:** namn, kontaktuppgifter, sociala länkar, menyn och nyhetsflöden.
- **Loppisens varor:** lägg till, ändra, markera som såld. Filtren skapas av kategorierna.
- **Spara** (Ctrl+S) sparar i mappen. **Publicera** skickar upp ändringarna till GitHub.
  Fungerar inte publiceringen, öppna GitHub Desktop och tryck *Push origin*.
- Bilder som laddas upp förminskas och rensas från GPS och annan metadata.
- En kopia av varje fil sparas i `_redigerare/historik` innan den skrivs över (kommer inte upp på GitHub).
- Mappen `_redigerare` publiceras inte av GitHub Pages, eftersom den börjar med understreck.

## Vanliga ändringar för hand

- **Lägg till Blogg, Bildgalleri eller Loppis i menyn:** lägg till en rad i `menu` i `data.json`,
  t.ex. `{ "label": "Blogg", "url": "blog.html", "dataPage": "blog" }`.
- **Nyheter på startsidan:** fyll i adresser till RSS-flöden i `nyhetsfloden` i `data.json`.
  Tom lista = ingen nyhetsdel visas. Obs: nyheterna hämtas via tjänsten rss2json, som då ser besökarens IP-adress.
- **Bilder:** ta bort platsinformation (GPS) innan du laddar upp foton från mobilen, och håll dem under ca 1600 px.

## Säkerhet

Varje sida har samma strikta säkerhetsregel (Content-Security-Policy): bara egna skript och stilar får köras,
inga inline-skript, inga externa skript. Allt som kommer från JSON-filer eller nyhetsflöden sätts som text,
aldrig som HTML, och länkar kontrolleras innan de används.
