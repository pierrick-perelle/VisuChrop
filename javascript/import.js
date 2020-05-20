
let dropArea = document.getElementById('drop-area');
let fileInput = document.getElementById('fileElem');

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

    graphSetup(dataGroup);




}



function graphSetup(data) {


    // Rappel : data[Chromosome][origine].values[ligne de données]

    let vis = d3.select("#visualisation"),
        WIDTH = document.getElementById('visualisation').clientWidth,
        HEIGHT = document.getElementById('visualisation').clientHeight,
        MARGINS = {
            top: 50,
            right: 20,
            bottom: 50,
            left: 50
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
        vis.append('svg:path')
            .attr('d', lineGen(d.values))
            .attr('stroke', function(d, j) {
                return "hsl(" + Math.random() * 360 + ",100%,50%)";
            })
            .attr('stroke-width', 2)
            .attr('fill', 'none');
    });




}