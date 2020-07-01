export function parsingColor(colorFile){

    let colorMap = {};

    colorFile.map(function(cur){
        colorMap[cur.group] = [cur.name,cur.hex];
    });

    return colorMap;
}


export function randomColorGenerator(data){

    let colorMap = {};

    data.map(function(cur){
        cur.values.map(function(origine) {
            if (colorMap[origine["key"]] === undefined) {
                let color = "#" + Math.floor(Math.random() * 16777215).toString(16);
                colorMap[origine["key"]] = [origine["key"], color]
            }
        });
    });

    return colorMap;
}

export function parsingLen(lenFile){

    const chromatide = 2;

    /*
    what we want :

    #chromosome	arm	bp_start	bp_stop

    1	p	0	18972949
    1	q	18972949	37945898
    2   p   ...

    what we have :

    chr	len	centromereInf	centromereSup

    chr01	37945898	25000000	27000000
    chr02	34728925	08000000	11000000

    */

    let field = ["#chromosome","arm","bp_start","bp_stop"];

    let block = [];
    block.push(field);

    let line = [];

    lenFile.map(function(cur){

        for (let i = 0; i < chromatide; i++) {

            let ctrSup = cur["centromereSup"];
            let ctrInf = cur["centromereInf"];

            line.push(parseInt(cur["chr"].replace("chr",""))); //chr
            //arm
            if(ctrSup === "" && ctrInf === "" && i === (chromatide-2)){
                line.push("p");
                line.push("0");
                line.push(parseInt(cur["len"]/2));
            }else if(ctrSup === "" && ctrInf === "" && i === (chromatide-1)){
                line.push("q");
                line.push(parseInt(cur["len"]/2));
                line.push(cur["len"]);
            }else if(ctrInf !== "" && ctrSup === "" && i === (chromatide-2)){
                line.push("p");
                line.push("0");
                line.push(ctrInf);
            }else if(ctrInf !== "" && ctrSup === "" && i === (chromatide-1)){
                line.push("q");
                line.push(ctrInf);
                line.push(cur["len"]);
            }else if(ctrSup !== "" && ctrInf === "" && i === (chromatide-2)){
                line.push("p");
                line.push("0");
                line.push(ctrSup);
            }else if(ctrSup !== "" && ctrInf === "" && i === (chromatide-1)) {
                line.push("q");
                line.push(ctrSup);
                line.push(cur["len"]);
            }else if(ctrSup !== "" && ctrInf !== "" && i === (chromatide-2)){
                line.push("p");
                line.push("0");
                line.push(parseFloat((parseInt(ctrSup) + parseInt(ctrInf))/2)+"");
            }else if(ctrSup !== "" && ctrInf !== "" && i === (chromatide-1)){
                line.push("q");
                line.push(parseFloat((parseInt(ctrSup) + parseInt(ctrInf))/2)+"");
                line.push(cur["len"])
            }

            block.push(line);
            line = [];
        }
    });

    let result = [];

    block.map(function(each){
        result.push(each.join("\t"));
    });

    let tsv = "";

    result.map(function (each) {
       tsv = tsv + each + "\n";
    });

    sendFile(tsv); //send to server


}

function sendFile(tsv){

    $.ajax({
        url: "http://localhost:8000/upload",
        data: {
            "data":JSON.stringify(tsv)
        },
        cache: false,
        type: "POST",
        timeout: 5000,
        complete: function() {
            //called when complete
            console.log('process complete');
        },

        success: function(data) {
            console.log(data);
            console.log('process sucess');
        },

        error: function() {
            console.log('process error');
        },
    });

    customGenom()
}

function customGenom(){
    $.ajax({
        type: 'GET',
        url: 'http://localhost:8000/run_convert_band_data.py',
    });
}

export function dataStuffing(data,chrConfig){

    /*Ajout de ligne factice ayant pour but de remplir les trous dans nos données (avoir des données pour toutes les positions de 0 à celle de fin du chromosome)
    * On ajoute également un champ average("avr") qui fait la moyenne entre le début("start") et la fin("end") dans chaque ligne de données.
    * */

    let i = 0;
    let borneInf = 0;
    while(i < data.length){

        borneInf = 0;

        let chr = data[i]["chr"];

        let len = 0;

        for (let j = 0; j < chrConfig.length; j++) {
            if(chrConfig[j]["chr"] === chr){
                len = chrConfig[j]["len"];
            }
        }

        while(i < data.length && chr === data[i]["chr"] ){

            let dataStuff = JSON.parse(JSON.stringify(data[i]));

            if(parseInt(data[i]["start"]) - borneInf !== 0){

                dataStuff["start"] = borneInf + "";
                dataStuff["end"] = parseInt(data[i]["start"]) + "";
                borneInf = parseInt(dataStuff["end"]);
                dataStuff["avr"] = (((parseInt(dataStuff["start"]) + parseInt(dataStuff["end"])) / 2).toFixed(0)) + "";
                data.splice(i, 0, dataStuff);

            }else {

                borneInf = parseInt(data[i]["end"]);
                data[i]["avr"] = (((parseInt(data[i]["start"]) + parseInt(data[i]["end"])) / 2).toFixed(0)) + "";

            }
            i++;
        }
        let lastDataLine = JSON.parse(JSON.stringify(data[i-1]));
        lastDataLine["start"] = lastDataLine["end"];
        lastDataLine["end"] = len;
        data.splice(i, 0, lastDataLine);
        i++; //On a ajouté une ligne alors on avance l'itérateur.
    }

    return data;

}

/**
 * cette fonction sert à travailler les données,
 * il est préférable de les avoir sous la forme d'un tableau dont chaque case correspond à un graphique.
 * maquette : data[graphique(ch0,chr1,...)][courbe(Velut,Schiz,...)]
 * les données sont trié par chromosome puis par origine
 * @param data un tableau contenant nos données.
 */

export function parsingData(data){

    /*
    mappage (si ça se dit?) des données pour faire en sorte que les origines(A_m..) ne soient plus des colonnes mais des champs dans les lignes de données
    et qu'une valeur leur soit associée
    on en profite pour enlever les colonnes start et end qui ne nous servent pas pour la suite. (on peut facilement les remettre si besoins
    pour les mosaïques)
    */

    let dataByOrigin = data.columns.slice(3).map(function (id) {
        return {
            id: id,
            values: data.map(function (d) {
                return {chr: d.chr, valeur: parseFloat(d[id]),avr: parseFloat(d.avr)};
            })
        };
    });


    let parsedData = [];

    /*
    ajout des origines (A_m, A_z..)(initialement id du tableau) dans les lignes de données
    Le tout est mis à la suite dans un nouveau tableau (parsedData)
    */

    for(let ancestors of dataByOrigin){
        for(let line of ancestors.values){
            line["origine"] = ancestors.id;
            parsedData.push(line);
        }
    }

    /* Ce qui nous permet d'utiliser la fonction D3.nest pour grouper nos données sur deux niveaux, d'abord par chromosome(chr1...) puis par origine(V...).*/

    let groupedData = d3.nest()
        .key(function(d) { return d.chr; })
        .key(function(d) { return d.origine; })
        .entries(parsedData);


    /*
     * le tableau groupedData est sous la forme suivante :
     * GroupedData[Chromosome].values[origine].values[ligne de données]
     * chaque ligne de données est sous la forme suivante :
     * chromosome(chr1,chr2...) - origine(A_m,A_z...) - valeur(0.50,0.20,...) - avr(9000,3000000,...)
     */
    return groupedData;

}

