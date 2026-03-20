/**
 * Test Telegram client connection
 */
import { getTelegramClient, getTrackedChannels } from './server/telegram/client.js';

async function testTelegramConnection() {
  try {
    console.log('Checking Telegram configuration...');
    const configured = require('./server/telegram/client.js').isTelegramConfigured();
    console.log('Configured:', configured);

    if (!configured) {
      console.error('❌ Telegram not configured!');
      return;
    }

    console.log('\nFetching tracked channels...');
    const channels = getTrackedChannels();
    console.log(`Found ${channels.length} tracked channels`);

    console.log('\nConnecting to Telegram client...');
    const client = await getTelegramClient();
    console.log('✅ Client connected!');

    // Test fetching from first channel
    const testChannel = channels[0];
    console.log(`\nTesting fetch from ${testChannel.displayName}...`);
    const messages = await client.getMessages(testChannel.username, { limit: 5 });
    console.log(`✅ Fetched ${messages.length} messages`);
    console.log('Sample message:', messages[0]?.text?.slice(0, 100) || 'No text in first message');

  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

testTelegramConnection().then(() => {
  console.log('\n✅ Test complete');
  process.exit(0);
}).catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});