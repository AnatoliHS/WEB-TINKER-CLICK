# tinker.click, the design

The home page, the legal pages and the look of [tinker.click](https://tinker.click), built with
[Eleventy](https://www.11ty.dev/). The server itself lives in `tinker-click/tinker-click-site`,
which serves its `public/` folder with no build step.

## Work on it

```sh
npm install
npm start        # serves the site with live reload, the sketches in src/concepts/ included
npm run build    # the build that gets published: no sketches
```

## What the server expects

tinker.click answers every page with a strict Content-Security-Policy: scripts and styles
come from files on the site, and nothing else runs.

- A `style=""` attribute is fine to write. The build moves it into a class in
  `/assets/css/inline.css` (`src/_plugins/eleventy-plugin-csp.js`).
- An inline `<script>`, a `<style>` block or an `onclick=""` fails the build. Put the code in
  `src/assets/js/` or `src/assets/css/`.
- Fonts, pictures and scripts are served from the site. A link to a file on another site is refused.
- A page lives one folder deep (`/privacy/`). `/<name>/<name>/` addresses belong to published apps.
- The legal text in `src/privacy.html` and `src/tos.html` is word for word what the people
  responsible for it wrote. Change the look freely; change the words only on their say.
- `sitemap.xml` is written by the build from the pages; a page marked `noindex: true` stays out.

## Publish

Commit and push here, then, in a checkout of the site repo:

```sh
python3 tools/publish_design.py PATH/TO/THIS/REPO
```

It builds this repo, checks the result against the server's rules, lays it over `public/` and
says what to commit. It refuses work that is not pushed, so what is live can always be rebuilt:
`https://tinker.click/assets/build.txt` names the commit.
