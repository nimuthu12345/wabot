const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

// Initialize WhatsApp client
const client = new Client({
    authStrategy: new LocalAuth({ dataPath: './link_remover_bot_session' }),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});

// Configuration
const CONFIG = {
    ADMIN_NUMBERS: ['94759952830'], // Your admin number with country code
    URL_REGEX: /(https?:\/\/|www\.)[^\s]+/gi
};

// Event handlers
client.on('qr', qr => {
    console.log('QR Code generated. Scan to authenticate:');
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('Authentication successful!');
});

client.on('ready', () => {
    console.log('Link Remover Bot is ready!');
});

client.on('message', async message => {
    try {
        const sender = message.from;
        const isGroup = message.from.endsWith('@g.us');
        const isAdmin = CONFIG.ADMIN_NUMBERS.includes(sender.replace('@c.us', ''));

        // Only process group messages
        if (!isGroup) {
            // Handle admin commands in private chat
            const text = message.body?.toLowerCase().trim();
            if (text && text.startsWith('!') && isAdmin) {
                const command = text.split(' ')[0];
                
                switch (command) {
                    case '!help':
                        await sendHelpMessage(message);
                        break;
                    case '!status':
                        await message.reply('Bot is running and removing all links in all groups (except from admins).');
                        break;
                    default:
                        await message.reply('Unknown command. Type !help for available commands.');
                }
            }
            return;
        }

        // Skip if message is from admin
        if (isAdmin) return;

        // Check for any links in the message
        if (message.body && CONFIG.URL_REGEX.test(message.body)) {
            console.log('Detected link in message from', sender);
            
            // Add reaction first (in case deletion fails)
            await message.react('❌');
            
            // Delete the message containing the link
            if (message.id) {
                try {
                    await message.delete(true); // true = delete for everyone
                    console.log('Deleted message with link');
                } catch (deleteError) {
                    console.error('Failed to delete message:', deleteError);
                    // Reaction was already added, so we'll just leave it at that
                }
            }
        }
    } catch (error) {
        console.error('Error handling message:', error);
    }
});

async function sendHelpMessage(message) {
    const isAdmin = CONFIG.ADMIN_NUMBERS.includes(message.from.replace('@c.us', ''));
    
    let helpText = `🚫 *Link Remover Bot* 🚫

This bot automatically removes all links from all groups (except when sent by admins).`;

    if (isAdmin) {
        helpText += `\n\n*Admin Commands:*
!status - Check bot status
!help - Show this help message`;
    }

    await message.reply(helpText);
}

// Start the client
client.initialize();

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down Link Remover Bot...');
    client.destroy();
    process.exit();
});