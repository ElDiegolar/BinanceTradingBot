const rp = require('request-promise');
const bottleneck = require('bottleneck');
const _ = require('lodash');
const config = require('./config.js');
const fs = require('fs');
const csv = require('fast-csv');
const log = console.log;

const getReqArray = ({ symbol, fromTS, toTS, timeframe, tfw }) => {
  const barw = tfw[timeframe];
  const n = Math.ceil((toTS - fromTS) / (1000 * barw));
  return _.times(n, (i) => {
    const startTS = fromTS + i * 1000 * barw;
    return `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${timeframe}&startTime=${startTS}&limit=1000`;
  });
};

//Limit to 15 requests per sec, which translates to 900 requests per minute (way below the rate limit)
const limiter = new bottleneck({
  reservoir: 15, // initial value
  reservoirRefreshAmount: 15,
  reservoirRefreshInterval: 1 * 1000,
  maxConcurrent: 15,
  minTime: 80,
});

const getKline = async (url) => {
  try {
    return JSON.parse(await rp(url));
  } catch (e) {
    log(e);
    return [];
  }
};

const wrapKline = limiter.wrap(getKline);

// Business Logic
const download = async () => {
  const {
    symbol,
    timeframe,
    fromTS,
    toTS,
    fileName,
    tfw,
  } = config.getPrameters();
  const reqA = getReqArray({ symbol, fromTS, toTS, timeframe, tfw });
  log(`Total No. API Requests to process => ${reqA.length}`);
  log(`Initiating download...`);

  // 1499040000000,      // Open time
  //   "0.01634790",       // Open
  //   "0.80000000",       // High
  //   "0.01575800",       // Low
  //   "0.01577100",       // Close
  //   "148976.11427815",  // Volume
  //   1499644799999,      // Close time
  //   "2434.19055334",    // Quote asset volume
  //   308,                // Number of trades
  //   "1756.87402397",    // Taker buy base asset volume
  //   "28.46694368",      // Taker buy quote asset volume
  //   "17928899.62484339" // Ignore.
  
  const header = [
    ['date', 'open', 'high', 'low', 'close', 'volume', 'quoteVolume'],
  ];
  const results = [
    ...header,
    ..._.flatten([
      ...(await Promise.all(reqA.map((item) => wrapKline(item)))),
    ]).filter(k => k[0] <= toTS).map((k) => [
      new Date(k[0]).toLocaleString('en-GB'),
      k[1],
      k[2],
      k[3],
      k[4],
      k[5],
      k[7],
    ]),
  ];
  //Save to csv file
  const ws = fs.createWriteStream(fileName);
  csv
    .write(results, { headers: true })
    .pipe(ws)
    .on('finish', () =>
      log(`Candlestick data has been downloaded to ${fileName}`)
    );
};

download();