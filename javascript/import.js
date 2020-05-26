
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
    document.getElementById("visualisation").innerHTML = '';
}

/* PARSING DATA */

/**
 * cette fonction sert à travailler les données,
 * il est préférable de les avoir sous la forme d'un tableau dont chaque case correspond à un graphique.
 * les données sont trié par chromosome
 * @param data un tableau contenant nos données.
 */

function parsing(data){

    /* Ajout d'un x qui servira d'abscisse sur chaque lignes de données */

    let i = 0;
    while(i < data.length){

        let x = 0;

        let chr = data[i]["chr"];

        while(i < data.length && chr === data[i]["chr"] ){
            data[i]["x"] = x;
            i++;
            x++;
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
                return {chr: d.chr, valeur: d[id],x: d.x};
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
    *
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


    let field = {
        'V' : "Velut",
        'T' : "Texti",
        'S' : "Schiz",
        'E' : "Enset",
        'B' : "Balbi",
        'A_z' : "Zebri",
        'A_u' : "Sumsat",
        'A_s' : "Bursa",
        'A_m' : "Malac",
        'A_j' : "PJB",
        'A_b' : "Banks"
    };

    console.log(data);

    let visu = document.getElementById('graph');


    let style = getComputedStyle(visu);

    let marginLeft = parseInt(style.marginLeft);
    let marginRight = parseInt(style.marginRight);
    let marginTop = parseInt(style.marginTop);
    let marginBottom = parseInt(style.marginBottom);

    let vis = d3.select("#graph"),
        MARGINS = {
            top: marginTop,
            right: marginRight,
            bottom: marginBottom,
            left: marginLeft
        },
        WIDTH = visu.clientWidth - MARGINS.left - MARGINS.right,
        HEIGHT = visu.clientHeight - MARGINS.top - MARGINS.bottom;

    let lSpace = (HEIGHT/field.length)/2;

    let x = d3.scaleLinear()
        .range([0, WIDTH]);

    let y = d3.scaleLinear()
        .range([HEIGHT, 0]);

    let xAxis = d3.axisBottom()
        .scale(x);

    let yAxis = d3.axisLeft()
        .scale(y);

    let lineGen = d3.line()
        .x(function(d) {
            return x(d.x);
        })
        .y(function(d) {
            return y(d.valeur);
        }).curve(d3.curveBasis);

    let svg = d3.select("#graph").append("svg")
        .attr("width", WIDTH + MARGINS.left + MARGINS.right)
        .attr("height", HEIGHT + MARGINS.top + MARGINS.bottom)
        .append("g")
        .attr("transform", "translate(" + MARGINS.left + "," + MARGINS.top + ")");


    x.domain(d3.extent(data[0][0].values, function(d) {
        return d.x;
    }));

    /*let ymin = d3.min(data[0], function(c) {
        return d3.min(c.values, function(v) {
            return v.valeur;
        });
    });

    let ymax = d3.max(data[0], function(c) {
        return d3.max(c.values, function(v) {
            return v.valeur;
        });
    });*/


    y.domain([0,1]);

    let key = {}; //origin floor value

    let selector = d3.select("#legend");

    let legend = selector.selectAll('g')
        .data(data[0])
        .enter()
        .append('g')
        .attr('class', 'legend');

    legend.append('div')
        .attr("class","color")
        .style("width","10")
        .style("height","10");

    legend.append('text')
        .text(function(d) {
            key[d.key] = 0;
            return field[d.key];
        });



    /*let inputColumn = d3.select("#input");

    let input = inputColumn.selectAll("input")
        .data(data[0])
        .enter()
        .append('input');*/

    /*create input*/

    svg.append("g")
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
        .style("text-anchor", "end")
        .text("Valeur d'origine");

    let origine = svg.selectAll(".origine")
        .data(data[0])
        .enter().append("g")
        .attr("class", "origine");

    data[0].forEach(function(d, i) {
        origine.append('path')
            .attr("class", "line")
            .attr('d', lineGen(d.values))
            .style('stroke', function(d, j) {
                return "hsl(" + Math.random() * 360 + ",100%,50%)";
            })
            .attr('stroke-width', 2)
            .attr('fill', 'none');
    });

    let mouseG = svg.append("g")
        .attr("class", "mouse-over-effects");

    mouseG.append("path") // this is the black vertical line to follow mouse
        .attr("class", "mouse-line")
        .style("stroke", "black")
        .style("stroke-width", "1px")
        .style("opacity", "0")
        .style("transform", "rotate(90deg) translate(0,-"+ WIDTH + "px)");

    let text = mouseG.append("text")
        .attr("class","y-value");

    let lines = document.getElementsByClassName('line');

    let mousePerLine = mouseG.selectAll('.mouse-per-line')
        .data(origine)
        .enter()
        .append("g")
        .attr("class", "mouse-per-line");

    let yHeight = document.getElementById("y axis").firstChild.getBoundingClientRect().height; //retrouver la taille en px du df de y

    mousePerLine.append("text")
        .attr("transform", "translate(10,3)");

    inputSetup();

    mouseG.append('svg:rect') // append a rect to catch mouse movements on canvas
        .attr('width', WIDTH) // can't catch mouse events on a g element
        .attr('height', yHeight)
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
                });

            text.text(((mouse[1] - (yHeight-2.5))/(yHeight-2.5)).toFixed(3) * -1 + ""); //afficher au dessus de la ligne du tooltip la valeur de y
        })
        .on("click", function () {
            let mouse = d3.mouse(this);
            key[getKeyByValue(field,originSelector)] = ((mouse[1] - yHeight) / yHeight).toFixed(3) * -1;
            console.log(key);
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
    return Object.keys(object).find(key => object[key] === value);
}
