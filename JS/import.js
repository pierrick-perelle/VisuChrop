let dropArea = document.getElementById('drop-area');

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

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;

    handleFiles(files)
}

function handleFiles(files) {
    let reader = new FileReader();
    let file = files[0];
    reader.readAsText(file, "UTF-8");
    reader.onload = function (evt) {
        document.getElementById("fileContents").innerHTML = evt.target.result;
    };
    reader.onerror = function (evt) {
        document.getElementById("fileContents").innerHTML = "error reading file";
    }
}


