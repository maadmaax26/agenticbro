const CDP = require('chrome-remote-interface');

async function scan() {
  let client;
  try {
    client = await CDP({ host: '127.0.0.1', port: 18801 });
    const { Page, Runtime, DOM } = client;
    await Page.enable();
    await DOM.enable();

    // Navigate to profile
    await Page.navigate({ url: 'https://x.com/weczarmy' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 4000));

    // Scroll down to load more tweets
    for (let i = 0; i < 4; i++) {
      await Runtime.evaluate({ expression: 'window.scrollBy(0, 1200)' });
      await new Promise(r => setTimeout(r, 2500));
    }

    // Get all visible tweet text and engagement data
    const result = await Runtime.evaluate({
      expression: `
        (function() {
          const tweets = [];
          document.querySelectorAll('article[data-testid="tweet"]').forEach((tweet, idx) => {
            if (idx > 20) return;
            const textEl = tweet.querySelector('[data-testid="tweetText"]');
            const text = textEl ? textEl.innerText : '';
            
            const replyEl = tweet.querySelector('[data-testid="reply"]');
            const replyCount = replyEl ? replyEl.innerText : '0';
            
            const rtEl = tweet.querySelector('[data-testid="retweet"]');
            const rtCount = rtEl ? rtEl.innerText : '0';
            
            const likeEl = tweet.querySelector('[data-testid="like"]');
            const likeCount = likeEl ? likeEl.innerText : '0';
            
            const authorEl = tweet.querySelector('[data-testid="User-Name"]');
            const author = authorEl ? authorEl.innerText : '';
            
            const hasImages = tweet.querySelectorAll('[data-testid="tweetPhoto"], video').length > 0;
            
            const timeEl = tweet.querySelector('time');
            const timestamp = timeEl ? timeEl.getAttribute('datetime') : '';
            
            if (text || author) {
              tweets.push({
                idx: idx,
                author: author.substring(0, 120),
                text: text.substring(0, 400),
                replies: replyCount,
                retweets: rtCount,
                likes: likeCount,
                hasImages: hasImages,
                timestamp: timestamp
              });
            }
          });
          return JSON.stringify(tweets, null, 2);
        })()
      `,
      returnByValue: true
    });

    console.log('=== MAIN TWEETS & ENGAGEMENT ===');
    console.log(result.result.value);

    // Now check the replies tab
    await Page.navigate({ url: 'https://x.com/weczarmy/with_replies' });
    await Page.loadEventFired();
    await new Promise(r => setTimeout(r, 4000));

    for (let i = 0; i < 4; i++) {
      await Runtime.evaluate({ expression: 'window.scrollBy(0, 1200)' });
      await new Promise(r => setTimeout(r, 2500));
    }

    const replies = await Runtime.evaluate({
      expression: `
        (function() {
          const tweets = [];
          document.querySelectorAll('article[data-testid="tweet"]').forEach((tweet, idx) => {
            if (idx > 20) return;
            const textEl = tweet.querySelector('[data-testid="tweetText"]');
            const text = textEl ? textEl.innerText : '';
            const authorEl = tweet.querySelector('[data-testid="User-Name"]');
            const author = authorEl ? authorEl.innerText.substring(0, 120) : '';
            const likeEl = tweet.querySelector('[data-testid="like"]');
            const likeCount = likeEl ? likeEl.innerText : '0';
            const rtEl = tweet.querySelector('[data-testid="retweet"]');
            const rtCount = rtEl ? rtEl.innerText : '0';
            const replyEl = tweet.querySelector('[data-testid="reply"]');
            const replyCount = replyEl ? replyEl.innerText : '0';
            const timeEl = tweet.querySelector('time');
            const timestamp = timeEl ? timeEl.getAttribute('datetime') : '';
            
            if (text || author) {
              tweets.push({
                idx: idx,
                author: author,
                text: text.substring(0, 300),
                likes: likeCount,
                retweets: rtCount,
                replies: replyCount,
                timestamp: timestamp
              });
            }
          });
          return JSON.stringify(tweets, null, 2);
        })()
      `,
      returnByValue: true
    });

    console.log('\n=== REPLIES TAB ===');
    console.log(replies.result.value);

    // Analyze for bot patterns
    const analysis = await Runtime.evaluate({
      expression: `
        (function() {
          // Get follower count from profile
          const stats = document.querySelectorAll('a[href*="/verified_followers"], a[href*="/followers"]');
          let followerText = '';
          stats.forEach(s => { followerText += s.innerText + ' | '; });
          
          // Check for suspicious patterns
          const allText = document.body.innerText;
          const patterns = {
            hasGIVEAWAY: /giveaway/i.test(allText),
            hasAIRDROP: /airdrop/i.test(allText),
            hasDM_ME: /dm me|dm us|dm for/i.test(allText),
            hasGUARANTEED: /guaranteed|100x|1000x/i.test(allText),
            hasFREE: /free.*crypto|free.*token/i.test(allText),
            hasUrgency: /act now|hurry|limited time|ending soon/i.test(allText),
            hasEmoji: /[\u{1F680}\u{1F525}\u{1F4B0}\u{1F48E}\u{2728}\u{1F389}]/u.test(allText.substring(0, 3000)),
          };
          
          return JSON.stringify({followerStats: followerText, patterns: patterns}, null, 2);
        })()
      `,
      returnByValue: true
    });

    console.log('\n=== BOT PATTERN ANALYSIS ===');
    console.log(analysis.result.value);

    await client.close();
  } catch (e) {
    console.error('Error:', e.message);
    if (client) await client.close();
    process.exit(1);
  }
}

scan();