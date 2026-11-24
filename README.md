# קוֹרְאִים עִם בּוּץ — Reading with Butz

Hebrew reading app for children aged 5-8 (Expo SDK 58 / React Native, TypeScript). Works offline, no ads, no data collection.

- Web version: https://ravivh.com/butz/
- Privacy policy: https://ravivh.com/butz/privacy.html (source: `public/privacy.html`)
- Android: package `com.raviv.butz`, built with EAS (`npx eas-cli build -p android --profile production`)

Start here: [AGENTS.md](AGENTS.md) (commands, rules), [docs/SPEC.md](docs/SPEC.md) (spec), [PUBLISHING.md](PUBLISHING.md) (Google Play steps).

`npm ci` then `npm run check`. Every push to `main` that changes the app rebuilds the web version and privacy page
(`.github/workflows/pages.yml`, this repo's own GitHub Pages; ravivh.com is the custom domain of ravivhi/ravivhi.github.io, so no other repo is involved).
