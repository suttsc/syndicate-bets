# Football Bets

Live scores for this week's football bets — https://bets.chrisutton.co.uk

Static HTML + Tailwind v4, hosted on Cloudflare Pages (Git integration), with Pages Functions + KV for shared picks.

## Local development

```bash
npm install
npm run dev     # rebuilds public/assets/app.css on change
npm test        # outcome logic unit tests
```

Serve `public/` with any static server. Design mode uses mock data — switch scenarios with
`?scenario=live|final|pre|empty`. Admin password in design mode is `demo`.

## Cloudflare Pages settings

- Build command: `npm run build`
- Build output directory: `public`
