const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Configure Express
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

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

// Store QR code data for web display
let qrCodeData = null;

// Event handlers
client.on('qr', async (qr) => {
    console.log('QR Code generated');
    qrCodeData = await qrcode.toDataURL(qr);
});

client.on('authenticated', () => {
    console.log('Authentication successful!');
    qrCodeData = null;
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

// Routes
app.get('/', (req, res) => {
    if (client.info) {
        // Already authenticated
        res.render('status', { status: 'authenticated', user: client.info.pushname });
    } else if (qrCodeData) {
        // Show QR code for authentication
        res.render('index', { qrCodeData });
    } else {
        // Loading state
        res.render('status', { status: 'loading' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

// Handle process termination
process.on('SIGINT', () => {
    console.log('\nShutting down Link Remover Bot...');
    client.destroy();
    process.exit();
});
