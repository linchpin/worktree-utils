<table width="100%">
  <tr>
    <td align="left" width="70%">
      <strong>Linchpin CLI - Worktree Utils</strong><br />
      Git worktree tooling for WordPress plugin review workflows with Codex and other agents.
    </td>
    <td align="center" width="30%">
      <img src="https://img.shields.io/badge/Status-Active%20Development-2ea44f" alt="Status: Active Development" />
      <img src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" alt="Maintained: yes" />
      <img src="https://img.shields.io/badge/Node-%3E%3D18-339933" alt="Node >= 20" />
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

`linchpin wt` is a git worktree helper tuned for WordPress plugin development alongside Agent support.

It is designed for this setup:

- Plugin repository in `~/Documents/GitHub/<plugin-name>`.
- Multiple git worktrees created by Codex or other agents.
- A shared local WordPress environment (Studio, `wp-env`, or LocalWP).
- A plugin directory in that environment that should point to a specific worktree via symlink.

## Install

```bash
npm install -g @linchpin/worktree-utils
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
npm install -g @linchpin/worktree-utils
```

Confirm install:

```bash
linchpin --help
linchpin wt help
```

### 3. Initialize project config

From the plugin repo root (base worktree):

```bash
linchpin wt config init --plugin-slug <plugin-slug>
```

This creates `.linchpin.json`. Edit it so `wordpress.environments` matches your local machine paths.

### 4. Configure WordPress plugin targets

Set each environment path to the plugin location inside that WordPress install:

- Studio: `/path/to/studio/wp-content/plugins/<plugin-slug>`
- `wp-env`: `/path/to/project/.wp-env/.../plugins/<plugin-slug>`
- LocalWP: `/path/to/Local Sites/<site>/app/public/wp-content/plugins/<plugin-slug>`

Use absolute paths. `~` is supported.

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
  Run `linchpin wt config init` in the base worktree.
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

linchpin wt config init [--plugin-slug <slug>] [--force]
linchpin wt config show
```

Shell usage notes:

- `linchpin wt cd` and `linchpin wt home` return paths for command substitution.
- Use `cd "$(linchpin wt cd)"` and `cd "$(linchpin wt home)"`.
- `linchpin wt cd` uses `fzf` when no argument is provided.

## Configuration

Create `.linchpin.json` in the base repository root:

```json
{
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

- If `defaultEnvironment` is omitted, the first environment key is used.
- `~` is supported in configured paths.
- `linchpin wt switch` without a worktree argument uses the current worktree.

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

- Pushes to `main` or `master` run `.github/workflows/release-please.yml`.
- `release-please` opens/updates a release PR from conventional commits.
- When the release PR is merged, a GitHub release/tag is created.
- If a release is created, the workflow publishes `@linchpin/worktree-utils` to npm.

Repository secret required:

- `NPM_TOKEN`: npm automation token with publish access for `@linchpin/worktree-utils`.

![Linchpin an award winning digital agency building immersive, high performing web experiences](https://assets.linchpin.com/github/linchpin-github-repo-banner.jpg)
