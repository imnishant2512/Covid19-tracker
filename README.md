# Covid-19 Tracker App

A live COVID-19 dashboard built with React and [Vite](https://vite.dev), backed by the
public [disease.sh](https://disease.sh) API.

- Live cases, recoveries and deaths as clickable tabs
- Worldwide totals plus per-country breakdowns
- Interactive Leaflet map with per-country circles scaled and coloured by the selected metric
- 120-day trend chart of day-over-day change — hover for exact figures

Deployed live at https://covid19-tracker-c92c2.web.app/

![Screenshot of the Covid-19 Tracker dashboard](screenshot.png)

## Getting started

Requires Node 20.19+ or 22.12+ (Vite 7).

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the dev server with hot module replacement |
| `npm run build` | Production build into `build/` |
| `npm run preview` | Serve the production build locally |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |

## Project layout

```
index.html            Vite entry point
vite.config.js        Build + Vitest config
src/
  main.jsx            React root (createRoot)
  App.jsx             All application state and layout
  api.js              disease.sh client — throws on non-2xx, supports AbortSignal
  util.js             Pure helpers: sorting, formatting, chart deltas, circle radius
  components/
    InfoBox.jsx       Selectable stat card (keyboard accessible)
    Map.jsx           Leaflet map, circles and popups
    Table.jsx         Country table sorted by total cases
    LineGraph.jsx     Chart.js trend chart
    ErrorBoundary.jsx Keeps a panel crash from blanking the page
  __tests__/          Vitest + Testing Library specs
```

## Deployment

The build output goes to `build/`, which is what `firebase.json` serves:

```bash
npm run build
firebase deploy
```

## A note on the data

`disease.sh` stopped receiving recovery figures from most upstream sources during
2021, so the **Recovered** tab reports zero or stale values for many countries.
That is a limitation of the data, not of the app.
