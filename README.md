# tts-mermaid

The repository is an npm workspace with two explicit runtime boundaries:

```text
tts-mermaid/
├── web/       React 19 and Vite browser application
└── server/    Express API, SQLite persistence, and Node PowerPoint tooling
```

The web package never imports the server or Node-only PowerPoint importer. The server owns its
runtime code, tests, database, assets, and command-line PowerPoint tools.

From the repository root:

```sh
npm install
npm run dev
npm run server:dev
npm run typecheck
npm test
npm run build
```

`npm run dev` starts the web app. `npm run server:dev` starts the API. Package-specific commands
can also be run with `npm run <command> --workspace @tts-mermaid/web` or
`npm run <command> --workspace @tts-mermaid/server`.
