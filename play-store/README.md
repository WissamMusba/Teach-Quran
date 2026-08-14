# Teach Quran — Google Play Publishing Pack

Everything you need to publish the signed AAB to the Google Play Console.

| Doc | Purpose |
|-----|---------|
| `privacy-policy.md` | Full privacy policy text — host it at a public URL, then paste the URL into the console. |
| `store-listing.md` | App name, short/full description, category, and contact details for the store listing. |
| `data-safety.md` | Answers for the Data safety form (what the app collects/stores/shares). |
| `content-rating.md` | Guidance for the content-rating questionnaire. |
| `target-audience-and-families.md` | Target age groups + Families policy notes (children use the app). |
| `app-access-test-logins.md` | How reviewers log in + demo account instructions. |
| `release-notes.md` | Copy-paste release notes for the first production release. |
| `assets-checklist.md` | Icon, feature graphic, and screenshot specs you must upload. |

## Quick checklist

1. **Create app** in Play Console: name = **Teach Quran**, Default language = English, App or game = App, Free.
2. **Host the privacy policy** (e.g., GitHub Pages for this repo, or any public URL) and paste its URL under App content → Privacy policy.
3. Fill **Data safety** (see `data-safety.md`), **Content rating** (see `content-rating.md`), **Target audience** (see `target-audience-and-families.md`), **App access** (see `app-access-test-logins.md`), **Ads** = No.
4. **Main store listing** (see `store-listing.md`) + upload icon, feature graphic, screenshots (see `assets-checklist.md`).
5. **Production → Create new release** → upload `app-release.aab` (32 MB, at `android\app\build\outputs\bundle\release\app-release.aab`) → release name `1.0.0` → notes from `release-notes.md`.
6. **Review and start rollout**.
