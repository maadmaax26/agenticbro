import { getTelegramClient, getTrackedChannels } from './server/telegram/client.js';

async function testFetch() {
  try {
    console.log('Getting Telegram client...');
    const client = await getTelegramClient();
    console.log('✅ Client connected');

    const channels = getTrackedChannels();
    console.log(`\nChannels: ${channels.length}`);

    const testChannel = channels[0];
    console.log(`\nFetching from ${testChannel.displayName}...`);

    const messages = await client.getMessages(testChannel.username, { limit: 10 });
    console.log(`\n✅ Fetched ${messages.length} messages`);
    
    for (let i = 0; i < messages.length; i++) {
      const m = messages[i];
      console.log(`\nMessage ${i+1}:`);
      console.log(`  Date: ${new Date(m.date * 1000).toISOString()}`);
      console.log(`  Text: ${m.text?.slice(0, 200) || '(no text)'}`);
    }

  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

testFetch();
