// Datos en memoria para filtros
let _entradasData = [];
let _salidasData = [];
let _inventarioData = [];
let _configEstibas = {};
let _codigosData = {};
let _chartInstance = null;

// ===== INIT =====

function initApp(){
  checkAuth();
  configurarSidebar();
  configurarSeccionesPE();
  cargarSelects();
  cargarCodigos();
  verEntradas();
  verSalidas();
  verInventario();
  cargarConfig();
  verUsuarios();
  verPreEntradas();
  setUserInfo();

  let rol = localStorage.getItem("rol");
  showSection(rol === "Producción" ? "preentradas" : "entradas");
}

function checkAuth(){
  if(!localStorage.getItem("usuario")) location.href = "index.html";
}

function setUserInfo(){
  let usuario = localStorage.getItem("usuario");
  let rol = localStorage.getItem("rol");
  document.getElementById("userInfo").innerText = usuario + " · " + rol;
}

function showSection(id){
  document.querySelectorAll(".vista").forEach(v => v.style.display = "none");
  document.getElementById(id).style.display = "block";
}

async function mostrar(id){
  if(!puedeAcceder(id)){
    alert("❌ No tienes permiso para acceder a esta sección");
    return;
  }
  if(id === "config" || id === "usuarios"){
    let ok = await pedirClaveAdmin();
    if(!ok) return;
  }
  showSection(id);
}

function puedeAcceder(id){
  let rol = localStorage.getItem("rol");
  if(rol === "Admin") return true;
  if(rol === "Supervisor") return id !== "config" && id !== "usuarios";
  if(rol === "Operador") return id !== "config" && id !== "usuarios" && id !== "reportes";
  if(rol === "Producción") return id === "preentradas";
  return false;
}

function configurarSidebar(){
  document.querySelectorAll(".sidebar a[data-vista]").forEach(link => {
    let id = link.getAttribute("data-vista");
    link.style.display = puedeAcceder(id) ? "block" : "none";
  });
}

function configurarSeccionesPE(){
  let rol = localStorage.getItem("rol");
  let seccionCrear = document.getElementById("seccionCrearPE");
  let seccionPendientes = document.getElementById("seccionPendientesPE");
  // Producción crea, no confirma. Operador confirma, no crea.
  if(seccionCrear) seccionCrear.style.display = (rol === "Operador") ? "none" : "block";
  if(seccionPendientes) seccionPendientes.style.display = (rol === "Producción") ? "none" : "block";
}

// ===== SELECTS =====

function cargarSelects(){
  llenar("productoE", "referenciaE");
  llenar("productoS", "referenciaS");
  llenar("productoPE", "referenciaPE");
  llenar("nuevoCodigoProd", "nuevoCodigoRef");
  ["filtroEProd", "filtroSProd"].forEach(id => {
    let sel = document.getElementById(id);
    if(!sel) return;
    catalogo.productos.forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`);
  });
}

function llenar(p, r){
  let prod = document.getElementById(p);
  let ref = document.getElementById(r);
  prod.innerHTML = "";
  catalogo.productos.forEach(x => prod.innerHTML += `<option>${x}</option>`);
  prod.onchange = () => {
    ref.innerHTML = "";
    catalogo.referencias[prod.value].forEach(y => ref.innerHTML += `<option>${y}</option>`);
  };
  prod.onchange();
}

// ===== ENTRADAS =====

function entrada(){
  let p = productoE.value;
  let r = referenciaE.value;
  let pac = parseInt(pacasE.value);
  if(!pac) return alert("Ingrese cantidad");

  db.collection("entradas").add({
    fecha: new Date().toLocaleString(),
    fechaISO: new Date().toISOString(),
    producto: p,
    referencia: r,
    pacas: pac,
    usuario: localStorage.getItem("usuario")
  });

  actualizarInventario(p, r, pac);
  pacasE.value = "";
  alert("✅ Entrada registrada");
}

function verEntradas(){
  db.collection("entradas").orderBy("fecha", "desc")
  .onSnapshot(snap => {
    _entradasData = [];
    snap.forEach(doc => _entradasData.push(doc.data()));
    filtrarEntradas();
  });
}

function filtrarEntradas(){
  let desde = document.getElementById("filtroEDesde").value;
  let hasta = document.getElementById("filtroEHasta").value;
  let prod = document.getElementById("filtroEProd").value;
  let buscar = document.getElementById("buscarE").value.toLowerCase();

  let filtrados = _entradasData.filter(x => {
    let fc = x.fechaISO ? x.fechaISO.substring(0, 10) : "";
    if(desde && fc && fc < desde) return false;
    if(hasta && fc && fc > hasta) return false;
    if(prod && x.producto !== prod) return false;
    if(buscar && !`${x.fecha}${x.producto}${x.referencia}${x.pacas}${x.lote||""}${x.usuario}`.toLowerCase().includes(buscar)) return false;
    return true;
  });

  renderTablaEntradas(filtrados);
}

function renderTablaEntradas(data){
  tablaEntradas.innerHTML = "";
  if(!data.length){
    tablaEntradas.innerHTML = '<tr><td colspan="6" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  data.forEach(x => {
    tablaEntradas.innerHTML += `
    <tr>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote || "—"}</td><td>${x.usuario}</td>
    </tr>`;
  });
}

function limpiarFiltrosE(){
  ["filtroEDesde","filtroEHasta","buscarE"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("filtroEProd").value = "";
  filtrarEntradas();
}

function descargarEntradas(){
  if(typeof XLSX === "undefined") return alert("❌ Librería Excel no cargó");
  let data = _entradasData.map(x => ({Fecha:x.fecha, Producto:x.producto, Referencia:x.referencia, Pacas:x.pacas, Usuario:x.usuario}));
  let ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:25},{wch:15},{wch:10},{wch:15}];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Entradas");
  XLSX.writeFile(wb, "Entradas_ONE_CARIBE.xlsx");
}

// ===== SALIDAS =====

function salida(){
  let p = productoS.value;
  let r = referenciaS.value;
  let pac = parseInt(pacasS.value);
  if(!pac) return alert("Ingrese cantidad");

  let clave = p + "_" + r;
  db.collection("inventario").doc(clave).get().then(doc => {
    if(!doc.exists) return alert("Sin inventario para este producto");
    let data = doc.data();
    if(data.pacas < pac) return alert("❌ No hay suficiente stock (" + data.pacas + " pacas disponibles)");

    db.collection("salidas").add({
      fecha: new Date().toLocaleString(),
      fechaISO: new Date().toISOString(),
      producto: p,
      referencia: r,
      pacas: pac,
      usuario: localStorage.getItem("usuario")
    });

    db.collection("inventario").doc(clave).update({ pacas: data.pacas - pac });
    pacasS.value = "";
    alert("✅ Salida registrada");
  });
}

function verSalidas(){
  db.collection("salidas").orderBy("fecha", "desc")
  .onSnapshot(snap => {
    _salidasData = [];
    snap.forEach(doc => _salidasData.push(doc.data()));
    filtrarSalidas();
  });
}

function filtrarSalidas(){
  let desde = document.getElementById("filtroSDesde").value;
  let hasta = document.getElementById("filtroSHasta").value;
  let prod = document.getElementById("filtroSProd").value;
  let buscar = document.getElementById("buscarS").value.toLowerCase();

  let filtrados = _salidasData.filter(x => {
    let fc = x.fechaISO ? x.fechaISO.substring(0, 10) : "";
    if(desde && fc && fc < desde) return false;
    if(hasta && fc && fc > hasta) return false;
    if(prod && x.producto !== prod) return false;
    if(buscar && !`${x.fecha}${x.producto}${x.referencia}${x.pacas}${x.usuario}`.toLowerCase().includes(buscar)) return false;
    return true;
  });

  renderTablaSalidas(filtrados);
}

function renderTablaSalidas(data){
  tablaSalidas.innerHTML = "";
  if(!data.length){
    tablaSalidas.innerHTML = '<tr><td colspan="5" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  data.forEach(x => {
    tablaSalidas.innerHTML += `
    <tr>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.usuario}</td>
    </tr>`;
  });
}

function limpiarFiltrosS(){
  ["filtroSDesde","filtroSHasta","buscarS"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("filtroSProd").value = "";
  filtrarSalidas();
}

function descargarSalidas(){
  if(typeof XLSX === "undefined") return alert("❌ Librería Excel no cargó");
  let data = _salidasData.map(x => ({Fecha:x.fecha, Producto:x.producto, Referencia:x.referencia, Pacas:x.pacas, Usuario:x.usuario}));
  let ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:25},{wch:15},{wch:10},{wch:15}];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Salidas");
  XLSX.writeFile(wb, "Salidas_ONE_CARIBE.xlsx");
}

// ===== INVENTARIO =====

function actualizarInventario(p, r, pac){
  let clave = p + "_" + r;
  db.collection("inventario").doc(clave).get().then(doc => {
    if(!doc.exists){
      db.collection("inventario").doc(clave).set({ producto: p, referencia: r, pacas: pac });
    } else {
      db.collection("inventario").doc(clave).update({ pacas: doc.data().pacas + pac });
    }
  });
}

function verInventario(){
  db.collection("inventario").onSnapshot(snap => {
    tablaInventario.innerHTML = "";
    _inventarioData = [];
    let totalPacas = 0;

    snap.forEach(doc => {
      let x = doc.data();
      _inventarioData.push({ ...x, _id: doc.id });
      totalPacas += x.pacas;

      tablaInventario.innerHTML += `
      <tr>
        <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td>
        <td id="estiba-${doc.id}">...</td>
      </tr>`;

      calcularEstibas(doc.id, x.producto, x.referencia, x.pacas);
    });

    document.getElementById("totales").innerHTML =
      `<span>📦 Total Pacas: <b>${totalPacas}</b></span>`;

    renderChart(_inventarioData);
    checkStockBajo(_inventarioData);
  });
}

function calcularEstibas(id, p, r, pac){
  db.collection("estibas").doc(p + "_" + r).get().then(doc => {
    let el = document.getElementById("estiba-" + id);
    if(!el) return;
    el.innerText = doc.exists ? (pac / doc.data().pacas).toFixed(2) : "—";
  });
}

function renderChart(data){
  let canvas = document.getElementById("chartInv");
  if(!canvas || !data.length) return;

  let grupos = {};
  data.forEach(x => {
    let nombre = x.producto.replace("Agua ", "");
    grupos[nombre] = (grupos[nombre] || 0) + x.pacas;
  });

  let labels = Object.keys(grupos);
  let valores = Object.values(grupos);

  if(_chartInstance) _chartInstance.destroy();

  _chartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: labels,
      datasets: [{
        label: "Pacas",
        data: valores,
        backgroundColor: "#2563eb",
        borderRadius: 6
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });
}

function checkStockBajo(data){
  let alertas = [];
  data.forEach(x => {
    let conf = _configEstibas[x.producto + "_" + x.referencia];
    if(conf && conf.minimo && x.pacas < conf.minimo){
      alertas.push(`${x.producto} - ${x.referencia}: <b>${x.pacas}</b> pacas (mín: ${conf.minimo})`);
    }
  });

  let div = document.getElementById("alertaStock");
  if(!div) return;
  if(alertas.length){
    div.innerHTML = "⚠️ <b>Stock bajo en:</b><br>" + alertas.join("<br>");
    div.classList.add("visible");
  } else {
    div.classList.remove("visible");
  }
}

// ===== CONFIG =====

function cargarConfig(){
  db.collection("estibas").onSnapshot(snap => {
    _configEstibas = {};
    let conf = {};
    snap.forEach(d => {
      _configEstibas[d.id] = d.data();
      conf[d.id] = d.data();
    });

    let html = "";
    catalogo.productos.forEach(p => {
      catalogo.referencias[p].forEach(r => {
        let item = conf[p + "_" + r];
        html += `
        <tr>
          <td>${p}</td>
          <td>${r}</td>
          <td><input id="c-${p}-${r}" type="number" value="${item ? item.pacas : ''}" placeholder="Pacas/estiba"></td>
          <td><input id="m-${p}-${r}" type="number" value="${item && item.minimo ? item.minimo : ''}" placeholder="Mínimo"></td>
          <td><button onclick="guardarFila('${p}','${r}')">Guardar</button></td>
        </tr>`;
      });
    });
    tablaConfig.innerHTML = html;
  });
}

function guardarFila(p, r){
  let val = parseInt(document.getElementById(`c-${p}-${r}`).value);
  let min = parseInt(document.getElementById(`m-${p}-${r}`).value) || 0;
  if(!val) return alert("Ingrese las pacas por estiba");

  db.collection("estibas").doc(p + "_" + r).set({ producto: p, referencia: r, pacas: val, minimo: min });
  alert("✅ Guardado");
}

async function limpiar(tipo){
  let clave = document.getElementById("claveAdmin").value;
  if(!clave) return alert("Ingrese la clave admin");

  try {
    let snap = await db.collection("usuarios").where("rol","==","Admin").where("clave","==",clave).get();
    if(snap.empty) return alert("❌ Clave incorrecta");
  } catch(e) {
    console.error(e);
    alert("Error verificando clave");
    return;
  }

  if(!confirm("¿Eliminar todos los datos de " + tipo + "? Esta acción no se puede deshacer.")) return;

  db.collection(tipo).get().then(snap => {
    snap.forEach(doc => db.collection(tipo).doc(doc.id).delete());
    alert("✅ Eliminado");
  });
}

// ===== USUARIOS =====

function crearUsuario(){
  let u = userN.value.trim();
  let c = passN.value.trim();
  let rol = rolN.value;
  if(!u || !c) return alert("Complete todos los campos");

  db.collection("usuarios").add({ usuario: u, clave: c, rol: rol });
  userN.value = "";
  passN.value = "";
  alert("✅ Usuario creado");
}

function verUsuarios(){
  db.collection("usuarios").onSnapshot(snap => {
    tablaUsuarios.innerHTML = "";
    snap.forEach(doc => {
      let u = doc.data();
      tablaUsuarios.innerHTML += `
      <tr>
        <td>${u.usuario}</td>
        <td><input id="pass-${doc.id}" value="${u.clave}"></td>
        <td>${u.rol}</td>
        <td>
          <button onclick="guardarUsuario('${doc.id}')">💾</button>
          <button onclick="eliminarUsuario('${doc.id}')" class="btn-rojo" style="margin-top:4px;">🗑</button>
        </td>
      </tr>`;
    });
  });
}

function guardarUsuario(id){
  let nueva = document.getElementById("pass-" + id).value;
  if(!nueva) return alert("Ingrese la nueva clave");
  db.collection("usuarios").doc(id).update({ clave: nueva });
  alert("✅ Contraseña actualizada");
}

function eliminarUsuario(id){
  if(!confirm("¿Eliminar este usuario?")) return;
  db.collection("usuarios").doc(id).delete();
}

async function pedirClaveAdmin(){
  let clave = prompt("Ingrese la clave de administrador:");
  if(!clave) return false;
  try {
    let snap = await db.collection("usuarios").where("rol","==","Admin").where("clave","==",clave).get();
    if(!snap.empty) return true;
    alert("❌ Clave incorrecta");
    return false;
  } catch(e) {
    console.error(e);
    alert("Error verificando clave");
    return false;
  }
}

function logout(){
  localStorage.removeItem("usuario");
  localStorage.removeItem("rol");
  location.href = "index.html";
}

// ===== PRE-ENTRADAS =====

function crearPreEntrada(){
  let p = productoPE.value;
  let r = referenciaPE.value;
  let pac = parseInt(pacasPE.value);
  let lote = document.getElementById("lotePE").value.trim();
  if(!pac) return alert("Ingrese cantidad");

  db.collection("preentradas").add({
    fecha: new Date().toLocaleString(),
    fechaISO: new Date().toISOString(),
    producto: p,
    referencia: r,
    pacas: pac,
    lote: lote,
    usuarioProduccion: localStorage.getItem("usuario"),
    estado: "pendiente"
  });

  pacasPE.value = "";
  document.getElementById("lotePE").value = "";
  alert("✅ Pre-entrada enviada al operario");
}

function verPreEntradas(){
  db.collection("preentradas").onSnapshot(snap => {
    let items = [];
    snap.forEach(doc => items.push({ ...doc.data(), _id: doc.id }));
    items.sort((a, b) => (b.fechaISO || "") > (a.fechaISO || "") ? 1 : -1);

    let pendientes = items.filter(x => x.estado === "pendiente");

    // Badge en sidebar
    let badge = document.getElementById("badgePre");
    if(pendientes.length){
      badge.textContent = pendientes.length;
      badge.style.display = "inline";
    } else {
      badge.style.display = "none";
    }

    renderTablaPendientes(pendientes);
    renderTablaHistorialPE(items);
  });
}

function renderTablaPendientes(pendientes){
  let rol = localStorage.getItem("rol");
  let puedeConfirmar = rol === "Operador" || rol === "Supervisor" || rol === "Admin";

  tablaPendientes.innerHTML = "";
  if(!pendientes.length){
    tablaPendientes.innerHTML = '<tr><td colspan="8" class="sin-datos">Sin pre-entradas pendientes</td></tr>';
    return;
  }

  pendientes.forEach(x => {
    let loteEsc = (x.lote || "").replace(/'/g, "\\'");
    tablaPendientes.innerHTML += `
    <tr>
      <td>${x.fecha}</td>
      <td>${x.producto}</td>
      <td>${x.referencia}</td>
      <td>${x.pacas}</td>
      <td>${x.lote || "—"}</td>
      <td>${x.usuarioProduccion}</td>
      <td><span class="estado-pendiente">Pendiente</span></td>
      <td>
        ${puedeConfirmar ? `
          <button onclick="confirmarPreEntrada('${x._id}','${x.producto}','${x.referencia}',${x.pacas},'${loteEsc}')">✅ Confirmar</button>
          <button onclick="rechazarPreEntrada('${x._id}')" class="btn-rojo" style="margin-top:4px;">❌ Rechazar</button>
        ` : "—"}
      </td>
    </tr>`;
  });
}

function renderTablaHistorialPE(items){
  tablaHistorialPE.innerHTML = "";
  if(!items.length){
    tablaHistorialPE.innerHTML = '<tr><td colspan="8" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  items.forEach(x => {
    let est = x.estado === "confirmado"
      ? '<span class="estado-confirmado">Confirmado</span>'
      : x.estado === "rechazado"
      ? '<span class="estado-rechazado">Rechazado</span>'
      : '<span class="estado-pendiente">Pendiente</span>';

    tablaHistorialPE.innerHTML += `
    <tr>
      <td>${x.fecha}</td>
      <td>${x.producto}</td>
      <td>${x.referencia}</td>
      <td>${x.pacas}</td>
      <td>${x.lote || "—"}</td>
      <td>${x.usuarioProduccion}</td>
      <td>${est}</td>
      <td>${x.usuarioOperario || "—"}</td>
    </tr>`;
  });
}

async function confirmarPreEntrada(id, producto, referencia, pacas, lote){
  if(!confirm(`¿Confirmar pre-entrada de ${pacas} pacas de ${producto} - ${referencia}${lote ? ' (Lote: '+lote+')' : ''}?`)) return;

  try {
    await db.collection("entradas").add({
      fecha: new Date().toLocaleString(),
      fechaISO: new Date().toISOString(),
      producto: producto,
      referencia: referencia,
      pacas: pacas,
      lote: lote || "",
      usuario: localStorage.getItem("usuario")
    });

    actualizarInventario(producto, referencia, pacas);

    await db.collection("preentradas").doc(id).update({
      estado: "confirmado",
      usuarioOperario: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });

    alert("✅ Pre-entrada confirmada e ingresada al inventario");
  } catch(e) {
    console.error(e);
    alert("❌ Error al confirmar: " + e.message);
  }
}

async function rechazarPreEntrada(id){
  if(!confirm("¿Rechazar esta pre-entrada?")) return;
  try {
    await db.collection("preentradas").doc(id).update({
      estado: "rechazado",
      usuarioOperario: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });
    alert("Pre-entrada rechazada");
  } catch(e) {
    console.error(e);
    alert("❌ Error: " + e.message);
  }
}

// ===== EXPORTAR INVENTARIO =====

window.descargarInventario = async function(){
  try {
    if(typeof XLSX === "undefined") return alert("❌ Librería Excel no cargó");
    let snap = await db.collection("inventario").get();
    let data = [];
    for(let doc of snap.docs){
      let x = doc.data();
      let confDoc = await db.collection("estibas").doc(x.producto + "_" + x.referencia).get();
      let estibas = confDoc.exists ? (x.pacas / confDoc.data().pacas).toFixed(2) : 0;
      data.push({ Producto: x.producto, Referencia: x.referencia, Pacas: x.pacas, Estibas: estibas });
    }
    let ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{wch:25},{wch:15},{wch:10},{wch:10}];
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "Inventario_ONE_CARIBE.xlsx");
  } catch(e) {
    console.error(e);
    alert("❌ Error al descargar: " + e.message);
  }
}

// ===== SCANNER =====

let _camaraStream = null;
let _camaraDetector = null;
let _camaraTipo = null;
let _camaraInterval = null;

function cargarCodigos(){
  db.collection("codigos").onSnapshot(snap => {
    _codigosData = {};
    snap.forEach(doc => {
      _codigosData[doc.id] = { ...doc.data(), _id: doc.id };
    });
    renderTablaCodigos();
  });
}

function buscarCodigo(codigo, tipo){
  codigo = codigo.trim();
  if(!codigo) return;
  let item = _codigosData[codigo];
  if(!item) return alert("❌ Código no registrado: " + codigo);

  let prodId = tipo === "E" ? "productoE" : "productoS";
  let refId  = tipo === "E" ? "referenciaE" : "referenciaS";
  let pacId  = tipo === "E" ? "pacasE" : "pacasS";
  let scanId = tipo === "E" ? "scanE" : "scanS";

  let prodSel = document.getElementById(prodId);
  prodSel.value = item.producto;
  prodSel.dispatchEvent(new Event("change"));

  setTimeout(() => {
    document.getElementById(refId).value = item.referencia;
    document.getElementById(scanId).value = "";
    document.getElementById(pacId).focus();
  }, 60);
}

function guardarCodigo(){
  let codigo   = document.getElementById("nuevoCodigo").value.trim();
  let producto = document.getElementById("nuevoCodigoProd").value;
  let referencia = document.getElementById("nuevoCodigoRef").value;
  if(!codigo) return alert("Ingrese el código de barras");

  db.collection("codigos").doc(codigo).set({ codigo, producto, referencia });
  document.getElementById("nuevoCodigo").value = "";
  alert("✅ Código guardado");
}

function eliminarCodigo(codigo){
  if(!confirm("¿Eliminar este código?")) return;
  db.collection("codigos").doc(codigo).delete();
}

function renderTablaCodigos(){
  let tabla = document.getElementById("tablaCodigos");
  if(!tabla) return;
  let entries = Object.entries(_codigosData);
  if(!entries.length){
    tabla.innerHTML = '<tr><td colspan="4" class="sin-datos">Sin códigos registrados</td></tr>';
    return;
  }
  tabla.innerHTML = "";
  entries.forEach(([codigo, item]) => {
    tabla.innerHTML += `
    <tr>
      <td>${codigo}</td>
      <td>${item.producto}</td>
      <td>${item.referencia}</td>
      <td><button onclick="eliminarCodigo('${codigo}')" class="btn-rojo">🗑</button></td>
    </tr>`;
  });
}

async function abrirCamara(tipo){
  if(!("BarcodeDetector" in window)){
    alert("Tu navegador no soporta escaneo por cámara.\nUsa Chrome o Edge, o escribe el código manualmente.");
    return;
  }
  _camaraTipo = tipo;
  try {
    _camaraStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    document.getElementById("camaraVideo").srcObject = _camaraStream;
    document.getElementById("modalCamara").style.display = "flex";
    _camaraDetector = new BarcodeDetector({
      formats: ["ean_13","ean_8","code_128","code_39","qr_code","upc_a","upc_e","data_matrix"]
    });
    _camaraInterval = setInterval(scanFrame, 400);
  } catch(e){
    alert("❌ No se pudo acceder a la cámara: " + e.message);
  }
}

async function scanFrame(){
  let video = document.getElementById("camaraVideo");
  if(video.readyState < 2) return;
  try {
    let barcodes = await _camaraDetector.detect(video);
    if(barcodes.length > 0){
      let codigo = barcodes[0].rawValue;
      cerrarCamara();
      buscarCodigo(codigo, _camaraTipo);
    }
  } catch(e){ /* seguir escaneando */ }
}

function cerrarCamara(){
  clearInterval(_camaraInterval);
  if(_camaraStream) _camaraStream.getTracks().forEach(t => t.stop());
  _camaraStream = null;
  document.getElementById("modalCamara").style.display = "none";
}

function imprimirInventario(){
  db.collection("inventario").get().then(snap => {
    let total = 0;
    let totalEstibas = 0;
    let promesas = [];

    snap.forEach(doc => {
      let x = doc.data();
      total += x.pacas;
      let prom = db.collection("estibas").doc(x.producto + "_" + x.referencia).get()
      .then(confDoc => {
        let estibas = 0;
        if(confDoc.exists){
          estibas = (x.pacas / confDoc.data().pacas).toFixed(2);
          totalEstibas += parseFloat(estibas);
        }
        return `<tr><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${estibas}</td></tr>`;
      });
      promesas.push(prom);
    });

    Promise.all(promesas).then(filas => {
      let contenido = `
      <html><head><title>Inventario ONE CARIBE</title>
      <style>
        body{font-family:Arial;padding:30px;color:#111;}
        .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;}
        .titulo{font-size:22px;font-weight:bold;} .sub{font-size:13px;color:#555;}
        table{width:100%;border-collapse:collapse;}
        th{background:#1e293b;color:white;padding:12px;text-align:center;}
        td{padding:12px;border-bottom:1px solid #ddd;text-align:center;}
        tr:nth-child(even){background:#f9fafb;}
        .total{margin-top:20px;text-align:right;font-weight:bold;font-size:15px;}
        .footer{margin-top:30px;text-align:center;font-size:12px;color:#555;}
      </style></head>
      <body>
        <div class="header">
          <div><div class="titulo">ONE CARIBE</div><div class="sub">Reporte de Inventario</div></div>
          <div class="sub">${new Date().toLocaleString()}</div>
        </div>
        <table>
          <tr><th>Producto</th><th>Referencia</th><th>Pacas</th><th>Estibas</th></tr>
          ${filas.join("")}
        </table>
        <div class="total">TOTAL PACAS: ${total} &nbsp;|&nbsp; TOTAL ESTIBAS: ${totalEstibas.toFixed(2)}</div>
        <div class="footer">© 2026 ONE CARIBE</div>
      </body></html>`;

      let w = window.open("");
      w.document.write(contenido);
      w.document.close();
      w.print();
    });
  });
}
