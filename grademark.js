const dataForge = require('data-forge');
require('data-forge-fs'); // For loading files.
require('data-forge-indicators'); // For the moving average indicator.
require('data-forge-plot');
const { backtest, analyze, computeEquityCurve, computeDrawdown } = require('grademark');
var Table = require('easy-table');
const fs = require('fs');
const moment = require('moment');
const { plot } = require('plot');
require('@plotex/render-image')

const getData= async() =>{

    // let inputSeries = dataForge.readFileSync("data.csv")
    // .parseCSV()
    // .parseDates("date", "DD/MM/YYYY")
    // .parseFloats(["open", "high", "low", "close", "volume"])
    // .setIndex("date") // Index so we can later merge on date.
    // .renameSeries({ date: "time" }); BTCUSDT_1h_2012_2021_data


    let inputSeries = dataForge.readFileSync("BTCUSDT_1h_last90days_data.csv")
    .parseCSV()
    .parseDates("Date", "DD/MM/YYYY, h:mm:ss")
    .parseFloats([ 'open', 'high', 'low', 'close', 'volume', 'quoteVolume' ], "0.00")
    .setIndex("date") // Index so we can later merge on date.
    .renameSeries({ date: "time" });

 
    console.log('inputSeries', inputSeries);
   // Add strat and signals
    
    const movingAverage = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .sma(30);                           // 30 day moving average.
    
    inputSeries = inputSeries
    .withSeries("sma30", movingAverage)   // Integrate moving average into data, indexed on date.
    .skip(30)                           // Skip blank sma entries.

    const rsi = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .rsi(14);                           // 30 day moving average.
    
    inputSeries = inputSeries
    .withSeries("rsi14", rsi)   // Integrate moving average into data, indexed on date.
    .skip(14)                           // Skip blank sma entries.


    const movingAverage14 = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .sma(14);                           // 30 day moving average.
    
    inputSeries = inputSeries
    .withSeries("sma14", movingAverage14)   // Integrate moving average into data, indexed on date.
    .skip(14)                           // Skip blank sma entries.

    
    const movingAverage50 = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .sma(50);                           // 30 day moving average.
    
    inputSeries = inputSeries
    .withSeries("sma50", movingAverage50)   // Integrate moving average into data, indexed on date.
    .skip(50)                           // Skip blank sma entries.

    const movingAverage200 = inputSeries
    .deflate(bar => bar.close)          // Extract closing price series.
    .sma(200);                           // 30 day moving average.
    
    inputSeries = inputSeries
    .withSeries("sma200", movingAverage200)   // Integrate moving average into data, indexed on date.
    .skip(200)            

     console.log('moving avg',inputSeries);
   
   // This is a very simple and very naive mean reversion strategy:
    const strategy = {
        entryRule: (enterPosition, args) => {
            // if(marketPrice > ema200){
                // if(ema14 > ema50){
                //     if(ema50 > ema200)
                //     if(rsi<35){
            
            if (args.bar.close < args.bar.sma30) { // Buy when price is below average
                            console.log(JSON.stringify(args.bar))
                            enterPosition();
                }
            
                
            
        },

        exitRule: (exitPosition, args) => {
            if (args.bar.close > args.bar.sma200 && args.bar.close > args.bar.sma50 ) {
                exitPosition(); // Sell when price is above average.
            }
        },

        stopLoss: args => { // Intrabar stop loss.
            console.log("entryPrice=>>> ",args.entryPrice)
            return args.entryPrice * (5/100); // Stop out on 5% loss from entry price.
        },
    };


    
    console.log("Backtesting...");

    // Backtest your strategy, then compute and print metrics:
    const trades = backtest(strategy, inputSeries);
    console.log("The backtest conducted " + trades.length + " trades!");
   
   
    const profitpctpath = "output/profitpct.png";

    await plot(trades, { chartType: "bar", y: { label: "profitPct" }})
        .renderImage(profitpctpath);
   
   // trades.plot({chartType: 'bar'},{y: "profitPct"}).renderImage(profitpctpath);;

    new dataForge.DataFrame(trades)
        .transformSeries({
            entryTime: d => moment(d).format("YYYY/MM/DD"),
            exitTime: d => moment(d).format("YYYY/MM/DD"),
        })
        .asCSV()
        .writeFileSync("./output/trades.csv");

    console.log("Analyzing...");

    const startingCapital = 1;
    const analysis = analyze(startingCapital, trades);

    const analysisTable = new Table();

    for (const key of Object.keys(analysis)) {
        analysisTable.cell("Metric", key);
        analysisTable.cell("Value", analysis[key]);
        analysisTable.newRow();
    }

    const analysisOutput = analysisTable.toString();
    console.log(analysisOutput);
    const analysisOutputFilePath = "output/analysis.txt";
    fs.writeFileSync(analysisOutputFilePath, analysisOutput);
    console.log(">> " + analysisOutputFilePath);

    console.log("Plotting...");

    // Visualize the equity curve and drawdown chart for your backtest:
    const equityCurve = computeEquityCurve(startingCapital, trades);
    const equityCurveOutputFilePath = "output/my-equity-curve.png";
    await plot(equityCurve, { chartType: "area", y: { label: "Equity $" }})
        .renderImage(equityCurveOutputFilePath);
    console.log(">> " + equityCurveOutputFilePath);

    const equityCurvePctOutputFilePath = "output/my-equity-curve-pct.png";
    const equityPct = equityCurve.map(v => ((v - startingCapital) / startingCapital) * 100);
    await plot(equityPct, { chartType: "area", y: { label: "Equity %" }})
        .renderImage(equityCurvePctOutputFilePath);
    console.log(">> " + equityCurvePctOutputFilePath);
        
    const drawdown = computeDrawdown(startingCapital, trades);
    const drawdownOutputFilePath = "output/my-drawdown.png";
    await plot(drawdown, { chartType: "area", y: { label: "Drawdown $" }})
        .renderImage(drawdownOutputFilePath);
    console.log(">> " + drawdownOutputFilePath);

    const drawdownPctOutputFilePath = "output/my-drawdown-pct.png";
    const drawdownPct = drawdown.map(v => (v / startingCapital) * 100);
    await plot(drawdownPct, { chartType: "area", y: { label: "Drawdown %" }})
        .renderImage(drawdownPctOutputFilePath);
    console.log(">> " + drawdownPctOutputFilePath);

    console.log(inputSeries)
}

getData();