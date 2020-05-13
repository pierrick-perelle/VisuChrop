let dropArea = document.getElementById('drop-area');

['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, preventDefaults, false)
});

function preventDefaults (e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('OK');
}

['dragenter', 'dragover'].forEach(eventName => {
    dropArea.addEventListener(eventName, highlight, false)
});

['dragleave', 'drop'].forEach(eventName => {
    dropArea.addEventListener(eventName, unhighlight, false)
});

function highlight(e) {
    dropArea.classList.add('highlight');
}

function unhighlight(e) {
    dropArea.classList.remove('highlight');
}

dropArea.addEventListener('drop', handleDrop, false);

function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;

    handleFiles(files)
}

function handleFiles(files) {
    ([...files]).forEach(uploadFile)
}

function uploadFile(file) {
    let url = 'python script ?';
    let request = new XMLHttpRequest();
    let formData = new FormData();
    request.open('POST', url, true);

    request.addEventListener('readystatechange', function(e) {
        if (request.readyState === 4 && request.status === 200) {
            alert('Votre fichier a bien été déposé !');
        }
        else if (request.readyState === 4 && request.status !== 200) {
            alert('Votre fichier n\'a pas pu être déposé :(');
        }
    });
    console.log(request.status);

    formData.append('file', file);
    request.send(formData)
}

