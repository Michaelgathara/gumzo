# gumzo

`gumzo` is an exploration of a single-window AI inbox: one visible conversation for the user, many underlying contexts for the system.

## Workspace

The repo is intentionally set up as a small monorepo so we can evolve the product in tight slices without tangling domain logic, UI primitives, and app surfaces together.

## Tooling

- `bun` workspaces for package management
- `turbo` for task orchestration
- `TypeScript` as the baseline language for shared contracts and app code
- `Node.js 22.22.3` for the underlying tool runtime expected by Vite and Turbo

## Getting Started

1. `source ~/.nvm/nvm.sh && nvm use`
2. `source ~/.zshrc`
3. `bun install`
4. `bun run dev`
