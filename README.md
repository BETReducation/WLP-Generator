# Weekly Learning Plan Generator

A local web app for building your weekly learning plans (IG1, IG2, A-Level) from
reusable dropdown lists, then copying the results straight into your existing
OneDrive Excel template.

## Running it

```
npm install
npm run dev
```

Then open the URL it prints (usually http://localhost:5173) in your browser.
Everything you enter is saved automatically in that browser's local storage —
nothing is sent anywhere, and it will still be there next time you open the app
(on the same computer, same browser).

## How it works

- **Tabs** across the top switch between IG1, IG2 and A-Level. Each tab shows
  the classes that belong to it, each with its own 4- or 7-lesson grid.
- **"+ Add"** on any cell opens a checklist of saved options for that
  class/row. Tick as many as you need — they stack as bullet points in the
  cell. Type new wording at the bottom of the popover and either:
  - **Add to list & insert** — saves it for reuse next time, or
  - **Insert once** — uses it just in this cell, without saving it.
- Click any bullet's text to edit it in place, or the **×** to remove it.
- **Manage dropdown lists** (per class, top of each grid) is where you
  add/edit/delete the saved options themselves.
- **Copy for Excel** copies that class's grid (4 rows × lesson columns) so you
  can paste it directly under the "Lesson 1..N" headers in your OneDrive
  template. **Copy whole [tab] tab** does the same for every class in the
  current tab at once.
- **Week** (top right) lets you start a new blank week, duplicate the current
  one (handy for carrying content forward), rename, or delete it — your
  dropdown lists are shared across all weeks.

The "Example Week" and its placeholder text/options are just a starting
example — delete the bullets, delete the library items via "Manage dropdown
lists", or delete the whole week once you no longer need it.

## Deploying it later

This is a plain static site (Vite + React, no backend). `npm run build`
produces a `dist/` folder you can host anywhere (Netlify, Vercel, GitHub
Pages, etc.) if you want it accessible outside your own machine. Note that
each browser/device has its own separate local storage, so data doesn't sync
between devices unless you add a backend later.
