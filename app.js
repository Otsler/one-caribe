let _entradasData   = [];
let _salidasData    = [];
let _inventarioData = [];
let _preentradasData= [];
let _configEstibas  = {};
let _chartInstance  = null;
let _permisosData   = {};
let _catalogo       = { productos: [], referencias: {} };
let _currentSection   = "";
let _capacidades      = {};   // { Principal: 100, Galapa: 50, ... }
let _chartOcupacion   = null;
let _sucursalesData   = [];
let _trasladosData    = [];
let _viewSucursal     = null;   // inventario viewer para Admin/Principal
let _unsubInventario  = null;   // listener activo de inventario

const _permisosDefault = {
  "Admin":      { dashboard:true,  preentradas:true,  entradas:true,  salidas:true,  inventario:true,  reportes:true,  config:true,  usuarios:true,  traslados:true  },
  "Supervisor": { dashboard:true,  preentradas:true,  entradas:true,  salidas:true,  inventario:true,  reportes:true,  config:false, usuarios:false, traslados:true  },
  "Operador":   { dashboard:false, preentradas:false, entradas:true,  salidas:true,  inventario:true,  reportes:false, config:false, usuarios:false, traslados:true  },
  "Producción": { dashboard:false, preentradas:true,  entradas:false, salidas:false, inventario:false, reportes:false, config:false, usuarios:false, traslados:false }
};
const _vistas = ['dashboard','preentradas','entradas','salidas','inventario','traslados','reportes','config','usuarios'];
const _vistasNombres = {
  dashboard:'🏠 Dashboard', preentradas:'📋 Pre-entradas', entradas:'📥 Entradas',
  salidas:'📤 Salidas', inventario:'📦 Inventario', traslados:'🔄 Traslados',
  reportes:'📊 Reportes', config:'⚙️ Config', usuarios:'👥 Usuarios'
};
let _rolesConfig = ['Admin','Supervisor','Operador','Producción'];

function localISO() {
  let d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}T${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
}

function toast(msg, tipo = "success") {
  let cont = document.getElementById("toastContainer");
  if (!cont) return;
  let div = document.createElement("div");
  div.className = `toast toast-${tipo}`;
  div.innerHTML = msg;
  cont.appendChild(div);
  requestAnimationFrame(() => div.classList.add("show"));
  setTimeout(() => {
    div.classList.remove("show");
    setTimeout(() => div.remove(), 350);
  }, 3500);
}

let _spinnerCount = 0;
function showSpinner() {
  _spinnerCount++;
  let s = document.getElementById("spinner");
  if (s) s.style.display = "flex";
}
function hideSpinner() {
  _spinnerCount = Math.max(0, _spinnerCount - 1);
  if (!_spinnerCount) {
    let s = document.getElementById("spinner");
    if (s) s.style.display = "none";
  }
}

function pedirTexto(titulo, placeholder, tipo = "text") {
  return new Promise(resolve => {
    let modal  = document.getElementById("modalInput");
    let tit    = document.getElementById("modalInputTitulo");
    let inp    = document.getElementById("modalInputField");
    let btnOk  = document.getElementById("modalInputOk");
    let btnCan = document.getElementById("modalInputCancel");

    tit.innerText      = titulo;
    inp.type           = tipo;
    inp.placeholder    = placeholder;
    inp.value          = "";
    inp.style.borderColor = "";
    modal.style.display = "flex";
    setTimeout(() => inp.focus(), 80);

    function done(val) {
      modal.style.display = "none";
      inp.type = "text";
      btnOk.onclick  = null;
      btnCan.onclick = null;
      inp.onkeydown  = null;
      resolve(val);
    }

    btnOk.onclick  = () => { let v = inp.value.trim(); if (!v) { inp.style.borderColor="#dc2626"; return; } done(v); };
    btnCan.onclick = () => done(null);
    inp.onkeydown  = e => { if (e.key === "Enter") { let v = inp.value.trim(); if (!v) return; done(v); } };
  });
}

function abrirModalEditar(tipo, datos) {
  return new Promise(resolve => {
    let modal      = document.getElementById("modalEditar");
    let titulo     = document.getElementById("modalEditarTitulo");
    let inpPacas   = document.getElementById("modalEditarPacas");
    let inpLote    = document.getElementById("modalEditarLote");
    let inpNotas   = document.getElementById("modalEditarNotas");
    let rowNotas   = document.getElementById("modalEditarNotasRow");
    let btnOk      = document.getElementById("modalEditarOk");
    let btnCan     = document.getElementById("modalEditarCancel");
    let btnAnular  = document.getElementById("modalEditarAnular");

    titulo.innerText   = `Editar ${tipo}`;
    inpPacas.value     = datos.pacas || "";
    inpLote.value      = datos.lote  || "";
    inpNotas.value     = datos.notas || "";
    if (rowNotas) rowNotas.style.display = tipo === "Salida" ? "block" : "none";
    modal.style.display = "flex";
    setTimeout(() => inpPacas.focus(), 80);

    function done(val) {
      modal.style.display = "none";
      btnOk.onclick     = null;
      btnCan.onclick    = null;
      btnAnular.onclick = null;
      resolve(val);
    }

    btnOk.onclick = () => {
      let pac = parseInt(inpPacas.value);
      if (!pac || pac <= 0) { toast("Ingrese una cantidad válida", "error"); return; }
      done({ accion:"editar", pacas:pac, lote:inpLote.value.trim(), notas:inpNotas.value.trim() });
    };
    btnAnular.onclick = () => {
      if (!confirm("¿Anular este movimiento? El inventario será revertido y no se puede deshacer.")) return;
      done({ accion:"anular" });
    };
    btnCan.onclick = () => done(null);
  });
}

async function initApp() {
  checkAuth();
  showSpinner();
  try {
    await cargarRoles();
    await cargarPermisos();
    await cargarCatalogo();
    await cargarCapacidadBodega();
    await cargarSucursalUsuario();
    await cargarSucursales();
    configurarSidebar();
    configurarSeccionesPE();
    cargarSelects();
    verEntradas();
    verSalidas();
    verInventario();
    cargarConfig();
    verUsuarios();
    verPreEntradas();
    verTraslados();
    setUserInfo();

    let rol = localStorage.getItem("rol");
    let seccionGuardada = localStorage.getItem("seccionActiva");
    let seccionInicial = (seccionGuardada && puedeAcceder(seccionGuardada))
                       ? seccionGuardada
                       : (rol === "Admin" || rol === "Supervisor") ? "dashboard"
                       : (rol === "Operador") ? "entradas" : "preentradas";
    if (!puedeAcceder(seccionInicial)) {
      for (let v of _vistas) { if (puedeAcceder(v)) { seccionInicial = v; break; } }
    }
    showSection(seccionInicial);

    let origT = document.getElementById("origenTraslado");
    if (origT) origT.addEventListener("change", _actualizarStockTraslado);
    iniciarInactividadWatch();
    registrarAuditoria("sesion", null, "LOGIN", { usuario: localStorage.getItem("usuario") }, null);
  } finally {
    setTimeout(hideSpinner, 600);
  }
}

function checkAuth() {
  if (!localStorage.getItem("usuario")) location.href = "index.html";
}

function setUserInfo() {
  let usuario = localStorage.getItem("usuario");
  let rol     = localStorage.getItem("rol");
  document.getElementById("userInfo").innerText = usuario + " · " + rol;
}

function showSection(id) {
  document.querySelectorAll(".vista").forEach(v => v.style.display = "none");
  let el = document.getElementById(id);
  if (el) el.style.display = "block";
  _currentSection = id;
  localStorage.setItem("seccionActiva", id);

  document.querySelectorAll(".sidebar a[data-vista]").forEach(link => {
    link.classList.toggle("activo", link.getAttribute("data-vista") === id);
  });

  let filtInv = document.getElementById("filtroSucursalInv");
  if (filtInv) {
    let rol = localStorage.getItem("rol");
    let suc = getSucursalActual();
    filtInv.style.display = (id === "inventario" && (rol === "Admin" || suc === "Principal")) ? "block" : "none";
  }

  if (id === "config") {
    _actualizarInputCapacidad();
    let suc    = getSucursalActual();
    let rol    = localStorage.getItem("rol");
    let secSuc = document.getElementById("seccionSucursales");
    if (secSuc) secSuc.style.display = (suc === "Principal" || rol === "Admin") ? "block" : "none";
  }
  if (id === "dashboard") renderDashboard();
}

async function mostrar(id) {
  if (!puedeAcceder(id)) {
    toast("❌ No tienes permiso para acceder a esta sección", "error");
    return;
  }
  if (id === "config" || id === "usuarios") {
    let ok = await pedirClaveAdmin();
    if (!ok) return;
  }
  showSection(id);
}

function puedeAcceder(id) {
  let rol = localStorage.getItem("rol");
  if (rol === "Admin") return true;
  let perms = _permisosData[rol] || _permisosDefault[rol] || {};
  return perms[id] === true;
}

function configurarSidebar() {
  document.querySelectorAll(".sidebar a[data-vista]").forEach(link => {
    let id = link.getAttribute("data-vista");
    link.style.display = puedeAcceder(id) ? "block" : "none";
  });
}

function configurarSeccionesPE() {
  let rol = localStorage.getItem("rol");
  let suc = getSucursalActual();
  let seccionCrear = document.getElementById("seccionCrearPE");
  if (seccionCrear) seccionCrear.style.display = (rol === "Operador") ? "none" : "block";
  // Pre-entradas pendientes solo aplica para la sucursal Principal
  let secPE = document.getElementById("seccionPendientesPE");
  if (secPE) secPE.style.display = (suc === "Principal") ? "block" : "none";
}

// ===== CATALOGO DE PRODUCTOS (Firestore) =====
function _catalogoDocId(suc, p) {
  return suc === "Principal" ? p : suc + "_" + p;
}

function _parsearCatalogo(snap, suc) {
  let cat = { productos: [], referencias: {} };
  snap.forEach(doc => {
    let d = doc.data();
    if (suc === "Principal" && d.sucursal && d.sucursal !== "Principal") return;
    cat.productos.push(d.producto);
    cat.referencias[d.producto] = d.referencias || [];
  });
  cat.productos.sort();
  return cat;
}

async function cargarCatalogo() {
  let suc   = getSucursalActual();
  let query = suc === "Principal"
    ? db.collection("catalogoProductos")
    : db.collection("catalogoProductos").where("sucursal","==",suc);

  try {
    let snap = await query.get();
    let cat  = _parsearCatalogo(snap, suc);
    if (cat.productos.length > 0) {
      _catalogo = cat;
    } else if (suc === "Principal" && typeof catalogo !== "undefined") {
      _catalogo = { productos: [...catalogo.productos], referencias: { ...catalogo.referencias } };
      for (let p of catalogo.productos) {
        await db.collection("catalogoProductos").doc(p)
          .set({ sucursal:"Principal", producto: p, referencias: catalogo.referencias[p] || [] });
      }
    }
  } catch(e) {
    console.error("Error cargando catálogo:", e);
    if (typeof catalogo !== "undefined") _catalogo = catalogo;
  }

  query.onSnapshot(snap => {
    let cat = _parsearCatalogo(snap, suc);
    if (cat.productos.length > 0) _catalogo = cat;
    cargarSelects();
    renderTablaCatalogo();
    renderTablaEstibas();
  });
}

function renderTablaCatalogo() {
  let t = document.getElementById("tablaCatalogo");
  if (!t) return;
  if (!_catalogo.productos.length) {
    t.innerHTML = '<tr><td colspan="3" class="sin-datos">Sin productos configurados</td></tr>';
    return;
  }
  t.innerHTML = "";
  _catalogo.productos.forEach(p => {
    (_catalogo.referencias[p] || []).forEach((r, i) => {
      let pEsc = p.replace(/'/g, "\\'");
      let rEsc = r.replace(/'/g, "\\'");
      t.innerHTML += `<tr>
        <td>${i === 0 ? p : ""}</td><td>${r}</td>
        <td><button onclick="eliminarReferencia('${pEsc}','${rEsc}')" class="btn-rojo" style="padding:6px 10px;font-size:12px;">🗑</button></td>
      </tr>`;
    });
  });
}

async function agregarProducto() {
  let suc = getSucursalActual();
  let p   = document.getElementById("nuevoProd").value.trim();
  let r   = document.getElementById("nuevaRef").value.trim();
  if (!p || !r) return toast("Complete producto y referencia", "error");
  let existente = _catalogo.referencias[p] || [];
  if (existente.includes(r)) return toast("Esa referencia ya existe para este producto", "error");
  try {
    await db.collection("catalogoProductos").doc(_catalogoDocId(suc, p))
      .set({ sucursal:suc, producto: p, referencias: [...existente, r] });
    document.getElementById("nuevoProd").value = "";
    document.getElementById("nuevaRef").value  = "";
    toast("✅ Producto/referencia agregado");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

async function eliminarReferencia(p, r) {
  if (!confirm(`¿Eliminar referencia "${r}" del producto "${p}"?`)) return;
  let suc  = getSucursalActual();
  let refs = (_catalogo.referencias[p] || []).filter(x => x !== r);
  try {
    if (refs.length === 0) {
      await db.collection("catalogoProductos").doc(_catalogoDocId(suc, p)).delete();
    } else {
      await db.collection("catalogoProductos").doc(_catalogoDocId(suc, p)).update({ referencias: refs });
    }
    toast("✅ Referencia eliminada");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

function cargarSelects() {
  llenar("productoS", "referenciaS", _actualizarStockSalida);
  llenar("productoPE", "referenciaPE");
  llenar("prodTraslado", "refTraslado", _actualizarStockTraslado);
  llenarSelectSucursales();
  renderCheckboxesSucursales();
  ["filtroEProd", "filtroSProd"].forEach(id => {
    let sel = document.getElementById(id);
    if (!sel) return;
    let current = sel.value;
    sel.innerHTML = '<option value="">Todos los productos</option>';
    _catalogo.productos.forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`);
    sel.value = current;
  });
}

function llenar(p, r, afterChange) {
  let prod = document.getElementById(p);
  let ref  = document.getElementById(r);
  if (!prod || !ref) return;
  prod.innerHTML = "";
  _catalogo.productos.forEach(x => prod.innerHTML += `<option>${x}</option>`);
  prod.onchange = () => {
    ref.innerHTML = "";
    (_catalogo.referencias[prod.value] || []).forEach(y => ref.innerHTML += `<option>${y}</option>`);
    if (afterChange) afterChange();
  };
  if (afterChange) ref.onchange = afterChange;
  prod.onchange();
}

function _actualizarStockSalida() {
  let p  = document.getElementById("productoS")?.value;
  let r  = document.getElementById("referenciaS")?.value;
  let el = document.getElementById("stockDisponibleS");
  if (!el) return;
  let inv = _inventarioData.find(x => x.producto === p && x.referencia === r);
  let stock = inv ? inv.pacas : 0;
  el.textContent = `Disponible: ${stock} pacas`;
  el.style.color = stock > 0 ? "#16a34a" : "#dc2626";
}

function _actualizarStockTraslado() {
  let p      = document.getElementById("prodTraslado")?.value;
  let r      = document.getElementById("refTraslado")?.value;
  let origen = document.getElementById("origenTraslado")?.value;
  let el     = document.getElementById("stockDisponibleT");
  if (!el) return;
  if (!origen) { el.textContent = ""; return; }
  let col   = origen === "Principal" ? "inventario" : "inventarioSucursales";
  let clave = origen === "Principal" ? p + "_" + r : origen + "_" + p + "_" + r;
  db.collection(col).doc(clave).get().then(doc => {
    let stock = doc.exists ? doc.data().pacas : 0;
    el.textContent = `Stock en ${origen}: ${stock} pacas`;
    el.style.color = stock > 0 ? "#16a34a" : "#dc2626";
  });
}

function _actualizarSelectSalida() {
  let prod = document.getElementById("productoS");
  let ref  = document.getElementById("referenciaS");
  if (!prod || !ref) return;
  let conStock = {};
  _inventarioData.forEach(x => {
    if (x.pacas > 0) {
      if (!conStock[x.producto]) conStock[x.producto] = [];
      conStock[x.producto].push(x.referencia);
    }
  });
  let lista = Object.keys(conStock).sort();
  if (!lista.length) { llenar("productoS", "referenciaS", _actualizarStockSalida); return; }
  let curProd = prod.value;
  prod.innerHTML = "";
  lista.forEach(p => prod.innerHTML += `<option>${p}</option>`);
  if (curProd && conStock[curProd]) prod.value = curProd;
  let fillRefs = () => {
    let refs   = conStock[prod.value] || [];
    let curRef = ref.value;
    ref.innerHTML = "";
    refs.forEach(r => ref.innerHTML += `<option>${r}</option>`);
    if (curRef && refs.includes(curRef)) ref.value = curRef;
    _actualizarStockSalida();
  };
  prod.onchange = fillRefs;
  ref.onchange  = _actualizarStockSalida;
  fillRefs();
}

function getCapacidadActual() {
  return _capacidades[getViewSucursal()] || 0;
}

function _actualizarInputCapacidad() {
  let suc = getSucursalActual();
  let inp = document.getElementById("capacidadBodegaInput");
  let lbl = document.getElementById("capSucLabel");
  if (inp) inp.value = _capacidades[suc] || "";
  if (lbl) lbl.textContent = `Sucursal: ${suc}`;
}

async function cargarCapacidadBodega() {
  db.collection("configuracion").doc("capacidades").onSnapshot(doc => {
    _capacidades = doc.exists ? (doc.data() || {}) : {};
    _actualizarInputCapacidad();
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function guardarCapacidadBodega() {
  let val = parseInt(document.getElementById("capacidadBodegaInput").value);
  if (!val || val <= 0) return toast("Ingrese una capacidad válida (número de estibas)", "error");
  let suc = getSucursalActual();
  db.collection("configuracion").doc("capacidades").set({ [suc]: val }, { merge: true });
  toast(`✅ Capacidad guardada para ${suc}`);
}

function calcularEstibasTotales() {
  let total = 0;
  _inventarioData.forEach(x => {
    let conf = _configEstibas[x.producto + "_" + x.referencia];
    if (conf && conf.pacas) total += x.pacas / conf.pacas;
  });
  return total;
}

function renderChartOcupacion(estOcupadas) {
  let canvas = document.getElementById("chartOcupacion");
  let cap    = getCapacidadActual();
  if (!canvas || cap <= 0) return;

  let disponibles = Math.max(0, cap - estOcupadas);
  let pct = Math.min(100, estOcupadas / cap * 100);
  let color = pct >= 95 ? "#dc2626" : pct >= 80 ? "#ea580c" : "#2563eb";

  if (_chartOcupacion) _chartOcupacion.destroy();
  _chartOcupacion = new Chart(canvas.getContext("2d"), {
    type: "doughnut",
    data: {
      labels: ["Ocupadas", "Disponibles"],
      datasets: [{
        data: [parseFloat(estOcupadas.toFixed(2)), parseFloat(disponibles.toFixed(2))],
        backgroundColor: [color, "#e2e8f0"],
        borderWidth: 0,
        hoverOffset: 4
      }]
    },
    options: {
      responsive: false,
      cutout: "72%",
      plugins: { legend: { display: false }, tooltip: { enabled: true } },
      animation: { duration: 600 }
    }
  });
}

function renderDashboard() {
  let cont = document.getElementById("dashboardContent");
  if (!cont) return;

  let _d = new Date();
  let hoy = `${_d.getFullYear()}-${String(_d.getMonth()+1).padStart(2,'0')}-${String(_d.getDate()).padStart(2,'0')}`;
  let suc          = getSucursalActual();
  let rol          = localStorage.getItem("rol");
  let totalPacas   = _inventarioData.reduce((s, x) => s + (x.pacas || 0), 0);
  let entradasHoy  = _entradasData.filter(x => (x.fechaISO || "").startsWith(hoy));
  let salidasHoy   = _salidasData.filter(x  => (x.fechaISO || "").startsWith(hoy));
  let pendientes   = _preentradasData.filter(x => x.estado === "pendiente");
  let trasladosHoy = _trasladosData.filter(x =>
    (x.fechaISO || "").startsWith(hoy) &&
    (rol === "Admin" || x.sucursalOrigen === suc || x.sucursalDestino === suc)
  );
  let estOcupadas  = calcularEstibasTotales();
  let cap          = getCapacidadActual();
  let pct          = cap > 0 ? Math.min(100, estOcupadas / cap * 100) : 0;
  let colorPct     = pct >= 95 ? "#dc2626" : pct >= 80 ? "#ea580c" : "#16a34a";
  let labelPct     = pct >= 95 ? "Bodega casi llena" : pct >= 80 ? "Capacidad alta" : "Nivel normal";

  let alertasStock = [];
  _inventarioData.forEach(x => {
    let conf = _configEstibas[x.producto + "_" + x.referencia];
    if (conf && conf.minimo && x.pacas < conf.minimo)
      alertasStock.push(`${x.producto} ${x.referencia}: <b>${x.pacas}</b> / ${conf.minimo}`);
  });

  let html = `<div class="dash-grid">
    <div class="dash-card dash-blue">
      <div class="dash-icon">📦</div>
      <div class="dash-num">${totalPacas.toLocaleString()}</div>
      <div class="dash-label">Pacas en inventario</div>
    </div>
    <div class="dash-card dash-green">
      <div class="dash-icon">📥</div>
      <div class="dash-num">${entradasHoy.length}</div>
      <div class="dash-label">Entradas hoy · ${entradasHoy.reduce((s,x)=>s+(x.pacas||0),0)} pacas</div>
    </div>
    <div class="dash-card dash-orange">
      <div class="dash-icon">📤</div>
      <div class="dash-num">${salidasHoy.length}</div>
      <div class="dash-label">Salidas hoy · ${salidasHoy.reduce((s,x)=>s+(x.pacas||0),0)} pacas</div>
    </div>
    <div class="dash-card ${trasladosHoy.length ? 'dash-yellow' : 'dash-gray'}">
      <div class="dash-icon">🔄</div>
      <div class="dash-num">${trasladosHoy.length}</div>
      <div class="dash-label">Traslados hoy · ${trasladosHoy.reduce((s,x)=>s+(x.pacas||0),0)} pacas</div>
    </div>
    <div class="dash-card ${pendientes.length ? 'dash-yellow' : 'dash-gray'}">
      <div class="dash-icon">⏳</div>
      <div class="dash-num">${pendientes.length}</div>
      <div class="dash-label">Pre-entradas pendientes</div>
    </div>
  </div>`;

  if (cap > 0) {
    let disponibles = Math.max(0, cap - estOcupadas);
    html += `<div class="dash-ocupacion">
      <h4>Nivel de ocupación de la bodega</h4>
      <div class="dash-ocu-wrap">
        <div class="dash-ocu-canvas-wrap">
          <canvas id="chartOcupacion" width="200" height="200"></canvas>
          <div class="dash-ocu-center">
            <div class="dash-ocu-pct" style="color:${colorPct}">${pct.toFixed(1)}%</div>
            <div class="dash-ocu-label">${labelPct}</div>
          </div>
        </div>
        <div class="dash-ocu-stats">
          <div class="dash-ocu-stat">
            <b style="color:${colorPct}">${estOcupadas.toFixed(1)}</b>
            <span>Estibas ocupadas</span>
          </div>
          <div class="dash-ocu-stat">
            <b>${disponibles.toFixed(1)}</b>
            <span>Estibas disponibles</span>
          </div>
          <div class="dash-ocu-stat">
            <b>${cap}</b>
            <span>Capacidad total</span>
          </div>
        </div>
      </div>
    </div>`;
  } else {
    html += `<div class="alerta-stock visible" style="margin-bottom:16px;">
      ℹ️ Configure la <b>capacidad total de estibas</b> de la bodega en <b>Config</b> para ver el nivel de ocupación.
    </div>`;
  }

  if (alertasStock.length) {
    html += `<div class="alerta-stock visible">
      ⚠️ <b>Stock bajo (${alertasStock.length}):</b><br>${alertasStock.join("<br>")}
    </div>`;
  }

  let recE = _entradasData.slice(0, 5);
  let recS = _salidasData.slice(0, 5);

  html += `<div class="dash-recientes">
    <h4>Últimas 5 entradas</h4>
    <div class="tabla-scroll"><table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Referencia</th><th>Pacas</th><th>Lote</th></tr></thead>
      <tbody>${recE.length ? recE.map(x=>`<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td></tr>`).join("") : '<tr><td colspan="5" class="sin-datos">Sin registros</td></tr>'}</tbody>
    </table></div>
    <h4 style="margin-top:16px;">Últimas 5 salidas</h4>
    <div class="tabla-scroll"><table>
      <thead><tr><th>Fecha</th><th>Producto</th><th>Referencia</th><th>Pacas</th><th>Cliente/Notas</th></tr></thead>
      <tbody>${recS.length ? recS.map(x=>`<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.notas||"—"}</td></tr>`).join("") : '<tr><td colspan="5" class="sin-datos">Sin registros</td></tr>'}</tbody>
    </table></div>
  </div>`;

  cont.innerHTML = html;

  if (cap > 0) renderChartOcupacion(estOcupadas);

  let rolDash = localStorage.getItem("rol");
  if (rolDash === "Admin" && _sucursalesData.length > 0) {
    let divSuc = document.createElement("div");
    divSuc.innerHTML = '<p style="color:#64748b;font-size:13px;margin-top:16px;">⏳ Cargando resumen por sucursal...</p>';
    cont.appendChild(divSuc);
    _renderResumenSucursales(divSuc);
  }
}

async function _renderResumenSucursales(cont) {
  if (!cont) return;
  let sucursales = ["Principal", ..._sucursalesData.map(s => s.nombre)];
  try {
    let rows = await Promise.all(sucursales.map(async suc => {
      let [invSnap, trasSnap] = await Promise.all([
        suc === "Principal"
          ? db.collection("inventario").get()
          : db.collection("inventarioSucursales").where("sucursal","==",suc).get(),
        db.collection("traslados").where("sucursalDestino","==",suc).where("estado","==","en_transito").get()
      ]);
      let pacas = 0;
      invSnap.forEach(doc => pacas += doc.data().pacas || 0);
      let cap = _capacidades[suc] || 0;
      let pct = cap > 0 ? Math.min(100, pacas / cap * 100).toFixed(1) + "%" : "—";
      let colorPct = "";
      if (cap > 0) {
        let p = pacas / cap * 100;
        colorPct = p >= 95 ? "color:#dc2626" : p >= 80 ? "color:#ea580c" : "color:#16a34a";
      }
      return `<tr>
        <td><b>${suc}</b></td>
        <td>${pacas.toLocaleString()}</td>
        <td>${cap || "—"}</td>
        <td style="${colorPct}">${pct}</td>
        <td>${trasSnap.size}</td>
      </tr>`;
    }));
    cont.innerHTML = `<h4 style="margin-top:20px;">Resumen por Sucursal</h4>
      <div class="tabla-scroll"><table>
        <thead><tr><th>Sucursal</th><th>Pacas</th><th>Capacidad (estibas)</th><th>% Ocupación</th><th>Traslados por recibir</th></tr></thead>
        <tbody>${rows.join("")}</tbody>
      </table></div>`;
  } catch(e) {
    cont.innerHTML = `<p style="color:#dc2626;margin-top:16px;">Error cargando resumen: ${e.message}</p>`;
  }
}

function verEntradas() {
  let suc = getSucursalActual();
  db.collection("entradas").orderBy("fecha","desc").onSnapshot(snap => {
    _entradasData = [];
    snap.forEach(doc => {
      let d = doc.data();
      if ((d.sucursal || "Principal") === suc) _entradasData.push({ ...d, _id: doc.id });
    });
    filtrarEntradas();
    renderTablaEntradasSimple(_entradasData.slice(0, 50));
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function renderTablaEntradasSimple(data) {
  let t   = document.getElementById("tablaEntradasSimple");
  if (!t) return;
  let rol     = localStorage.getItem("rol");
  let esAdmin = rol === "Admin";
  if (!data.length) {
    t.innerHTML = '<tr><td colspan="7" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  data.forEach(x => {
    let estilo = x.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '';
    let btnAcc = esAdmin && !x.anulado
      ? `<button onclick="editarEntrada('${x._id}')" style="padding:5px 9px;font-size:12px;">✏️</button>`
      : x.anulado ? '<span style="color:#dc2626;font-size:11px;">Anulado</span>' : '—';
    t.innerHTML += `<tr${estilo}>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuario}</td><td>${btnAcc}</td>
    </tr>`;
  });
}

function filtrarEntradas() {
  let desde  = document.getElementById("filtroEDesde")?.value || "";
  let hasta  = document.getElementById("filtroEHasta")?.value || "";
  let prod   = document.getElementById("filtroEProd")?.value  || "";
  let lote   = (document.getElementById("filtroELote")?.value  || "").toLowerCase();
  let buscar = (document.getElementById("buscarE")?.value      || "").toLowerCase();

  let filtrados = _entradasData.filter(x => {
    let fc = (x.fechaISO || "").substring(0, 10);
    if (desde && fc && fc < desde) return false;
    if (hasta && fc && fc > hasta) return false;
    if (prod  && x.producto !== prod) return false;
    if (lote  && !(x.lote || "").toLowerCase().includes(lote)) return false;
    if (buscar && !`${x.fecha}${x.producto}${x.referencia}${x.pacas}${x.lote||""}${x.usuario}`.toLowerCase().includes(buscar)) return false;
    return true;
  });
  renderTablaEntradas(filtrados);
}

function renderTablaEntradas(data) {
  let t = document.getElementById("tablaEntradas");
  if (!t) return;
  if (!data.length) {
    t.innerHTML = '<tr><td colspan="6" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  data.forEach(x => {
    let estilo = x.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '';
    t.innerHTML += `<tr${estilo}>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuario}</td>
    </tr>`;
  });
}

function limpiarFiltrosE() {
  ["filtroEDesde","filtroEHasta","filtroELote","buscarE"].forEach(id => {
    let el = document.getElementById(id); if (el) el.value = "";
  });
  let sel = document.getElementById("filtroEProd"); if (sel) sel.value = "";
  filtrarEntradas();
}

function descargarEntradas() {
  if (typeof XLSX === "undefined") return toast("❌ Librería Excel no cargó", "error");
  let data = _entradasData.filter(x => !x.anulado).map(x => ({
    Fecha:x.fecha, Producto:x.producto, Referencia:x.referencia,
    Pacas:x.pacas, Lote:x.lote||"", Usuario:x.usuario
  }));
  let ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:25},{wch:15},{wch:10},{wch:15},{wch:15}];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Entradas");
  XLSX.writeFile(wb, "Entradas_ONE_CARIBE.xlsx");
}

async function editarEntrada(id) {
  let item = _entradasData.find(x => x._id === id);
  if (!item) return;
  let res = await abrirModalEditar("Entrada", item);
  if (!res) return;
  showSpinner();
  try {
    let clave = item.producto + "_" + item.referencia;
    if (res.accion === "anular") {
      let inv = await db.collection("inventario").doc(clave).get();
      if (inv.exists) await db.collection("inventario").doc(clave).update({ pacas: inv.data().pacas - item.pacas });
      await db.collection("entradas").doc(id).update({
        anulado: true,
        anuladoPor: localStorage.getItem("usuario"),
        fechaAnulacion: new Date().toLocaleString()
      });
      await registrarAuditoria("entradas", id, "ANULAR", item, null);
      toast("✅ Entrada anulada — inventario revertido");
    } else {
      let diff = item.pacas - res.pacas;
      let inv  = await db.collection("inventario").doc(clave).get();
      if (inv.exists) await db.collection("inventario").doc(clave).update({ pacas: inv.data().pacas - diff });
      await db.collection("entradas").doc(id).update({
        pacas: res.pacas, lote: res.lote,
        editadoPor: localStorage.getItem("usuario"),
        fechaEdicion: new Date().toLocaleString()
      });
      await registrarAuditoria("entradas", id, "EDITAR",
        { pacas: item.pacas, lote: item.lote },
        { pacas: res.pacas,  lote: res.lote });
      toast("✅ Entrada actualizada");
    }
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
  hideSpinner();
}

async function editarSalida(id) {
  let item = _salidasData.find(x => x._id === id);
  if (!item) return;
  let res = await abrirModalEditar("Salida", item);
  if (!res) return;
  showSpinner();
  try {
    let clave = item.producto + "_" + item.referencia;
    if (res.accion === "anular") {
      let inv = await db.collection("inventario").doc(clave).get();
      if (inv.exists) await db.collection("inventario").doc(clave).update({ pacas: inv.data().pacas + item.pacas });
      await db.collection("salidas").doc(id).update({
        anulado: true,
        anuladoPor: localStorage.getItem("usuario"),
        fechaAnulacion: new Date().toLocaleString()
      });
      await registrarAuditoria("salidas", id, "ANULAR", item, null);
      toast("✅ Salida anulada — inventario revertido");
    } else {
      let diff = res.pacas - item.pacas;
      let inv  = await db.collection("inventario").doc(clave).get();
      if (inv.exists) await db.collection("inventario").doc(clave).update({ pacas: inv.data().pacas - diff });
      await db.collection("salidas").doc(id).update({
        pacas: res.pacas, lote: res.lote, notas: res.notas,
        editadoPor: localStorage.getItem("usuario"),
        fechaEdicion: new Date().toLocaleString()
      });
      await registrarAuditoria("salidas", id, "EDITAR",
        { pacas: item.pacas, lote: item.lote, notas: item.notas },
        { pacas: res.pacas,  lote: res.lote,  notas: res.notas });
      toast("✅ Salida actualizada");
    }
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
  hideSpinner();
}

async function registrarAuditoria(coleccion, docId, accion, antes, despues) {
  try {
    await db.collection("auditoria").add({
      coleccion, docId, accion,
      antes: antes || null, despues: despues || null,
      usuario: localStorage.getItem("usuario"),
      fecha: new Date().toLocaleString(),
      fechaISO: localISO()
    });
  } catch(e) { console.error("Auditoria error:", e); }
}

// ===== SALIDAS =====
function salida() {
  let p     = productoS.value;
  let r     = referenciaS.value;
  let pac   = parseInt(pacasS.value);
  let lote  = document.getElementById("loteS").value.trim();
  let notas = document.getElementById("notasS").value.trim();
  if (!pac) return toast("Ingrese cantidad", "error");

  let { col, id: clave } = getInvRef(p, r);
  let suc = getSucursalActual();
  showSpinner();
  db.collection(col).doc(clave).get().then(doc => {
    if (!doc.exists) { hideSpinner(); return toast("Sin inventario para este producto", "error"); }
    let data = doc.data();
    if (data.pacas < pac) { hideSpinner(); return toast(`❌ Stock insuficiente — disponible: ${data.pacas} pacas`, "error"); }

    db.collection("salidas").add({
      fecha: new Date().toLocaleString(), fechaISO: localISO(),
      producto:p, referencia:r, pacas:pac, lote, notas, sucursal: suc,
      usuario: localStorage.getItem("usuario")
    });
    db.collection(col).doc(clave).update({ pacas: data.pacas - pac });
    pacasS.value = "";
    document.getElementById("loteS").value  = "";
    document.getElementById("notasS").value = "";
    hideSpinner();
    toast("✅ Salida registrada");
  }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
}

function verSalidas() {
  let suc = getSucursalActual();
  db.collection("salidas").orderBy("fecha","desc").onSnapshot(snap => {
    _salidasData = [];
    snap.forEach(doc => {
      let d = doc.data();
      if ((d.sucursal || "Principal") === suc) _salidasData.push({ ...d, _id: doc.id });
    });
    filtrarSalidas();
    renderTablaSalidasSimple(_salidasData.slice(0, 50));
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function renderTablaSalidasSimple(data) {
  let t   = document.getElementById("tablaSalidasSimple");
  if (!t) return;
  let rol     = localStorage.getItem("rol");
  let esAdmin = rol === "Admin";
  if (!data.length) {
    t.innerHTML = '<tr><td colspan="8" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  data.forEach(x => {
    let estilo = x.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '';
    let btnAcc = esAdmin && !x.anulado
      ? `<button onclick="editarSalida('${x._id}')" style="padding:5px 9px;font-size:12px;">✏️</button>`
      : x.anulado ? '<span style="color:#dc2626;font-size:11px;">Anulado</span>' : '—';
    t.innerHTML += `<tr${estilo}>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.notas||"—"}</td><td>${x.usuario}</td><td>${btnAcc}</td>
    </tr>`;
  });
}

function filtrarSalidas() {
  let desde  = document.getElementById("filtroSDesde")?.value || "";
  let hasta  = document.getElementById("filtroSHasta")?.value || "";
  let prod   = document.getElementById("filtroSProd")?.value  || "";
  let lote   = (document.getElementById("filtroSLote")?.value  || "").toLowerCase();
  let buscar = (document.getElementById("buscarS")?.value      || "").toLowerCase();

  let filtrados = _salidasData.filter(x => {
    let fc = (x.fechaISO || "").substring(0, 10);
    if (desde && fc && fc < desde) return false;
    if (hasta && fc && fc > hasta) return false;
    if (prod  && x.producto !== prod) return false;
    if (lote  && !(x.lote || "").toLowerCase().includes(lote)) return false;
    if (buscar && !`${x.fecha}${x.producto}${x.referencia}${x.pacas}${x.lote||""}${x.notas||""}${x.usuario}`.toLowerCase().includes(buscar)) return false;
    return true;
  });
  renderTablaSalidas(filtrados);
  renderReporteClientes();
}

function renderTablaSalidas(data) {
  let t = document.getElementById("tablaSalidas");
  if (!t) return;
  if (!data.length) {
    t.innerHTML = '<tr><td colspan="7" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  data.forEach(x => {
    let estilo = x.anulado ? ' style="opacity:.5;text-decoration:line-through"' : '';
    t.innerHTML += `<tr${estilo}>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.notas||"—"}</td><td>${x.usuario}</td>
    </tr>`;
  });
}

function limpiarFiltrosS() {
  ["filtroSDesde","filtroSHasta","filtroSLote","buscarS"].forEach(id => {
    let el = document.getElementById(id); if (el) el.value = "";
  });
  let sel = document.getElementById("filtroSProd"); if (sel) sel.value = "";
  filtrarSalidas();
}

function descargarSalidas() {
  if (typeof XLSX === "undefined") return toast("❌ Librería Excel no cargó", "error");
  let data = _salidasData.filter(x => !x.anulado).map(x => ({
    Fecha:x.fecha, Producto:x.producto, Referencia:x.referencia,
    Pacas:x.pacas, Lote:x.lote||"", "Cliente/Notas":x.notas||"", Usuario:x.usuario
  }));
  let ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:25},{wch:15},{wch:10},{wch:15},{wch:28},{wch:15}];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Salidas");
  XLSX.writeFile(wb, "Salidas_ONE_CARIBE.xlsx");
}

function renderReporteClientes() {
  let t = document.getElementById("tablaReporteClientes");
  if (!t) return;
  let grupos = {};
  _salidasData.filter(x => !x.anulado).forEach(x => {
    let cliente = (x.notas || "").trim() || "Sin cliente";
    if (!grupos[cliente]) grupos[cliente] = { pacas: 0, movimientos: 0 };
    grupos[cliente].pacas += x.pacas || 0;
    grupos[cliente].movimientos++;
  });
  let entradas = Object.entries(grupos).sort((a, b) => b[1].pacas - a[1].pacas);
  if (!entradas.length) {
    t.innerHTML = '<tr><td colspan="3" class="sin-datos">Sin datos</td></tr>';
    return;
  }
  t.innerHTML = entradas.map(([cliente, d]) =>
    `<tr><td>${cliente}</td><td>${d.movimientos}</td><td>${d.pacas.toLocaleString()}</td></tr>`
  ).join("");
}

let _trasladosFiltrados = [];

function llenarFiltrosTraslados() {
  ["filtroTOrigen","filtroTDest"].forEach(selId => {
    let sel = document.getElementById(selId);
    if (!sel) return;
    let cur = sel.value;
    sel.innerHTML = `<option value="">${selId==="filtroTOrigen"?"Todos los orígenes":"Todos los destinos"}</option>`;
    sel.innerHTML += '<option value="Principal">Principal</option>';
    _sucursalesData.forEach(s => sel.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`);
    if (cur) sel.value = cur;
  });
}

function filtrarTraslados() {
  let suc    = getSucursalActual();
  let rol    = localStorage.getItem("rol");
  let desde  = document.getElementById("filtroTDesde")?.value  || "";
  let hasta  = document.getElementById("filtroTHasta")?.value  || "";
  let origen = document.getElementById("filtroTOrigen")?.value || "";
  let dest   = document.getElementById("filtroTDest")?.value   || "";
  let estado = document.getElementById("filtroTEstado")?.value || "";
  let buscar = (document.getElementById("buscarT")?.value      || "").toLowerCase();

  _trasladosFiltrados = _trasladosData.filter(x => {
    if (rol !== "Admin" && x.sucursalOrigen !== suc && x.sucursalDestino !== suc) return false;
    let fc = (x.fechaISO||"").substring(0,10);
    if (desde  && fc < desde) return false;
    if (hasta  && fc > hasta) return false;
    if (origen && x.sucursalOrigen !== origen) return false;
    if (dest   && x.sucursalDestino !== dest)  return false;
    if (estado && x.estado !== estado)         return false;
    if (buscar && !`${x.fecha}${x.producto}${x.referencia}${x.lote||""}${x.sucursalOrigen}${x.sucursalDestino}`.toLowerCase().includes(buscar)) return false;
    return true;
  });

  let t = document.getElementById("tablaReporteTraslados");
  if (!t) return;
  if (!_trasladosFiltrados.length) {
    t.innerHTML = '<tr><td colspan="9" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  _trasladosFiltrados.forEach(x => {
    let est = x.estado === "recibido"
      ? '<span class="estado-confirmado">Recibido</span>'
      : x.estado === "rechazado"
      ? '<span class="estado-rechazado">Rechazado</span>'
      : '<span class="estado-transito">En tránsito</span>';
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.sucursalOrigen}</td><td>${x.sucursalDestino}</td>
      <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td>
      <td>${x.lote||"—"}</td><td>${est}</td><td>${x.usuarioConfirmador||"—"}</td>
    </tr>`;
  });
}

function limpiarFiltrosT() {
  ["filtroTDesde","filtroTHasta","buscarT"].forEach(id => {
    let el = document.getElementById(id); if (el) el.value = "";
  });
  ["filtroTOrigen","filtroTDest","filtroTEstado"].forEach(id => {
    let el = document.getElementById(id); if (el) el.value = "";
  });
  filtrarTraslados();
}

function descargarTraslados() {
  if (typeof XLSX === "undefined") return toast("❌ Librería Excel no cargó", "error");
  let suc = getSucursalActual();
  let data = _trasladosFiltrados.map(x => ({
    Fecha: x.fecha, Origen: x.sucursalOrigen, Destino: x.sucursalDestino,
    Producto: x.producto, Referencia: x.referencia, Pacas: x.pacas,
    Lote: x.lote||"", Estado: x.estado, "Confirmado por": x.usuarioConfirmador||""
  }));
  if (!data.length) return toast("No hay datos para exportar", "error");
  let ws = XLSX.utils.json_to_sheet(data);
  ws["!cols"] = [{wch:22},{wch:16},{wch:16},{wch:25},{wch:15},{wch:8},{wch:15},{wch:12},{wch:18}];
  let wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Traslados");
  XLSX.writeFile(wb, `Traslados_${suc}_ONE_CARIBE.xlsx`);
}

function buscarTrazabilidad() {
  let lote = (document.getElementById("inputTrazLote")?.value || "").trim().toLowerCase();
  if (!lote) return toast("Ingrese un número de lote para buscar", "error");

  let preE = _preentradasData.filter(x => (x.lote||"").toLowerCase().includes(lote));
  let ent  = _entradasData.filter(x    => (x.lote||"").toLowerCase().includes(lote));
  let sal  = _salidasData.filter(x     => (x.lote||"").toLowerCase().includes(lote));
  let tras = _trasladosData.filter(x   => (x.lote||"").toLowerCase().includes(lote));

  let tPE  = document.getElementById("trazPreentradas");
  let tE   = document.getElementById("trazEntradas");
  let tS   = document.getElementById("trazSalidas");
  let tTr  = document.getElementById("trazTraslados");
  let res  = document.getElementById("trazResumen");

  const estadoBadge = e => {
    let cls = e === "recibido" ? "confirmado" : e === "rechazado" ? "rechazado" : "transito";
    return `<span class="estado-${cls}">${e}</span>`;
  };

  if (tPE) tPE.innerHTML = preE.length
    ? preE.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuarioProduccion}</td><td><span class="estado-${x.estado}">${x.estado}</span></td></tr>`).join("")
    : '<tr><td colspan="7" class="sin-datos">Sin registros</td></tr>';

  if (tE) tE.innerHTML = ent.length
    ? ent.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.usuario}</td></tr>`).join("")
    : '<tr><td colspan="5" class="sin-datos">Sin registros</td></tr>';

  if (tS) tS.innerHTML = sal.length
    ? sal.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.notas||"—"}</td><td>${x.usuario}</td></tr>`).join("")
    : '<tr><td colspan="6" class="sin-datos">Sin registros</td></tr>';

  if (tTr) tTr.innerHTML = tras.length
    ? tras.map(x => `<tr><td>${x.fecha}</td><td>${x.sucursalOrigen}</td><td>${x.sucursalDestino}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${estadoBadge(x.estado)}</td></tr>`).join("")
    : '<tr><td colspan="7" class="sin-datos">Sin registros</td></tr>';

  if (res) {
    let pacE = ent.reduce((s,x)=>s+(x.pacas||0),0);
    let pacS = sal.reduce((s,x)=>s+(x.pacas||0),0);
    let pacT = tras.reduce((s,x)=>s+(x.pacas||0),0);
    res.innerHTML = `
      <span>📋 Pre-entradas: <b>${preE.length}</b></span>
      <span>📥 Entradas: <b>${ent.length}</b> (${pacE} pacas)</span>
      <span>📤 Salidas: <b>${sal.length}</b> (${pacS} pacas)</span>
      <span>🔄 Traslados: <b>${tras.length}</b> (${pacT} pacas)</span>
    `;
    res.style.display = "flex";
  }
}

function actualizarInventario(p, r, pac) {
  let clave = p + "_" + r;
  db.collection("inventario").doc(clave).get().then(doc => {
    if (!doc.exists) {
      db.collection("inventario").doc(clave).set({ producto:p, referencia:r, pacas:pac });
    } else {
      db.collection("inventario").doc(clave).update({ pacas: doc.data().pacas + pac });
    }
  });
}

async function _verInventarioConsolidado() {
  let t = document.getElementById("tablaInventario");
  let th = document.getElementById("thSucursalInv");
  if (th) th.style.display = "";
  if (t) t.innerHTML = '<tr><td colspan="5" class="sin-datos">Cargando...</td></tr>';
  try {
    let [sP, sS] = await Promise.all([
      db.collection("inventario").get(),
      db.collection("inventarioSucursales").get()
    ]);
    _inventarioData = [];
    sP.forEach(doc => _inventarioData.push({ ...doc.data(), sucursal:"Principal", _id:doc.id }));
    sS.forEach(doc => _inventarioData.push({ ...doc.data(), _id:doc.id }));
    _inventarioData.sort((a,b) => (a.sucursal+a.producto).localeCompare(b.sucursal+b.producto));
    let total = _inventarioData.reduce((s,x) => s+x.pacas, 0);
    if (t) {
      t.innerHTML = "";
      _inventarioData.forEach(x => {
        t.innerHTML += `<tr><td>${x.sucursal}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>—</td></tr>`;
      });
    }
    document.getElementById("totales").innerHTML =
      `<span>📦 Total Pacas (consolidado): <b>${total.toLocaleString()}</b></span>`;
    renderChart(_inventarioData);
  } catch(e) { if(t) t.innerHTML = `<tr><td colspan="5" class="sin-datos">Error: ${e.message}</td></tr>`; }
}

function verInventario() {
  if (_unsubInventario) { _unsubInventario(); _unsubInventario = null; }
  let thSuc = document.getElementById("thSucursalInv");
  if (thSuc) thSuc.style.display = "none";

  if (getViewSucursal() === "CONSOLIDADO") { _verInventarioConsolidado(); return; }

  let suc   = getViewSucursal();
  let query = suc === "Principal"
    ? db.collection("inventario")
    : db.collection("inventarioSucursales").where("sucursal","==",suc);

  _unsubInventario = query.onSnapshot(snap => {
    tablaInventario.innerHTML = "";
    _inventarioData = [];
    let totalPacas  = 0;

    snap.forEach(doc => {
      let x = doc.data();
      _inventarioData.push({ ...x, _id: doc.id });
      totalPacas += x.pacas;
      tablaInventario.innerHTML += `<tr>
        <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td>
        <td id="estiba-${doc.id}">...</td>
      </tr>`;
      calcularEstibas(doc.id, x.producto, x.referencia, x.pacas);
    });

    document.getElementById("totales").innerHTML =
      `<span>📦 Total Pacas: <b>${totalPacas.toLocaleString()}</b></span>`;
    renderChart(_inventarioData);
    checkStockBajo(_inventarioData);
    if (_currentSection === "dashboard") renderDashboard();
    _actualizarSelectSalida();
  });
}

function calcularEstibas(id, p, r, pac) {
  let suc = getViewSucursal();
  db.collection("estibas").doc(_estibasDocId(suc, p, r)).get().then(doc => {
    let el = document.getElementById("estiba-" + id);
    if (!el) return;
    el.innerText = doc.exists ? (pac / doc.data().pacas).toFixed(2) : "—";
  });
}

function renderChart(data) {
  let canvas = document.getElementById("chartInv");
  if (!canvas || !data.length) return;
  let grupos = {};
  data.forEach(x => {
    let nombre = x.producto.replace("Agua ", "");
    grupos[nombre] = (grupos[nombre] || 0) + x.pacas;
  });
  if (_chartInstance) _chartInstance.destroy();
  _chartInstance = new Chart(canvas.getContext("2d"), {
    type: "bar",
    data: {
      labels: Object.keys(grupos),
      datasets: [{ label:"Pacas", data:Object.values(grupos), backgroundColor:"#2563eb", borderRadius:6 }]
    },
    options: {
      responsive:true,
      plugins:{ legend:{ display:false } },
      scales:{ y:{ beginAtZero:true } }
    }
  });
}

function checkStockBajo(data) {
  let alertas = [];
  data.forEach(x => {
    let conf = _configEstibas[x.producto + "_" + x.referencia];
    if (conf && conf.minimo && x.pacas < conf.minimo)
      alertas.push(`${x.producto} - ${x.referencia}: <b>${x.pacas}</b> pacas (mín: ${conf.minimo})`);
  });
  let div = document.getElementById("alertaStock");
  if (!div) return;
  if (alertas.length) {
    div.innerHTML = "⚠️ <b>Stock bajo en:</b><br>" + alertas.join("<br>");
    div.classList.add("visible");
  } else {
    div.classList.remove("visible");
  }
}

function renderTablaEstibas() {
  let t = document.getElementById("tablaConfig");
  if (!t) return;
  let html = "";
  _catalogo.productos.forEach(p => {
    (_catalogo.referencias[p] || []).forEach(r => {
      let item = _configEstibas[p + "_" + r];
      let pEsc = p.replace(/'/g,"\\'");
      let rEsc = r.replace(/'/g,"\\'");
      html += `<tr>
        <td>${p}</td><td>${r}</td>
        <td><input id="c-${p}-${r}" type="number" value="${item ? item.pacas : ''}" placeholder="Pacas/estiba"></td>
        <td><input id="m-${p}-${r}" type="number" value="${item && item.minimo ? item.minimo : ''}" placeholder="Mínimo"></td>
        <td><button onclick="guardarFila('${pEsc}','${rEsc}')">Guardar</button></td>
      </tr>`;
    });
  });
  t.innerHTML = html || '<tr><td colspan="5" class="sin-datos">Sin productos — agréguelos abajo</td></tr>';
}

function _estibasDocId(suc, p, r) {
  return suc === "Principal" ? p + "_" + r : suc + "_" + p + "_" + r;
}

function cargarConfig() {
  let suc   = getSucursalActual();
  let query = suc === "Principal"
    ? db.collection("estibas")
    : db.collection("estibas").where("sucursal","==",suc);

  query.onSnapshot(snap => {
    _configEstibas = {};
    snap.forEach(d => {
      let data = d.data();
      if (suc === "Principal" && data.sucursal && data.sucursal !== "Principal") return;
      _configEstibas[data.producto + "_" + data.referencia] = data;
    });
    renderTablaEstibas();
    renderTablaCatalogo();
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function guardarFila(p, r) {
  let suc = getSucursalActual();
  let val = parseInt(document.getElementById(`c-${p}-${r}`).value);
  let min = parseInt(document.getElementById(`m-${p}-${r}`).value) || 0;
  if (!val) return toast("Ingrese las pacas por estiba", "error");
  db.collection("estibas").doc(_estibasDocId(suc, p, r))
    .set({ sucursal:suc, producto:p, referencia:r, pacas:val, minimo:min });
  toast("✅ Guardado");
}

async function limpiar(tipo) {
  let clave = document.getElementById("claveAdmin").value;
  if (!clave) return toast("Ingrese la clave admin", "error");
  try {
    let snap = await db.collection("usuarios").where("rol","==","Admin").where("clave","==",clave).get();
    if (snap.empty) return toast("❌ Clave incorrecta", "error");
  } catch(e) { toast("Error verificando clave", "error"); return; }

  let suc = getSucursalActual();
  if (!confirm(`¿Eliminar datos de "${tipo}" de la sucursal ${suc}? No se puede deshacer.`)) return;
  showSpinner();
  try {
    let snap;
    let all = await (tipo === "inventario"
      ? (suc === "Principal" ? db.collection("inventario") : db.collection("inventarioSucursales").where("sucursal","==",suc))
      : db.collection(tipo)
    ).get();
    let refs = [];
    all.forEach(doc => {
      let d = doc.data();
      if (tipo === "traslados") {
        if (d.sucursalOrigen === suc || d.sucursalDestino === suc) refs.push(doc.ref);
      } else if (tipo === "inventario") {
        refs.push(doc.ref);
      } else {
        if ((d.sucursal || "Principal") === suc) refs.push(doc.ref);
      }
    });
    refs.forEach(ref => ref.delete());
    registrarAuditoria("limpiar", tipo, "LIMPIAR_COLECCION", { coleccion: tipo, sucursal: suc, registros: refs.length }, null);
    hideSpinner();
    toast("✅ Eliminado");
  } catch(e) { hideSpinner(); toast("❌ Error: " + e.message, "error"); }
}

function crearUsuario() {
  let u   = userN.value.trim();
  let c   = passN.value.trim();
  let rol = rolN.value;
  let checks = document.querySelectorAll("#sucursalesCheck input[type=checkbox]:checked");
  let sucursales = Array.from(checks).map(cb => cb.value);
  if (!sucursales.length) sucursales = ["Principal"];
  if (!u || !c) return toast("Complete todos los campos", "error");
  db.collection("usuarios").add({ usuario:u, clave:c, rol:rol, sucursales }).then(() => {
    registrarAuditoria("usuarios", null, "CREAR", null, { usuario:u, rol, sucursales });
  });
  userN.value = ""; passN.value = "";
  toast("✅ Usuario creado");
}

function verUsuarios() {
  db.collection("usuarios").onSnapshot(snap => {
    tablaUsuarios.innerHTML = "";
    snap.forEach(doc => {
      let u   = doc.data();
      let id  = doc.id;
      let rolOpts = _rolesConfig.map(r =>
        `<option value="${r}" ${r===u.rol?"selected":""}>${r}</option>`
      ).join("");
      let sucArr  = Array.isArray(u.sucursales) ? u.sucursales : [u.sucursal||"Principal"];
      let sucText = sucArr.join(", ");
      let sucEnc  = encodeURIComponent(JSON.stringify(sucArr));
      tablaUsuarios.innerHTML += `<tr>
        <td>${u.usuario}</td>
        <td><input id="pass-${id}" value="${u.clave}" style="min-width:70px;"></td>
        <td><select id="rol-${id}" style="width:auto;">${rolOpts}</select></td>
        <td style="white-space:nowrap;">
          <span style="font-size:12px;">${sucText}</span>
          <button onclick="editarSucursalesUsuario('${id}','${sucEnc}')" style="padding:3px 7px;font-size:11px;margin-left:4px;">✏️</button>
        </td>
        <td>
          <button onclick="guardarUsuario('${id}')">💾</button>
          <button onclick="eliminarUsuario('${id}')" class="btn-rojo" style="margin-top:4px;">🗑</button>
        </td>
      </tr>`;
    });
  });
}

function guardarUsuario(id) {
  let clave  = document.getElementById("pass-" + id)?.value;
  let rol    = document.getElementById("rol-"  + id)?.value;
  if (!clave) return toast("Ingrese la nueva clave", "error");
  let update = { clave };
  if (rol) update.rol = rol;
  db.collection("usuarios").doc(id).update(update);
  toast("✅ Usuario actualizado");
}

let _editSucUserId = null;

function editarSucursalesUsuario(id, sucEnc) {
  _editSucUserId = id;
  let current = JSON.parse(decodeURIComponent(sucEnc));
  let cont = document.getElementById("checkSucursalesUsuario");
  if (!cont) return;
  let todas = ["Principal", ..._sucursalesData.map(s => s.nombre)];
  cont.innerHTML = todas.map(s =>
    `<label class="check-suc-label"><input type="checkbox" value="${s}" ${current.includes(s)?"checked":""}> ${s}</label>`
  ).join("");
  document.getElementById("modalSucursalesUsuario").style.display = "flex";
}

function guardarSucursalesUsuario() {
  if (!_editSucUserId) return;
  let checks = document.querySelectorAll("#checkSucursalesUsuario input:checked");
  let sucursales = Array.from(checks).map(cb => cb.value);
  if (!sucursales.length) return toast("Seleccione al menos una sucursal", "error");
  db.collection("usuarios").doc(_editSucUserId).update({ sucursales });
  cerrarModalSucursalesUsuario();
  toast("✅ Sucursales actualizadas");
}

function cerrarModalSucursalesUsuario() {
  document.getElementById("modalSucursalesUsuario").style.display = "none";
  _editSucUserId = null;
}

function eliminarUsuario(id) {
  if (!confirm("¿Eliminar este usuario?")) return;
  db.collection("usuarios").doc(id).delete().then(() => {
    registrarAuditoria("usuarios", id, "ELIMINAR", null, null);
  });
  toast("✅ Usuario eliminado");
}

async function pedirClaveAdmin() {
  let clave = await pedirTexto("Clave de administrador", "Ingrese la clave...", "password");
  if (!clave) return false;
  try {
    let snap = await db.collection("usuarios").where("rol","==","Admin").where("clave","==",clave).get();
    if (!snap.empty) return true;
    toast("❌ Clave incorrecta", "error");
    return false;
  } catch(e) { toast("Error verificando clave", "error"); return false; }
}

async function logout() {
  try { await registrarAuditoria("sesion", null, "LOGOUT", { usuario: localStorage.getItem("usuario") }, null); } catch(e) {}
  localStorage.removeItem("usuario");
  localStorage.removeItem("rol");
  location.href = "index.html";
}

function iniciarInactividadWatch() {
  const TIMEOUT_MS = 15 * 60 * 1000;
  const WARN_MS    =  1 * 60 * 1000;
  let timer, warnTimer;
  function reset() {
    clearTimeout(timer); clearTimeout(warnTimer);
    warnTimer = setTimeout(() =>
      toast("⚠️ Sesión cerrará en 1 minuto por inactividad", "info"),
      TIMEOUT_MS - WARN_MS);
    timer = setTimeout(() => logout(), TIMEOUT_MS);
  }
  ["mousemove", "keydown", "click", "touchstart"].forEach(e =>
    document.addEventListener(e, reset, { passive: true })
  );
  reset();
}

function crearPreEntrada() {
  let p    = productoPE.value;
  let r    = referenciaPE.value;
  let pac  = parseInt(pacasPE.value);
  let lote = document.getElementById("lotePE").value.trim();
  if (!pac) return toast("Ingrese cantidad", "error");

  showSpinner();
  db.collection("preentradas").add({
    fecha: new Date().toLocaleString(), fechaISO: localISO(),
    producto:p, referencia:r, pacas:pac, lote,
    sucursal: getSucursalActual(),
    usuarioProduccion: localStorage.getItem("usuario"),
    estado: "pendiente"
  }).then(() => {
    pacasPE.value = "";
    document.getElementById("lotePE").value = "";
    hideSpinner();
    toast("✅ Pre-entrada enviada a confirmación");
  }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
}

function actualizarBadgeEntradas() {
  let suc = getSucursalActual();
  let rol = localStorage.getItem("rol");
  let pePend = _preentradasData.filter(x => x.estado === "pendiente").length;
  let trPend = _trasladosData.filter(x =>
    x.estado === "en_transito" && (rol === "Admin" || x.sucursalDestino === suc)
  ).length;
  let total  = pePend + trPend;
  let badgeE = document.getElementById("badgeEntradas");
  if (badgeE) {
    badgeE.textContent   = total;
    badgeE.style.display = total ? "inline" : "none";
  }
}

function verPreEntradas() {
  let suc = getSucursalActual();
  db.collection("preentradas").onSnapshot(snap => {
    _preentradasData = [];
    snap.forEach(doc => {
      let d = doc.data();
      if ((d.sucursal || "Principal") === suc) _preentradasData.push({ ...d, _id: doc.id });
    });
    _preentradasData.sort((a, b) => (b.fechaISO||"") > (a.fechaISO||"") ? 1 : -1);

    let pendientes = _preentradasData.filter(x => x.estado === "pendiente");
    actualizarBadgeEntradas();
    renderTablaHistorialPE(_preentradasData);
    renderTablaConfirmaciones(pendientes);
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function renderTablaConfirmaciones(pendientes) {
  let t   = document.getElementById("tablaPendientes");
  if (!t) return;
  let rol             = localStorage.getItem("rol");
  let puedeConfirmar  = rol === "Operador" || rol === "Supervisor" || rol === "Admin";

  if (!pendientes.length) {
    t.innerHTML = '<tr><td colspan="7" class="sin-datos">Sin pre-entradas pendientes</td></tr>';
    return;
  }
  t.innerHTML = "";
  pendientes.forEach(x => {
    let loteEsc = (x.lote||"").replace(/'/g,"\\'");
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuarioProduccion}</td>
      <td>${puedeConfirmar ? `
        <button onclick="confirmarPreEntrada('${x._id}','${x.producto}','${x.referencia}',${x.pacas},'${loteEsc}')">✅ Confirmar</button>
        <button onclick="rechazarPreEntrada('${x._id}')" class="btn-rojo" style="margin-top:4px;">❌ Rechazar</button>
      ` : "—"}</td>
    </tr>`;
  });
}

function renderTablaHistorialPE(items) {
  let t = document.getElementById("tablaHistorialPE");
  if (!t) return;
  if (!items.length) {
    t.innerHTML = '<tr><td colspan="9" class="sin-datos">Sin registros</td></tr>';
    return;
  }
  t.innerHTML = "";
  items.forEach(x => {
    let est = x.estado === "confirmado"
      ? '<span class="estado-confirmado">Confirmado</span>'
      : x.estado === "rechazado"
      ? '<span class="estado-rechazado">Rechazado</span>'
      : '<span class="estado-pendiente">Pendiente</span>';
    let motivo = x.motivoRechazo
      ? `<span title="${x.motivoRechazo}" style="cursor:help;color:#b45309;">⚠️ ${x.motivoRechazo.substring(0,25)}${x.motivoRechazo.length>25?'…':''}</span>`
      : "—";
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td>
      <td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuarioProduccion}</td>
      <td>${est}</td><td>${x.usuarioOperario||"—"}</td><td>${motivo}</td>
    </tr>`;
  });
}

async function confirmarPreEntrada(id, producto, referencia, pacas, lote) {
  if (!confirm(`¿Confirmar ${pacas} pacas de ${producto} - ${referencia}${lote ? ' (Lote: '+lote+')' : ''}?`)) return;
  showSpinner();
  try {
    await db.collection("entradas").add({
      fecha: new Date().toLocaleString(), fechaISO: localISO(),
      producto, referencia, pacas, lote: lote||"",
      sucursal: "Principal",
      usuario: localStorage.getItem("usuario")
    });
    actualizarInventario(producto, referencia, pacas);
    await db.collection("preentradas").doc(id).update({
      estado: "confirmado",
      usuarioOperario: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });
    hideSpinner();
    toast("✅ Pre-entrada confirmada — inventario actualizado");
  } catch(e) { hideSpinner(); toast("❌ Error al confirmar: " + e.message, "error"); }
}

async function rechazarPreEntrada(id) {
  let motivo = await pedirTexto("Motivo de rechazo", "¿Por qué se rechaza esta pre-entrada?");
  if (!motivo) return;
  showSpinner();
  try {
    await db.collection("preentradas").doc(id).update({
      estado: "rechazado",
      motivoRechazo: motivo,
      usuarioOperario: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });
    hideSpinner();
    toast("Pre-entrada rechazada");
  } catch(e) { hideSpinner(); toast("❌ Error: " + e.message, "error"); }
}

// ===== INVENTARIO EXPORT / PRINT =====
window.descargarInventario = async function() {
  if (typeof XLSX === "undefined") return toast("❌ Librería Excel no cargó", "error");
  showSpinner();
  try {
    let suc = getViewSucursal();
    let snaps = [];
    if (suc === "CONSOLIDADO") {
      let [sP, sS] = await Promise.all([db.collection("inventario").get(), db.collection("inventarioSucursales").get()]);
      snaps = [...sP.docs.map(d=>({...d.data(),sucursal:"Principal"})), ...sS.docs.map(d=>d.data())];
    } else {
      let s = suc === "Principal"
        ? await db.collection("inventario").get()
        : await db.collection("inventarioSucursales").where("sucursal","==",suc).get();
      snaps = s.docs.map(d => d.data());
    }
    let data = [];
    for (let x of snaps) {
      let docId  = _estibasDocId(x.sucursal||suc, x.producto, x.referencia);
      let confDoc = await db.collection("estibas").doc(docId).get();
      let estibas = confDoc.exists ? (x.pacas / confDoc.data().pacas).toFixed(2) : 0;
      let row = { Producto:x.producto, Referencia:x.referencia, Pacas:x.pacas, Estibas:estibas };
      if (suc === "CONSOLIDADO") row = { Sucursal:x.sucursal||"Principal", ...row };
      data.push(row);
    }
    let ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = suc==="CONSOLIDADO" ? [{wch:16},{wch:25},{wch:15},{wch:10},{wch:10}] : [{wch:25},{wch:15},{wch:10},{wch:10}];
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, `Inventario_${suc}_ONE_CARIBE.xlsx`);
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
  hideSpinner();
}

function imprimirInventario() {
  let suc = getViewSucursal();
  if (suc === "CONSOLIDADO") {
    Promise.all([db.collection("inventario").get(), db.collection("inventarioSucursales").get()])
      .then(([sP, sS]) => {
        let items = [...sP.docs.map(d=>({...d.data(),sucursal:"Principal"})), ...sS.docs.map(d=>d.data())];
        items.sort((a,b)=>(a.sucursal+a.producto).localeCompare(b.sucursal+b.producto));
        let total = items.reduce((s,x)=>s+x.pacas,0);
        let filas = items.map(x=>`<tr><td>${x.sucursal}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td></tr>`).join("");
        let w = window.open("");
        w.document.write(`<html><head><title>Inventario Consolidado</title>
        <style>body{font-family:Arial;padding:30px;}table{width:100%;border-collapse:collapse;}
        th{background:#1e293b;color:white;padding:12px;text-align:center;}td{padding:12px;border-bottom:1px solid #ddd;text-align:center;}
        .total{margin-top:20px;text-align:right;font-weight:bold;}</style></head>
        <body><div style="display:flex;justify-content:space-between;margin-bottom:20px;">
        <div><b style="font-size:22px">OTS LOGISTIC</b><div style="color:#555;font-size:13px">Inventario Consolidado — Todas las Sucursales</div></div>
        <div style="color:#555;font-size:13px">${new Date().toLocaleString()}</div></div>
        <table><tr><th>Sucursal</th><th>Producto</th><th>Referencia</th><th>Pacas</th></tr>${filas}</table>
        <div class="total">TOTAL PACAS: ${total}</div>
        <div style="margin-top:30px;text-align:center;color:#555;font-size:12px;">© 2026 OTS LOGISTIC</div></body></html>`);
        w.document.close(); w.print();
      });
    return;
  }
  let query = suc === "Principal"
    ? db.collection("inventario")
    : db.collection("inventarioSucursales").where("sucursal","==",suc);
  query.get().then(snap => {
    let total = 0, totalEstibas = 0, promesas = [];
    snap.forEach(doc => {
      let x = doc.data(); total += x.pacas;
      let prom = db.collection("estibas").doc(x.producto + "_" + x.referencia).get().then(confDoc => {
        let estibas = 0;
        if (confDoc.exists) { estibas = (x.pacas / confDoc.data().pacas).toFixed(2); totalEstibas += parseFloat(estibas); }
        return `<tr><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${estibas}</td></tr>`;
      });
      promesas.push(prom);
    });
    Promise.all(promesas).then(filas => {
      let w = window.open("");
      w.document.write(`<html><head><title>Inventario OTS LOGISTIC</title>
      <style>body{font-family:Arial;padding:30px;}table{width:100%;border-collapse:collapse;}
      th{background:#1e293b;color:white;padding:12px;text-align:center;}
      td{padding:12px;border-bottom:1px solid #ddd;text-align:center;}
      tr:nth-child(even){background:#f9fafb;}.total{margin-top:20px;text-align:right;font-weight:bold;}</style></head>
      <body>
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <div><b style="font-size:22px">OTS LOGISTIC</b><div style="color:#555;font-size:13px">Reporte de Inventario — Sucursal: <b>${suc}</b></div></div>
          <div style="color:#555;font-size:13px">${new Date().toLocaleString()}</div>
        </div>
        <table><tr><th>Producto</th><th>Referencia</th><th>Pacas</th><th>Estibas</th></tr>${filas.join("")}</table>
        <div class="total">TOTAL PACAS: ${total} &nbsp;|&nbsp; TOTAL ESTIBAS: ${totalEstibas.toFixed(2)}</div>
        <div style="margin-top:30px;text-align:center;color:#555;font-size:12px;">© 2026 OTS LOGISTIC</div>
      </body></html>`);
      w.document.close(); w.print();
    });
  });
}

async function cargarSucursalUsuario() {
  let usuario = localStorage.getItem("usuario");
  try {
    let snap = await db.collection("usuarios").where("usuario","==",usuario).limit(1).get();
    if (!snap.empty) {
      let data = snap.docs[0].data();
      // soporta formato antiguo (sucursal string) y nuevo (sucursales array)
      let sucursales = data.sucursales
        || (data.sucursal ? [data.sucursal] : ["Principal"]);
      localStorage.setItem("sucursalesUsuario", JSON.stringify(sucursales));
      let activa = localStorage.getItem("sucursal");
      if (!activa || !sucursales.includes(activa)) {
        localStorage.setItem("sucursal", sucursales[0]);
      }
    } else {
      localStorage.setItem("sucursal", "Principal");
      localStorage.setItem("sucursalesUsuario", '["Principal"]');
    }
  } catch(e) {
    localStorage.setItem("sucursal", "Principal");
    localStorage.setItem("sucursalesUsuario", '["Principal"]');
  }
}

function getViewSucursal() {
  return _viewSucursal || getSucursalActual();
}

function cambiarSucursalActiva() {
  let val = document.getElementById("selectSucursalActiva").value;
  localStorage.setItem("sucursal", val);
  _viewSucursal = null;
  location.reload();
}

function cambiarVistaSucursal() {
  _viewSucursal = document.getElementById("selectVistaSucursal").value || null;
  verInventario();
}

function _renderNavbarSwitcher() {
  let cont = document.getElementById("sucursalSwitcher");
  if (!cont) return;
  let rol = localStorage.getItem("rol");
  let sucursales = JSON.parse(localStorage.getItem("sucursalesUsuario") || '["Principal"]');
  // Admin ve todas las sucursales
  if (rol === "Admin") {
    sucursales = ["Principal", ..._sucursalesData.map(s => s.nombre)];
  }
  if (sucursales.length <= 1) { cont.style.display = "none"; return; }
  let activa = getSucursalActual();
  cont.style.display = "flex";
  let sel = document.getElementById("selectSucursalActiva");
  if (!sel) return;
  sel.innerHTML = "";
  sucursales.forEach(s => sel.innerHTML += `<option value="${s}" ${s===activa?"selected":""}>${s}</option>`);
}

function renderCheckboxesSucursales(selectedValues = []) {
  let cont = document.getElementById("sucursalesCheck");
  if (!cont) return;
  cont.innerHTML = "";
  let todas = ["Principal", ..._sucursalesData.map(s => s.nombre)];
  todas.forEach(s => {
    let checked = selectedValues.includes(s) ? "checked" : "";
    cont.innerHTML += `<label class="check-suc-label">
      <input type="checkbox" value="${s}" ${checked}> ${s}
    </label>`;
  });
}

async function cargarSucursales() {
  try {
    let snap = await db.collection("sucursales").get();
    _sucursalesData = [];
    snap.forEach(doc => _sucursalesData.push({ ...doc.data(), _id: doc.id }));
  } catch(e) { console.error(e); }

  db.collection("sucursales").onSnapshot(snap => {
    _sucursalesData = [];
    snap.forEach(doc => _sucursalesData.push({ ...doc.data(), _id: doc.id }));
    renderTablaSucursales();
    llenarSelectSucursales();
    renderCheckboxesSucursales();
    _renderNavbarSwitcher();
    llenarFiltrosTraslados();
  });
}

async function crearSucursal() {
  let nombre = document.getElementById("nuevaSucursal").value.trim();
  if (!nombre) return toast("Ingrese el nombre de la sucursal", "error");
  if (_sucursalesData.some(s => s.nombre === nombre)) return toast("Esa sucursal ya existe", "error");
  try {
    await db.collection("sucursales").add({ nombre });
    document.getElementById("nuevaSucursal").value = "";
    toast("✅ Sucursal agregada");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

async function eliminarSucursal(id, nombre) {
  if (!confirm(`¿Eliminar la sucursal "${nombre}"? Su inventario y traslados asociados se conservan en Firestore.`)) return;
  try {
    await db.collection("sucursales").doc(id).delete();
    toast("✅ Sucursal eliminada");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

function renderTablaSucursales() {
  let t = document.getElementById("tablaSucursales");
  if (!t) return;
  t.innerHTML = "";
  let fila = `<tr><td>Principal</td><td><span style="font-size:12px;color:#94a3b8;">Sistema</span></td></tr>`;
  _sucursalesData.forEach(s => {
    let idEsc  = s._id.replace(/'/g,"\\'");
    let nomEsc = s.nombre.replace(/'/g,"\\'");
    fila += `<tr>
      <td>${s.nombre}</td>
      <td><button onclick="eliminarSucursal('${idEsc}','${nomEsc}')" class="btn-rojo" style="padding:5px 9px;font-size:12px;">🗑</button></td>
    </tr>`;
  });
  t.innerHTML = fila;
}

function llenarSelectSucursales() {
  // destino
  let selDest = document.getElementById("destTraslado");
  if (selDest) {
    let cur = selDest.value;
    selDest.innerHTML = '<option value="">— Sucursal destino —</option>';
    selDest.innerHTML += '<option value="Principal">Principal</option>';
    _sucursalesData.forEach(s => selDest.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`);
    if (cur) selDest.value = cur;
  }
  // origen
  let selOrig = document.getElementById("origenTraslado");
  if (selOrig) {
    let cur = selOrig.value;
    selOrig.innerHTML = '<option value="">— Sucursal origen —</option>';
    selOrig.innerHTML += '<option value="Principal">Principal</option>';
    _sucursalesData.forEach(s => selOrig.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`);
    if (cur) selOrig.value = cur;
  }
  // vista inventario (Admin ve opción consolidado)
  let selInv = document.getElementById("selectVistaSucursal");
  if (selInv) {
    let cur = selInv.value;
    let rol = localStorage.getItem("rol");
    selInv.innerHTML = '<option value="Principal">Principal</option>';
    _sucursalesData.forEach(s => selInv.innerHTML += `<option value="${s.nombre}">${s.nombre}</option>`);
    if (rol === "Admin") selInv.innerHTML += '<option value="CONSOLIDADO">— Consolidado (todas) —</option>';
    if (cur) selInv.value = cur;
  }
}

function getSucursalActual() {
  return localStorage.getItem("sucursal") || "Principal";
}

function getInvRef(prod, ref) {
  let suc = getSucursalActual();
  return suc === "Principal"
    ? { col:"inventario",           id: prod + "_" + ref }
    : { col:"inventarioSucursales", id: suc + "_" + prod + "_" + ref, sucursal: suc };
}

async function crearTraslado() {
  let prod   = document.getElementById("prodTraslado").value;
  let ref    = document.getElementById("refTraslado").value;
  let pac    = parseInt(document.getElementById("pacasTraslado").value);
  let lote   = document.getElementById("loteTraslado").value.trim();
  let origen = document.getElementById("origenTraslado").value;
  let dest   = document.getElementById("destTraslado").value;
  if (!pac)            return toast("Ingrese cantidad de pacas", "error");
  if (!origen)         return toast("Seleccione la sucursal de origen", "error");
  if (!dest)           return toast("Seleccione la sucursal destino", "error");
  if (origen === dest) return toast("El origen y el destino no pueden ser la misma sucursal", "error");

  showSpinner();
  try {
    let destDocId  = dest === "Principal" ? prod : dest + "_" + prod;
    let destCatDoc = await db.collection("catalogoProductos").doc(destDocId).get();
    if (!destCatDoc.exists || !(destCatDoc.data().referencias || []).includes(ref)) {
      hideSpinner();
      return toast(`❌ "${prod} - ${ref}" no está registrado en el catálogo de ${dest}`, "error");
    }
  } catch(e) { hideSpinner(); return toast("❌ Error verificando catálogo: " + e.message, "error"); }

  let col   = origen === "Principal" ? "inventario" : "inventarioSucursales";
  let clave = origen === "Principal" ? prod + "_" + ref : origen + "_" + prod + "_" + ref;

  db.collection(col).doc(clave).get().then(doc => {
    let disponible = doc.exists ? doc.data().pacas : 0;
    if (!doc.exists || disponible < pac) {
      hideSpinner();
      return toast(`❌ Stock insuficiente en ${origen} — disponible: ${disponible} pacas`, "error");
    }
    let promesas = [
      db.collection(col).doc(clave).update({ pacas: disponible - pac }),
      db.collection("traslados").add({
        fecha: new Date().toLocaleString(), fechaISO: localISO(),
        sucursalOrigen: origen, sucursalDestino: dest,
        producto: prod, referencia: ref, pacas: pac, lote,
        estado: "en_transito",
        usuarioCreador: localStorage.getItem("usuario")
      })
    ];
    Promise.all(promesas).then(() => {
      document.getElementById("pacasTraslado").value  = "";
      document.getElementById("loteTraslado").value   = "";
      document.getElementById("origenTraslado").value = "";
      document.getElementById("destTraslado").value   = "";
      hideSpinner();
      toast(`✅ Traslado enviado de ${origen} → ${dest}`);
    }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
  }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
}

async function confirmarTraslado(id, sucDest, prod, ref, pac, lote) {
  if (!confirm(`¿Confirmar recepción de ${pac} pacas de ${prod} - ${ref}?`)) return;
  showSpinner();
  try {

    if (sucDest === "Principal") {
      let clave  = prod + "_" + ref;
      let invDoc = await db.collection("inventario").doc(clave).get();
      if (invDoc.exists) {
        await db.collection("inventario").doc(clave).update({ pacas: invDoc.data().pacas + pac });
      } else {
        await db.collection("inventario").doc(clave).set({ producto: prod, referencia: ref, pacas: pac });
      }
    } else {
      let clave  = sucDest + "_" + prod + "_" + ref;
      let invDoc = await db.collection("inventarioSucursales").doc(clave).get();
      if (invDoc.exists) {
        await db.collection("inventarioSucursales").doc(clave).update({ pacas: invDoc.data().pacas + pac });
      } else {
        await db.collection("inventarioSucursales").doc(clave).set({ sucursal: sucDest, producto: prod, referencia: ref, pacas: pac });
      }
    }

    await db.collection("entradas").add({
      fecha: new Date().toLocaleString(), fechaISO: localISO(),
      producto: prod, referencia: ref, pacas: pac, lote: lote || "",
      sucursal: sucDest,
      usuario: localStorage.getItem("usuario"),
      origen: "traslado"
    });
    await db.collection("traslados").doc(id).update({
      estado: "recibido",
      usuarioConfirmador: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });
    hideSpinner();
    toast("✅ Traslado recibido — inventario actualizado");
  } catch(e) { hideSpinner(); toast("❌ Error: " + e.message, "error"); }
}

async function rechazarTraslado(id, prod, ref, pac, sucOrigen) {
  let motivo = await pedirTexto("Motivo de rechazo", "¿Por qué se rechaza este traslado?");
  if (!motivo) return;
  showSpinner();
  try {
    let col   = sucOrigen === "Principal" ? "inventario" : "inventarioSucursales";
    let clave = sucOrigen === "Principal" ? prod + "_" + ref : sucOrigen + "_" + prod + "_" + ref;
    let invDoc = await db.collection(col).doc(clave).get();
    let actual = invDoc.exists ? invDoc.data().pacas : 0;
    await db.collection(col).doc(clave).update({ pacas: actual + pac });
    await db.collection("traslados").doc(id).update({
      estado: "rechazado", motivoRechazo: motivo,
      usuarioConfirmador: localStorage.getItem("usuario"),
      fechaConfirmacion: new Date().toLocaleString()
    });
    hideSpinner();
    toast(`Traslado rechazado — stock restaurado en ${sucOrigen}`);
  } catch(e) { hideSpinner(); toast("❌ Error: " + e.message, "error"); }
}

function verTraslados() {
  llenarFiltrosTraslados();
  db.collection("traslados").orderBy("fechaISO","desc").onSnapshot(snap => {
    _trasladosData = [];
    snap.forEach(doc => _trasladosData.push({ ...doc.data(), _id: doc.id }));
    renderTrasladosPendientes();
    renderHistorialTraslados();
    renderTrasladosPorRecibir();
    actualizarBadgeEntradas();
    filtrarTraslados();
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function renderTrasladosPendientes() {
  let t   = document.getElementById("tablaTrasladosPendientes");
  if (!t) return;
  let suc = getSucursalActual();
  let rol = localStorage.getItem("rol");

  let secCrear = document.getElementById("seccionCrearTraslado");
  if (secCrear) secCrear.style.display = "block";

  // Muestra traslados en tránsito que involucran la sucursal actual (como origen o destino)
  let enTransito = _trasladosData.filter(x => {
    if (x.estado !== "en_transito") return false;
    if (rol === "Admin") return true;
    return x.sucursalOrigen === suc || x.sucursalDestino === suc;
  });

  let badge = document.getElementById("badgeTraslados");
  if (badge) {
    // badge muestra traslados enviados desde esta sucursal que aún no llegan
    let enviados = enTransito.filter(x => x.sucursalOrigen === suc || rol === "Admin");
    badge.textContent   = enviados.length;
    badge.style.display = enviados.length ? "inline" : "none";
  }

  if (!enTransito.length) {
    t.innerHTML = '<tr><td colspan="7" class="sin-datos">Sin traslados en tránsito</td></tr>';
    return;
  }
  t.innerHTML = "";
  enTransito.forEach(x => {
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.sucursalOrigen}</td><td>${x.sucursalDestino}</td>
      <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td>
    </tr>`;
  });
}

function renderTrasladosPorRecibir() {
  let sec = document.getElementById("seccionTrasladosPorRecibir");
  let t   = document.getElementById("tablaTrasladosPorRecibir");
  if (!t) return;
  let suc = getSucursalActual();
  let rol = localStorage.getItem("rol");

  let pendientes = _trasladosData.filter(x =>
    x.estado === "en_transito" && (rol === "Admin" || x.sucursalDestino === suc)
  );

  if (sec) sec.style.display = pendientes.length ? "block" : "none";

  if (!pendientes.length) { t.innerHTML = ""; return; }
  t.innerHTML = "";
  pendientes.forEach(x => {
    let idEsc   = x._id.replace(/'/g,"\\'");
    let loteEsc = (x.lote||"").replace(/'/g,"\\'");
    let prodEsc = x.producto.replace(/'/g,"\\'");
    let refEsc  = x.referencia.replace(/'/g,"\\'");
    let origEsc = (x.sucursalOrigen||"Principal").replace(/'/g,"\\'");
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.sucursalOrigen}</td>
      <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td>
      <td>
        <button onclick="confirmarTraslado('${idEsc}','${x.sucursalDestino}','${prodEsc}','${refEsc}',${x.pacas},'${loteEsc}')">✅ Recibido</button>
        <button onclick="rechazarTraslado('${idEsc}','${prodEsc}','${refEsc}',${x.pacas},'${origEsc}')" class="btn-rojo" style="margin-top:4px;">❌ Rechazar</button>
      </td>
    </tr>`;
  });
}

function renderHistorialTraslados() {
  let t   = document.getElementById("tablaTraslados");
  if (!t) return;
  let suc = getSucursalActual();
  let rol = localStorage.getItem("rol");

  let lista = _trasladosData.filter(x =>
    rol === "Admin" || x.sucursalOrigen === suc || x.sucursalDestino === suc
  );

  if (!lista.length) {
    t.innerHTML = '<tr><td colspan="9" class="sin-datos">Sin traslados</td></tr>';
    return;
  }
  t.innerHTML = "";
  lista.forEach(x => {
    let est = x.estado === "recibido"
      ? '<span class="estado-confirmado">Recibido</span>'
      : x.estado === "rechazado"
      ? '<span class="estado-rechazado">Rechazado</span>'
      : '<span class="estado-transito">En tránsito</span>';
    let motivo = x.motivoRechazo
      ? ` <span title="${x.motivoRechazo}" style="cursor:help;">⚠️</span>` : "";
    t.innerHTML += `<tr>
      <td>${x.fecha}</td><td>${x.sucursalOrigen}</td><td>${x.sucursalDestino}</td>
      <td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td>
      <td>${est}${motivo}</td><td>${x.usuarioConfirmador||"—"}</td>
    </tr>`;
  });
}

async function cargarRoles() {
  try {
    let snap = await db.collection("roles").get();
    if (snap.empty) {
      const defaults = ['Admin','Supervisor','Operador','Producción'];
      for (let r of defaults) {
        await db.collection("roles").doc(r).set({ nombre: r });
      }
      _rolesConfig = defaults;
    } else {
      _rolesConfig = [];
      snap.forEach(doc => _rolesConfig.push(doc.data().nombre));
      _ordenarRoles();
    }
  } catch(e) { console.error("Error cargando roles:", e); }

  db.collection("roles").onSnapshot(snap => {
    _rolesConfig = [];
    snap.forEach(doc => _rolesConfig.push(doc.data().nombre));
    _ordenarRoles();
    llenarSelectRoles();
    renderTablaRoles();
    renderTablaPermisos();
  });
}

function _ordenarRoles() {
  _rolesConfig = ['Admin', ..._rolesConfig.filter(r => r !== 'Admin').sort()];
}

function llenarSelectRoles() {
  let sel = document.getElementById("rolN");
  if (!sel) return;
  let current = sel.value;
  sel.innerHTML = "";
  _rolesConfig.forEach(r => sel.innerHTML += `<option>${r}</option>`);
  if (current && _rolesConfig.includes(current)) sel.value = current;
}

async function crearRol() {
  let nombre = document.getElementById("nuevoRol").value.trim();
  if (!nombre) return toast("Ingrese un nombre para el rol", "error");
  if (_rolesConfig.includes(nombre)) return toast("Ese rol ya existe", "error");
  try {
    await db.collection("roles").doc(nombre).set({ nombre });
    let perms = {};
    _vistas.forEach(v => perms[v] = false);
    await db.collection("permisos").doc(nombre).set(perms);
    document.getElementById("nuevoRol").value = "";
    toast(`✅ Rol "${nombre}" creado — configure sus permisos abajo`);
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

async function eliminarRol(nombre) {
  if (nombre === "Admin") return toast("El rol Admin no se puede eliminar", "error");
  if (!confirm(`¿Eliminar el rol "${nombre}"? Los usuarios con este rol quedarán sin acceso.`)) return;
  try {
    await db.collection("roles").doc(nombre).delete();
    await db.collection("permisos").doc(nombre).delete();
    toast(`✅ Rol "${nombre}" eliminado`);
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

function renderTablaRoles() {
  let t = document.getElementById("tablaRoles");
  if (!t) return;
  t.innerHTML = "";
  _rolesConfig.forEach(r => {
    let rEsc = r.replace(/'/g,"\\'");
    t.innerHTML += `<tr>
      <td>${r}</td>
      <td>${r === "Admin"
        ? '<span style="font-size:12px;color:#94a3b8;">Sistema</span>'
        : `<button onclick="eliminarRol('${rEsc}')" class="btn-rojo" style="padding:5px 9px;font-size:12px;">🗑</button>`
      }</td>
    </tr>`;
  });
}

async function cargarPermisos() {
  try {
    let snap = await db.collection("permisos").get();
    _permisosData = {};
    snap.forEach(doc => { _permisosData[doc.id] = doc.data(); });
  } catch(e) { console.error("Error cargando permisos:", e); }

  db.collection("permisos").onSnapshot(snap => {
    _permisosData = {};
    snap.forEach(doc => { _permisosData[doc.id] = doc.data(); });
    renderTablaPermisos();
    configurarSidebar();
  });
}

function renderTablaPermisos() {
  let cont = document.getElementById("tablaPermisosContainer");
  if (!cont) return;

  let html = `<div class="tabla-scroll"><table><thead><tr><th>Sección</th>`;
  _rolesConfig.forEach(r => html += `<th>${r}</th>`);
  html += `</tr></thead><tbody>`;

  _vistas.forEach(v => {
    html += `<tr><td>${_vistasNombres[v]}</td>`;
    _rolesConfig.forEach(r => {
      if (r === "Admin") {
        html += `<td style="text-align:center"><input type="checkbox" disabled checked></td>`;
      } else {
        let perms   = _permisosData[r] || _permisosDefault[r] || {};
        let checked = perms[v] ? "checked" : "";
        html += `<td style="text-align:center"><input type="checkbox" id="perm-${r}-${v}" ${checked}></td>`;
      }
    });
    html += `</tr>`;
  });

  html += `</tbody></table></div>`;
  cont.innerHTML = html;
}

function guardarPermisos() {
  _rolesConfig.forEach(rol => {
    if (rol === "Admin") return;
    let perms = {};
    _vistas.forEach(v => {
      let cb = document.getElementById(`perm-${rol}-${v}`);
      perms[v] = cb ? cb.checked : false;
    });
    db.collection("permisos").doc(rol).set(perms);
  });
  registrarAuditoria("permisos", null, "GUARDAR_PERMISOS", null, null);
  toast("✅ Permisos guardados");
}
