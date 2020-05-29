
let dropArea = document.getElementById('drop-area');
let fileInput = document.getElementById('fileElem');
let originSelector = "Velut";

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
 * les données sont trié par chromosome
 * @param data un tableau contenant nos données.
 */

function parsing(data){

    console.log(data);

    /* Ajout d'un x qui servira d'abscisse sur chaque lignes de données */


    let i = 0;
    while(i < data.length){

        let chr = data[i]["chr"];

        let fillingData = JSON.parse(JSON.stringify(data[i])); //deep copy

        fillingData["start"] = 0 + "";
        fillingData["end"] = parseInt(data[i]["start"] - 1) + "";
        data.splice(i, 0, fillingData);

        while(i < data.length && chr === data[i]["chr"] ){
           //console.log(parseInt(data[i]["start"]) + " + " + parseInt(data[i]["end"]) + "/ 2 " + " = " + ((parseInt(data[i]["start"]) + parseInt(data[i]["end"])) / 2).toFixed(0) + "");
            data[i]["avr"] = ((parseInt(data[i]["start"]) + parseInt(data[i]["end"])) / 2).toFixed(0) + "";
            i++;
        }
    }


    /*
    mappage (si ça se dit?) des données pour faire en sorte que les origines(A_m..) ne soient plus des colonnes mais des champs dans les lignes de données
    * et qu'une valeur leur soit associée
    *(on en profite pour enlever les colonnes start et end qui ne nous servent pas pour la suite. (on peut facilement les remettre si besoins
    * pour les mosaïques)
    * */

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
    * ajout des origines (A_m, A_z..)(initialement id du tableau) dans les lignes de données
    * Le tout est mis à la suite dans un nouveau tableau (parsedData)
    * */

    for(let ancestors of dataByOrigin){
        for(let line of ancestors.values){
            line["origine"] = ancestors.id;
            parsedData.push(line);
        }
    }

    /* Ce qui nous permet d'utiliser la fonction D3.nest pour grouper nos données par chromosome */

    let groupedData = d3.nest()
        .key(function(d) { return d.chr; })
        .entries(parsedData);




    /* le tableau groupedData est sous la forme suivante :
        GroupedData[Chromosome].values[ligne de données]
        chaque ligne de données est sous la forme suivante :
        chromosome(<- useless) - origine(A_m,A_z...) - valeur(0.50,0.20,...) - x(notre abscisse)
     */

    //console.log(groupedData);

    /* On réutilise la fonction d3.nest pour trier par origine (A_m,..) chaque sous tableau (GroupedData[Chromosome])*/

    let dataGroup = [];

    for (let j = 0; j < groupedData.length-1; j++) {
        dataGroup.push(d3.nest()
            .key(function(d) {
                return d.origine;
            })
            .entries(groupedData[j].values));
    }


    /*les données sont maintenant sous la forme :
    * dataGroup[Chromosome][origine].values[la ligne de données]
    * chaque ligne de données est sous la forme suivante :
    * chromosome(<- useless) - origine(A_m,A_z...) - valeur(0.50,0.20,...) - x(notre abscisse)
    * */

    graphSetup2(dataGroup);




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

        console.log(visu.clientWidth);

    });


}

function graphSetup2(data){

    window.accesData = data;

    let chr = 0; //displayed chromosome

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

    console.log(data);

    let visu = document.getElementById('graph');


    let style = getComputedStyle(visu);

    let marginLeft = parseInt(style.marginLeft);
    let marginRight = parseInt(style.marginRight);
    let marginTop = parseInt(style.marginTop);
    let marginBottom = parseInt(style.marginBottom);

    let WIDTH = visu.clientWidth - marginLeft - marginRight;
    let HEIGHT = visu.clientHeight - marginTop - marginBottom;


    //mise en place des axes.

    /*let x = d3.scaleLinear()
        .range([0, WIDTH])
        .domain([572,37801687]);*/


    let y = d3.scaleLinear()
        .range([HEIGHT, 0])
        .domain([0,1.20]);

    /*let xAxis = d3.axisBottom()
        .scale(x);*/

    let yAxis = d3.axisLeft()
        .scale(y);

    //mise en place du zoom.


    //création de notre svg qui sera notre container pour notre graphique

    let svg = d3.select("#graph").append("svg")
        .attr("width", (WIDTH + marginLeft) + marginRight)
        .attr("height", HEIGHT + marginTop + marginBottom)
        .append("g")
        .attr("transform", "translate(" + marginLeft + "," + marginTop + ")");


    svg.append("defs").append("svg:clipPath")
        .attr("id", "clip")
        .append("svg:rect")
        .attr("width", WIDTH )
        .attr("height", HEIGHT )
        .attr("x", 0)
        .attr("y", 0);

    let graphlimit = svg.append('g')
        .attr("id","graphlimit")
        .attr("clip-path", "url(#clip)");




    ////////////////////////

    let x = d3.scaleLinear()
        .domain([572,37801687])
        .range([0, WIDTH]);

    let x2 = x.copy(); // reference.

    let zoom = d3.zoom()
        .scaleExtent([1, 10])
        .on("zoom", zoomed);

    d3.select("svg")
        .call(zoom);

    let axis = d3.axisBottom().scale(x);

    let axisG = svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + HEIGHT + ")")
        .call(axis)
        .attr("y", 6)
        .attr("dy", ".71em");

    function zoomed() {
        console.log("ZOOMED");
        x = d3.event.transform.rescaleX(x2);
        axis.scale(x);
        axisG.call(d3.axisBottom(x));
        fillgraph(chr,data,lineGen,svg,field,graphlimit);
    }




    //////////////////////////







    /*svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + HEIGHT + ")")
        .call(xAxis)
        .attr("y", 6)
        .attr("dy", ".71em");*/

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



    let floorValueArray = {}; //origin floor value

    let legend = d3.select("#legend").selectAll('g')
        .data(data[0])
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
            floorValueArray[d.key] = 0;
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
        });

    document.getElementsByClassName("legend")[0].classList.add("clicked"); //ajout de la class clicked au premier node de la classe legend.


    let chromosome = svg.select("#graphlimit").selectAll(".chromosome")
        .data(data[0]) // nombre de <g id="chrx"> </g> qui vont être crée (1 par chromosome).
        .enter()
        .append("g")
        .attr("id", function(d,i){
            return "chr" + i;
        })
        .attr("class","chromosome");

    fillgraph(chr,data,lineGen,svg,field);

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

    let mousePerLine = mouseG.selectAll('.mouse-per-line')
        .data(chromosome)
        .enter()
        .append("g")
        .attr("class", "mouse-per-line");

    let yHeight = document.getElementById("y axis").firstChild.getBoundingClientRect().height; //retrouver la taille en px du df de y
    console.log(yHeight);

    mousePerLine.append("text")
        .attr("transform", "translate(10,3)");

    inputSetup();

    mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
        .attr('width', WIDTH) // can't catch mouse events on a g element
        .attr('height', yHeight-4)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .on('mouseout', function() { // on mouse out hide line, circles and text
            d3.select(".mouse-line")
                .style("opacity", "0");
            d3.selectAll(".mouse-per-line text")
                .style("opacity", "0");
            d3.select(".y-value")
                .style("opacity", "0");
        })
        .on('mouseover', function() { // on mouse in show line, circles and text
            d3.select(".mouse-line")
                .style("opacity", "1");
            d3.selectAll(".mouse-per-line text")
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
                    let d = "translate(" + 10 + "," + (mouse[1] - 10)  + ")";
                    return d;
                })
                .text(((mouse[1] - (yHeight-4))/((yHeight-4)/1.20)).toFixed(3)*-1); //afficher au dessus de la ligne du tooltip la valeur de y
        })
        .on("click", function () {
            let mouse = d3.mouse(this);
            floorValueArray[getKeyByValue(field,originSelector)] = (((mouse[1] - yHeight)/(yHeight/1.20)).toFixed(3)*-1); //on cherche la valeur origineSelector dans field (Velut => V) et ensuite on cherche cette valeur dans notre floorValueArray puis on ajoute la valeur.
            console.log(floorValueArray);
            refreshFloor(floorValueArray);
        });

}

function inputSetup(){
    let legend = document.getElementById("legend");
    for (let i = 0; i < legend.children.length; i++) {
        legend.children[i].addEventListener("click",function(){
            originSelector = legend.children[i].innerText;
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

function fillgraph(idChromosome,data,lineGen,svg,field,graphlimit){

    d3.selectAll(".line").remove();

    for(let chromosome of document.getElementsByClassName("chromosome") ){
        if(chromosome.id !== "chr" + idChromosome) {
            chromosome.style.display = "none";
        }else{
            chromosome.style.display = "block";
        }
    }

    let currentChromosome = svg.select("#chr" + idChromosome);

    data[idChromosome].forEach(function(d) {
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

function refreshFloor(floorValueArray){
   let id;

    Object.keys(floorValueArray).forEach(function(key) {
        id = document.getElementById(key);
        id.value = floorValueArray[key];
    });

}

function curveOpacitySetup(){
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


