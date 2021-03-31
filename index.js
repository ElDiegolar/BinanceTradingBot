require('dotenv').config;
const ccxt = require('ccxt');
const axios = require('axios');
const tulind = require('tulind');
var express = require('express');
var app = express();
var interval;
// const candles4h = getCandles('4h');

const candles1h = require('./BTCUSDT_1h_data');

const { getSupportInfo } = require('prettier');

const config = {
    asset: 'BTC',
    base: 'USDT',
    assetTokenName: 'bitcoin',
    baseTokenName: 'tether',
    maxOpenTrades: 5,
    allocation: 0.1,
    spread: 0.2, // limit order spread,
    tickInterval: 5000,// 2 sec checking interval api dependant
    profitPercentage: 3,
    status: 'off',
}

//******************************************************************************************** Server setup 
app.get('/', (req, res) => {
    res.send(`Hello World!
    Start bot at api: /api/startbot
    `)
})

app.get('/api/startbot', (req, res) => {
    config.status = 'running';
    run();
    res.send(`bot has started with the following congiguration
    ${JSON.stringify(config)
        }
    `)
})


app.get('/api/stopbot', (req, res) => {
    config.status = 'off';
    res.send(`bot has stopped`)
})

app.get('/api/settings', (req, res) => {

    res.send(`bot settings`)
})


var server = app.listen(3001, function () {
    console.log(`Find the server at: http://localhost:${3001}/`);
});



//******************************************************************************************** End Server setup 

// Historical candle data from saved file  
const open = candles1h.data.map(d => d.Open);

const high = candles1h.data.map(d => d.High);

const low = candles1h.data.map(d => d.Low);

const close = candles1h.data.map(d => d.Close);

let ema200 = null;
let ema14 = null;
let ema50 = null;
let rsi = null;

const setupIndicators = async () => {
    rsi = getRsi(14);
    console.log(getEMA(200))
    ema200 = getEMA(200);
    ema14 = getEMA(14);
    ema50 = getEMA(50);
}

const getRsi = (timeframe) => {
    let rsi;
    tulind.indicators.rsi.indicator([close], [timeframe], (err, res) => {
        if (err) return console.log("rsi error:> ", err);
        rsi = res[0].slice(-1)[0]
    });
    return rsi;
};

const getEMA = (timeframe) => {
    let ema;
    tulind.indicators.sma.indicator([close], [timeframe], (err, res) => {
        if (err) return console.log(`ema ${timeframe}error:> `, err);
        console.log(`${timeframe}ema success:> `, res[0].slice(-1)[0]);
        ema = res[0].slice(-1)[0];

    });
    return ema;
};

const getindicators = async () => { await setupIndicators(); }

getindicators();


// get market price of coins
const getMarketPrice = async (currency, pair) => {
    const prices = await Promise.all([
        axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${currency}&vs_currencies=USD`),
        axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${pair}&vs_currencies=USD`)
    ])

    return prices;
}

const movingAverageCrossOverPlay = async (prices, binanceClient) => {
    
    console.log('moving avg 200 = > ', ema200);
    console.log('moving avg 14 = > ', ema14);
    console.log('moving avg 50 = > ', ema50);
    console.log('rsi => ', rsi);

    const marketPrice = prices[0].data.bitcoin.usd / prices[1].data.tether.usd;

    // create new order
    const sellPrice = marketPrice * (1 + config.spread);
    const buyPrice = marketPrice * (1 - config.spread);
    const balances = await binanceClient.fetchBalance();
    const assetBalance = balances.free[config.asset];
    const baseBalance = balances.free[config.base];
    const sellVolume = assetBalance * config.allocation;
    const buyVolume = (baseBalance * config.allocation) / marketPrice;

    // going alalala long
    if (marketPrice > ema200) {
        if (ema14 > ema50) {
            if (ema50 > ema200)
                if (rsi < 35) {
                    // make buy order(get profit margin)
                    // await binanceClient.createLimitSellOrder(market, sellVolume,sellPrice);
                    // await binanceClient.createLimitBuyOrder(market, buyVolume,buyPrice);
                    // await binanceClient.trade.newOCOOrder('BTCUSDT', 'SELL', 1, 0.003, 0.0025, {
                    //     stopLimitPrice: 0.0024
                    //})
                    // make stop loss
                    // await binanceClient.trade.newOCOOrder('BTCUSDT', 'SELL', 1, 0.003, 0.0025, {
                    //     stopLimitPrice: 0.0024
                    // })
                    // set take profit
                }
        }
    }

}

const tick = async (config, binanceClient) => {
    if (config.status == 'running') {
        const { asset, base, spread, allocation, assetTokenName, baseTokenName } = config;
        const market = `${asset}/${base}`;

        const prices = await getMarketPrice(assetTokenName, baseTokenName);

        // employ madman strats

        // ***************** moving avg x-over strategy ***********************//
        movingAverageCrossOverPlay(prices, binanceClient);
        // ***************** --------------------- ***********************//

        //cancel previous outstanding orders when conditions are met (TODO)
        const orders = await binanceClient.fetchOpenOrders(market);
        orders.forEach(async order => {
            await binanceClient.cancelOrder(order.id);
        });

        

        // ***************** market maker strategy ***********************//
        // marketMakerStrat();
        // ***************** --------------------- ***********************//

    } else {
        clearInterval(interval);
    }

}


const marketMakerStrat = async () => {

    // get market price
    const prices = await Promise.all([
        axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=USD'),
        axios.get('https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=USD')
    ])

    console.log('prices', prices)

    // get bitcoin vs tether price;
    const marketPrice = prices[0].data.bitcoin.usd / prices[1].data.tether.usd;

    // create new order
    const sellPrice = marketPrice * (1 + spread);
    const buyPrice = marketPrice * (1 - spread);
    const balances = await binanceClient.fetchBalance();
    const assetBalance = balances.free[asset];
    const baseBalance = balances.free[base];
    const sellVolume = assetBalance * allocation;
    const buyVolume = (baseBalance * allocation) / marketPrice;

    // await binanceClient.createLimitSellOrder(market, sellVolume,sellPrice);
    // await binanceClient.createLimitBuyOrder(market, buyVolume,buyPrice);

    console.log(
        `New tick for ${market} ----------->
            Created sell order for ${sellVolume} @${sellPrice}
        Created limit buy order for ${buyVolume}@${buyPrice}
        `
    )
}


const run = async () => {

    console.log(
        `Binance auto bot deployed
        `
    )

    // binance 
    const binanceClient = new ccxt.binance(
        {
            apiKey: 'your key',
            secret: 'sekooritycodemeddem',
            nonce: 1000
        }
    )

    // console.log(JSON.stringify(this.microseconds));
    // console.log(JSON.stringify(binanceClient));

    tick(config, binanceClient);
    interval = setInterval(tick, config.tickInterval, config, binanceClient);

}