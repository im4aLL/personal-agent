# 1 - personal-agent | Frontend - Bootstrap scaffold and tooling

**What to build:** `npm run tauri dev` opens a Tauri window with React 19, Tailwind v4, shadcn (new-york), Zustand, hash router, and all tooling configured. The app has a minimal shell (empty sidebar placeholder + main area) with theme applied. ESLint and Prettier are configured and run green. All pre-existing artifacts (`ai/extensions/`, `.pi/`, `.opencode/`, `pi-lsp-setup.md`) are untouched.

**Blocked by:** None - can start immediately.

**Status:** Done

- [x] Scaffold project manually alongside pre-existing artifacts without colliding or removing them
- [x] Add React 19, TypeScript, Vite, Tailwind v4 via `@tailwindcss/vite`, react-router (hash), Zustand, lucide-react, sonner
- [x] Configure `package.json` `imports` aliases (`#components/*`, `#lib/*`, `#lib/types/*`, `#hooks/*`, `#pages/*`, `#store/*`) with `tsconfig.json` `resolvePackageJsonImports: true`
- [x] shadcn init (new-york style): `components.json`, `src/lib/utils.ts` with `cn` helper, Tailwind v4 shadcn token wiring
- [x] Install shadcn components needed for Phase 1 (button, input, dialog, dropdown-menu, sidebar, tooltip, textarea, collapsible, tabs, card, separator, scroll-area, sonner)
- [x] Configure Biome (replaces ESLint + Prettier) matching personal-os conventions
- [x] Configure `tauri.conf.json`, capabilities, and minimal `App.tsx` router with two empty routes
- [x] Verify Rust toolchain and Tauri prerequisites (manual: run `npm run tauri dev`)
- [x] Verify: `npm run tauri dev` shows a window with the shell (manual)
- [x] Verify: `npm run build` typechecks
- [x] Verify: `npm run lint` passes
