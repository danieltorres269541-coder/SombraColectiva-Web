const IMGBB_API_KEY = "06493ebbb64bc96bb6a089c33bc36ac1";

const firebaseConfig = {
    apiKey: "AIzaSyCb8doF0TmBCO7RHf__KHF8mK7J42Us-Fg",
    authDomain: "sombracolectiva-828ee.firebaseapp.com",
    projectId: "sombracolectiva-828ee",
    storageBucket: "sombracolectiva-828ee.firebasestorage.app",
    messagingSenderId: "589312236715",
    appId: "1:589312236715:web:b26a526318466b3672ebee"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

const centroDefecto = [27.0805, -109.4452];
const zoomDefecto = 15;

const vistaGuardada = sessionStorage.getItem('ultimaVistaMapa');
const vistaInicial = vistaGuardada ? JSON.parse(vistaGuardada) : { centro: centroDefecto, zoom: zoomDefecto };

const map = L.map('mapaPrincipal').setView(vistaInicial.centro, vistaInicial.zoom);

sessionStorage.removeItem('ultimaVistaMapa');

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

const iconoPendiente = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconoProceso = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const iconoSolucionado = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

let grupoClusters = L.markerClusterGroup({ disableClusteringAtZoom: 18 });
let marcadoresGuardados = {};
let contenedorGaleria = document.getElementById('contenedorImagenes');
let contadorReportes = document.getElementById('contadorReportes');

const URL_WEB = window.location.href;
let todosLosReportes = [];
let usuarioActual = null;

auth.onAuthStateChanged((user) => {
    if (user) {
        usuarioActual = user;
        document.getElementById('btnAbrirLogin').style.display = 'none';
        document.getElementById('infoAdmin').style.display = 'flex';
        document.getElementById('txtAdminEmail').innerText = user.email;
    } else {
        usuarioActual = null;
        document.getElementById('btnAbrirLogin').style.display = 'block';
        document.getElementById('infoAdmin').style.display = 'none';
    }
    filtrarReportes();
});

db.collection("reportes").orderBy("fecha", "desc").onSnapshot((querySnapshot) => {
    todosLosReportes = [];
    querySnapshot.forEach((doc) => {
        let datos = doc.data();
        datos.id = doc.id;
        todosLosReportes.push(datos);
    });
    filtrarReportes();
});

function filtrarReportes() {
    let filtroSeleccionado = document.getElementById('filtroCategoria') ? document.getElementById('filtroCategoria').value : "Todos";
    let filtroEstado = document.getElementById('filtroEstado') ? document.getElementById('filtroEstado').value : "Todos";
    let idAbierto = null;

    for (let id in marcadoresGuardados) {
        if (marcadoresGuardados[id].isPopupOpen()) {
            idAbierto = id;
            break;
        }
    }
    
    if(contenedorGaleria) contenedorGaleria.innerHTML = "";
    grupoClusters.clearLayers();
    marcadoresGuardados = {}; 

    let reportesFiltrados = todosLosReportes;

    if (filtroSeleccionado === "MasVotados") {
        reportesFiltrados = [...reportesFiltrados].sort((a, b) => (b.votos || 0) - (a.votos || 0));
    } else if (filtroSeleccionado !== "Todos") {
        reportesFiltrados = reportesFiltrados.filter(r => r.categoria === filtroSeleccionado);
    }

    if (filtroEstado !== "Todos") {
        reportesFiltrados = reportesFiltrados.filter(r => (r.estado || "Pendiente") === filtroEstado);
    }

    if(contadorReportes) contadorReportes.innerText = `${reportesFiltrados.length} activos`;

    if(reportesFiltrados.length === 0 && contenedorGaleria) {
        contenedorGaleria.innerHTML = '<p style="text-align: center; color: #777; font-style: italic; grid-column: 1 / -1;">No hay reportes que coincidan con tu búsqueda.</p>';
    }

    reportesFiltrados.forEach((datos) => {
        let idReporte = datos.id; 
        let cantidadVotos = datos.votos || 0;
        let categoria = datos.categoria || "📍 Zona sin identificar";
        let estado = datos.estado || "Pendiente";
        let fechaP = datos.fechaPlantacion || "";
        
        let iconoUsar = iconoPendiente;
        if (estado === "En proceso") iconoUsar = iconoProceso;
        if (estado === "Solucionado") iconoUsar = iconoSolucionado;

        let miniaturaPopup = datos.imagenUrl ? `<img src="${datos.imagenUrl}" style="width:100%; max-height:100px; margin-top:8px; border-radius:5px; object-fit:cover;">` : "";
        let descripcionPopup = datos.descripcion ? `<p style="margin: 8px 0; font-size: 13px; color: #444; font-style: italic;">"${datos.descripcion}"</p>` : "";
        
        let infoFechaPublica = fechaP ? `<p style="margin:5px 0; font-size:12px; color:#2E7D32; font-weight:bold;">🌳 Plantación: ${fechaP}</p>` : "";

        let controlesAdmin = usuarioActual ? `
            <div style="margin-top:10px; border-top:1px solid #eee; padding-top:10px; text-align:left;">
                <label style="font-size:10px; font-weight:bold; color:#777;">ESTADO:</label>
                <select onchange="cambiarEstado('${idReporte}', this.value)" style="width:100%; margin-bottom:8px; padding:5px; font-size:12px; border-radius:4px; border:1px solid #ccc;">
                    <option value="Pendiente" ${estado === 'Pendiente' ? 'selected' : ''}>🔴 Pendiente</option>
                    <option value="En proceso" ${estado === 'En proceso' ? 'selected' : ''}>🟡 En proceso</option>
                    <option value="Solucionado" ${estado === 'Solucionado' ? 'selected' : ''}>🟢 Solucionado</option>
                </select>
                <label style="font-size:10px; font-weight:bold; color:#777;">FECHA PLANTACIÓN:</label>
                <input type="date" value="${fechaP}" onchange="cambiarFechaPlantacion('${idReporte}', this.value)" style="width:100%; padding:5px; font-size:12px; border-radius:4px; border:1px solid #ccc; box-sizing:border-box;">
                <button onclick="eliminarReporte('${idReporte}')" style="background: #dc3545; color: white; border: none; padding: 5px; margin-top: 8px; cursor: pointer; width: 100%; border-radius: 4px; font-size:12px;">🗑️ Eliminar</button>
            </div>
        ` : `<p style="margin:5px 0; font-size:12px; font-weight:bold;">Estado: ${estado === 'Pendiente' ? '🔴 Pendiente' : estado === 'En proceso' ? '🟡 En proceso' : '🟢 Solucionado'}</p>${infoFechaPublica}`;

        let marcador = L.marker([datos.latitud, datos.longitud], {icon: iconoUsar});
        marcadoresGuardados[idReporte] = marcador; 

        let contenidoPopup = `
            <div style="text-align: center; font-family: Arial; min-width: 160px;">
                <b style="color:#2E7D32;">${categoria}</b>
                ${controlesAdmin}
                ${descripcionPopup}
                ${miniaturaPopup}
                <button id="btn-vote-${idReporte}" onclick="votarReporte('${idReporte}')" style="background: #007bff; color: white; border: none; padding: 5px; margin-top: 10px; cursor: pointer; width: 100%; border-radius: 4px; font-size:12px;">
                    👍 Apoyar (<span id="btn-count-${idReporte}">${cantidadVotos}</span>)
                </button>
            </div>
        `;
        marcador.bindPopup(contenidoPopup);
        grupoClusters.addLayer(marcador);

        if (datos.imagenUrl && contenedorGaleria) {
            let itemGaleria = document.createElement('div');
            itemGaleria.className = 'galeria-item';
            
            let msjWhatsApp = `¡Urge sombra aquí! Apoya este reporte: ${URL_WEB}`;
            let linkWA = `https://api.whatsapp.com/send?text=${encodeURIComponent(msjWhatsApp)}`;

            itemGaleria.innerHTML = `
                <img src="${datos.imagenUrl}" alt="Evidencia" onclick="enfocarMapa(${datos.latitud}, ${datos.longitud}, '${idReporte}')">
                <div class="item-descripcion">
                    <span class="item-categoria">${categoria}</span>
                    <span style="font-size: 11px; font-weight: bold; display: block; margin-bottom: 2px;">
                        ${estado === 'Pendiente' ? '🔴 Pendiente' : estado === 'En proceso' ? '🟡 En proceso' : '🟢 Solucionado'}
                    </span>
                    ${fechaP ? `<span style="font-size:11px; color:#2E7D32; font-weight:bold; display:block; margin-bottom:5px;">📅 Plantación: ${fechaP}</span>` : ''}
                    <span style="color: #555; font-size:13px;">${datos.descripcion ? datos.descripcion : 'Sin descripción'}</span>
                    <div class="item-acciones" style="display: flex; justify-content: space-between; margin-top:10px;">
                        <span id="galeria-vote-${idReporte}">👍 ${cantidadVotos}</span>
                        <a href="${linkWA}" target="_blank" style="text-decoration:none; font-size:12px; color:#2E7D32; font-weight:bold;">📲 Compartir</a>
                    </div>
                </div>
            `;
            contenedorGaleria.appendChild(itemGaleria);
        }
    });
    map.addLayer(grupoClusters);

    if (idAbierto && marcadoresGuardados[idAbierto]) {
        marcadoresGuardados[idAbierto].openPopup();
    }
}

function enfocarMapa(lat, lng, id) {
    map.setView([lat, lng], 18);
    if(marcadoresGuardados[id]) marcadoresGuardados[id].openPopup();
}

let marcadorActual = null;

map.on('click', function(evento) {
    colocarPinTemporal(evento.latlng.lat, evento.latlng.lng);
});

function colocarPinTemporal(latitud, longitud) {
    if (marcadorActual !== null) map.removeLayer(marcadorActual);
    marcadorActual = L.marker([latitud, longitud], {icon: iconoPendiente}).addTo(map);

    let contenidoPopup = `
        <div style="text-align: center;">
            <b>📍 Confirmar ubicación</b><br>
            <div style="display: flex; gap: 5px; margin-top: 10px;">
                <button onclick="borrarMarcador()" style="background: #ccc; border:none; padding: 5px; border-radius:4px; cursor:pointer;">❌</button>
                <button onclick="abrirFormulario()" style="background: #2E7D32; color:white; border:none; padding: 5px 10px; border-radius:4px; cursor:pointer;">📸 Evidencia</button>
            </div>
        </div>
    `;
    marcadorActual.bindPopup(contenidoPopup).openPopup();
}

function ubicarUsuario() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function(posicion) {
            let lat = posicion.coords.latitude;
            let lng = posicion.coords.longitude;
            map.setView([lat, lng], 18);
            colocarPinTemporal(lat, lng);
        }, function(error) { console.error(error); }, { enableHighAccuracy: true });
    }
}

function borrarMarcador() {
    if (marcadorActual !== null) { map.removeLayer(marcadorActual); marcadorActual = null; }
}

function abrirFormulario() {
    map.closePopup();
    document.getElementById('modalEvidencia').style.display = 'block';
}

function cerrarFormulario() {
    document.getElementById('modalEvidencia').style.display = 'none';
}

async function guardarReporte() {
    let inputFoto = document.getElementById('fotoEvidencia');
    let cajaDescripcion = document.getElementById('textoDescripcion'); 
    let menuCategoria = document.getElementById('categoriaReporte');
    let botonSubir = document.getElementById('btnSubir');
    
    let archivoFoto = inputFoto.files[0];
    let textoEscrito = cajaDescripcion.value.trim();
    let categoriaSeleccionada = menuCategoria.value;
    
    if (!categoriaSeleccionada || !archivoFoto) { alert("Faltan datos"); return; }

    botonSubir.innerText = "⏳ Subiendo...";
    botonSubir.disabled = true;

    let latitud = marcadorActual.getLatLng().lat;
    let longitud = marcadorActual.getLatLng().lng;

    try {
        let formData = new FormData();
        formData.append("image", archivoFoto);
        let respuestaImgbb = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        let datosImgbb = await respuestaImgbb.json();
        
        await db.collection("reportes").add({
            latitud: latitud,
            longitud: longitud,
            imagenUrl: datosImgbb.data.url,
            descripcion: textoEscrito,
            categoria: categoriaSeleccionada,
            votos: 0,
            estado: "Pendiente",
            fechaPlantacion: "",
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        location.reload(); 
    } catch (error) {
        alert("Error al subir");
        botonSubir.disabled = false;
    }
}

async function cambiarEstado(idReporte, nuevoEstado) {
    try {
        await db.collection("reportes").doc(idReporte).update({ estado: nuevoEstado });
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function cambiarFechaPlantacion(idReporte, nuevaFecha) {
    try {
        await db.collection("reportes").doc(idReporte).update({ fechaPlantacion: nuevaFecha });
    } catch (error) {
        alert("Error: " + error.message);
    }
}

async function eliminarReporte(idReporte) {
    if (confirm("¿Eliminar reporte?")) {
        await db.collection("reportes").doc(idReporte).delete();
    }
}

async function votarReporte(idReporte) {
    await db.collection("reportes").doc(idReporte).update({ votos: firebase.firestore.FieldValue.increment(1) });
}

function iniciarSesion() {
    let email = document.getElementById('loginEmail').value;
    let pass = document.getElementById('loginPass').value;
    auth.signInWithEmailAndPassword(email, pass)
        .then(() => document.getElementById('modalLogin').style.display = 'none')
        .catch((error) => alert("Error: " + error.message));
}

function cerrarSesion() {
    auth.signOut();
}