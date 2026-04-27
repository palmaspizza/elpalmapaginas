<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Llamadas Fáciles</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>

    <!-- ===== PANTALLA DE INGRESO ===== -->
    <div id="pantalla-ingreso" class="pantalla">
        <div class="logo-grande">
            <div class="icono-telefono">📞</div>
            <div>Llamadas Fáciles</div>
        </div>

        <div class="campo-grupo">
            <label class="etiqueta-campo">¿Cómo te llamas?</label>
            <input
                type="text"
                id="input-username"
                class="campo-texto"
                placeholder="Escribe tu nombre"
                maxlength="20"
                autocomplete="off"
                onkeydown="if(event.key==='Enter') ingresar()"
            >
        </div>

        <button id="btn-ingresar" class="boton-principal boton-amarillo" onclick="ingresar()">
            ENTRAR 🚪
        </button>

        <div id="error-ingreso" class="mensaje-error" style="display:none"></div>
    </div>

    <!-- ===== PANTALLA DE DIRECTORIO ===== -->
    <div id="pantalla-directorio" class="pantalla" style="display:none">
        <div class="barra-superior">
            <div>
                <div class="titulo-seccion" id="saludo-usuario">📒 Directorio</div>
                <div class="mi-id-badge" id="mi-id-display">Conectando...</div>
            </div>
            <button class="boton-cerrar-sesion" onclick="cerrarSesion()">Salir</button>
        </div>

        <!-- Llamar por ID manualmente -->
        <div class="seccion-llamar-id">
            <input
                type="text"
                id="input-llamar-id"
                class="campo-texto campo-pequeño"
                placeholder="Escribe un ID para llamar"
                autocomplete="off"
                onkeydown="if(event.key==='Enter') llamarPorId()"
            >
            <button class="boton-llamar-id" onclick="llamarPorId()">📞 Llamar</button>
        </div>

        <div class="lista-contactos" id="lista-contactos">
            <div class="sin-contactos">
                <div style="font-size:70px">⏳</div>
                <div>Buscando usuarios...</div>
            </div>
        </div>
    </div>

    <!-- ===== PANTALLA DE LLAMADA ACTIVA ===== -->
    <div id="pantalla-llamada" class="pantalla" style="display:none">
        <div class="contenedor-llamada">
            <div class="avatar-llamada" id="avatar-llamada">?</div>
            <div class="nombre-llamada" id="nombre-llamada">Nombre</div>
            <div class="estado-llamada" id="estado-llamada">Conectando...</div>
            <div class="timer-llamada" id="timer-llamada" style="visibility:hidden">00:00</div>

            <div class="controles-llamada" id="controles-llamada">
                <!-- Se rellena dinámicamente por JS -->
                <button class="boton-control boton-cortar" onclick="colgarLlamada()">📵</button>
            </div>
        </div>
    </div>

    <!-- ===== LLAMADA ENTRANTE (overlay) ===== -->
    <div id="notificacion-entrante" style="display:none">
        <div class="icono-entrante">📞</div>
        <div class="nombre-entrante" id="nombre-entrante">Alguien</div>
        <div class="texto-entrante">Te está llamando...</div>
        <div class="controles-llamada">
            <button class="boton-control boton-aceptar" onclick="aceptarLlamadaEntrante()">📞</button>
            <button class="boton-control boton-cortar" onclick="rechazarLlamada()">📵</button>
        </div>
    </div>

  <script type="module" src="script.js"></script>
</body>
</html>
