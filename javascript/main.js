
import {resetgraph, showupConfig} from "./import";

let dropArea = document.getElementById('drop-area');
let fileInput = document.getElementById('fileElem');
let data;

////////////RECUPERATION DU FICHIER///////////////////////////////

dropArea.addEventListener('drop', handleDrop, false);
fileInput.addEventListener('change',function(){
    handleFiles(this.files);
});

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;

    handleFiles(files)
}

function handleFiles(files) {
    resetgraph();
    let reader = new FileReader();
    let file = files[0];
    reader.readAsText(file, "UTF-8");
    reader.onload = function (e) {
        data = d3.tsvParse(e.target.result);
        parsing(data);
        showupConfig();
    };
    reader.onerror = function (e) {
        alert("Echec de chargement du fichier");
    }
}

////////////////////PARSING DES DONNEES////////////////////////////////

let rawData = [];

/**
 * cette fonction sert à travailler les données,
 * il est préférable de les avoir sous la forme d'un tableau dont chaque case correspond à un graphique.
 * maquette : data[graphique(ch0,chr1,...)][courbe(Velut,Schiz,...)]
 * les données sont trié par chromosome puis par origine
 * @param data un tableau contenant nos données.
 */

function parsing(data){


    /* Ajout d'une ligne de données factice qui va de la position 0 à la position de début('start') de la première vrai ligne de données (pour chaque chromosome)
    * On ajoute également un champ average("avr") qui fait la moyenne entre le début("start") et la fin("end") dans chaque ligne de données.
    * */

    let i = 0;
    let borneInf = 0;
    while(i < data.length){

        borneInf = 0;

        let chr = data[i]["chr"];

        while(i < data.length && chr === data[i]["chr"] ){

            let dataStuffing = JSON.parse(JSON.stringify(data[i]));

            if(parseInt(data[i]["start"]) - borneInf !== 1){

                dataStuffing["start"] = borneInf + "";
                dataStuffing["end"] = (parseInt(data[i]["start"] - 1)) + "";
                borneInf = dataStuffing["end"];
                dataStuffing["avr"] = (((parseInt(dataStuffing["start"]) + parseInt(dataStuffing["end"])) / 2).toFixed(0)) + "";
                data.splice(i, 0, dataStuffing);

            }else {

                borneInf = parseInt(data[i]["end"]);
                data[i]["avr"] = (((parseInt(data[i]["start"]) + parseInt(data[i]["end"])) / 2).toFixed(0)) + "";

            }
            i++;
        }
    }

    rawData = data;

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

    graphSetup(groupedData);

}

///////////////////////CREATION DU GRAPHIQUE//////////////////////////////////////

import {inputSetup, getKeyByValue, refreshFloor, curveOpacitySetup, refreshCurveOpacity, arraySetup, floorPositionsSetup, refreshfloorPositions, tracerCourbe} from "./graph";

let selectedOrigin = "Velut"; // origin selected for floor
let selectedChromosome = 0; // displayed chromosome
let haplotype = 2;
let WIDTH = 0;
let HEIGHT = 0;

function graphSetup(data){


    let ancestors = {
        'V' : ["Velut","#730800"],
        'T' : ["Texti","#ffff00"],
        'S' : ["Schiz","#660099"],
        'E' : ["Enset","#22780f"],
        'B' : ["Balbi","#FFFFFF"],
        'A_z' : ["Zebri","#ff0000"],
        'A_u' : ["Sumsat","#1034a6"],
        'A_s' : ["Bursa","#ef9b0f"],
        'A_m' : ["Malac","#0000ff"],
        'A_j' : ["PJB","#ff00ff"],
        'A_b' : ["Banks","#00ff00"],
    };


    let visu = document.getElementById('graph');


    let style = getComputedStyle(visu);

    let marginLeft = parseInt(style.marginLeft);
    let marginRight = parseInt(style.marginRight);
    let marginTop = parseInt(style.marginTop);
    let marginBottom = parseInt(style.marginBottom);

    WIDTH = visu.clientWidth - marginLeft - marginRight;
    HEIGHT = visu.clientHeight - marginTop - marginBottom;


    //création de notre svg qui sera notre container pour notre graphique

    let svg = d3.select("#graph").append("svg")
        .attr("width", (WIDTH + marginLeft) + marginRight)
        .attr("height", HEIGHT + marginTop + marginBottom)
        .append("g")
        .attr("transform", "translate(" + marginLeft + "," + marginTop + ")");


    //création d'un clip path, tout tracée hors de cet élement ne sera pas affiché (résout le pb des courbes dépassant les axes lors du zoom)

    svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", WIDTH )
        .attr("height", HEIGHT )
        .attr("x", 0)
        .attr("y", 0);

    svg.append('g')
        .attr("id","graphlimit")
        .attr("clip-path", "url(#clip)");


    //mise en place des axes et du zoom.

    //y

    let y = d3.scaleLinear()
        .range([HEIGHT, 0])
        .domain([0,1]);


    let yAxis = d3.axisLeft()
        .scale(y);

    //x

    let x = d3.scaleLinear()
        .domain([0,d3.max(data[selectedChromosome].values[0].values, function (d) {
            return d.avr;
        })])
        .range([0, WIDTH]);

    let xAxis = d3.axisBottom()
        .scale(x);

    let x2 = x.copy();

    let zoom = d3.zoom()
        .scaleExtent([1, 10])
        .on("zoom", zoomed);

    d3.select("svg")
        .call(zoom);

    function zoomed() {
        x = d3.event.transform.rescaleX(x2);
        xAxis.scale(x);
        axisG.call(d3.axisBottom(x));
        tracerCourbe(selectedChromosome,data,lineGen,svg,ancestors,ancestors); //à chaque mouvement on redessine nos courbes.
    }


    //On place nos axes dans notre svg

    let axisG = svg.append("g")
        .attr("id", "xaxis")
        .attr("transform", "translate(0," + HEIGHT + ")")
        .call(xAxis)
        .style("color", "white")
        .attr("y", 6)
        .attr("dy", ".71em");


    svg.append("g")
        .attr("id", "yaxis")
        .call(yAxis)
        .style("color", "white")
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .text("Valeur de l'origine");


    //déclaration de notre générateur de courbe

    let lineGen = d3.line()
        .x(function(d) {
            return x(d.avr);
        })
        .y(function(d) {
            return y(d.valeur);
        });/*.curve(d3.curveBasis);*/


    //Création du selecteur de chromosome (dropdown)

    d3.select("#floorContainer").append("select").attr("id","chromosomeSelector")
        .style("margin-top","10%")
        .on("change",function(){
            selectedChromosome = document.getElementById("chromosomeSelector").value;
            refreshfloorPositions(floorPositions,selectedChromosome);
            refreshFloor(floorValues,selectedChromosome);
            refreshCurveOpacity();

            tracerCourbe(selectedChromosome,data,lineGen,svg,ancestors);
        });


    data.forEach(function(current_data,i){ //impossible d'utiliser .data() .enter() ici pour des raisons obscure.

        d3.select("#chromosomeSelector")
            .append("option")
            .text(current_data.key)
            .attr("value", i);
    });


    //Création d'une légende pour chaque origine (ainsi que des inputs dedans seuil, affichage etc)

    let legend = d3.select("#floorContainer").append("div").attr("id","legend").selectAll('g')
        .data(data[selectedChromosome].values)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .style("margin-bottom",""+((HEIGHT/ancestors.length)/2)+"px");

    legend.append('input')
        .attr("class","displayedCurve")
        .attr("type","checkbox")
        .attr("checked","")
        .attr("name",function(d){
            return d.key;
        });

    curveOpacitySetup();

    legend.append('div')
        .attr("class","color")
        .style("background-color",function(d){
            return ancestors[d.key][1];
        });

    legend.append('text')
        .text(function(d) {
            return ancestors[d.key][0];
        });

    legend.append('input')
        .attr("class","floor")
        .attr("type","number")
        .attr("step","0.001")
        .attr("max","1.20")
        .attr("min","0.1")
        .attr("value",1/haplotype)
        .attr("id", function(d){
            return d.key;
        })
        .on("mousedown",function(){
            selectedOrigin = ancestors[this.id][0];
        })
        .on("change",function(){
            //x = (y-4) * [1 - (z/1.20)]
            origine = getKeyByValue(ancestors,selectedOrigin);
            floorValues[origine] = parseFloat(this.value);
            refreshFloor(floorValues,selectedChromosome);
            let z = (yHeight-4) * (1 - (this.value/1)); // mouse position == mouse[1]
            let d = "M" + z + "," + WIDTH;
            d += " " + z + "," + 0;
            floorPositions[origine] = d;
            refreshfloorPositions(floorPositions,selectedChromosome);
            mosaique(floorValues,data,ancestors);
        });

    document.getElementsByClassName("legend")[0].classList.add("clicked"); //ajout de la class clicked au premier node de la classe legend.

    inputSetup(); //Ajout de nos eventListener sur les légendes les checkbox, les seuils etc..

    //Tout est prêt pour tracer nos courbes.

    tracerCourbe(selectedChromosome,data,lineGen,svg,ancestors);

    //A partir d'ici c'est l'ajout des tooltips, des seuils et de leurs intéractions

    let mouseG = svg.append("g")
        .attr("class", "mouse-over-effects");

    mouseG.append("path") // ligne vertical noir.
        .attr("class", "mouse-line")
        .style("stroke", "white")
        .style("stroke-width", "1px")
        .style("opacity", "0")
        .style("transform", "rotate(90deg) translate(0,-"+ WIDTH + "px)");

    mouseG.append("text")
        .style("stroke","white")
        .style("fill","white")
        .attr("class","y-value");


    let yHeight = document.getElementById("yaxis").firstChild.getBoundingClientRect().height; //retrouver la taille en px du df de y
    let origine = getKeyByValue(ancestors,selectedOrigin); //getKeyByValue(filed,"Velut") retourne "V"
    let floorPositions = arraySetup(haplotype); // crée le dico qui contiendra les positions pour les seuils fixe (ligne en pointillé)
    let floorValues = arraySetup(haplotype); // crée le même dico mais avec les valeurs des seuils (0.5,0.25,...)
    floorPositionsSetup(floorPositions,mouseG,WIDTH,ancestors,yHeight); // crée les lignes en pointillé (ainsi que le conteneur) selon le dico crée au dessus.


    mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
        .attr('width', WIDTH) // can't catch mouse events on a g element
        .attr('height', yHeight-4)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mouseout', function() { // on mouse out hide line
            d3.select(".mouse-line")
                .style("opacity", "0");
            d3.select(".y-value")
                .style("opacity", "0");
        })
        .on('mouseover', function() { // on mouse in show line
            d3.select(".mouse-line")
                .style("opacity", "1");
            d3.select(".y-value")
                .style("opacity", "1");
        })
        .on('mousemove', function() { // mouse moving over canvas
            let mouse = d3.mouse(this);
            d3.select(".mouse-line")
                .attr("d", function() {
                    let d = "M" + mouse[1] + "," + WIDTH;
                    d += " " + mouse[1] + "," + 0;
                    return d;
                });
            d3.select(".y-value")
                .attr("transform",function() {
                    return "translate(" + 10 + "," + (mouse[1] - 10) + ")";
                })
                .text((1-(mouse[1]/(yHeight-4))).toFixed(3)); //afficher au dessus de la ligne du tooltip la valeur de y
        })
        .on("click", function () {
            let mouse = d3.mouse(this);
            origine = getKeyByValue(ancestors,selectedOrigin);
            //1.20 * [1 - (x/(y-4))]
            floorValues[origine] = parseFloat((1-(mouse[1]/(yHeight-4))).toFixed(3)); //Ajout de la valeur du seuil à notre FloorValueArray à l'index correspondant à l'origine actuellement séléctioné (selectedOrigin)
            refreshFloor(floorValues,selectedChromosome);


            //display fixed Floor (dashed line) :

            floorPositions[origine] = document.getElementsByClassName("mouse-line")[0].attributes.d.value; //update floorPositions with the value clicked

            refreshfloorPositions(floorPositions,selectedChromosome); //As soon as our array is up to date we call this to refresh our dashed lines, this function will set opacity to 1 for a dashed line if a value in our current chromosome is != 0.

            mosaique(floorValues,data,ancestors);
        });
    refreshfloorPositions(floorPositions,selectedChromosome);
    mosaique(floorValues,data,ancestors);
}

///////////////////CREATION DES DONNEES ET SETUP POUR IDEOGRAM///////////////////////

import {order, convertStrtoRangeSet, groupByColor} from "./mosaique";


function mosaique(floorValue,data,field){


    /*
    1 0 0 200000 #7DC7D2
    1 0 200001 400000 #7AA1D2
    1 0 400001 600000 #7AA1D2
    1 0 600001 800000 #BCE2CA
    1 0 800001 1000000 #7AA1D2
    1 0 1000001 1200000 #7AA1D2
    1 0 1200001 1400000 #7DC7D2
     */

    console.log(floorValue);
    console.log(data);

    // préparation du tableau pour le bloc idéogramme

    let mosaique = [];

    for (let i = 0; i < rawData.length; i++) {
        mosaique.push([]);
    }

    let metaBlocks = [];
    let block = [];
    let chrStr = "chr";
    let originalChrNumber = "";
    let countHaplotype = 0;

    for (let i = 0; i < mosaique.length; i++) {

        originalChrNumber = rawData[i]["chr"].replace(/chr/g,"");

        Object.keys(floorValue).forEach(function(origineKey) {

            if(countHaplotype !== -1) {

                //Si pour la valeur de l'origine courante le seuil est dépassé, (détéction d'une dose) et qu'il reste un haplotype à alouer alors j'ajoute une ligne dans mon block
                if (rawData[i][origineKey] >= floorValue[origineKey] && countHaplotype < haplotype) {

                    for (let j = 0; j <= haplotype - countHaplotype; j++) {
                        if(rawData[i][origineKey] >= (floorValue[origineKey]*(j+1)) && countHaplotype < haplotype){
                            block.push([originalChrNumber, countHaplotype, parseInt(rawData[i]["start"]), parseInt(rawData[i]["end"]), field[origineKey][1],'\n']);
                            countHaplotype++;
                        }
                    }

                }

                //Si une dose est détécté mais que plus d'haplotype dispo je met tout le block en gris.
                else if (rawData[i][origineKey] >= floorValue[origineKey] && countHaplotype >= haplotype) {
                    block = []; //reset block
                    for (let j = 0; j < haplotype; j++) {
                        block.push([originalChrNumber, j, parseInt(rawData[i]["start"]), parseInt(rawData[i]["end"]), "#808080",'\n']);
                    }
                    countHaplotype = -1;
                }

            }

        });

        //Si à la fin de la recherche de dose il reste de la place je la remplie avec du gris.
        if(block.length < haplotype){
            let emplacementRestant = haplotype - block.length;
            for (let j = 0; j < emplacementRestant; j++) {
                block.push([originalChrNumber,countHaplotype,parseInt(rawData[i]["start"]),parseInt(rawData[i]["end"]),"#808080",'\n']);
                countHaplotype++;
            }
        }

        countHaplotype = 0;
        metaBlocks.push(block);
        block = [];
        chrStr = "chr";

    }

    let groupedBlock = groupByColor(metaBlocks);
    groupedBlock = order(groupedBlock,haplotype);

    metaBlocks = [];
    for (let block of groupedBlock){
        metaBlocks.push(block.flat(1));
    }


    let strMosaique = metaBlocks.join(" ").replace(/,/g,' ');
    strMosaique = strMosaique.replace(/^ +/gm,"");

    dl.href="data:text/plain,"+encodeURIComponent(strMosaique);


    ideogramConfig(strMosaique,haplotype);

}


function ideogramConfig(mosaique){

    let dataSet = convertStrtoRangeSet(mosaique);

    let config = {
        rotatable:false,
        orientation: 'horizontal',
        organism: 'banana',
        ploidy: haplotype,
        dataDir: "./config/",
        container: "#box4",
        rangeSet: dataSet,
        chrMargin: 0,
        chrHeight: WIDTH*1.1,
        chrWidth: HEIGHT/50,
    };

    let ideogram = new Ideogram(config);

}