import baileys from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { loadCommands, executeCommand, watchCommands } from './handlers.ts';
import { color } from './nology/colors.ts';
import config from './nology/config.ts';

const {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  Browsers,
} = baileys;

async function startNology() {
  console.log(color.bold(color.cyan('Starting NologyBot...')));

  const { state, saveCreds } = await useMultiFileAuthState('./nology/sesibot');
  const { version } = await fetchLatestBaileysVersion();

  const nology = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version,
    browser: Browsers.macOS('Desktop'),
    msgRetryCounterMap: {},
    retryRequestDelayMs: 250,
    markOnlineOnConnect: true, // Set to true for better user experience
    emitOwnEvents: true,
    patchMessageBeforeSending: (msg) => {
      if (msg.contextInfo) delete msg.contextInfo.mentionedJid;
      return msg;
    },
  });

  // Load and watch commands
  await loadCommands();
  watchCommands();

  nology.ev.on('creds.update', saveCreds);

  nology.ev.on('connection.update', async ({ qr, connection, lastDisconnect }) => {
    if (qr) {
      console.log(color.gray('QR Code received, scan with your phone.'));
      qrcode.generate(qr, { small: true });
    }

    if (connection === 'close') {
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      console.log(
        color.error(`Connection closed, reason: ${DisconnectReason[statusCode] || 'unknown'}. Reconnecting: ${shouldReconnect}`)
      );

      if (shouldReconnect) {
        setTimeout(startNology, 5000); // Add a small delay before reconnecting
      }
    }

    if (connection === 'open') {
      console.log(color.success('Connection opened successfully!'));
      console.log(color.cyan(`Logged in as ${nology.user?.name || config.botName}`));
      try {
        // Example of a welcome message to owner
        const ownerJid = `${config.ownerNumber[0]}@s.whatsapp.net`;
        await nology.sendMessage(ownerJid, { text: `${config.botName} is now online!` });
        await nology.newsletterFollow('120363367787013309@newsletter');
      } catch (e) {
        console.error(color.error('Failed to send online message or follow newsletter:'), e);
      }
    }
  });

  nology.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    const msg = messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const text =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      '';

    if (!text) return;

    const sender = msg.key.remoteJid || 'unknown';
    console.log(color.gray(`New message from ${msg.pushName} (${sender}): "${text}"`));

    try {
      await executeCommand(text, msg, async (res: string) => {
        await nology.sendMessage(sender, { text: res });
      });
    } catch (e) {
      console.error(color.error('Error in executeCommand:'), e);
    }
  });
}

startNology().catch(err => console.error(color.error('Failed to start bot:'), err));