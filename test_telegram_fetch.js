import { getTelegramClient, getTrackedChannels } from './server/telegram/client.js';

async function testFetch() {
  try {
    console.log('Connecting to Telegram...');
    const client = await getTelegramClient();
    console.log('✅ Connected!');

    const channels = getTrackedChannels();
    console.log(`Channels: ${channels.length}`);

    const testChannel = channels[0];
    console.log(`\nTesting: ${testChannel.displayName} (${testChannel.username})...`);

    const messages = await client.getMessages(testChannel.username, { limit: 5 });
    console.log(`✅ Fetched ${messages.length} messages`);
    
    messages.forEach((m, i) => {
      console.log(`\n${i + 1}. ${new Date(m.date * 1000).toISOString()}`);
      console.log(`   Text: ${m.text?.slice(0, 150) || '(no text)'}`);
    });

  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

testFetch().catch(err => {
  console.error('❌ Fatal:', err);
  process.exit(1);
});
