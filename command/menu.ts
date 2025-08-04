import { Command } from '../nology/types.ts';
import { commands } from '../handlers.ts';
import config from '../nology/config.ts';

const handler: Command = async (m, { prefix }) => {
  let menuText = `Hi ${m.pushName}! I am ${config.botName}, a WhatsApp bot.\n\n`;
  menuText += `*Available Commands*\n`;

  const processedCommands = new Set<Command>();
  const commandDetails: { name: string, help: string, tags: string }[] = [];

  // De-duplicate commands and collect details
  commands.forEach((cmd) => {
    if (!processedCommands.has(cmd)) {
      processedCommands.add(cmd);
      commandDetails.push({
        name: cmd.command[0],
        help: cmd.help ? cmd.help.join(', ') : 'No description',
        tags: cmd.tags ? cmd.tags.join(', ') : 'uncategorized'
      });
    }
  });

  // Sort commands alphabetically
  commandDetails.sort((a, b) => a.name.localeCompare(b.name));

  // Group commands by tag for a cleaner look
  const commandsByTag: { [key: string]: string[] } = {};

  commandDetails.forEach(cmd => {
    const tagName = `*${cmd.tags.charAt(0).toUpperCase() + cmd.tags.slice(1)}*`;
    if (!commandsByTag[tagName]) {
      commandsByTag[tagName] = [];
    }
    commandsByTag[tagName].push(`  - ${prefix}${cmd.name}: _${cmd.help}_`);
  });

  // Build the final menu string
  for (const tag in commandsByTag) {
    menuText += `\n${tag}\n`;
    menuText += commandsByTag[tag].join('\n');
  }

  menuText += `\n\n_Use ${prefix}command <query> to use a command._`;

  await m.reply(menuText);
};

handler.command = ['menu', 'help'];
handler.help = ['Shows the command menu.'];
handler.tags = ['utility'];

export default handler;
