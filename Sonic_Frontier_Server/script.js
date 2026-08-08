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
