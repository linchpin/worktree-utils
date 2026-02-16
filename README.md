<table width="100%">
  <tr>
    <td align="left" width="70%">
      <strong>Linchpin Worktree CLI</strong><br />
      Git worktree tooling for WordPress plugin review workflows with Codex and other agents.
    </td>
    <td align="center" width="30%">
      <img src="https://img.shields.io/badge/Status-Active%20Development-2ea44f" alt="Status: Active Development" />
      <img src="https://img.shields.io/badge/Maintained%3F-yes-green.svg" alt="Maintained: yes" />
      <img src="https://img.shields.io/badge/Node-%3E%3D18-339933" alt="Node >= 18" />
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

`linchpin wt` is a git worktree helper tuned for WordPress plugin development and QA.

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
npm test
```

![Linchpin an award winning digital agency building immersive, high performing web experiences](https://assets.linchpin.com/github/linchpin-github-repo-banner.jpg)
