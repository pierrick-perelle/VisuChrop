const fs = require('fs');
const express = require('express');
const app = express();
const bodyParser = require("body-parser");

const path = require('path');

app.use(bodyParser.urlencoded({extended: true})); //je crois que ça me permet de lire le body de ma requête ajax dans parse.js sendFile()..
app.use(bodyParser.json()); //donc je le laisse là.
app.use(express.static(__dirname));

app.get('/',function(req,res) {
    res.sendFile(path.join(__dirname+'/index.html'));
});

app.get('/run_convert_band_data.py', (req, res) => {

    let dataToSend;

    let spawn = require("child_process").spawn;
    let python = spawn('python', ["python/convert_band_data.py"]);
    // spawn new child process to call the python script
    // collect data from script
    python.stdout.on('data', function (data) {
        console.log('Pipe data from python script ...');
        dataToSend = data.toString();
    });
    // in close event we are sure that stream from child process is closed
    python.on('close', (code) => {
        console.log(`child process close all stdio with code ${code}`);
        console.log(dataToSend);
        // send data to browser
        res.send(dataToSend)
    });

});

app.post('/upload', function(req, res){

    data = JSON.stringify(req.body.data);

    fs.writeFile('data/bands/ncbi/musa-acuminata.tsv', JSON.parse(req.body.data), function (err) {
        if (err) return console.log(err);
        console.log("musa-acuminata.tsv uploaded to : data/bands/ncbi/");
    });

    res.contentType('string');
    res.send("Apparement je dois répondre quelque chose à ma requête ajax.. alors je pose ça là : 'Lourd est le parpaing de la réalité sur la tartelette aux fraises de nos illusions.' - Boulet");
});



server=app.listen(8000,function() {});
