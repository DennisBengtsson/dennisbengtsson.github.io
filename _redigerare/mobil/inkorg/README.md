# blogg-inkorg

Privat inkorg för skrivappen på telefonen (https://dennisbengtsson.github.io/skriv/).

- Appen lägger nya inlägg i mappen `inkorg/`.
- GitHub Actions (`.github/workflows/inkorg.yml`) gör om dem till ett ändringsförslag
  på hemsidan och tömmer sedan inkorgen.
- Ingenting publiceras förrän du trycker **Merge** på förslaget i GitHub-appen.

Hemligheten `SAJT_NYCKEL` (Settings → Secrets and variables → Actions) är nyckeln som får
skapa förslag på hemsidan. Den lämnar aldrig GitHub.
