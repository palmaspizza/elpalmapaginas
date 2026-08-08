/* =========================================================
   SONIC // SERVER JAVASCRIPT
   ========================================================= */


/* =========================================================
   LOADING SCREEN
   EXACTAMENTE ~2 SEGUNDOS
   ========================================================= */

const loader = document.getElementById("loader");
const website = document.getElementById("website");

const progress =
    document.getElementById("progress");

const loadingPercent =
    document.getElementById("loadingPercent");


let loadingStart = performance.now();

const loadingDuration = 2000;


function loadingAnimation(time) {

    const elapsed =
        time - loadingStart;

    let percent =
        Math.min(
            elapsed / loadingDuration,
            1
        );

    const percentage =
        Math.floor(percent * 100);

    progress.style.width =
        percentage + "%";

    loadingPercent.textContent =
        percentage + "%";


    if (percent < 1) {

        requestAnimationFrame(
            loadingAnimation
        );

    } else {

        setTimeout(() => {

            loader.style.opacity = "0";
            loader.style.pointerEvents = "none";

            website.classList.add("visible");

            setTimeout(() => {

                loader.remove();

            }, 800);

        }, 100);

    }

}


requestAnimationFrame(
    loadingAnimation
);


/* =========================================================
   FILE SYSTEM
   ========================================================= */

const fileInput =
    document.getElementById("fileInput");

const dropZone =
    document.getElementById("dropZone");

const selectedFile =
    document.getElementById("selectedFile");

const fileName =
    document.getElementById("fileName");

const fileSize =
    document.getElementById("fileSize");

const fileStatus =
    document.getElementById("fileStatus");

const runButton =
    document.getElementById("runButton");


let currentFile = null;


/* =========================================================
   FORMAT FILE SIZE
   ========================================================= */

function formatFileSize(bytes) {

    if (bytes === 0) {
        return "0 Bytes";
    }

    const units = [
        "Bytes",
        "KB",
        "MB",
        "GB"
    ];

    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );

    return (
        parseFloat(
            (bytes /
            Math.pow(1024, index))
            .toFixed(2)
        )
        +
        " "
        +
        units[index]
    );

}


/* =========================================================
   HANDLE FILE
   ========================================================= */

function handleFile(file) {

    if (!file) {
        return;
    }


    currentFile = file;


    selectedFile.textContent =
        file.name;


    fileName.textContent =
        file.name;


    fileSize.textContent =
        formatFileSize(
            file.size
        );


    fileStatus.textContent =
        "READY";


    fileStatus.style.color =
        "#00ff66";


    runButton.disabled =
        false;


    const warning =
        document.querySelector(
            ".run-warning"
        );


    warning.textContent =
        "// FILE READY — CLICK RUN ONLINE";


    console.log(
        "Selected file:",
        file
    );

}


/* =========================================================
   INPUT
   ========================================================= */

fileInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];

        handleFile(file);

    }
);


/* =========================================================
   DRAG & DROP
   ========================================================= */

[
    "dragenter",
    "dragover"
].forEach(eventName => {

    dropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            dropZone.classList.add(
                "dragging"
            );

        }
    );

});


[
    "dragleave",
    "drop"
].forEach(eventName => {

    dropZone.addEventListener(
        eventName,
        event => {

            event.preventDefault();

            dropZone.classList.remove(
                "dragging"
            );

        }
    );

});


dropZone.addEventListener(
    "drop",
    event => {

        const file =
            event.dataTransfer.files[0];

        handleFile(file);

    }
);


/* =========================================================
   RUN ONLINE
   ========================================================= */

runButton.addEventListener(
    "click",
    function () {

        if (!currentFile) {

            alert(
                "SELECT A FILE FIRST."
            );

            return;

        }


        fileStatus.textContent =
            "INITIALIZING...";


        runButton.disabled =
            true;


        const warning =
            document.querySelector(
                ".run-warning"
            );


        warning.textContent =
            "// INITIALIZING ONLINE SERVER...";


        /*
         * Pequeño efecto de terminal.
         */

        setTimeout(() => {

            fileStatus.textContent =
                "ONLINE";


            warning.textContent =
                "// SERVER INITIALIZED — STARTING DOWNLOAD";


            /*
             * Creamos una URL temporal
             * para el archivo seleccionado.
             */

            const downloadURL =
                URL.createObjectURL(
                    currentFile
                );


            /*
             * Creamos un enlace invisible.
             */

            const link =
                document.createElement("a");


            link.href =
                downloadURL;


            link.download =
                currentFile.name;


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            /*
             * Liberamos memoria.
             */

            setTimeout(() => {

                URL.revokeObjectURL(
                    downloadURL
                );

            }, 1000);


            /*
             * Restauramos el botón.
             */

            setTimeout(() => {

                runButton.disabled =
                    false;

                fileStatus.textContent =
                    "READY";

                warning.textContent =
                    "// FILE READY — CLICK RUN ONLINE";

            }, 1500);


        }, 700);

    }
);


/* =========================================================
   KEYBOARD EFFECT
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Enter" &&
            currentFile &&
            !runButton.disabled
        ) {

            runButton.click();

        }

    }
);


/* =========================================================
   RANDOM TERMINAL GLITCH
   ========================================================= */

const brand =
    document.querySelector(".brand");


setInterval(() => {

    if (
        Math.random() > .75
    ) {

        brand.style.transform =
            "translateX(-2px)";

        setTimeout(() => {

            brand.style.transform =
                "translateX(2px)";

        }, 40);


        setTimeout(() => {

            brand.style.transform =
                "translateX(0)";

        }, 80);

    }

}, 2500);


/* =========================================================
   CONSOLE
   ========================================================= */

console.log(
`
╔════════════════════════════════════╗
║   SONIC // CYBER SERVER 1991       ║
║                                    ║
║   SYSTEM: ONLINE                   ║
║   PROTOCOL: CYBER-90               ║
║   STATUS: READY                    ║
╚════════════════════════════════════╝
`
);