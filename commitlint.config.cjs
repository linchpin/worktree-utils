/**
 * Custom config for commitlint based on Linchpin needs/conventions.
 *
 * This config only slightly modifies the default config to allow for "improve" as a type
 * and adds support for ClickUp or Github issue numbers in the commit message.
 *
 * Format Example
 *
 * feat(LINCHPIN-4850): Add new feature or GitHub issue number or NO-TASK if cowboying it on the fly.
 */
module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
		'type-enum': [
			2,
			'always',
			[
				'improve',
				'build',
				'chore',
				'ci',
				'docs',
				'feat',
				'fix',
				'perf',
				'refactor',
				'revert',
				'style',
				'test',
				'update',
			],
		],
		'subject-case': [1, 'always', ['sentence-case']],
	},
	parserPreset: {
		parserOpts: {
			headerPattern:
				/^(improve|build|ci|feat|fix|docs|style|revert|perf|refactor|test|chore)\(((?:[A-Z]+-\d+)|(?:NO-TASK)|(?:\#\d+))\):\s?([\w\d\s,\-]*)/,
			headerCorrespondence: ['type', 'scope', 'subject'],
		},
	}
};
