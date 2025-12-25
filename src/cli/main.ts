import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildCommand } from "./commands/build";
import { devCommand } from "./commands/dev";
import {
  formatCommandHelp,
  formatCommandList,
  type Command,
  type HelpInfo,
} from "./commands/command";

type CommandDefinition = {
  name: string;
  summary: string;
  help: HelpInfo;
  parse: (argv: string[]) => unknown;
  run: (parsed: unknown) => Promise<void> | void;
};

function toCommand<TParsed>(command: Command<TParsed>): CommandDefinition {
  return {
    name: command.name,
    summary: command.summary,
    help: command.help,
    parse: command.parse,
    run: (parsed) => command.run(parsed as TParsed),
  };
}

const commands: CommandDefinition[] = [toCommand(devCommand), toCommand(buildCommand)];

function printHelp() {
  const list = formatCommandList(commands);
  process.stderr.write(
    [
      "btuin",
      "",
      "Usage:",
      "  btuin <command> [options]",
      "",
      "Commands:",
      ...list,
      "",
      "Run `btuin <command> --help` for command options.",
      "",
    ].join("\n"),
  );
}

function printCommandHelp(commandName: string, help: HelpInfo) {
  const lines = formatCommandHelp(commandName, help);
  process.stderr.write([`btuin ${commandName}`, "", ...lines, ""].join("\n"));
}

function printVersion() {
  try {
    const pkgPath = fileURLToPath(new URL("../../package.json", import.meta.url));
    const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { name?: string; version?: string };
    process.stdout.write(`${pkg.name ?? "btuin"} ${pkg.version ?? ""}`.trimEnd() + "\n");
  } catch {
    process.stdout.write("btuin\n");
  }
}

export async function btuinCli(argv: string[]) {
  if (argv.length === 0) {
    printHelp();
    return;
  }

  if (argv.includes("-h") || argv.includes("--help")) {
    const commandName = argv[0];
    const command = commands.find((cmd) => cmd.name === commandName);
    if (command) {
      printCommandHelp(command.name, command.help);
    } else {
      printHelp();
    }
    return;
  }

  if (argv.includes("-v") || argv.includes("--version")) {
    printVersion();
    return;
  }

  const [commandName, ...rest] = argv;
  const command = commands.find((cmd) => cmd.name === commandName);
  if (!command) {
    process.stderr.write(`[btuin] unknown command: ${commandName}\n`);
    printHelp();
    process.exitCode = 1;
    return;
  }

  try {
    await command.run(command.parse(rest));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`${message}\n`);
    printCommandHelp(command.name, command.help);
    process.exitCode = 1;
  }
}
