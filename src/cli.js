const { runWt } = require('./commands/wt');

async function run(argv) {
  const command = argv[0] || 'help';

  switch (command) {
    case 'wt':
      return runWt(argv.slice(1));
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      return 0;
    case '--version':
    case '-v':
      process.stdout.write('0.1.0\n');
      return 0;
    default:
      throw new Error(`Unknown command '${command}'. Run 'linchpin --help'.`);
  }
}

function printHelp() {
  process.stdout.write('linchpin\n\n');
  process.stdout.write('Usage:\n');
  process.stdout.write('  linchpin wt <command>\n\n');
  process.stdout.write('Commands:\n');
  process.stdout.write('  wt   Manage worktree workflows and WordPress plugin symlink switching\n');
}

module.exports = {
  run
};
