export type OptionSpec = {
  flags: string[];
  value?: string;
  description: string;
  defaultValue?: string;
};

export type HelpInfo = {
  usage: string;
  examples?: string[];
  options?: OptionSpec[];
  notes?: string[];
};

export type Command<TParsed> = {
  name: string;
  summary: string;
  help: HelpInfo;
  parse: (argv: string[]) => TParsed;
  run: (parsed: TParsed) => Promise<void> | void;
};

function formatOptions(options: OptionSpec[]): string[] {
  const formatted = options.map((option) => {
    const flags = option.flags.join(", ") + (option.value ? ` ${option.value}` : "");
    const description = option.defaultValue
      ? `${option.description} (default: ${option.defaultValue})`
      : option.description;
    return { flags, description };
  });

  const maxWidth = formatted.reduce((width, option) => Math.max(width, option.flags.length), 0);
  return formatted.map((option) => `  ${option.flags.padEnd(maxWidth + 2)}${option.description}`);
}

export function formatCommandHelp(commandName: string, help: HelpInfo): string[] {
  const lines: string[] = [];
  lines.push("Usage:");
  lines.push(`  btuin ${commandName} ${help.usage}`);

  if (help.examples && help.examples.length > 0) {
    lines.push("");
    lines.push("Examples:");
    for (const example of help.examples) {
      lines.push(`  ${example}`);
    }
  }

  if (help.options && help.options.length > 0) {
    lines.push("");
    lines.push("Options:");
    lines.push(...formatOptions(help.options));
  }

  if (help.notes && help.notes.length > 0) {
    lines.push("");
    for (const note of help.notes) {
      lines.push(note);
    }
  }

  return lines;
}

export function formatCommandList(commands: Array<{ name: string; summary: string }>): string[] {
  const maxWidth = commands.reduce((width, cmd) => Math.max(width, cmd.name.length), 0);
  return commands.map((cmd) => `  ${cmd.name.padEnd(maxWidth + 2)}${cmd.summary}`);
}
