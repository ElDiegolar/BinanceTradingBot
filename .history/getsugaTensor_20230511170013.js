const tf = require('@tensorflow/tfjs-node');
const csvParser = require('csv-parser');
const fs = require('fs');
const _ = require('lodash');

async function run() {
    const data = await getData();
    const model = createModel();
    const tensorData = convertToTensor(data);
    const {inputs, labels} = tensorData;

    await trainModel(model, inputs, labels);
    console.log('Model Training Complete');
}

async function getData() {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream('crypto_data.csv')
            .pipe(csvParser())
            .on('data', (data) => results.push(data))
            .on('end', () => {
                resolve(_.map(results, result => ({
                    price: Number(result.price),
                    timestamp: Number(result.timestamp) // Assuming you have a timestamp field
                })));
            });
    });
}

function createModel() {
    const model = tf.sequential();
    model.add(tf.layers.dense({inputShape: [1], units: 1, useBias: true}));
    model.add(tf.layers.dense({units: 1}));
    return model;
}

function convertToTensor(data) {
    return tf.tidy(() => {
        tf.util.shuffle(data);

        const inputs = data.map(d => d.timestamp);
        const labels = data.map(d => d.price);

        const inputTensor = tf.tensor2d(inputs, [inputs.length, 1]);
        const labelTensor = tf.tensor2d(labels, [labels.length, 1]);

        const inputMax = inputTensor.max();
        const inputMin = inputTensor.min();
        const labelMax = labelTensor.max();
        const labelMin = labelTensor.min();

        const normalizedInputs = inputTensor.sub(inputMin).div(inputMax.sub(inputMin));
        const normalizedLabels = labelTensor.sub(labelMin).div(labelMax.sub(labelMin));

        return {
            inputs: normalizedInputs,
            labels: normalizedLabels,
            inputMax,
            inputMin,
            labelMax,
            labelMin,
        };
    });
}

async function trainModel(model, inputs, labels) {
    model.compile({
        optimizer: tf.train.adam(),
        loss: tf.losses.meanSquaredError,
        metrics: ['mse'],
    });

    const batchSize = 32;
    const epochs = 50;

    return await model.fit(inputs, labels, {
        batchSize,
        epochs,
        shuffle: true,
        callbacks: tf.node.tensorBoard('/tmp/fit_logs_1')
    });
}

run().catch(console.error);
