
// Registrar el Service Worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/firebase-messaging-sw.js')
    .then(reg => {
      console.log('Service Worker registrado');
    })
    .catch(err => {
      console.error('Error al registrar el Service Worker:', err);
    });
}

// Solicitar permiso y guardar token
document.getElementById('solicitar').addEventListener('click', async () => {
  try {
    const permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
      const token = await messaging.getToken({ vapidKey: 'LPiNDM_XNqEyUax9FouVf80pSRw0RKakQcr3uWolXio' }); // reemplaza con tu VAPID
      console.log('Token:', token);

      await fetch('http://localhost:3000/guardar-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    console.error('Error al solicitar notificaciones:', err);
  }
});

// Simular reserva y enviar notificación
document.getElementById('reservar').addEventListener('click', async () => {
  await fetch('http://localhost:3000/enviar-notificaciones', {
    method: 'POST',
    body: JSON.stringify({
      titulo: 'Nueva reserva',
      mensaje: 'Se ha confirmado una nueva reserva en la barbería 💈'
    }),
    headers: { 'Content-Type': 'application/json' }
  });
});





function abrirVentanaEditarTexto(fecha, hora, textoActual) {
  fechaBloqueActual = fecha;
  horaBloqueActual = hora;
  document.getElementById("inputTextoBloque").value = textoActual;
  document.getElementById("ventanaEditarTexto").style.display = "block";
}

function cerrarVentanaEditarTexto() {
  document.getElementById("ventanaEditarTexto").style.display = "none";
}


function editarTextoBloque(fecha, hora, textoActual) {
  const nuevoTexto = prompt(`Editar texto para ${hora}:`, textoActual);
  if (nuevoTexto !== null && nuevoTexto.trim() !== "") {
    guardarTextoBloque(fecha, hora, nuevoTexto);
  }
}
document.getElementById("btnConfirmarTexto").onclick = guardarTextoBloque;


function guardarTextoBloque() {
  const nuevoTexto = document.getElementById("inputTextoBloque").value.trim();
  if (!fechaBloqueActual || !horaBloqueActual || nuevoTexto === "") return;

  const ref = firebase.database().ref(`bloquesTextoPorDia/${fechaBloqueActual}/${horaBloqueActual}`);
  ref.set(nuevoTexto).then(() => {
    if (elementoTextoBloque) {
      elementoTextoBloque.textContent = nuevoTexto;
    }
    cerrarVentanaEditarTexto();
  });
}



function cargarTextosDeBloques(fecha, horarioDelDia) {
  const bloquesTextoRef = firebase.database().ref(`bloquesTextoPorDia/${fecha}`);

  bloquesTextoRef.once("value").then(snapshot => {
    const textos = snapshot.val() || {};

    horarioDelDia.forEach(hora => {
      const texto = textos[hora] || `${hora}`;
      mostrarBloque(hora, texto, fecha); // tu función para mostrar el bloque
    });
  });
}

  // Inicializar Firebase

const firebaseConfig = {
  apiKey: "AIzaSyBA4Ot8J1lYF-dM2nFnOR5hCkcSfwNWCeg",
  authDomain: "pinkpalace-b8015.firebaseapp.com",
  projectId: "pinkpalace-b8015",
  storageBucket: "pinkpalace-b8015.firebasestorage.app",
  messagingSenderId: "331331523129",
  appId: "1:331331523129:web:dca4f510caf7e559ffb3e8",
  measurementId: "G-7GDQ31Q6ZH"
};


        firebase.initializeApp(firebaseConfig);
        firebase.database().ref("diasSemanaBloqueados").on("value", snapshot => {
  const data = snapshot.val() || {};
  diasDeLaSemanaBloqueados = Object.keys(data).map(Number);
  generarCuadroCalendario(); // actualiza el calendario
});

        const db = firebase.database();
        const reservasRef = db.ref("reservas");
        const horariosRef = db.ref("horarios"); // Nueva referencia para los horarios personalizados

        const fechaInput = document.getElementById("fecha");
        const listaReservas = document.getElementById("reservas-lista");
        const cuadroCalendario = document.getElementById("cuadroCalendario");
        const ventanaHorarios = document.getElementById("modal-horarios");
        const cerrarVentana = document.getElementById("cerrarVentana");
        const tituloVentana = document.getElementById("tituloVentana");
        const horariosDisponibles = document.getElementById("horariosDisponibles");
        const selectorMesTexto = document.getElementById("selectorMesTexto");
        const tituloMes = document.getElementById("tituloMes");
        const botonAnterior = document.getElementById("mesAnterior");
        const botonSiguiente = document.getElementById("mesSiguiente");
        const botonActivarBloqueo = document.getElementById("activarBloqueoDias");
        const botonDesactivarBloqueo = document.getElementById("desactivarBloqueoDias");
        const modalConfiguracionHorarios = document.getElementById("modal-configuracion-horarios");
        const tituloConfigHorarios = document.getElementById("titulo-config-horarios");
        const fechaConfigHorarios = document.getElementById("fecha-config-horarios");
        const botonesToggleHoras = document.getElementById("botones-toggle-horas");

        let modoBloqueoDias = false;
        let modoGestionHorarios = false;
        let diasBloqueados = [];
        let horariosPersonalizados = {};
        let reservasPorDia = {};
        let fechaActualCalendario = new Date();
        let fechaSeleccionadaParaConfigurar = "";

        // 2. Referencia a los días bloqueados
const diasSemanaBloqueadosRef = firebase.database().ref("diasSemanaBloqueados");
 // debe ser let para poder actualizarla

// 3. Escucha los cambios en Firebase
diasSemanaBloqueadosRef.on("value", snapshot => {
  const data = snapshot.val() || {};
  diasDeLaSemanaBloqueados = Object.keys(data).map(Number);
  generarCuadroCalendario(); // actualiza el calendario con los días bloqueados
});

// 4. Llamas a otras funciones de carga si es necesario

// C:00BIAR HORARIO
        const horarioSemana = ["08:00 a 09:00", "09:00 a 10:00",  "11:00 a 12:00",  "18:00 a 19:00",  "19:00 a 20:00"];
        const horarioDomingo = ["08:00 a 09:00", "09:00 a 10:00",  "11:00 a 12:00",  "18:00 a 19:00",  "19:00 a 20:00"];
const horariosPorDia = {
  0: [ // Lunes
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "💪 FULL BODY - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "👯 FIT CHICAS - 19:00 a 20:00 |",
    "🧘 YOGA - 20:30 a 21:15 |"
  ],
  1: [ // Martes
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "🦵 TREN INFERIOR - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "👯 FIT CHICAS - 19:00 a 20:00 |"
  ],
  2: [ // Miércoles
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "💪 FULL BODY - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "💃 BAILANDO - 19:00 a 20:00 |",
    "🧘 YOGA - 20:30 a 21:15 |"
  ],
  3: [ // Jueves
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "💪 TREN SUPERIOR - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "👯 FIT CHICAS - 19:00 a 20:00 |"
  ],
  4: [ // Viernes
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "💪 FULL BODY - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "💃 BAILANDO - 19:00 a 20:00 |"
  ],
  5: [ // Sábado
    "⏱️ Horario libre 08:00 a 09:00 |",
    "⏱️ Horario libre - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "⏱️ Horario libre 17:00 a 18:00 |",
    "⏱️ Horario libre 18:00 a 19:00 |",
    "⏱️ Horario libre 19:00 a 20:00 |"
  ],
  6: [ // Domingo
    "🏋️ MUSCULACIÓN - 08:00 a 09:00 |",
    "⏱️ Horario libre - 09:00 a 10:00 |",
    "⏱️ Horario libre - 11:00 a 12:00 |",
    "📝 EVALUACIÓN - 17:00 a 18:00 |",
    "🏋️ MUSCULACIÓN - 18:00 a 19:00 |",
    "👯 FIT CHICAS - 19:00 a 20:00 |"
  ]
};

        const mesesTexto = [
            "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
            "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
        ];

        const estadoRef = firebase.database().ref("estadoBarberia");
        const mensajeRef = firebase.database().ref("mensajeCierre");
        const diasBloqueadosRef = firebase.database().ref("diasBloqueados");

        // Escuchar reservas en tiempo real
        reservasRef.on("value", snapshot => {
            reservasPorDia = {};
            snapshot.forEach(child => {
                const {
                    fecha,
                    hora
                } = child.val();
                if (!reservasPorDia[fecha]) reservasPorDia[fecha] = [];
                reservasPorDia[fecha].push(hora);
            });
            actualizarBarraMes();
        });

        // Escuchar días bloqueados en tiempo real
        diasBloqueadosRef.on("value", snapshot => {
            diasBloqueados = [];
            snapshot.forEach(child => {
                diasBloqueados.push(child.val().fecha);
            });
            actualizarBarraMes();
        });

        // Escuchar horarios personalizados en tiempo real
        horariosRef.on("value", snapshot => {
            horariosPersonalizados = snapshot.val() || {};
            actualizarBarraMes();
        });

        function ingresarllave() {
            document.getElementById("clave-input").value = '';
        }

    

function obtenerHorarioDelDiaDesdeFecha(fecha) {
  const fechaObj = new Date(fecha);
  const diaSemana = fechaObj.getDay(); // 0 = domingo, 1 = lunes, etc.
  return horariosPorDia[diaSemana] || [];
}

let estaOcupado = false;

function verificarDiaOcupado(fecha) {
  const refDia = firebase.database().ref(`reservasPorDia/${fecha}`);

  refDia.once("value").then(snapshot => {
    const bloques = snapshot.val();

    if (!bloques) {
      estaOcupado = false;
      return;
    }

    const horas = Object.keys(bloques);
    let todasCompletas = true;

    for (let hora of horas) {
      const reservas = bloques[hora];
      const cantidad = reservas ? Object.keys(reservas).length : 0;

      if (cantidad < 10) {
        todasCompletas = false;
        break;
      }
    }

    const elementoDia = document.getElementById(`dia-${fecha}`);
    if (elementoDia) {
      if (todasCompletas) {
        elementoDia.classList.add("diaOcupado");
        estaOcupado = true;
      } else {
        elementoDia.classList.remove("diaOcupado");
        estaOcupado = false;
      }
    }
  });
}


    
     function generarCuadroCalendario() {


    const mesStr = `${fechaActualCalendario.getFullYear()}-${String(fechaActualCalendario.getMonth() + 1).padStart(2, "0")}`;
    cuadroCalendario.innerHTML = "";
    const [anio, mes] = mesStr.split("-");
    const fechaInicio = new Date(anio, mes - 1, 1);
    const primerDiaSemana = fechaInicio.getDay();
    const totalDias = new Date(anio, mes, 0).getDate();
    const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

    // Obtener la fecha actual para la comparación
    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0); // Establecer la hora a 00:00:00 para una comparación precisa

    for (let i = 0; i < offset; i++) {
        const vacio = document.createElement("div");
        cuadroCalendario.appendChild(vacio);
    }

    for (let dia = 1; dia <= totalDias; dia++) {
        const fechaActual = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
        const celda = document.createElement("div");
        celda.classList.add("diaCalendario");
        celda.textContent = dia;



        const horasReservadas = reservasPorDia[fechaActual] || [];
        
        
    

        // Dentro de la función generarCuadroCalendario()
// ...
const horarioDelDia = obtenerHorarioDelDiaDesdeFecha(fechaActual);
const fechaCelda = new Date(anio, mes - 1, dia);
const diaSemana = fechaCelda.getDay();

const estaBloqueado = diasBloqueados.includes(fechaActual) ||
                      horarioDelDia.length === 0 ||
                      diasDeLaSemanaBloqueados.includes(diaSemana);

const estaOcupado = horasReservadas.length >= horarioDelDia.length;
const diaPasado = fechaCelda < hoy;

// Aplicar clases visuales
if (diaPasado) {
  celda.classList.add("diaPasado");
  celda.title = "Este día ya ha pasado";
} else if (estaBloqueado) {
  celda.classList.add("diaBloqueado");
  celda.title = "Día bloqueado por el administrador";
  celda.style.pointerEvents = "none";
} else if (estaOcupado) {
  celda.classList.add("diaOcupado");
  celda.title = "Día con todas las horas reservadas";
} else {
  celda.classList.add("diaLibre");
  celda.title = "Día disponible";
}

        
        // **NUEVA LÓGICA:** Deshabilitar el clic si el día ya pasó
        if (diaPasado || (!modoBloqueoDias && estaBloqueado)) {
            celda.style.pointerEvents = "none";
        }

        // Modificar el `onclick` para que solo se ejecute si no es un día pasado
        celda.onclick = () => {
            if (diaPasado) return; // Salir de la función si el día ya pasó
            
            if (modoGestionHorarios) {
                fechaSeleccionadaParaConfigurar = fechaActual;
                abrirVentanaConfiguracionHorarios();
            } else if (modoBloqueoDias) {
                if (estaBloqueado) {
                    diasBloqueadosRef.once("value", snapshot => {
                        snapshot.forEach(child => {
                            if (child.val().fecha === fechaActual) {
                                child.ref.remove();
                            }
                        });
                    });
                } else {
                    diasBloqueadosRef.push({ fecha: fechaActual });
                }
            } else {
                if (!estaBloqueado) {
                    fechaInput.value = fechaActual;
                    abrirVentanaHorarios(fechaActual);
                }
            }
        };

        cuadroCalendario.appendChild(celda);
    }
}
const diasDeLaSemanaBloqueadosRef = firebase.database().ref("diasDeLaSemanaBloqueados");




        function actualizarBarraMes() {
            const mes = fechaActualCalendario.getMonth();
            const año = fechaActualCalendario.getFullYear();
            tituloMes.textContent = `${mesesTexto[mes]} ${año}`;
            generarCuadroCalendario();
        }

        botonAnterior.onclick = () => {
            fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() - 1);
            actualizarBarraMes();
        };

        botonSiguiente.onclick = () => {
            fechaActualCalendario.setMonth(fechaActualCalendario.getMonth() + 1);
            actualizarBarraMes();
        };

        window.addEventListener("DOMContentLoaded", () => {
            actualizarBarraMes();
            botonDesactivarBloqueo.style.display = 'none';
        });

        botonActivarBloqueo.onclick = () => {
            modoBloqueoDias = true;
            modoGestionHorarios = false;
            botonActivarBloqueo.style.display = 'none';
            botonDesactivarBloqueo.style.display = 'block';
            generarCuadroCalendario();
            console.log("Modo bloqueo ACTIVADO");
            cerrarModal('modal-control');
        };

        botonDesactivarBloqueo.onclick = () => {
            modoBloqueoDias = false;
            botonActivarBloqueo.style.display = 'block';
            botonDesactivarBloqueo.style.display = 'none';
            generarCuadroCalendario();
            console.log("Modo bloqueo DESACTIVADO");
        };

        fechaInput.addEventListener("change", () => {
            const fechaElegida = new Date(fechaInput.value);
            const opciones = {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            };
            const fechaFormateada = fechaElegida.toLocaleDateString('es-CL', opciones);
            document.getElementById("boton").innerHTML = `📅 ${fechaFormateada}`;
            document.getElementById("botonCambiar").classList.remove("oculto");
        });

       document.getElementById("buscadorGlobal").addEventListener("input", () => {
    // Convertir el valor del input a minúsculas y eliminar espacios en blanco
    const filtro = document.getElementById("buscadorGlobal").value.trim().toLowerCase();
    const contenedor = document.getElementById("reservas-lista");

    if (!contenedor) return;

    // Primero, eliminar cualquier resaltado de una búsqueda anterior
    contenedor.querySelectorAll(".resaltado").forEach(span => {
        const parent = span.parentNode;
        if (parent) {
            parent.replaceChild(document.createTextNode(span.textContent), span);
            parent.normalize();
        }
    });

    if (filtro === "") return;

    const elementos = contenedor.querySelectorAll("*");
    let primeraCoincidencia = null;

    elementos.forEach(el => {
        el.childNodes.forEach(node => {
            // Verificar si el nodo es de texto y si su contenido (en minúsculas) incluye el filtro
            if (node.nodeType === 3 && node.textContent.toLowerCase().includes(filtro)) {
                // Usar una expresión regular para dividir el texto sin importar mayúsculas
                const partes = node.textContent.split(new RegExp(filtro, "i"));
                const fragmento = document.createDocumentFragment();

                partes.forEach((parte, i) => {
                    fragmento.appendChild(document.createTextNode(parte));
                    if (i < partes.length - 1) {
                        const span = document.createElement("span");
                        span.className = "resaltado";
                        // Mantener el texto original del filtro en el resaltado
                        span.textContent = node.textContent.substring(
                            node.textContent.toLowerCase().indexOf(filtro),
                            node.textContent.toLowerCase().indexOf(filtro) + filtro.length
                        );
                        fragmento.appendChild(span);
                    }
                });
                
                // Reemplazar el nodo de texto original con el fragmento que contiene el resaltado
                el.replaceChild(fragmento, node);
                if (!primeraCoincidencia) primeraCoincidencia = el;
            }
        });
    });

    // Si se encuentra una coincidencia, desplazarse a ella
    if (primeraCoincidencia) {
        setTimeout(() => {
            primeraCoincidencia.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        }, 50);
    }
});

setTimeout(() => {
    const primeraCoincidencia = document.querySelector(".resaltado");
    if (primeraCoincidencia) {
        primeraCoincidencia.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });
    }
}, 100);
        let temporizadorPresion;
        const logoCerrado = document.getElementById("logo-cerrado");
        const logo = document.getElementById("logo");

        function iniciarPresionLenta(objeto) {
            if (!objeto) return;
            objeto.addEventListener("mousedown", () => {
                temporizadorPresion = setTimeout(() => {
                    document.getElementById("modal-acceso").classList.remove("fantasma");
                }, 3000);
            });
            objeto.addEventListener("mouseup", () => clearTimeout(temporizadorPresion));
            objeto.addEventListener("mouseleave", () => clearTimeout(temporizadorPresion));
            objeto.addEventListener("touchstart", () => {
                temporizadorPresion = setTimeout(() => {
                    document.getElementById("modal-acceso").classList.remove("fantasma");
                }, 3000);
            });
            objeto.addEventListener("touchend", () => clearTimeout(temporizadorPresion));
        }

        if (logo) {
            iniciarPresionLenta(logo);
        }
        if (logoCerrado) {
            iniciarPresionLenta(logoCerrado);
        }

        reservasRef.on("child_removed", (snapshot) => {
            const {
                fecha,
                hora
            } = snapshot.val();
            const idBloque = `${fecha}-${hora}`;
            console.log("Eliminando visualmente:", idBloque);
            const div = document.getElementById(idBloque);
            if (div) div.remove();
        });

        function reservarHora() {
            const fecha = fechaInput.value;
            const hora = document.getElementById("hora").value;
            const 
            nombre = document.getElementById("nombre").value.trim();

            if (!fecha || !hora || !nombre) {
                alert("Completa todos los campos: nombre, fecha y hora");
                return;
            }

            const idBloque = `${fecha}-${hora}`;

            reservasRef.once("value", snapshot => {
                let ocupada = false;
                snapshot.forEach(child => {
                    const r = child.val();
                    if (`${r.fecha}-${r.hora}` === idBloque) {
                        ocupada = true;
                    }
                });
                if (ocupada) {
                    document.getElementById("modal-ocupado").classList.remove("hidden");
                } else {
                    reservasRef.push({
                        fecha,
                        hora,
                        nombre
                    });
                    document.getElementById("modal-reservada").classList.remove("hidden");
                    enviarMensajeWhatsApp(nombre, fecha, hora);
                }
            });
        }

        function cerrarModal(id) {
            document.getElementById(id).classList.add("fantasma");
        }

        function validarClave() {
            const claveInput = document.getElementById("clave-input");
            const clave = claveInput.value;
            if (clave === "1188") {
                document.getElementById("modal-acceso").classList.add("fantasma");
                document.getElementById("modal-control").classList.remove("fantasma");
                claveInput.value = "";
            } else {
                alert("Clave incorrecta");
            }
        }

        function cerrarBarberia() {
            estadoRef.set("cerrado");
            document.getElementById("modal-control").classList.add("fantasma");
        }

        function abrirBarberia() {
            estadoRef.set("abierto");
            document.getElementById("modal-control").classList.add("fantasma");
        }

        estadoRef.on("value", snapshot => {
            const estado = snapshot.val();
            console.log("Estado actualizado:", estado);
            if (estado === "cerrado") {
                document.getElementById("modal-cerrado").style.display = "flex";
            } else {
                document.getElementById("modal-cerrado").style.display = "none";
            }
        });

        function activarPresionProlongada(elemento, accion, tiempo = 1000) {
            elemento.addEventListener("mousedown", () => {
                presionarTimer = setTimeout(accion, tiempo);
            });
            elemento.addEventListener("mouseup", () => clearTimeout(presionarTimer));
            elemento.addEventListener("mouseleave", () => clearTimeout(presionarTimer));
            elemento.addEventListener("touchstart", () => {
                presionarTimer = setTimeout(accion, tiempo);
            });
            elemento.addEventListener("touchend", () => clearTimeout(presionarTimer));
        }

     const reservasRefMostrar = firebase.database().ref("reservas");

reservasRefMostrar.on("child_added", (snapshot) => {
  const { fecha, hora, nombre } = snapshot.val();
  const idBloque = `${fecha}-${hora}`;

  // Evitar duplicados
  if (document.getElementById(idBloque)) return;

  // Crear el bloque visual
  const div = document.createElement("div");
  div.className = "reserva-item";
  div.id = idBloque;

  const texto = document.createElement("span");
  texto.textContent = `📅 ${fecha} ⏰ ${hora} - Cargando...`;

  const botonX = document.createElement("span");
  botonX.textContent = " | ❌";
  botonX.className = "boton-x";
  botonX.title = "Eliminar esta hora";

  botonX.onclick = () => {
    const reservaId = snapshot.key;
    const reservaRef = reservasRefMostrar.child(reservaId);

    reservaRef.remove()
      .then(() => {
        console.log("Reserva eliminada con éxito.");
        const bloque = document.getElementById(idBloque);
        if (bloque) bloque.remove();
      })
      .catch((error) => {
        console.error("Error al eliminar la reserva:", error);
      });
  };

  div.appendChild(texto);
  div.appendChild(botonX);
  listaReservas.appendChild(div);

  // Verificar cuántas reservas hay en esa hora
  const refHora = firebase.database().ref(`reservasPorDia/${fecha}/${hora}`);
  refHora.once("value").then(snapshotHora => {
    const reservasHora = snapshotHora.val() || {};
    const cantidad = Object.keys(reservasHora).length;

    if (cantidad >= 10) {
      texto.textContent = `📅 ${fecha} ⏰ ${hora} - ✅ Reservada (10/10 👤)`;
      div.classList.add("reserva-completa");
    } else {
      texto.textContent = `📅 ${fecha} ⏰ ${hora} - ${cantidad}/10 👤`;
    }
  });
});

        function mostrarBotonesX() {
            document.querySelectorAll(".boton-x").forEach(b => {
                b.style.display = "inline";
            });
        }

        function ocultarBotonesX() {
            document.querySelectorAll(".boton-x").forEach(b => {
                b.style.display = "none";
            });
        }

        function mostrarModalMensaje() {
            document.getElementById("modal-control").classList.add("fantasma");
            document.getElementById("modal-mensaje").classList.remove("fantasma");
        }

        function guardarMensajeCierre() {
            const mensaje = document.getElementById("mensaje-cierre").value;
            mensajeRef.set(mensaje);
            estadoRef.set("cerrado");
            document.getElementById("modal-mensaje").classList.add("fantasma");
        }

        mensajeRef.on("value", snapshot => {
            const mensaje = snapshot.val();
            document.getElementById("mensaje-cerrado").textContent = mensaje || "";
        });

        function borrarTodasLasHorasEnPantalla() {
            reservasRef.remove()
                .then(() => {
                    console.log("Todas las reservas han sido eliminadas de Firebase");
                    const lista = document.getElementById("reservas-lista");
                    if (!lista) {
                        console.warn("No se encontró el contenedor de reservas");
                        return;
                    }
                    while (lista.firstChild) {
                        lista.removeChild(lista.firstChild);
                    }
                    console.log("Todas las horas en pantalla han sido eliminadas");
                })
                .catch(error => {
                    console.error("Error al borrar las reservas:", error);
                });
        }

        function borrarHorasMesHastaHoy() {
            const hoy = new Date();
            const diaActual = hoy.getDate();
            const mesActual = hoy.getMonth() + 1;
            const añoActual = hoy.getFullYear();

            reservasRef.once("value", snapshot => {
                snapshot.forEach(child => {
                    const {
                        fecha
                    } = child.val();
                    const [año, mes, dia] = fecha.split("-").map(Number);
                    if (año === añoActual && mes === mesActual && dia < diaActual) {
                        reservasRef.child(child.key).remove();
                    }
                });
            });
            document.getElementById("modal-control").classList.add("fantasma");
        }

        function miFuncion() {
            document.getElementById("reservar-button").style.display = 'block';
              document.getElementById("nombre").addEventListener("input", function () {
  this.value = this.value.replace(/\d/g, ""); // elimina todos los números
});
        }
function cerrarVentanaAdminYMostrarBotones() {
  // Cierra la ventana modal
  document.getElementById("modalAdmin").style.display = "none";

  // Quita la clase "botonmenos" para mostrar los botones
  document.querySelectorAll(".botonmenos").forEach(boton => {
    boton.classList.remove("botonmenos");
  });
}


      function abrirVentanaHorarios(fecha) {
  tituloVentana.textContent = `HORAS DISPONIBLES ${fecha}`;
  horariosDisponibles.innerHTML = "";

  const diaSemana = new Date(fecha).getDay(); // 0 = Domingo
  const horarioDelDia = obtenerHorarioDelDiaDesdeFecha(fecha);

  firebase.database().ref(`reservasPorDia/${fecha}`).once("value").then(snapshot => {
    const reservasDelDia = snapshot.val() || {};

    horarioDelDia.forEach(hora => {
      const reservasHora = reservasDelDia[hora] || {};
      const cantidadReservas = Object.keys(reservasHora).length;
      const capacidadMaxima = 10;

      // 🔥 Obtener texto personalizado desde Firebase
      firebase.database().ref(`bloquesTextoPorDia/${fecha}/${hora}`).once("value").then(textSnapshot => {
        const textoPersonalizado = textSnapshot.val() || `${hora}`;

        // 🧱 Crear el bloque completo dentro del callback
        const bloque = document.createElement("div");
        bloque.classList.add("bloqueHora");

        // 🕒 Texto de la hora
        const textoHora = document.createElement("span");
        textoHora.className = "horaTexto";
        textoHora.textContent = hora;

        // 🧮 Contador
        const contador = document.createElement("span");
        const idContador = `contador-${hora.replace(/[^0-9]/g, "")}`;
        contador.id = idContador;
        contador.className = cantidadReservas >= capacidadMaxima ? "contadorLleno" : "contadorActivo";
        contador.innerHTML = `
          <span class="contadorIzquierda" style="color:red; font-weight:bold;">${cantidadReservas}</span>
          <span class="contadorDerecha" style="color:white;">/10 👤|</span>
        `;

        // 🔴 Botón rojo "-"
        const botonMenos = document.createElement("button");
        botonMenos.textContent = "x";
        botonMenos.className = "botonmenos";
        botonMenos.style.backgroundColor = "red";
        botonMenos.style.color = "white";
        botonMenos.style.border = "none";
        botonMenos.style.borderRadius = "3px";
        botonMenos.style.padding = "5px 10px";
        botonMenos.style.marginRight = "10px";
        botonMenos.title = "Eliminar una persona de esta hora";

        botonMenos.onclick = (e) => {
          e.stopPropagation();
          const ref = firebase.database().ref(`reservasPorDia/${fecha}/${hora}`);
          ref.once("value").then(snapshot => {
            const reservas = snapshot.val() || {};
            const nombres = Object.keys(reservas);
            if (nombres.length > 0) {
              const nombreAEliminar = nombres[0];
              firebase.database().ref(`reservasPorDia/${fecha}/${hora}/${nombreAEliminar}`).remove()
                .then(() => {
                  firebase.database().ref(`reservasPorDia/${fecha}/${hora}`).once("value").then(snapshot => {
                    const nuevasReservas = snapshot.val() || {};
                    const nuevaCantidad = Object.keys(nuevasReservas).length;
                    contador.innerHTML = `
                      <span class="contadorIzquierda" style="color:red; font-weight:bold;">${nuevaCantidad}</span>
                      <span class="contadorDerecha" style="color:white;">/10 👤|</span>
                    `;
                    contador.className = nuevaCantidad >= capacidadMaxima ? "contadorLleno" : "contadorActivo";
                  });
                });
            }
          });
        };

        // 🔤 Texto personalizado
        const textoBloque = document.createElement("span");
        textoBloque.textContent = textoPersonalizado;
        textoBloque.className = "textoBloque";

        // ✏️ Botón de edición
        const botonEditar = document.createElement("button");
botonEditar.textContent = "✏️ Editar";
botonEditar.className = "botonEditarTexto";
botonEditar.style.marginLeft = "10px";
botonEditar.onclick = (e) => {
  e.stopPropagation(); // 🔒 evita que se active el clic del bloque
  abrirVentanaEditarTexto(fecha, hora, textoBloque.textContent, textoBloque);
};


        // 🟢 Acción para agendar si hay espacio
        if (cantidadReservas < capacidadMaxima) {
          bloque.classList.add("horaLibre");
          bloque.onclick = () => {
            const nombrePersona = "usuario_" + Math.floor(Math.random() * 10000);
const ref = firebase.database().ref(`reservasPorDia/${fecha}/${hora}`);

ref.once('value').then(snapshot => {
  const reservasActuales = snapshot.val() || {};

  if (!reservasActuales[nombrePersona]) {
    const nuevaReserva = {};
    nuevaReserva[nombrePersona] = true;
    ref.update(nuevaReserva).then(() => {
      
      abrirVentanaHorarios(fecha);
    });
  } else {
    // ✅ Ya estaba reservado, pero igual enviamos el mensaje
    abrirVentanaHorarios(fecha);
  }
});


            document.getElementById("hora").value = hora;
            fechaInput.value = fecha;
            document.getElementById("modal-hora-personalizada").classList.remove("hidden");
            ventanaHorarios.style.display = "none";
          };
        } else {
          bloque.classList.add("horaOcupada");
        }

        // 🧩 Armar el bloque visual
        bloque.appendChild(contador);
        bloque.appendChild(botonMenos);
        bloque.appendChild(textoBloque);
        bloque.appendChild(botonEditar);
        horariosDisponibles.appendChild(bloque);
      });
    });

    // ✅ Verificar si todas las horas están llenas
    const todasLlenas = horarioDelDia.every(hora => {
      const reservas = reservasDelDia[hora] || {};
      return Object.keys(reservas).length >= 10;
    });

    if (todasLlenas) {
      document.getElementById("modal-horarios").classList.add("diaOcupado");
    } else {
      document.getElementById("modal-horarios").classList.remove("diaOcupado");
    }

    ventanaHorarios.style.display = "block";
  });
}










        cerrarVentana.onclick = () => {
            ventanaHorarios.style.display = "none";
        };

        window.onclick = (e) => {
            if (e.target === ventanaHorarios) ventanaHorarios.style.display = "none";
        };

      function enviarPorWhatsApp() {
  const nombre = document.getElementById("nombre")?.value.trim();
  const fecha = fechaInput.value;
  const hora = document.getElementById("hora").value;

  if (!nombre || !fecha || !hora) {
    alert("Faltan datos: asegúrate de ingresar nombre, fecha y hora");
    return;
  }

  const numeroDestino = "56944680449";
  const mensaje = `Hola, soy ${nombre}. Quiero reservar para el día ${fecha} a las ${hora}.`;
  const url = `https://wa.me/${numeroDestino}?text=${encodeURIComponent(mensaje)}`;
  window.open(url, "_blank");
}



        // NUEVA FUNCIONALIDAD: GESTIÓN DE HORARIOS PERSONALIZADOS

        function activarModoHorarios() {
            modoBloqueoDias = false;
            modoGestionHorarios = true;
            cerrarModal('modal-control');
            generarCuadroCalendario();
            console.log("Modo de gestión de horarios ACTIVADO");
            alert("Ahora haz clic en un día para personalizar su horario.");
        }

        function abrirVentanaConfiguracionHorarios() {
            const diaSemana = new Date(fechaSeleccionadaParaConfigurar).getDay();
            const esSabado = diaSemana === 6;

            tituloConfigHorarios.textContent = `Configurar Horario (${fechaSeleccionadaParaConfigurar})`;
            fechaConfigHorarios.textContent = ``;

            document.getElementById("boton-horario-semana").onclick = () => {
                cargarHorasEnModal(horarioSemana);
            };
            document.getElementById("boton-horario-sabado").onclick = () => {
                cargarHorasEnModal(horarioSabado);
            };
            document.getElementById("boton-horario-cerrado").onclick = () => {
                cargarHorasEnModal([]);
            };

            const horarioActual = horariosPersonalizados[fechaSeleccionadaParaConfigurar] || [];
            cargarHorasEnModal(horarioActual);

            modalConfiguracionHorarios.classList.remove("fantasma");
        }

        function cargarHorasEnModal(horasActivas) {
            botonesToggleHoras.innerHTML = "";
            bloquesBase.forEach(hora => {
                const boton = document.createElement("button");
                boton.textContent = hora;
                boton.classList.add("toggle-hora-btn");
                if (horasActivas.includes(hora)) {
                    boton.classList.add("activo");
                }
                boton.onclick = () => {
                    boton.classList.toggle("activo");
                };
                botonesToggleHoras.appendChild(boton);
            });
        }

        function guardarHorarioPersonalizado() {
            const horasSeleccionadas = [];
            document.querySelectorAll("#botones-toggle-horas .activo").forEach(boton => {
                horasSeleccionadas.push(boton.textContent);
            });

            if (horasSeleccionadas.length > 0) {
                horariosRef.child(fechaSeleccionadaParaConfigurar).set(horasSeleccionadas)
                    .then(() => {
                        alert("Horario guardado con éxito.");
                        cerrarModal('modal-configuracion-horarios');
                        modoGestionHorarios = false;
                        generarCuadroCalendario();
                    })
                    .catch(error => {
                        alert("Error al guardar el horario: " + error.message);
                    });
            } else {
                horariosRef.child(fechaSeleccionadaParaConfigurar).remove()
                    .then(() => {
                        alert("Horario borrado con éxito. El día se marcará como cerrado.");
                        cerrarModal('modal-configuracion-horarios');
                        modoGestionHorarios = false;
                        generarCuadroCalendario();
                    })
                    .catch(error => {
                        alert("Error al borrar el horario: " + error.message);
                    });
            }
        }
        
let diasDeLaSemanaBloqueados = []; // debe ser let para poder actualizarla

  async function enviar() {
    try {
      const response = await window.fetch('http://localhost:3000/enviar-notificaciones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: 'Hola', mensaje: 'Mensaje desde el cliente' })
      });

      const result = await response.text();
      console.log('Respuesta del servidor:', result);
    } catch (error) {
      console.error('Error al enviar la notificación:', error);
    }
  }document.getElementById('solicitar').addEventListener('click', async () => {
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await messaging.getToken({ vapidKey: 'LPiNDM_XNqEyUax9FouVf80pSRw0RKakQcr3uWolXio' });
      console.log('Token:', token);

      // Aquí puedes guardar el token en tu base de datos para enviarle notificaciones después
      await fetch('/guardar-token', {
        method: 'POST',
        body: JSON.stringify({ token }),
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (err) {
    console.error('Error al solicitar permiso:', err);
  }
});



        // Función para generar los nombres de los días de la semana

        function generarDiasSemana() {

            const contenedorDias = document.querySelector(".dias-semana");

            const dias = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];



            contenedorDias.innerHTML = ""; // Limpia el contenedor para evitar duplicados

            dias.forEach(nombreDia => {

                const diaElemento = document.createElement("div");

                diaElemento.classList.add("dia-semana");

                diaElemento.textContent = nombreDia;

                contenedorDias.appendChild(diaElemento);

            });

        }



        // Tu función principal para generar los días del mes

        function generarCuadroCalendario() {

            const mesStr = `${fechaActualCalendario.getFullYear()}-${String(fechaActualCalendario.getMonth() + 1).padStart(2, "0")}`;

            cuadroCalendario.innerHTML = "";

            const [anio, mes] = mesStr.split("-");

            const fechaInicio = new Date(anio, mes - 1, 1);

            const primerDiaSemana = fechaInicio.getDay();

            const totalDias = new Date(anio, mes, 0).getDate();

            const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;



            for (let i = 0; i < offset; i++) {

                const vacio = document.createElement("div");

                cuadroCalendario.appendChild(vacio);

            }



            for (let dia = 1; dia <= totalDias; dia++) {

                const fechaActual = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

                const celda = document.createElement("div");

                celda.classList.add("diaCalendario");

                celda.textContent = dia;



                const horasReservadas = reservasPorDia[fechaActual] || [];


                const estaBloqueado = diasBloqueados.includes(fechaActual) || horarioDelDia.length === 0;

                const estaOcupado = horasReservadas.length >= horarioDelDia.length;



                if (estaBloqueado) {

                    celda.classList.add("diaBloqueado");

                    celda.title = "Día bloqueado por el administrador";

                } else if (estaOcupado) {

                    celda.classList.add("diaOcupado");

                    celda.title = "Día con todas las horas reservadas";

                } else {

                    celda.classList.add("diaLibre");

                    celda.title = "Día disponible";

                }



                celda.onclick = () => {

                    // ... (tu lógica de clic, que no se modificó) ...

                };

                

                if (!modoBloqueoDias && estaBloqueado) {

                    celda.style.pointerEvents = "none";

                }



                cuadroCalendario.appendChild(celda);

            }

        }



        // Aseguramos que el código se ejecuta una vez que la página ha cargado

        document.addEventListener('DOMContentLoaded', (event) => {

            generarDiasSemana();

            generarCuadroCalendario();

        });
function mostrar(){
    document.getElementById("botonescierraxdiv").hidden = false;
}

  document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById("modalContenedor");
    const botonAbrir = document.getElementById("abrirVentana");
    const botonCerrar = document.getElementsByClassName("cerrar-modal-personalizado")[0];

    // Asegúrate de que los elementos existen antes de añadir los eventos
    if (botonAbrir) {
        botonAbrir.onclick = function() {
            modal.style.display = "block";
        }
    }

    if (botonCerrar) {
        botonCerrar.onclick = function() {
            modal.style.display = "none";
        }
    }

    window.onclick = function(event) {
        if (event.target == modal) {
            modal.style.display = "none";
        }
    }
}); let fechaBloqueActual = "";
let horaBloqueActual = "";
let elementoTextoBloque = null; 
    // La función que ya tienes para cerrar la modal principal

    function abrirVentanaEditarTexto(fecha, hora, textoActual, elementoTexto) {
  fechaBloqueActual = fecha;
  horaBloqueActual = hora;
  elementoTextoBloque = elementoTexto;
  document.getElementById("inputTextoBloque").value = textoActual;
  document.getElementById("ventanaEditarTexto").style.display = "block";
}



function cerrarVentanaEditarTexto() {
  document.getElementById("ventanaEditarTexto").style.display = "none";
  fechaBloqueActual = "";
  horaBloqueActual = "";
  elementoTextoBloque = null;
}



function cerrarModal(id) {
    document.getElementById(id).style.display = 'none';
}

// Función para cambiar a la vista de cierre de días
function abrirVistaCierre() {
    document.getElementById("contenido-principal").hidden = true;
    document.getElementById("contenido-cierre").hidden = false;
}

// Función para volver a la vista principal del control
function mostrarVistaPrincipal() {
    document.getElementById("contenido-principal").hidden = false;
    document.getElementById("contenido-cierre").hidden = true;
}

// Vincula la función `abrirVistaCierre` al clic del botón
document.addEventListener('DOMContentLoaded', function() {
    const botonVistaCierre = document.getElementById("abrir-vista-cierre");
    if (botonVistaCierre) {
        botonVistaCierre.onclick = abrirVistaCierre;
    }
});
function resetearTodosLosContadores() {
  const ref = firebase.database().ref("reservasPorDia");

  ref.once("value").then(snapshot => {
    const dias = snapshot.val() || {};

    Object.keys(dias).forEach(fecha => {
      const horas = dias[fecha];
      Object.keys(horas).forEach(hora => {
        firebase.database().ref(`reservasPorDia/${fecha}/${hora}`).remove();
      });
    });
  });
}function mostrarTodosLosBotonesMenos() {
  document.querySelectorAll("button").forEach(boton => {
    if (boton.classList.contains("botonmenos")) {
      boton.classList.remove("botonmenos");
    }
  });
}
 function mostrarX(){
        document.getElementById("contenidoEmergente").hidden = false;
    }
        function okultarX(){
        document.getElementById("contenidoEmergente").hidden = true;
    }  document.addEventListener('DOMContentLoaded', function() {
    const botonesDiaSemana = document.querySelectorAll('.btn-dia-semana');

    botonesDiaSemana.forEach(boton => {
        boton.addEventListener('click', function() {
            // El ícono se añade o se quita SOLO del botón actual.
            this.classList.toggle('seleccionado');
        });
    });
});
function limpiarReservasMayoresAUnaño() {
    const fechaLimite = new Date();
    fechaLimite.setFullYear(fechaLimite.getFullYear() - 1);
    const fechaLimiteTimestamp = fechaLimite.getTime();

    // Obtener todas las reservas de la base de datos una sola vez
    reservasRef.once('value')
        .then(snapshot => {
            const actualizaciones = {};
            let hayReservasParaEliminar = false;

            snapshot.forEach(childSnapshot => {
                const reserva = childSnapshot.val();
                const fechaReservaTimestamp = new Date(reserva.fecha).getTime();

                // Si la reserva es más antigua que un año, la marcamos para eliminar
                if (fechaReservaTimestamp < fechaLimiteTimestamp) {
                    actualizaciones[childSnapshot.key] = null;
                    hayReservasParaEliminar = true;
                }
            });

            if (hayReservasParaEliminar) {
                // Borrar las reservas antiguas usando una sola operación
                return reservasRef.update(actualizaciones);
            } else {
                console.log("No se encontraron reservas con más de un año de antigüedad.");
                return Promise.resolve();
            }
        })
        .then(() => {
            console.log("Reservas con más de un año de antigüedad eliminadas exitosamente.");
        })
        .catch(error => {
            console.error("Error al eliminar las reservas antiguas: ", error);
        });
}

document.addEventListener('DOMContentLoaded', function() {
    // Llama a la función de limpieza de reservas al cargar la página
    limpiarReservasMayoresAUnaño();

    // Aquí iría el resto de tu código que se ejecuta al cargar la página,
    // como la generación del calendario, etc.
    generarCuadroCalendario();
}); document.addEventListener('DOMContentLoaded', function() {
    const botonesDiaSemana = document.querySelectorAll('.btn-dia-semana');
    const botonCerrar = document.getElementById('btn-cerrar-menu'); // Asumo que este es el ID de tu botón cerrar

    botonesDiaSemana.forEach(boton => {
        boton.addEventListener('click', function() {
            // Elimina la clase "seleccionado" de todos los botones
            botonesDiaSemana.forEach(btn => btn.classList.remove('seleccionado'));
            
            // Añade la clase "seleccionado" solo al botón clicado
            this.classList.add('seleccionado');

            // Desliza la pantalla hacia el botón de "Cerrar"
            if (botonCerrar) {
                botonCerrar.scrollIntoView({ behavior: 'smooth', block: 'end' });
            }
        });
    });
});
        // Aislamiento del código del modal para evitar conflictos
    (function() {
        const ventanaEmergente = document.getElementById("ventanaEmergenteCierreDias");
        const btnAbrirVentana = document.getElementById("abrirVentana");
        const btnCerrarVentana = document.getElementById("btnCerrarVentana");

        function abrirVentanaEmergente() {
            if (ventanaEmergente) {
                ventanaEmergente.style.display = "block";
            }
        }

        function cerrarVentanaEmergente() {
            if (ventanaEmergente) {
                ventanaEmergente.style.display = "none";
            }
        }

        if (btnAbrirVentana) {
            btnAbrirVentana.onclick = abrirVentanaEmergente;
        }
        
        if (btnCerrarVentana) {
            btnCerrarVentana.onclick = cerrarVentanaEmergente;
        }

        window.onclick = function(event) {
            if (event.target === ventanaEmergente) {
                cerrarVentanaEmergente();
            }
        };

        // Asignar el cierre a los botones de cierre de día
        document.querySelectorAll(".btn-cierre").forEach(btn => {
            btn.addEventListener("click", cerrarVentanaEmergente);
        });
    })();
    
    // Al cargar la página, llama a la función para generar el calendario
    document.addEventListener('DOMContentLoaded', generarCuadroCalendario);  function generarCuadroCalendario() {
            const mesStr = `${fechaActualCalendario.getFullYear()}-${String(fechaActualCalendario.getMonth() + 1).padStart(2, "0")}`;
            const cuadroCalendario = document.getElementById("cuadroCalendario");
            cuadroCalendario.innerHTML = "";
            const [anio, mes] = mesStr.split("-");
            const fechaInicio = new Date(anio, mes - 1, 1);
            const primerDiaSemana = fechaInicio.getDay();
            const totalDias = new Date(anio, mes, 0).getDate();
            const offset = primerDiaSemana === 0 ? 6 : primerDiaSemana - 1;

            const hoy = new Date();
            hoy.setHours(0, 0, 0, 0);

            for (let i = 0; i < offset; i++) {
                const vacio = document.createElement("div");
                cuadroCalendario.appendChild(vacio);
            }

            for (let dia = 1; dia <= totalDias; dia++) {
                const fechaActual = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
                const celda = document.createElement("div");
                celda.classList.add("diaCalendario");
                celda.textContent = dia;

                const fechaCelda = new Date(anio, mes - 1, dia);
                const diaSemana = fechaCelda.getDay();

                const horasReservadas = reservasPorDia[fechaActual] || [];
                
                const estaBloqueado = diasBloqueados.includes(fechaActual) || horarioDelDia.length === 0 || diasDeLaSemanaBloqueados.includes(diaSemana);
                const estaOcupado = horasReservadas.length >= horarioDelDia.length;
                const diaPasado = fechaCelda < hoy;

                if (diaPasado) {
                    celda.classList.add("diaPasado");
                    celda.title = "Este día ya ha pasado";
                } else if (estaBloqueado) {
                    celda.classList.add("diaBloqueado");
                    celda.title = "Día bloqueado por el administrador";
                } else if (estaOcupado) {
                    celda.classList.add("diaOcupado");
                    celda.title = "Día con todas las horas reservadas";
                } else {
                    celda.classList.add("diaLibre");
                    celda.title = "Día disponible";
                }

                if (diaPasado || (!modoBloqueoDias && estaBloqueado)) {
                    celda.style.pointerEvents = "none";
                }

                celda.onclick = () => {
                    if (diaPasado) return;

                    if (modoGestionHorarios) {
                        fechaSeleccionadaParaConfigurar = fechaActual;
                        abrirVentanaConfiguracionHorarios();
                    } else if (modoBloqueoDias) {
                        // Lógica de bloqueo
                    } else {
                        if (!estaBloqueado) {
                            fechaInput.value = fechaActual;
                            abrirVentanaHorarios(fechaActual);
                        }
                    }
                };
                cuadroCalendario.appendChild(celda);
            }
        }

 
        
 function cerrarDiaDeLaSemana(dia) {
  firebase.database().ref(`diasSemanaBloqueados/${dia}`).set(true);
}

function habilitarDiaDeLaSemana(dia) {
  firebase.database().ref(`diasSemanaBloqueados/${dia}`).remove();
}



        document.addEventListener('DOMContentLoaded', function() {
            generarCuadroCalendario();

            const botonMostrar = document.getElementById("mostrarBotonesCierre");
            const botonOcultar = document.getElementById("ocultarBotonesCierre");
            const contenedorBotones = document.getElementById("botonesCierreContainer");

            function toggleMenu() {
                contenedorBotones.classList.toggle("menu-visible");
            }

            if(botonMostrar) botonMostrar.addEventListener('click', toggleMenu);
            if(botonOcultar) botonOcultar.addEventListener('click', toggleMenu);
        });

 function mostrarModalHorarios() {
  // 1. Seleccionar el elemento div por su ID
  const modal = document.getElementById('modal-configuracion-horarios');

  // 2. Verificar si el elemento existe antes de manipularlo
  if (modal) {
    // 3. Eliminar la clase "fantasma"
    modal.classList.remove('fantasma');
    console.log('Se ha quitado la clase "fantasma" del modal.');
  } else {
    console.log('Error: No se encontró el elemento con el ID "modal-configuracion-horarios".');
  }
}  function actiwar() {
                document.getElementById("desactivarBloqueoDias").hidden = false;
                document.getElementById("cerrartodoslos-button").hidden = false;
            }

            function desactiwar() {
                document.getElementById("desactivarBloqueoDias").hidden = true;
             document.getElementById("cerrartodoslos-button").hidden = true;
            }
document.getElementById("botonAdministrar").onclick = () => {
  const clave = prompt("🔐 Ingresa la contraseña de administrador:");

  if (clave === "1188") {
    document.querySelectorAll(".botonmenos").forEach(boton => {
      boton.classList.remove("botonmenos");
      mostrarBotonesEditarTexto();
    });
  } else {
    alert("❌ Contraseña incorrecta");
  }
};   function verbotonesdecierre(){
                document.getElementById("botonescierraxdiv").style.display = 'block';
            }

              function ocultarbotonesdecierre(){
                document.getElementById("botonescierraxdiv").style.display = 'none';
            }

// Asegúrate de que este UID es el de tu cuenta de administrador
const UID_ADMINISTRADOR = "TU_UID_DE_ADMINISTRADOR"; 

// Usa el evento 'onAuthStateChanged' para saber si el usuario está logueado
firebase.auth().onAuthStateChanged((user) => {
    if (user) {
        // Si el usuario está logueado, verifica su UID
        if (user.uid === UID_ADMINISTRADOR) {
            // Si es el administrador, muestra el botón
            const botonBorrar = document.getElementById("boton-listo-borrar");
            if (botonBorrar) {
                botonBorrar.style.display = "block";
            }
        }
    } else {
        // Si no hay usuario logueado, el botón se mantiene oculto
        const botonBorrar = document.getElementById("boton-listo-borrar");
        if (botonBorrar) {
            botonBorrar.style.display = "none";
        }
    }
});   function mostrarBotonBorrar() {
    // Obtiene el elemento del botón
    const boton = document.getElementById("boton-listo-borrar");
    
    // Muestra el botón
    boton.style.display = "block"; 
}

function ocultarBotonBorrar() {
    // Obtiene el elemento del botón
    const boton = document.getElementById("boton-listo-borrar");
    
    // Oculta el botón
    boton.style.display = "none";
}
     // Aquí defines la función que se ejecutará al hacer clic en el botón
        function miFuncionBorrar() {
            alert("¡La función de borrado se ha ejecutado!");
        ocultarBotonesX();
         }