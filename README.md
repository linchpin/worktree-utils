<table width="100%">
  <tr>
    <td align="left" width="70%">
      <strong>Linchpin CLI - Worktree Utils</strong><br />
      Git worktree tooling for WordPress plugin review workflows with Codex, Claude Code, Cursor, Conductor and other agents.
    </td>
    <td align="center" width="30%">
      <img src="https://badge.fury.io/js/@linchpinagency%2Fworktree-utils.svg" alt="npm version" />
      <img src="https://img.shields.io/github/license/linchpin/worktree-utils" alt="License" />
      <img src="https://img.shields.io/badge/Node-%3E%3D20-339933?logo=node.js&logoColor=white" alt="Node >= 20" />
      <br />
      <img src="https://img.shields.io/github/actions/workflow/status/linchpin/worktree-utils/release-please.yml?label=release" alt="Release status" />
      <img src="https://img.shields.io/badge/Conventional%20Commits-1.0.0-FE5196?logo=conventionalcommits&logoColor=white" alt="Conventional Commits" />
      <br />
      <img src="https://img.shields.io/github/last-commit/linchpin/worktree-utils" alt="Last commit" />
      <img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs welcome" />
      <img src="https://img.shields.io/badge/WordPress-%2321759B?logo=wordpress&logoColor=white" alt="WordPress" />
    </td>
  </tr>
  <tr>
    <td>
      A <strong><a href="https://linchpin.com">Linchpin</a></strong> project · <em>Actively maintained</em>
    </td>
    <td align="center" width="30%">
      <img src="https://assets.linchpin.com/linchpin-logo-primary.svg" width="100" alt="Linchpin" />
    </td>
  </tr>
</table>

## What is this CLI?

`linchpin wt` is a git worktree helper tuned for WordPress plugin development alongside Agent support to help easily swap Symlinks between your local environment and worktrees created by you or agents.

It is designed for this setup:

- Plugin repository in `~/Documents/GitHub/<plugin-name>`.
- Multiple git worktrees created by Codex or other agents.
- A shared local WordPress environment (Studio, `wp-env`, or LocalWP).
- A plugin directory in that environment that should point to a specific worktree via symlink.

### Why symlinks? Why isn’t the repo checked out directly in my environment?

Your plugin repo is **not** checked out directly into Studio, LocalWP, or wp-env on purpose. The workflow relies on **symlinks** so you can **swap** which worktree (branch) the environment sees:

- The repo lives in its own directory (e.g. `~/Documents/GitHub/my-plugin`) with multiple [git worktrees](https://git-scm.com/docs/git-worktree) (e.g. `main`, `conductor/a`, `feature/b`).
- The WordPress environment has **one** plugin (or theme) slot (e.g. `~/Studio/mysite/wp-content/plugins/my-plugin`). That slot is a **symlink** pointing at one of the worktree paths.
- When you run `linchpin wt switch <branch>` (or pick from the list), we repoint that symlink to the chosen worktree. This allows for our local environment to use an already checked out worktree with out any errors. 

So you keep a single WordPress install and switch which worktree it uses by changing the symlink target.

## Install

```bash
npm install -g @linchpinagency/worktree-utils
```

For local development in this repository:

```bash
npm link
```

## Team setup guide

### 1. Prerequisites

- `git` 2.37+ (worktree support).
- Node.js `20+` and `npm`.
- Optional: `fzf` for interactive `linchpin wt cd`.
- A local WordPress environment (Studio, `wp-env`, or LocalWP).
- Your plugin repository cloned under `~/Documents/GitHub/<plugin-name>`.

### 2. Install CLI

```bash
npm install -g @linchpinagency/worktree-utils
```

Confirm install:

```bash
linchpin --help
linchpin wt help
```

### 3. Initialize project config

From the plugin or theme repo root (base worktree), run:

```bash
linchpin wt config init
```

When run in an interactive terminal, you're guided through:

1. **Plugin or theme** – Whether this repo is a WordPress plugin or theme (paths use `plugins/<slug>` or `themes/<slug>`).
2. **Slug** – The WordPress directory name (defaults to the repo directory name). Keep the default or type a different slug.
3. **Environment(s)** – For each environment: **Environment type** (Studio, LocalWP, wp-env, or Other), which sets the base folder; then for Studio/LocalWP you **pick a site** from that base (list or `fzf` if installed), or for wp-env you enter the WordPress root path; for Other you enter name and full path.
4. Choose the **default environment** for `linchpin wt switch`.

This creates `.linchpin.json`. You can edit it later if paths or environments change.

5. **Create initial symlink(s)** – If the target already exists and is not a symlink, that environment is skipped; run `linchpin wt switch --env <name> --force` to replace it.

If `.linchpin.json` already exists, the flow offers **Overwrite**, **Edit** (keep existing and add more environments), or **Cancel**.

For scripts or CI (no TTY), use non-interactive mode so a default template is written without prompts:

```bash
linchpin wt config init --plugin-slug <plugin-slug> [--force] [--no-interactive]
```

Use `--force` to overwrite an existing `.linchpin.json` without prompting. Use `--no-interactive` to skip prompts even when running in a terminal.

### 4. Paths built by config init

For Studio and LocalWP, paths are built from the environment type and the site you pick:

- **Studio**: `~/Studio/<site>/wp-content/plugins|themes/<slug>`
- **LocalWP**: `~/Local Sites/<site>/app/public/wp-content/plugins|themes/<slug>`
- **wp-env**: You provide the WordPress root; the CLI appends `wp-content/plugins|themes/<slug>`.

Use absolute paths in `.linchpin.json` if you edit by hand. `~` is supported.

### 5. Create and switch worktrees

Create a worktree for a new branch:

```bash
linchpin wt new feature/my-change
```

Or attach an existing remote branch:

```bash
linchpin wt get feature/existing-branch
```

Point your WordPress environment to that worktree:

```bash
linchpin wt switch feature/my-change --env studio
```

### 6. Verify active target

Check current worktree metadata:

```bash
linchpin wt current --link --env studio
```

List all worktrees:

```bash
linchpin wt ls
```

### 7. Daily review workflow

1. Open or create a worktree for the branch under review.
2. Run `linchpin wt switch --env <environment>` to repoint the plugin symlink.
3. Test the branch in the shared WordPress install.
4. Repeat for the next worktree/branch.
5. Clean up with `linchpin wt del` when the branch is merged.

### 8. Shell helpers (recommended)

Use command substitution for path-returning commands:

```bash
cd "$(linchpin wt cd)"
cd "$(linchpin wt home)"
```

### 9. Troubleshooting

- `Missing .linchpin.json`:
  Run `linchpin wt config init` in the base worktree (interactive prompts) or `linchpin wt config init --plugin-slug <slug> --no-interactive` for a default file.
- `Environment '<name>' is not configured`:
  Add the environment key in `.linchpin.json`.
- `Target exists and is not a symlink`:
  Use `linchpin wt switch ... --force` only if replacing the directory is intended.
- `Worktree has uncommitted changes` on delete:
  Commit/stash first, or force with `linchpin wt del --force`.
- `fzf is not installed`:
  Install `fzf` or pass a branch/path directly to `linchpin wt cd <ref>`.

## Command surface

```bash
linchpin wt ls [--json]
linchpin wt current [--link] [--env <name>]
linchpin wt switch [worktree|branch] [--env <name>] [--force] [--dry-run]
  # No argument in a TTY: interactive picker from available worktrees. Non-interactive: use current worktree.

linchpin wt new [name]
linchpin wt get <branch>
linchpin wt extract
linchpin wt mv <new-branch-name>
linchpin wt del [-f|--force]
linchpin wt cd [branch|path]
linchpin wt home
linchpin wt use
linchpin wt gone
linchpin wt copy <path>
linchpin wt link <path>
linchpin wt invoke <hook>

linchpin wt config init [--plugin-slug <slug>] [--force] [--no-interactive]
linchpin wt config show
```

Shell usage notes:

- `linchpin wt cd` and `linchpin wt home` return paths for command substitution.
- Use `cd "$(linchpin wt cd)"` and `cd "$(linchpin wt home)"`.
- `linchpin wt cd` uses `fzf` when no argument is provided.

## Configuration

Create `.linchpin.json` in the base repository root. The easiest way is to run `linchpin wt config init` in a terminal and follow the prompts. You can also create or edit the file manually:

```json
{
  "agent": "conductor",
  "agentBasePath": "/Users/you/conductor",
  "wordpress": {
    "pluginSlug": "my-plugin",
    "defaultEnvironment": "studio",
    "environments": {
      "studio": "/Users/you/Sites/studio/wp-content/plugins/my-plugin",
      "wp-env": "/Users/you/Documents/projects/site/.wp-env/.../plugins/my-plugin",
      "localwp": "/Users/you/Local Sites/site/app/public/wp-content/plugins/my-plugin"
    }
  }
}
```

Behavior notes:

- **Agent / base path**: `agent` (Conductor, Claude Code, Codex, or Custom Path) and optional `agentBasePath` record where your worktree repos live. Default base paths: Conductor `~/conductor`, Claude Code `~/Documents`, Codex `~/Documents/GitHub`. For Custom Path you’re prompted for a base path during `config init`.
- If `defaultEnvironment` is omitted, the first environment key is used.
- `~` is supported in configured paths.
- `linchpin wt switch` without a worktree argument: in an interactive terminal you get a **picker** of available worktrees; in non-interactive use it uses the current worktree.

## Hooks

Hook files are sourced in a subshell when present:

- `.linchpin/hooks/<hook-name>`

Supported lifecycle hooks:

- `pre-new`, `post-new`
- `pre-get`, `post-get`
- `pre-extract`, `post-extract`
- `pre-mv`, `post-mv`
- `pre-del`, `post-del`

Manual invocation:

```bash
linchpin wt invoke pre-new
```

Hook environment variables include `LINCHPIN_BRANCH` and `LINCHPIN_WORKTREE`.

## Typical WordPress review flow

1. Open a plugin worktree.
2. Run `linchpin wt switch --env studio`.
3. Use your existing WordPress environment to review that branch.
4. Move to another worktree and switch again.

## Safety behavior

- Existing symlink targets are repointed safely.
- Existing non-symlink targets are blocked unless `--force` is used.
- `linchpin wt del` blocks dirty or unmerged branches unless forced.

## Development

```bash
npm install
npm test
```

Husky enforces Conventional Commits on `commit-msg`:

```bash
npm run prepare
```

Example commit format:

```text
feat(LINCHPIN-4850): add release automation
```

## Releases

Releases are managed by `release-please` in GitHub Actions:

- Pushes to `main` run `.github/workflows/release-please.yml`.
- `release-please` opens/updates a release PR from conventional commits.
- When the release PR is merged, a GitHub release/tag is created.
- If a release is created, the workflow publishes `@linchpinagency/worktree-utils` to npm.

![Linchpin an award winning digital agency building immersive, high performing web experiences](https://assets.linchpin.com/github/linchpin-github-repo-banner.jpg)
