# Project conventions

- Use Oxc tooling: Oxlint for linting and Oxfmt for formatting. Do not invoke Prettier or add it as a direct dependency.
- Run `npm run fmt` after edits and `npm run lint` and `npm run fmt:check` before finishing.
- Verify behavioral changes with the relevant API/browser tests and `npm run build`.
- Preserve SQLite data and migrate existing databases when changing the schema.
- Add English and Simplified Chinese translations for user-facing text.
