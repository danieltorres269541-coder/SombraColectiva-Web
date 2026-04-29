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

const map = L.map('mapaPrincipal').setView([27.0805, -109.4452], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

let marcadoresGuardados = {};

// --- CARGAR REPORTES DESDE FIREBASE ---
db.collection("reportes").get().then((querySnapshot) => {
    querySnapshot.forEach((doc) => {
        let datos = doc.data();
        let idReporte = doc.id; 
        
        let miniatura = datos.imagenUrl ? `<img src="${datos.imagenUrl}" style="width:100%; max-height:100px; margin-top:8px; border-radius:5px;">` : "";
        let descripcionVisual = datos.descripcion ? `<p style="margin: 8px 0; font-size: 13px; color: #444; font-style: italic;">"${datos.descripcion}"</p>` : "";
        
        let marcador = L.marker([datos.latitud, datos.longitud]).addTo(map);
        marcadoresGuardados[idReporte] = marcador; 

        let contenidoPopup = `
            <div style="text-align: center; font-family: Arial; min-width: 150px;">
                <b>🌳 Zona sin sombra</b>
                ${descripcionVisual}
                ${miniatura}
                <button onclick="eliminarReporte('${idReporte}')" style="background: #dc3545; color: white; border: none; padding: 5px; margin-top: 10px; cursor: pointer; width: 100%; border-radius: 4px;">
                    🗑️ Eliminar
                </button>
            </div>
        `;
        
        marcador.bindPopup(contenidoPopup);
    });
});

// --- MAPA INTERACTIVO ---
let marcadorActual = null;

map.on('click', function(evento) {
    let latitud = evento.latlng.lat;
    let longitud = evento.latlng.lng;

    if (marcadorActual !== null) {
        map.removeLayer(marcadorActual);
    }

    marcadorActual = L.marker([latitud, longitud]).addTo(map);

    let contenidoPopup = `
        <div style="text-align: center; font-family: Arial;">
            <b style="color: #333;">📍 Confirmar ubicación</b><br>
            <p style="margin: 8px 0; font-size: 12px; color: #666;">
                Lat: ${latitud.toFixed(4)}, Lng: ${longitud.toFixed(4)}
            </p>
            <div style="display: flex; justify-content: space-around; margin-top: 10px;">
                <button onclick="borrarMarcador()" style="background: #dc3545; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">
                    ❌ Cancelar
                </button>
                <button onclick="abrirFormulario()" style="background: #28a745; color: white; border: none; padding: 5px 8px; border-radius: 4px; cursor: pointer;">
                    📸 Evidencia
                </button>
            </div>
        </div>
    `;

    marcadorActual.bindPopup(contenidoPopup).openPopup();
});

function borrarMarcador() {
    if (marcadorActual !== null) {
        map.removeLayer(marcadorActual);
        marcadorActual = null;
    }
}

function abrirFormulario() {
    map.closePopup();
    document.getElementById('modalEvidencia').style.display = 'block';
}

function cerrarFormulario() {
    document.getElementById('modalEvidencia').style.display = 'none';
}

async function guardarReporte() {
    let inputElemento = document.getElementById('fotoEvidencia');
    let cajaDescripcion = document.getElementById('textoDescripcion'); // Capturamos la caja de texto
    
    let archivoFoto = inputElemento.files[0];
    let textoEscrito = cajaDescripcion ? cajaDescripcion.value.trim() : "";
    
    if (!archivoFoto) {
        alert("Por favor, selecciona una foto antes de enviar.");
        return;
    }

    let latitud = marcadorActual.getLatLng().lat;
    let longitud = marcadorActual.getLatLng().lng;

    alert("Subiendo reporte... por favor espera.");

    try {
        let formData = new FormData();
        formData.append("image", archivoFoto);

        let respuestaImgbb = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
            method: "POST",
            body: formData
        });

        let datosImgbb = await respuestaImgbb.json();

        if (!datosImgbb.success) {
            throw new Error("Error en ImgBB");
        }

        let urlDeLaFoto = datosImgbb.data.url;

        // Guardamos también la descripción en Firebase
        let docRef = await db.collection("reportes").add({
            latitud: latitud,
            longitud: longitud,
            imagenUrl: urlDeLaFoto,
            descripcion: textoEscrito,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
        });

        let idNuevo = docRef.id; 
        marcadoresGuardados[idNuevo] = marcadorActual; 

        alert("¡Reporte guardado con éxito!");
        
        cerrarFormulario();
        inputElemento.value = "";
        if (cajaDescripcion) cajaDescripcion.value = ""; // Limpiamos la caja de texto
        
        let descripcionVisual = textoEscrito ? `<p style="margin: 8px 0; font-size: 13px; color: #444; font-style: italic;">"${textoEscrito}"</p>` : "";

        let contenidoPopupFinal = `
            <div style="text-align: center; font-family: Arial; min-width: 150px;">
                <b>🌳 Zona sin sombra</b>
                ${descripcionVisual}
                <img src="${urlDeLaFoto}" style="width:100%; max-height:100px; margin-top:8px; border-radius:5px;">
                <button onclick="eliminarReporte('${idNuevo}')" style="background: #dc3545; color: white; border: none; padding: 5px; margin-top: 10px; cursor: pointer; width: 100%; border-radius: 4px;">
                    🗑️ Eliminar
                </button>
            </div>
        `;

        marcadorActual.bindPopup(contenidoPopupFinal).closePopup();
        marcadorActual = null; 

    } catch (error) {
        console.error(error);
        alert("Error al guardar el reporte.");
    }
}

async function eliminarReporte(idReporte) {
    let confirmar = confirm("¿Estás seguro de que quieres eliminar este reporte?");
    if (!confirmar) return; 

    try {
        await db.collection("reportes").doc(idReporte).delete();

        if (marcadoresGuardados[idReporte]) {
            map.removeLayer(marcadoresGuardados[idReporte]);
            delete marcadoresGuardados[idReporte]; 
        }

        alert("Reporte eliminado correctamente.");
    } catch (error) {
        console.error("Error al eliminar: ", error);
        alert("Hubo un problema al intentar eliminar el reporte.");
    }
}