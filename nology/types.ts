import { WAMessage } from '@whiskeysockets/baileys';

// Define the structure of the object passed to each command
export interface CommandArgs {
  prefix: string;
  command: string;
  reply: (msg: string) => void;
  text: string;
  isBot: boolean;
  pushname: string;
  mime: string | null;
  quoted: WAMessage | null;
  fquoted: any; // Consider defining a more specific type if possible
  sleep: (ms: number) => Promise<void>;
  fetchJson: (url: string, options?: any) => Promise<any>;
  isPrivate: boolean;
}

// Define the structure for a command module
export interface Command {
  command: string[];
  help?: string[];
  tags?: string[];
  isBot?: boolean;
  private?: boolean;
  (m: WAMessage, args: CommandArgs): Promise<void>;
}
