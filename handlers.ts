import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { WAMessage } from "@whiskeysockets/baileys";
import config from "./nology/config.ts";
import { color } from "./nology/colors.ts";
import { Command, CommandArgs } from "./nology/types.ts";

// Using a Map for efficient command lookups (O(1) complexity)
export const commands = new Map<string, Command>();

/**
 * Dynamically loads all commands from the 'command' directory into the 'commands' Map.
 */
export const loadCommands = async (directory = "./command") => {
  const dirPath = path.resolve(directory);
  const files = fs.readdirSync(dirPath);

  // Clear old commands before reloading
  commands.clear();

  console.log(color.gray("Loading commands..."));

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    if (filePath.endsWith(".js") || filePath.endsWith(".ts")) {
      try {
        // Use a timestamp query to bypass cache on reloads
        const fileUrl = pathToFileURL(filePath).href + `?update=${Date.now()}`;
        const module = await import(fileUrl);
        const command: Command = module.default;

        if (command && Array.isArray(command.command)) {
          // Register each alias for the command
          command.command.forEach((alias) => {
            commands.set(alias.toLowerCase(), command);
          });
          console.log(color.success("✔ Loaded Plugin:"), color.cyan(file));
        }
      } catch (error) {
        console.error(color.error(`❌ Failed to load plugin ${file}:`), error);
      }
    }
  }
  console.log(color.success(`Total commands loaded: ${commands.size}`));
};

/**
 * Watches the command directory for changes and reloads commands automatically.
 */
export const watchCommands = (directory = "./command") => {
  const dirPath = path.resolve(directory);
  fs.watch(dirPath, { recursive: false }, async (eventType, filename) => {
    if (filename && (filename.endsWith(".js") || filename.endsWith(".ts"))) {
      console.log(
        color.warning(`🔁 Reloading commands due to change in:`),
        filename
      );
      await loadCommands(directory);
    }
  });
};

/**
 * Executes a command based on the user's message.
 * @param text The message content from the user.
 * @param m The full WAMessage object.
 * @param respond The function to send a reply.
 */
export const executeCommand = async (
  text: string,
  m: WAMessage,
  respond: (res: string) => Promise<void>
) => {
  const prefix = config.prefix || "!"; // Default prefix is '!'
  if (!text.startsWith(prefix)) return;

  const args = text.slice(prefix.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = commands.get(commandName);
  if (!command) return;

  const sender = m.key.remoteJid;
  console.log(
    color.info(`Executing command ${commandName} for ${m.pushName} in ${sender}`)
  );

  // Construct the arguments object for the command
  const commandArgs: CommandArgs = {
    prefix,
    command: commandName,
    reply: (msg) => respond(msg),
    text: args.join(" "),
    isBot: m.key.fromMe || false,
    pushname: m.pushName || "User",
    mime: Object.keys(m.message || {})[0] || null,
    quoted: m.message?.extendedTextMessage?.contextInfo?.quotedMessage || null,
    fquoted: m.message?.extendedTextMessage?.contextInfo,
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    fetchJson: async (url, options = {}) => {
      const res = await fetch(url, options);
      return res.json();
    },
    isPrivate: sender?.endsWith("@s.whatsapp.net") || false,
  };

  try {
    // Check for command restrictions
    if (command.isBot && !commandArgs.isBot) return;
    if (command.private && !commandArgs.isPrivate) {
      return commandArgs.reply(
        config.mess?.private || "This command can only be used in private chat."
      );
    }

    await command(m, commandArgs);
  } catch (err) {
    console.error(
      color.error(`❌ Error executing command ${commandName}:`),
      err
    );
    commandArgs.reply(config.mess?.error || "An error occurred while executing the command.");
  }
};
