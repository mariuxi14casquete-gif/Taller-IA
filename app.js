const API_URL = "https://script.google.com/macros/s/AKfycbzayA-sdxq2n5ZD3dc8KPXeU6ONXuk0Vwbte_bbGFQ0cAmuJOv7zOWyun9mu24p96Q/exec";

const STORAGE_KEY = "portalSolicitudesUsuario";

const elementos = {
  seccionLogin: document.getElementById("seccionLogin"),
  seccionApp: document.getElementById("seccionApp"),

  formLogin: document.getElementById("formLogin"),
  correoLogin: document.getElementById("correoLogin"),
  pinLogin: document.getElementById("pinLogin"),
  btnLogin: document.getElementById("btnLogin"),

  nombreUsuario: document.getElementById("nombreUsuario"),
  correoUsuario: document.getElementById("correoUsuario"),

  formSolicitud: document.getElementById("formSolicitud"),
  tipoSolicitud: document.getElementById("tipoSolicitud"),
  titulo: document.getElementById("titulo"),
  descripcion: document.getElementById("descripcion"),
  prioridad: document.getElementById("prioridad"),
  btnGuardarSolicitud: document.getElementById("btnGuardarSolicitud"),

  btnActualizar: document.getElementById("btnActualizar"),
  btnImprimir: document.getElementById("btnImprimir"),
  btnCerrarSesion: document.getElementById("btnCerrarSesion"),

  tbodySolicitudes: document.getElementById("tbodySolicitudes"),

  mensajeCarga: document.getElementById("mensajeCarga"),
  mensajeExito: document.getElementById("mensajeExito"),
  mensajeError: document.getElementById("mensajeError")
};

document.addEventListener("DOMContentLoaded", iniciarApp);

function iniciarApp() {
  elementos.formLogin.addEventListener("submit", manejarLogin);
  elementos.formSolicitud.addEventListener("submit", manejarCrearSolicitud);
  elementos.btnActualizar.addEventListener("click", listarSolicitudes);
  elementos.btnCerrarSesion.addEventListener("click", cerrarSesion);
  elementos.btnImprimir.addEventListener("click", imprimirGuardarPDF);

  const usuarioGuardado = obtenerUsuarioSesion();

  if (usuarioGuardado) {
    mostrarAreaPrincipal(usuarioGuardado);
    listarSolicitudes();
  } else {
    mostrarLogin();
  }
}

async function manejarLogin(evento) {
  evento.preventDefault();

  ocultarMensajes();

  const correo = elementos.correoLogin.value.trim();
  const pin = elementos.pinLogin.value.trim();

  if (!correo || !pin) {
    mostrarError("Ingresa correo y PIN para continuar.");
    return;
  }

  try {
    establecerCarga(true, "Validando usuario...");

    const respuesta = await enviarDatos({
      accion: "login",
      correo,
      pin
    });

    if (!respuesta.ok || !respuesta.usuario) {
      throw new Error(respuesta.mensaje || "Credenciales inválidas.");
    }

    const usuario = {
      idUsuario: respuesta.usuario.idUsuario || "",
      nombre: respuesta.usuario.nombre || "",
      correo: respuesta.usuario.correo || correo,
      estado: respuesta.usuario.estado || ""
    };

    if (!usuario.idUsuario || !usuario.correo) {
      throw new Error("La información del usuario está incompleta.");
    }

    guardarUsuarioSesion(usuario);
    elementos.formLogin.reset();
    mostrarAreaPrincipal(usuario);
    mostrarExito("Ingreso realizado correctamente.");
    await listarSolicitudes();
  } catch (error) {
    mostrarError(error.message || "No fue posible iniciar sesión.");
  } finally {
    establecerCarga(false);
  }
}

async function manejarCrearSolicitud(evento) {
  evento.preventDefault();

  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    mostrarError("La sesión no está activa. Ingresa nuevamente.");
    cerrarSesion();
    return;
  }

  const tipoSolicitud = elementos.tipoSolicitud.value.trim();
  const titulo = elementos.titulo.value.trim();
  const descripcion = elementos.descripcion.value.trim();
  const prioridad = elementos.prioridad.value.trim();

  if (!tipoSolicitud || !titulo || !descripcion || !prioridad) {
    mostrarError("Completa todos los campos de la solicitud.");
    return;
  }

  try {
    establecerCarga(true, "Guardando solicitud...");

    const respuesta = await enviarDatos({
      accion: "crearSolicitud",
      idUsuario: usuario.idUsuario,
      solicitante: usuario.nombre,
      correo: usuario.correo,
      tipoSolicitud,
      titulo,
      descripcion,
      prioridad
    });

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || "No fue posible guardar la solicitud.");
    }

    elementos.formSolicitud.reset();
    mostrarExito("Solicitud registrada correctamente.");
    await listarSolicitudes();
  } catch (error) {
    mostrarError(error.message || "No fue posible guardar la solicitud.");
  } finally {
    establecerCarga(false);
  }
}

async function listarSolicitudes() {
  ocultarMensajes();

  const usuario = obtenerUsuarioSesion();

  if (!usuario) {
    mostrarLogin();
    return;
  }

  try {
    establecerCarga(true, "Consultando solicitudes...");

    const respuesta = await enviarDatos({
      accion: "listarSolicitudes",
      idUsuario: usuario.idUsuario,
      correo: usuario.correo
    });

    if (!respuesta.ok) {
      throw new Error(respuesta.mensaje || "No fue posible consultar las solicitudes.");
    }

    construirTabla(respuesta.solicitudes || []);
  } catch (error) {
    construirTabla([]);
    mostrarError(error.message || "No fue posible consultar las solicitudes.");
  } finally {
    establecerCarga(false);
  }
}

async function enviarDatos(datos) {
  validarApiUrl();

  const cuerpo = new URLSearchParams();

  Object.entries(datos).forEach(([clave, valor]) => {
    cuerpo.append(clave, valor == null ? "" : String(valor));
  });

  const respuesta = await fetch(API_URL, {
    method: "POST",
    body: cuerpo
  });

  if (!respuesta.ok) {
    throw new Error("Error de conexión con el servidor.");
  }

  const texto = await respuesta.text();

  try {
    return JSON.parse(texto);
  } catch (error) {
    throw new Error("La respuesta del servidor no tiene un formato válido.");
  }
}

function construirTabla(solicitudes) {
  elementos.tbodySolicitudes.innerHTML = "";

  if (!Array.isArray(solicitudes) || solicitudes.length === 0) {
    const fila = document.createElement("tr");
    fila.id = "filaSinSolicitudes";

    const celda = document.createElement("td");
    celda.colSpan = 7;
    celda.textContent = "No existen solicitudes registradas.";

    fila.appendChild(celda);
    elementos.tbodySolicitudes.appendChild(fila);
    return;
  }

  solicitudes.forEach((solicitud) => {
    const fila = document.createElement("tr");

    agregarCelda(fila, solicitud.idSolicitud);
    agregarCelda(fila, solicitud.fechaRegistro);
    agregarCelda(fila, solicitud.tipoSolicitud);
    agregarCelda(fila, solicitud.titulo);
    agregarCelda(fila, solicitud.descripcion);
    agregarCelda(fila, solicitud.prioridad);
    agregarCelda(fila, solicitud.estado);

    elementos.tbodySolicitudes.appendChild(fila);
  });
}

function agregarCelda(fila, valor) {
  const celda = document.createElement("td");
  celda.textContent = valor == null || valor === "" ? "-" : String(valor);
  fila.appendChild(celda);
}

function mostrarAreaPrincipal(usuario) {
  elementos.seccionLogin.hidden = true;
  elementos.seccionApp.hidden = false;

  elementos.nombreUsuario.textContent = usuario.nombre || "-";
  elementos.correoUsuario.textContent = usuario.correo || "-";
}

function mostrarLogin() {
  elementos.seccionApp.hidden = true;
  elementos.seccionLogin.hidden = false;

  elementos.nombreUsuario.textContent = "";
  elementos.correoUsuario.textContent = "";
  construirTabla([]);
}

function guardarUsuarioSesion(usuario) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(usuario));
}

function obtenerUsuarioSesion() {
  const datos = sessionStorage.getItem(STORAGE_KEY);

  if (!datos) {
    return null;
  }

  try {
    return JSON.parse(datos);
  } catch (error) {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function cerrarSesion() {
  sessionStorage.removeItem(STORAGE_KEY);

  elementos.formLogin.reset();
  elementos.formSolicitud.reset();

  ocultarMensajes();
  mostrarLogin();
  mostrarExito("Sesión cerrada correctamente.");
}

function imprimirGuardarPDF() {
  window.print();
}

function establecerCarga(activo, texto) {
  elementos.mensajeCarga.textContent = texto || "Cargando información...";
  elementos.mensajeCarga.hidden = !activo;

  elementos.btnLogin.disabled = activo;
  elementos.btnGuardarSolicitud.disabled = activo;
  elementos.btnActualizar.disabled = activo;
  elementos.btnImprimir.disabled = activo;
  elementos.btnCerrarSesion.disabled = activo;
}

function mostrarExito(mensaje) {
  elementos.mensajeExito.textContent = mensaje || "Operación realizada correctamente.";
  elementos.mensajeExito.hidden = false;
  elementos.mensajeError.hidden = true;

  setTimeout(() => {
    elementos.mensajeExito.hidden = true;
  }, 3500);
}

function mostrarError(mensaje) {
  elementos.mensajeError.textContent = mensaje || "No fue posible completar la operación.";
  elementos.mensajeError.hidden = false;
  elementos.mensajeExito.hidden = true;
}

function ocultarMensajes() {
  elementos.mensajeCarga.hidden = true;
  elementos.mensajeExito.hidden = true;
  elementos.mensajeError.hidden = true;
}

function validarApiUrl() {
  if (!API_URL || API_URL === "PEGAR_AQUI_LA_URL_DE_APPS_SCRIPT") {
    throw new Error("Configura la URL de Apps Script en API_URL antes de usar el portal.");
  }
}
