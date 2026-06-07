# Flag images via ISO 3166-1 alpha-2 and flagcdn.com

The group-stage redesign replaced emoji flag characters (`flag_icon`) with CSS background images served by flagcdn.com, keyed by ISO 3166-1 alpha-2 code. This was chosen for the visual effect (flag as atmospheric row background) which cannot be achieved with emoji. Emoji were the previous approach and remain in the data as `flag_icon` for non-UI use. An `iso_code` field was added to both team data files to provide the flagcdn key; FIFA codes (3-letter) could not be used because they don't map 1:1 to ISO codes, and sub-national teams like England require `gb-eng` which can't be derived from the flag emoji's regional indicator encoding.

## Considered Options

- **Derive ISO code from `flag_unicode`** — works for 46 standard countries but England, Wales, and Scotland use tag sequences, not regional indicators, so derivation fails silently.
- **Map FIFA code → ISO code in code** — avoids touching JSON but creates a 48-entry lookup that lives outside the canonical data source.
- **Keep emoji, skip image effect** — no new field needed, but loses the key visual of the redesign.
