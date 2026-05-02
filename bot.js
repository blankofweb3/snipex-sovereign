require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const { Connection, PublicKey, VersionedTransaction, Keypair, SystemProgram, Transaction } = require('@solana/web3.js');

const bot = new TelegramBot(process.env.TELEGRAM_TOKEN, {polling: true});
const connection = new Connection(process.env.QUICKNODE_RPC, 'confirmed');
const HEADERS = {'x-api-key': process.env.JUPITER_API_KEY};
const SOL_MINT = 'So11111111111111111111111111111111111111112';
const users = {};
const wallets = {};

function getUser(id) {
  if (!users[id]) users[id] = {trades: 0, volume: 0, referrals: 0, referredBy: null, earnings: 0};
  return users[id];
}
function getRefCode(id) { return 'SX' + id.toString().slice(-6); }
function fmt(n) {
  if (!n) return 'N/A';
  if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M';
  if (n >= 1e3) return '$' + (n/1e3).toFixed(1) + 'K';
  return '$' + Number(n).toFixed(2);
}

async function sendSOL(keypair, toAddress, lamports) {
  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(toAddress),
        lamports
      })
    );
    const sig = await connection.sendTransaction(tx, [keypair]);
    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
  } catch(e) {
    console.log('Payout error:', e.message);
    return null;
  }
}

console.log('SnipeX Sovereign is LIVE 🚀');

bot.onText(/\/start(.*)/, (msg, match) => {
  const chatId = msg.chat.id;
  const ref = match[1].trim();
  const user = getUser(chatId);
  if (ref && ref !== getRefCode(chatId)) {
    const refId = Object.keys(users).find(id => getRefCode(id) === ref);
    if (refId && !user.referredBy) {
      user.referredBy = refId;
      getUser(refId).referrals += 1;
      bot.sendMessage(chatId, '🎉 Referral applied!');
    }
  }
  bot.sendMessage(chatId, `\`\`\`
╔═══════════════════════╗
║   ⚡ SNIPEX SOVEREIGN  ║
║   Solana Trading Bot   ║
╚═══════════════════════╝
\`\`\`
*The fastest Solana trading bot.*
Scan tokens. Snipe early. Stay safe.

━━━━━━━━━━━━━━━━━━
*🔍 SCAN*  — Paste any token address
*💱 TRADE* — /buy <token> <sol>
*💵 PRICE* — /price <token>
*💎 SOL*   — /sol
*📊 STATS* — /stats
*👥 REF*   — /referrals
*💼 WALLET*— /wallet <address>
━━━━━━━━━━━━━━━━━━
_Powered by SolanaGuard • Built on Solana_`, {parse_mode: 'Markdown'});
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `\`\`\`
╔═══════════════════════╗
║     SNIPEX COMMANDS    ║
╚═══════════════════════╝
\`\`\`
🔍 *SCAN*    — Paste token address
💱 *BUY*     — /buy <token> <sol>
💵 *PRICE*   — /price <token>
💎 *SOL*     — /sol
📊 *STATS*   — /stats
👥 *REFS*    — /referrals
💼 *WALLET*  — /wallet <address>`, {parse_mode: 'Markdown'});
});

bot.onText(/\/wallet (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const address = match[1].trim();
  try {
    new PublicKey(address);
    wallets[chatId] = address;
    bot.sendMessage(chatId, `✅ *Payout wallet saved!*\n\n\`${address}\`\n\nReferral commissions will be sent here automatically.`, {parse_mode: 'Markdown'});
  } catch(e) {
    bot.sendMessage(chatId, '❌ Invalid wallet address.');
  }
});

bot.onText(/\/sol/, async (msg) => {
  try {
    const res = await axios.get('https://api.jup.ag/price/v3?ids=' + SOL_MINT, {headers: HEADERS, timeout: 10000});
    const data = res.data[SOL_MINT];
    if (!data) return bot.sendMessage(msg.chat.id, '❌ Could not fetch SOL price.');
    const change = data.priceChange24h;
    bot.sendMessage(msg.chat.id, `\`\`\`
╔═══════════════════════╗
║     💎 SOLANA (SOL)    ║
╚═══════════════════════╝
\`\`\`
💵 *Price:*  $${Number(data.usdPrice).toFixed(2)}
📈 *24h:*    ${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(2)}%
⚡ *Network:* Solana Mainnet`, {parse_mode: 'Markdown'});
  } catch(e) {
    bot.sendMessage(msg.chat.id, '❌ Failed: ' + e.message);
  }
});

bot.onText(/\/stats/, (msg) => {
  const user = getUser(msg.chat.id);
  bot.sendMessage(msg.chat.id, `\`\`\`
╔═══════════════════════╗
║    📊 TRADING STATS    ║
╚═══════════════════════╝
\`\`\`
🔁 *Trades:*    ${user.trades}
💰 *Volume:*    ${user.volume.toFixed(4)} SOL
👥 *Referrals:* ${user.referrals}
💸 *Earned:*    ${user.earnings.toFixed(6)} SOL
━━━━━━━━━━━━━━━━━━
_SnipeX Sovereign_`, {parse_mode: 'Markdown'});
});

bot.onText(/\/referrals/, (msg) => {
  const chatId = msg.chat.id;
  const user = getUser(chatId);
  const code = getRefCode(chatId);
  bot.sendMessage(chatId, `\`\`\`
╔═══════════════════════╗
║   👥 REFERRAL PROGRAM  ║
╚═══════════════════════╝
\`\`\`
🔗 *Code:*      \`${code}\`
👥 *Referrals:* ${user.referrals}
💸 *Earned:*    ${user.earnings.toFixed(6)} SOL
💼 *Wallet:*    ${wallets[chatId] ? '✅ Set' : '⚠️ Not set'}
💰 *Rate:*      0.1% per swap

📲 *Your link:*
\`https://t.me/SnipeXSovereignBot?start=${code}\`

_Share and earn on every trade!_`, {parse_mode: 'Markdown'});
});

async function getTokenReport(token) {
  const [dexRes, mintInfo] = await Promise.all([
    axios.get('https://api.dexscreener.com/latest/dex/tokens/' + token, {timeout: 10000}),
    connection.getParsedAccountInfo(new PublicKey(token))
  ]);
  const pairs = dexRes.data.pairs;
  const pair = pairs && pairs.length > 0 ? pairs[0] : null;
  const name = pair?.baseToken?.name || 'Unknown';
  const symbol = pair?.baseToken?.symbol || '???';
  const price = pair?.priceUsd ? Number(pair.priceUsd) : null;
  const change24h = pair?.priceChange?.h24;
  const change1h = pair?.priceChange?.h1;
  const mcap = pair?.marketCap;
  const fdv = pair?.fdv;
  const vol24h = pair?.volume?.h24;
  const liq = pair?.liquidity?.usd;
  const dex = pair?.dexId?.toUpperCase() || 'N/A';
  const imageUrl = pair?.info?.imageUrl || null;
  const info = mintInfo?.value?.data?.parsed?.info;
  const mintAuth = info?.mintAuthority;
  const freezeAuth = info?.freezeAuthority;
  const safetyScore = [!mintAuth, !freezeAuth, !!pair].filter(Boolean).length;
  const safety = safetyScore === 3 ? '🟢 SAFE' : safetyScore === 2 ? '🟡 CAUTION' : '🔴 RISKY';

  return {imageUrl, report: `\`\`\`
╔═══════════════════════╗
║    ⚡ SNIPEX SCANNER   ║
╚═══════════════════════╝
\`\`\`
🏷️ *${name}* (${symbol})
🏦 ${dex} • \`${token.slice(0,8)}...${token.slice(-4)}\`

💵 *Price*
  └ USD:    $${price ? price.toFixed(8) : 'N/A'}
  └ 1h:     ${change1h ? (change1h > 0 ? '▲' : '▼') + Math.abs(change1h).toFixed(2) + '%' : 'N/A'}
  └ 24h:    ${change24h ? (change24h > 0 ? '▲' : '▼') + Math.abs(change24h).toFixed(2) + '%' : 'N/A'}

📊 *Market*
  └ MCap:   ${fmt(mcap)}
  └ FDV:    ${fmt(fdv)}
  └ Vol24h: ${fmt(vol24h)}
  └ Liq:    ${fmt(liq)}

🔐 *Security*
  └ Mint:   ${mintAuth ? '⚠️ ACTIVE' : '✅ REVOKED'}
  └ Freeze: ${freezeAuth ? '⚠️ ACTIVE' : '✅ REVOKED'}
  └ DEX:    ${pair ? '✅ LISTED' : '⚠️ UNLISTED'}

🏆 SAFETY: ${safety}
━━━━━━━━━━━━━━━━━━
_SnipeX Sovereign • SolanaGuard_`};
}

bot.on('message', async (msg) => {
  const text = msg.text;
  if (!text || text.startsWith('/')) return;
  const token = text.trim();
  if (token.length < 32 || token.length > 44) return;
  const chatId = msg.chat.id;
  const scanning = await bot.sendMessage(chatId, '```\n⚡ SNIPEX SCANNER\nScanning token...\n```', {parse_mode: 'Markdown'});
  try {
    new PublicKey(token);
    const {imageUrl, report} = await getTokenReport(token);
    await bot.deleteMessage(chatId, scanning.message_id);
    const keyboard = {
      inline_keyboard: [
        [
          {text: '💱 Buy 0.1 SOL', callback_data: `buy_${token}_0.1`},
          {text: '💱 Buy 0.5 SOL', callback_data: `buy_${token}_0.5`}
        ],
        [
          {text: '💱 Buy 1 SOL', callback_data: `buy_${token}_1`},
          {text: '💱 Buy 5 SOL', callback_data: `buy_${token}_5`}
        ],
        [
          {text: '🔗 DexScreener', url: `https://dexscreener.com/solana/${token}`},
          {text: '🔍 Solscan', url: `https://solscan.io/token/${token}`}
        ]
      ]
    };
    if (imageUrl) {
      await bot.sendPhoto(chatId, imageUrl, {caption: report, parse_mode: 'Markdown', reply_markup: keyboard});
    } else {
      await bot.sendMessage(chatId, report, {parse_mode: 'Markdown', reply_markup: keyboard});
    }
  } catch(e) {
    console.log(e.message);
    await bot.sendMessage(chatId, '❌ Scan failed: ' + e.message);
  }
});

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  if (data.startsWith('buy_')) {
    const parts = data.split('_');
    const token = parts[1];
    const solAmount = parseFloat(parts[2]);
    await bot.answerCallbackQuery(query.id, {text: `🔄 Buying with ${solAmount} SOL...`});
    await bot.sendMessage(chatId, `🔄 *Executing swap...*\n💰 ${solAmount} SOL\n⏳ Please wait...`, {parse_mode: 'Markdown'});
    try {
      const keypair = Keypair.fromSecretKey(Buffer.from(process.env.BOT_PRIVATE_KEY, 'hex'));
      const lamports = Math.floor(solAmount * 1e9);
      const feeAmount = Math.floor(lamports * 0.01);
      const refAmount = Math.floor(lamports * 0.001);
      const swapAmount = lamports - feeAmount;
      const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
        params: {inputMint: SOL_MINT, outputMint: token, amount: swapAmount, slippageBps: 300},
        headers: HEADERS, timeout: 10000
      });
      const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
        quoteResponse: quoteRes.data,
        userPublicKey: keypair.publicKey.toString(),
        wrapAndUnwrapSol: true
      }, {headers: HEADERS, timeout: 15000});
      const tx = VersionedTransaction.deserialize(Buffer.from(swapRes.data.swapTransaction, 'base64'));
      tx.sign([keypair]);
      const txid = await connection.sendRawTransaction(tx.serialize(), {skipPreflight: false});
      await connection.confirmTransaction(txid, 'confirmed');
      const user = getUser(chatId);
      user.trades += 1;
      user.volume += solAmount;
      if (user.referredBy && wallets[user.referredBy]) {
        const sig = await sendSOL(keypair, wallets[user.referredBy], refAmount);
        if (sig) {
          getUser(user.referredBy).earnings += refAmount / 1e9;
          bot.sendMessage(user.referredBy, `💸 *+${(refAmount/1e9).toFixed(6)} SOL earned!*\nFrom a referral trade.`, {parse_mode: 'Markdown'});
        }
      }
      await bot.sendMessage(chatId, `\`\`\`
╔═══════════════════════╗
║    ✅ SWAP SUCCESSFUL  ║
╚═══════════════════════╝
\`\`\`
💰 *Spent:*  ${solAmount} SOL
💸 *Fee:*    ${(feeAmount/1e9).toFixed(4)} SOL
📊 *Trades:* ${user.trades}
🔗 [View on Solscan](https://solscan.io/tx/${txid})`, {parse_mode: 'Markdown', disable_web_page_preview: true});
    } catch(e) {
      console.log(e.message);
      await bot.sendMessage(chatId, '❌ Swap failed: ' + e.message);
    }
  }
});

bot.onText(/\/buy (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1].trim();
  const solAmount = parseFloat(match[2].trim());
  if (isNaN(solAmount) || solAmount <= 0) return bot.sendMessage(chatId, '❌ Use: /buy <token> <sol>');
  if (solAmount < 0.001) return bot.sendMessage(chatId, '❌ Minimum 0.001 SOL');
  await bot.sendMessage(chatId, `🔄 *Executing swap...*\n💰 ${solAmount} SOL\n⏳ Please wait...`, {parse_mode: 'Markdown'});
  try {
    const keypair = Keypair.fromSecretKey(Buffer.from(process.env.BOT_PRIVATE_KEY, 'hex'));
    const lamports = Math.floor(solAmount * 1e9);
    const feeAmount = Math.floor(lamports * 0.01);
    const refAmount = Math.floor(lamports * 0.001);
    const swapAmount = lamports - feeAmount;
    const quoteRes = await axios.get('https://api.jup.ag/swap/v1/quote', {
      params: {inputMint: SOL_MINT, outputMint: token, amount: swapAmount, slippageBps: 300},
      headers: HEADERS, timeout: 10000
    });
    const swapRes = await axios.post('https://api.jup.ag/swap/v1/swap', {
      quoteResponse: quoteRes.data,
      userPublicKey: keypair.publicKey.toString(),
      wrapAndUnwrapSol: true
    }, {headers: HEADERS, timeout: 15000});
    const tx = VersionedTransaction.deserialize(Buffer.from(swapRes.data.swapTransaction, 'base64'));
    tx.sign([keypair]);
    const txid = await connection.sendRawTransaction(tx.serialize(), {skipPreflight: false});
    await connection.confirmTransaction(txid, 'confirmed');
    const user = getUser(chatId);
    user.trades += 1;
    user.volume += solAmount;
    if (user.referredBy && wallets[user.referredBy]) {
      const sig = await sendSOL(keypair, wallets[user.referredBy], refAmount);
      if (sig) {
        getUser(user.referredBy).earnings += refAmount / 1e9;
        bot.sendMessage(user.referredBy, `💸 *+${(refAmount/1e9).toFixed(6)} SOL earned!*`, {parse_mode: 'Markdown'});
      }
    }
    await bot.sendMessage(chatId, `\`\`\`
╔═══════════════════════╗
║    ✅ SWAP SUCCESSFUL  ║
╚═══════════════════════╝
\`\`\`
💰 *Spent:*  ${solAmount} SOL
💸 *Fee:*    ${(feeAmount/1e9).toFixed(4)} SOL
📊 *Trades:* ${user.trades}
🔗 [View on Solscan](https://solscan.io/tx/${txid})`, {parse_mode: 'Markdown', disable_web_page_preview: true});
  } catch(e) {
    console.log(e.message);
    await bot.sendMessage(chatId, '❌ Swap failed: ' + e.message);
  }
});

bot.onText(/\/price (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const token = match[1].trim();
  try {
    const res = await axios.get('https://api.dexscreener.com/latest/dex/tokens/' + token, {timeout: 10000});
    const pair = res.data.pairs?.[0];
    if (!pair) return bot.sendMessage(chatId, '❌ Price not found.');
    bot.sendMessage(chatId, `💵 *${pair.baseToken.name} (${pair.baseToken.symbol})*\n└ $${pair.priceUsd}\n📈 1h: ${pair.priceChange.h1 > 0 ? '▲' : '▼'}${Math.abs(pair.priceChange.h1).toFixed(2)}% | 24h: ${pair.priceChange.h24 > 0 ? '▲' : '▼'}${Math.abs(pair.priceChange.h24).toFixed(2)}%`, {parse_mode: 'Markdown'});
  } catch(e) {
    bot.sendMessage(chatId, '❌ Failed: ' + e.message);
  }
});

bot.on('polling_error', (err) => console.log('Polling error:', err.message));
