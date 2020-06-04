
let dropArea = document.getElementById('drop-area');
let fileInput = document.getElementById('fileElem');
let selectedOrigin = "Velut"; // origin selected for floor
let selectedChromosome = 0; // displayed chromosome

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false)
});

function preventDefaults (e) {
    e.preventDefault();
    e.stopPropagation();
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false)
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false)
});

function highlight() {
    dropArea.classList.add('highlight');
}

function unhighlight() {
    dropArea.classList.remove('highlight');
}

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
    };
    reader.onerror = function (e) {
        alert("Echec de chargement du fichier");
    }
}

function resetgraph(){
    document.getElementById("graph").innerHTML = '';
}

/* PARSING DATA */

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
    while(i < data.length){

        let chr = data[i]["chr"];

        let fillingData = JSON.parse(JSON.stringify(data[i])); //deep copy

        fillingData["start"] = 0 + "";
        fillingData["end"] = parseInt(data[i]["start"] - 1) + "";
        data.splice(i, 0, fillingData);

        while(i < data.length && chr === data[i]["chr"] ){
            data[i]["avr"] = ((parseInt(data[i]["start"]) + parseInt(data[i]["end"])) / 2).toFixed(0) + "";
            i++;
        }
    }


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
                return {chr: d.chr, valeur: d[id],avr: d.avr};
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

    graphSetup2(groupedData);




}



function graphSetup(data) {


    // Rappel : data[Chromosome][origine].values[ligne de données]


    let visu = document.getElementById('visualisation');
    let style = getComputedStyle(visu);

    let marginLeft = parseInt(style.marginLeft);
    let marginRight = parseInt(style.marginRight);
    let marginTop = parseInt(style.marginTop);
    let marginBottom = parseInt(style.marginBottom);


    let vis = d3.select("#visualisation"),
        WIDTH = visu.clientWidth,
        HEIGHT = visu.clientHeight,
        MARGINS = {
            top: marginTop,
            right: marginRight,
            bottom: marginBottom,
            left: marginLeft
        },

        // création des échelles et du domaine de définition

        xScale = d3.scaleLinear().range([MARGINS.left, WIDTH - MARGINS.right]).domain([d3.min(data[0][0].values, function (d) {
            return d.x;
        }), d3.max(data[0][0].values, function (d) {
            return d.x;
        })]),

        yScale = d3.scaleLinear().range([HEIGHT - MARGINS.top, MARGINS.bottom]).domain([0,1]),

        xAxis = d3.axisBottom(xScale)
            .scale(xScale);

    yAxis = d3.axisLeft(yScale)
        .scale(yScale);


    // espace entre chaque légende

    let lSpace = HEIGHT/data[0].length;


    //placement des échelles dans notre svg

    vis.append("svg:g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + (HEIGHT - MARGINS.bottom) + ")")
        .call(xAxis);

    vis.append("svg:g")
        .attr("class", "axis")
        .attr("transform", "translate(" + (MARGINS.left) + ",0)")
        .call(yAxis);



    //création de notre générateur de courbe

    let lineGen = d3.line()
        .x(function(d) {
            return xScale(d.x);
        })
        .y(function(d) {
            return yScale(d.valeur);
        }).curve(d3.curveBasis);

    //itération sur toutes les origines de notre chromosome; data[chromosome][origine] et création d'une courbe pour chacune des origines. + application de couleur random


    data[0].forEach(function(d, i) {

        //création des courbes

        vis.append('svg:path')
            .attr('d', lineGen(d.values))
            .attr('stroke', function(d, j) {
                return "hsl(" + Math.random() * 360 + ",100%,50%)";
            })
            .attr('stroke-width', 2)
            .attr('id', 'line_' + d.key)
            .attr('fill', 'none');

        //legend

        vis.append("text")
            .attr("y", (lSpace / 2) + i * lSpace)
            .attr("x", WIDTH - (MARGINS.right - 20))
            .style("fill", "black")
            .attr("class", "legend")
            .text(d.key)
            .on('click', function() {
                let active = !d.active;
                let opacity = active ? 0 : 1;

                d3.select("#line_" + d.key).style("opacity", opacity);

                d.active = active;
            });

    });


}

function graphSetup2(data){


    window.accesData = data;


    let field = {
        'V' : ["Velut","#730800"],
        'T' : ["Texti","#ffff00"],
        'S' : ["Schiz","#660099"],
        'E' : ["Enset","#22780f"],
        'B' : ["Balbi","#000000"],
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

    let WIDTH = visu.clientWidth - marginLeft - marginRight;
    let HEIGHT = visu.clientHeight - marginTop - marginBottom;


    //création de notre svg qui sera notre container pour notre graphique

    let svg = d3.select("#graph").append("svg")
        .attr("width", (WIDTH + marginLeft) + marginRight)
        .attr("height", HEIGHT + marginTop + marginBottom)
        .append("g")
        .attr("transform", "translate(" + marginLeft + "," + marginTop + ")");


    //création d'un clip path, tout tracée hors de cet élement ne sera pas affiché (résout le pb des courbes dépassant les axes)

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


    //mise en place des axes des abscisse et du zoom.

    //y

    let y = d3.scaleLinear()
        .range([HEIGHT, 0])
        .domain([0,1.20]);


    let yAxis = d3.axisLeft()
        .scale(y);

    //x

    let x = d3.scaleLinear()
        .domain([572,50000000]) //TODO DYNAMIC DOMAIN
        .range([0, WIDTH]);

    let x2 = x.copy(); // reference.

    let zoom = d3.zoom()
        .scaleExtent([1, 10])
        .on("zoom", zoomed);

    d3.select("svg")
        .call(zoom);

    let xAxis = d3.axisBottom().scale(x);


    function zoomed() {
        x = d3.event.transform.rescaleX(x2);
        xAxis.scale(x);
        axisG.call(d3.axisBottom(x));
        fillgraph(selectedChromosome,data,lineGen,svg,field,field); //à chaque mouvement on redessine nos courbes.
    }


    //On place nos axes dans notre svg

    let axisG = svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + HEIGHT + ")")
        .call(xAxis)
        .attr("y", 6)
        .attr("dy", ".71em");

    svg.append("g")
        .attr("class", "y axis")
        .attr("id", "y axis")
        .call(yAxis)
        .append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .text("text-anchor","end");




    let lineGen = d3.line() //line generator
        .x(function(d) {
            return x(d.avr);
        })
        .y(function(d) {
            return y(d.valeur);
        });/*.curve(d3.curveBasis);*/


    // adding chr selector

    d3.select("#floorContainer").append("select").attr("id","chromosomeSelector")
        .on("change",function(){
            selectedChromosome = document.getElementById("chromosomeSelector").value;
            fillgraph(selectedChromosome,data,lineGen,svg,field);
            refreshFixedFloor(fixedFloorArray,selectedChromosome);
            refreshFloor(floorValueArray,selectedChromosome);
        });


    data.forEach(function(current_data,i){ //impossible d'utiliser .data() .enter() ici pour des raisons obscure.

        d3.select("#chromosomeSelector")
            .append("option")
            .text(current_data.key)
            .attr("value", i);
    });





    let legend = d3.select("#legend").selectAll('g')
        .data(data[selectedChromosome].values)
        .enter()
        .append('g')
        .attr('class', 'legend')
        .style("margin-bottom",""+((HEIGHT/field.length)/2)+"px");

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
            return field[d.key][1];
        });

    legend.append('text')
        .text(function(d) {
            return field[d.key][0];
        });

    legend.append('input')
        .attr("class","floor")
        .attr("type","number")
        .attr("step","0.001")
        .attr("max","1.20")
        .attr("min","0")
        .attr("value","0")
        .attr("id", function(d){
            return d.key;
        })
        .on("mousedown",function(){
            selectedOrigin = this.id;
        })
        .on("change",function(){
            //x = (y-4) * [1 - (z/1.20)]
            origine = getKeyByValue(field,selectedOrigin);
            floorValueArray["chr"+selectedChromosome][selectedOrigin] = this.value;
            refreshFloor(floorValueArray,selectedChromosome);
            let z = (yHeight-4) * (1 - (this.value/1.20)); // mouse position == mouse[1]
            let d = "M" + z + "," + WIDTH;
            d += " " + z + "," + 0;
            fixedFloorArray["chr"+selectedChromosome][selectedOrigin] = d;
            refreshFixedFloor(fixedFloorArray,selectedChromosome);
        });

    document.getElementsByClassName("legend")[0].classList.add("clicked"); //ajout de la class clicked au premier node de la classe legend.


    svg.select("#graphlimit").selectAll(".chromosome")
        .data(data) // nombre de <g id="chrx"> </g> qui vont être crée (1 par chromosome) utile pour le selecteur.
        .enter()
        .append("g")
        .attr("id", function(d,i){
            return "chr" + i; //chr de 1 à 11
        })
        .attr("class","chromosome");

    fillgraph(selectedChromosome,data,lineGen,svg,field);

    let mouseG = svg.append("g")
        .attr("class", "mouse-over-effects");

    mouseG.append("path") // ligne vertical noir.
        .attr("class", "mouse-line")
        .style("stroke", "black")
        .style("stroke-width", "1px")
        .style("opacity", "0")
        .style("transform", "rotate(90deg) translate(0,-"+ WIDTH + "px)");

    mouseG.append("text")
        .attr("class","y-value");


    let yHeight = document.getElementById("y axis").firstChild.getBoundingClientRect().height; //retrouver la taille en px du df de y
    let origine = getKeyByValue(field,selectedOrigin); //getKeyByValue(filed,"Velut") retourne "V"
    inputSetup(); //place les inputs pour les seuils
    let fixedFloorArray = fixedFloorArraySetup(); // crée le dico qui contiendra les positions pour les seuils fixe (ligne en pointillé)
    let floorValueArray = fixedFloorArraySetup(); // crée le même dico mais avec les valeurs des seuils (0.5,0.25,...)
    console.log(floorValueArray);
    fixedFloorSetup(fixedFloorArray,mouseG,WIDTH,field); // crée les lignes en pointillé (ainsi que le conteneur) selon le dico crée au dessus.



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
                .text((1.20 * (1-(mouse[1]/(yHeight-4)))).toFixed(3)); //afficher au dessus de la ligne du tooltip la valeur de y
        })
        .on("click", function () {
            let mouse = d3.mouse(this);
            origine = getKeyByValue(field,selectedOrigin);
            //1.20 * [1 - (x/(y-4))]
            floorValueArray["chr"+selectedChromosome][origine] = (1.20 * (1-(mouse[1]/(yHeight-4)))).toFixed(3); //Ajout de la valeur du seuil à notre FloorValueArray à l'index correspondant à l'origine actuellement séléctioné (selectedOrigin)
            refreshFloor(floorValueArray,selectedChromosome);


            //display fixed Floor (dashed line) :

            fixedFloorArray["chr"+selectedChromosome][origine] = document.getElementsByClassName("mouse-line")[0].attributes.d.value; //update fixedFloorArray with the value clicked

            refreshFixedFloor(fixedFloorArray,selectedChromosome); //As soon as our array is up to date we call this to refresh our dashed lines, this function will set opacity to 1 for a dashed line if a value in our current chromosome is != 0.

        });

}


function inputSetup(){
    let legend = document.getElementById("legend");
    for (let i = 0; i < legend.children.length; i++) {
        legend.children[i].addEventListener("click",function(){
            selectedOrigin = legend.children[i].innerText;
            for (let j = 0; j < legend.children.length; j++) {
                legend.children[j].classList.remove("clicked");
            }
            legend.children[i].classList.add("clicked");
        });
        legend.children[i].addEventListener("mouseover", function () {
            legend.children[i].style.backgroundColor = "#dbdbdb"
        });
        legend.children[i].addEventListener("mouseout", function () {
            legend.children[i].style.backgroundColor = "#ccc"
        });
    }

}

function getKeyByValue(object, value) {
    return Object.keys(object).find(key => object[key][0] === value); //object[key][0] car field est sous la forme key => ["nom","color"] ici c'est le nom que nous voulons.
}

function fillgraph(idChromosome,data,lineGen,svg,field){

    d3.selectAll(".line").remove();

    for(let chromosome of document.getElementsByClassName("chromosome") ){
        if(chromosome.id !== "chr" + idChromosome) {
            chromosome.style.display = "none";
        }else{
            chromosome.style.display = "block";
        }
    }

    let currentChromosome = svg.select("#chr" + idChromosome);

    data[idChromosome].values.forEach(function(d) {
        currentChromosome.append('path')
            .attr("class", "line")
            .attr("ancestor",function(){
                return d.key;
            })
            .attr('d', lineGen(d.values))
            .style('stroke', function() {
                return field[d.key][1];
            })
            .attr('stroke-width', 2)
            .attr('fill', 'none');
    });
}

function refreshFloor(floorValueArray,selectedChromosome){
    let input;

    Object.keys(floorValueArray).forEach(function(chromosomeKey) {

        if(chromosomeKey === "chr" + selectedChromosome) {
            console.log(floorValueArray);
            Object.keys(floorValueArray[chromosomeKey]).forEach(function (origineKey) {
                console.log(origineKey);
                input = document.getElementById(origineKey);
                input.value = floorValueArray[chromosomeKey][origineKey];

            });
        }
    });

    //fixedFloorArray["chr"+chr] = floorValueArray;


}


function curveOpacitySetup(){ //TODO USE d3 .on TO ADD EVENT INSTEAD OF THIS
    let displayedCurveClass = document.getElementsByClassName("displayedCurve");
    for (let checkbox of displayedCurveClass){
        checkbox.addEventListener("click",function(){
            refreshCurveOpacity();
        });
    }
}

function refreshCurveOpacity(){

    let displayedCurveClass = document.getElementsByClassName("displayedCurve");
    let curves = document.getElementsByClassName("line");


    for(let checkbox of displayedCurveClass){
        if(checkbox.checked){
            for (let curve of curves ) {
                if(checkbox.name === curve.attributes.ancestor.value){
                    curve.style.opacity = 1;
                }
            }
        }else{
            for (let curve of curves ) {
                if(checkbox.name === curve.attributes.ancestor.value){
                    curve.style.opacity = 0;
                }
            }
        }
    }


}

function fixedFloorArraySetup() {
    let lines = document.getElementsByClassName("line");
    let chromosomes = document.getElementsByClassName("chromosome");

    let i = 0;

    let fixedFloorArray = {};

    for (let chromosome of chromosomes) {

        fixedFloorArray[chromosome.id] = {};

        for (let line of lines) {
            fixedFloorArray[chromosome.id][line.attributes.ancestor.value] = 0;
        }
        i++;
    }
    return fixedFloorArray;

}

function fixedFloorSetup(fixedFloorArray, mouseG, WIDTH,field){
    Object.keys(fixedFloorArray).forEach(function(chromosomeKey) {

        let chrGroup = mouseG.append("g")
            .attr("id","FF" + chromosomeKey); //FixedFloor

        Object.keys(fixedFloorArray[chromosomeKey]).forEach(function(origineKey) {


            chrGroup.append("path") // ligne vertical noir.
                .attr("id","fixedFloor_" + chromosomeKey +"_"+ origineKey)
                .attr("d", 0)
                .style("stroke", field[origineKey][1])
                .style("stroke-width", "1px")
                .style("opacity", "0")
                .style("stroke-dasharray", "4")
                .style("transform", "rotate(90deg) translate(0,-" + WIDTH + "px)");


        });
    });

}
/* l'idée ici est d'afficher et de positionner les seuils fixé (ligne pointillé) notre dico (fixedFloorArray) à la même structure que nos éléments
* à savoir, fixedFloorArray[chromosome][origine] => valeur
* et pour nos éléments :
*<g id="chromosome1">
*   <path id="Velut" >...</path>
*   <path id="Schiz" >...</paht>
*   [...]
*
*
* <g>
* <g id="chromosome2">[...]</g>
*
*
*/

function refreshFixedFloor(fixedFloorArray,selectedChromosome){

    Object.keys(fixedFloorArray).forEach(function(chromosomeKey) {

        if(chromosomeKey === "chr" + selectedChromosome){

            Object.keys(fixedFloorArray[chromosomeKey]).forEach(function(origineKey) {

                if(fixedFloorArray[chromosomeKey][origineKey] !== 0){

                    d3.select("#fixedFloor_" + chromosomeKey +"_"+ origineKey)
                        .attr("d", fixedFloorArray[chromosomeKey][origineKey])
                        .style("opacity",1);
                }

            });
        }else{
            Object.keys(fixedFloorArray[chromosomeKey]).forEach(function(origineKey) {
                d3.select("#fixedFloor_" + chromosomeKey +"_"+ origineKey)
                    .style("opacity",0);
            });
        }

    });

}