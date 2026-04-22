// ===== ESTADO GLOBAL =====
let _entradasData   = [];
let _salidasData    = [];
let _inventarioData = [];
let _preentradasData= [];
let _configEstibas  = {};
let _chartInstance  = null;
let _permisosData   = {};
let _catalogo       = { productos: [], referencias: {} };
let _currentSection = "";

const _permisosDefault = {
  "Admin":      { dashboard:true,  preentradas:true,  entradas:true,  salidas:true,  inventario:true,  reportes:true,  config:true,  usuarios:true  },
  "Supervisor": { dashboard:true,  preentradas:true,  entradas:true,  salidas:true,  inventario:true,  reportes:true,  config:false, usuarios:false },
  "Operador":   { dashboard:false, preentradas:false, entradas:true,  salidas:true,  inventario:true,  reportes:false, config:false, usuarios:false },
  "Producción": { dashboard:false, preentradas:true,  entradas:false, salidas:false, inventario:false, reportes:false, config:false, usuarios:false }
};
const _vistas = ['dashboard','preentradas','entradas','salidas','inventario','reportes','config','usuarios'];
const _vistasNombres = {
  dashboard:'🏠 Dashboard', preentradas:'📋 Pre-entradas', entradas:'📥 Entradas',
  salidas:'📤 Salidas', inventario:'📦 Inventario', reportes:'📊 Reportes',
  config:'⚙️ Config', usuarios:'👥 Usuarios'
};
let _rolesConfig = ['Admin','Supervisor','Operador','Producción'];

// ===== TOAST =====
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

// ===== SPINNER =====
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

// ===== MODAL GENERICO (texto / contraseña) =====
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

// ===== MODAL EDITAR MOVIMIENTO =====
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

// ===== INIT =====
async function initApp() {
  checkAuth();
  showSpinner();
  try {
    await cargarRoles();
    await cargarPermisos();
    await cargarCatalogo();
    configurarSidebar();
    configurarSeccionesPE();
    cargarSelects();
    verEntradas();
    verSalidas();
    verInventario();
    cargarConfig();
    verUsuarios();
    verPreEntradas();
    setUserInfo();

    let rol = localStorage.getItem("rol");
    let seccionInicial = (rol === "Admin" || rol === "Supervisor") ? "dashboard"
                       : (rol === "Operador") ? "entradas" : "preentradas";
    if (!puedeAcceder(seccionInicial)) {
      for (let v of _vistas) { if (puedeAcceder(v)) { seccionInicial = v; break; } }
    }
    showSection(seccionInicial);
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

  document.querySelectorAll(".sidebar a[data-vista]").forEach(link => {
    link.classList.toggle("activo", link.getAttribute("data-vista") === id);
  });

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
  let seccionCrear = document.getElementById("seccionCrearPE");
  if (seccionCrear) seccionCrear.style.display = (rol === "Operador") ? "none" : "block";
}

// ===== CATALOGO DE PRODUCTOS (Firestore) =====
async function cargarCatalogo() {
  try {
    let snap = await db.collection("catalogoProductos").get();
    if (!snap.empty) {
      _catalogo = { productos: [], referencias: {} };
      snap.forEach(doc => {
        let d = doc.data();
        _catalogo.productos.push(d.producto);
        _catalogo.referencias[d.producto] = d.referencias || [];
      });
      _catalogo.productos.sort();
    } else if (typeof catalogo !== "undefined") {
      _catalogo = { productos: [...catalogo.productos], referencias: { ...catalogo.referencias } };
      for (let p of catalogo.productos) {
        await db.collection("catalogoProductos").doc(p).set({ producto: p, referencias: catalogo.referencias[p] || [] });
      }
    }
  } catch(e) {
    console.error("Error cargando catálogo:", e);
    if (typeof catalogo !== "undefined") _catalogo = catalogo;
  }

  db.collection("catalogoProductos").onSnapshot(snap => {
    if (snap.empty) return;
    _catalogo = { productos: [], referencias: {} };
    snap.forEach(doc => {
      let d = doc.data();
      _catalogo.productos.push(d.producto);
      _catalogo.referencias[d.producto] = d.referencias || [];
    });
    _catalogo.productos.sort();
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
  let p = document.getElementById("nuevoProd").value.trim();
  let r = document.getElementById("nuevaRef").value.trim();
  if (!p || !r) return toast("Complete producto y referencia", "error");
  let existente = _catalogo.referencias[p] || [];
  if (existente.includes(r)) return toast("Esa referencia ya existe para este producto", "error");
  try {
    await db.collection("catalogoProductos").doc(p).set({ producto: p, referencias: [...existente, r] });
    document.getElementById("nuevoProd").value = "";
    document.getElementById("nuevaRef").value  = "";
    toast("✅ Producto/referencia agregado");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

async function eliminarReferencia(p, r) {
  if (!confirm(`¿Eliminar referencia "${r}" del producto "${p}"?`)) return;
  let refs = (_catalogo.referencias[p] || []).filter(x => x !== r);
  try {
    if (refs.length === 0) {
      await db.collection("catalogoProductos").doc(p).delete();
    } else {
      await db.collection("catalogoProductos").doc(p).update({ referencias: refs });
    }
    toast("✅ Referencia eliminada");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
}

// ===== SELECTS =====
function cargarSelects() {
  llenar("productoS", "referenciaS");
  llenar("productoPE", "referenciaPE");
  ["filtroEProd", "filtroSProd"].forEach(id => {
    let sel = document.getElementById(id);
    if (!sel) return;
    let current = sel.value;
    sel.innerHTML = '<option value="">Todos los productos</option>';
    _catalogo.productos.forEach(p => sel.innerHTML += `<option value="${p}">${p}</option>`);
    sel.value = current;
  });
}

function llenar(p, r) {
  let prod = document.getElementById(p);
  let ref  = document.getElementById(r);
  if (!prod || !ref) return;
  prod.innerHTML = "";
  _catalogo.productos.forEach(x => prod.innerHTML += `<option>${x}</option>`);
  prod.onchange = () => {
    ref.innerHTML = "";
    (_catalogo.referencias[prod.value] || []).forEach(y => ref.innerHTML += `<option>${y}</option>`);
  };
  prod.onchange();
}

// ===== DASHBOARD =====
function renderDashboard() {
  let cont = document.getElementById("dashboardContent");
  if (!cont) return;

  let hoy = new Date().toISOString().substring(0, 10);
  let totalPacas  = _inventarioData.reduce((s, x) => s + (x.pacas || 0), 0);
  let entradasHoy = _entradasData.filter(x => (x.fechaISO || "").startsWith(hoy));
  let salidasHoy  = _salidasData.filter(x  => (x.fechaISO || "").startsWith(hoy));
  let pendientes  = _preentradasData.filter(x => x.estado === "pendiente");

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
    <div class="dash-card ${pendientes.length ? 'dash-yellow' : 'dash-gray'}">
      <div class="dash-icon">⏳</div>
      <div class="dash-num">${pendientes.length}</div>
      <div class="dash-label">Pre-entradas pendientes</div>
    </div>
  </div>`;

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
}

// ===== ENTRADAS =====
function verEntradas() {
  db.collection("entradas").orderBy("fecha","desc").onSnapshot(snap => {
    _entradasData = [];
    snap.forEach(doc => _entradasData.push({ ...doc.data(), _id: doc.id }));
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

// ===== EDITAR / ANULAR MOVIMIENTOS =====
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
      fechaISO: new Date().toISOString()
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

  showSpinner();
  db.collection("inventario").doc(p + "_" + r).get().then(doc => {
    if (!doc.exists) { hideSpinner(); return toast("Sin inventario para este producto", "error"); }
    let data = doc.data();
    if (data.pacas < pac) { hideSpinner(); return toast(`❌ Stock insuficiente — disponible: ${data.pacas} pacas`, "error"); }

    db.collection("salidas").add({
      fecha: new Date().toLocaleString(), fechaISO: new Date().toISOString(),
      producto:p, referencia:r, pacas:pac, lote, notas,
      usuario: localStorage.getItem("usuario")
    });
    db.collection("inventario").doc(p + "_" + r).update({ pacas: data.pacas - pac });
    pacasS.value = "";
    document.getElementById("loteS").value  = "";
    document.getElementById("notasS").value = "";
    hideSpinner();
    toast("✅ Salida registrada");
  }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
}

function verSalidas() {
  db.collection("salidas").orderBy("fecha","desc").onSnapshot(snap => {
    _salidasData = [];
    snap.forEach(doc => _salidasData.push({ ...doc.data(), _id: doc.id }));
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

// ===== TRAZABILIDAD POR LOTE =====
function buscarTrazabilidad() {
  let lote = (document.getElementById("inputTrazLote")?.value || "").trim().toLowerCase();
  if (!lote) return toast("Ingrese un número de lote para buscar", "error");

  let preE = _preentradasData.filter(x => (x.lote||"").toLowerCase().includes(lote));
  let ent  = _entradasData.filter(x  => (x.lote||"").toLowerCase().includes(lote));
  let sal  = _salidasData.filter(x   => (x.lote||"").toLowerCase().includes(lote));

  let tPE = document.getElementById("trazPreentradas");
  let tE  = document.getElementById("trazEntradas");
  let tS  = document.getElementById("trazSalidas");
  let res = document.getElementById("trazResumen");

  if (tPE) tPE.innerHTML = preE.length
    ? preE.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.lote||"—"}</td><td>${x.usuarioProduccion}</td><td><span class="estado-${x.estado}">${x.estado}</span></td></tr>`).join("")
    : '<tr><td colspan="7" class="sin-datos">Sin registros</td></tr>';

  if (tE) tE.innerHTML = ent.length
    ? ent.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.usuario}</td></tr>`).join("")
    : '<tr><td colspan="5" class="sin-datos">Sin registros</td></tr>';

  if (tS) tS.innerHTML = sal.length
    ? sal.map(x => `<tr><td>${x.fecha}</td><td>${x.producto}</td><td>${x.referencia}</td><td>${x.pacas}</td><td>${x.notas||"—"}</td><td>${x.usuario}</td></tr>`).join("")
    : '<tr><td colspan="6" class="sin-datos">Sin registros</td></tr>';

  if (res) {
    let pacE = ent.reduce((s,x)=>s+(x.pacas||0),0);
    let pacS = sal.reduce((s,x)=>s+(x.pacas||0),0);
    res.innerHTML = `
      <span>📋 Pre-entradas: <b>${preE.length}</b></span>
      <span>📥 Entradas: <b>${ent.length}</b> (${pacE} pacas)</span>
      <span>📤 Salidas: <b>${sal.length}</b> (${pacS} pacas)</span>
    `;
    res.style.display = "flex";
  }
}

// ===== INVENTARIO =====
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

function verInventario() {
  db.collection("inventario").onSnapshot(snap => {
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
  });
}

function calcularEstibas(id, p, r, pac) {
  db.collection("estibas").doc(p + "_" + r).get().then(doc => {
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

// ===== CONFIG =====
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

function cargarConfig() {
  db.collection("estibas").onSnapshot(snap => {
    _configEstibas = {};
    snap.forEach(d => { _configEstibas[d.id] = d.data(); });
    renderTablaEstibas();
    renderTablaCatalogo();
    if (_currentSection === "dashboard") renderDashboard();
  });
}

function guardarFila(p, r) {
  let val = parseInt(document.getElementById(`c-${p}-${r}`).value);
  let min = parseInt(document.getElementById(`m-${p}-${r}`).value) || 0;
  if (!val) return toast("Ingrese las pacas por estiba", "error");
  db.collection("estibas").doc(p + "_" + r).set({ producto:p, referencia:r, pacas:val, minimo:min });
  toast("✅ Guardado");
}

async function limpiar(tipo) {
  let clave = document.getElementById("claveAdmin").value;
  if (!clave) return toast("Ingrese la clave admin", "error");
  try {
    let snap = await db.collection("usuarios").where("rol","==","Admin").where("clave","==",clave).get();
    if (snap.empty) return toast("❌ Clave incorrecta", "error");
  } catch(e) { toast("Error verificando clave", "error"); return; }

  if (!confirm("¿Eliminar todos los datos de " + tipo + "? Esta acción no se puede deshacer.")) return;
  showSpinner();
  db.collection(tipo).get().then(snap => {
    snap.forEach(doc => db.collection(tipo).doc(doc.id).delete());
    hideSpinner();
    toast("✅ Eliminado");
  });
}

// ===== USUARIOS =====
function crearUsuario() {
  let u   = userN.value.trim();
  let c   = passN.value.trim();
  let rol = rolN.value;
  if (!u || !c) return toast("Complete todos los campos", "error");
  db.collection("usuarios").add({ usuario:u, clave:c, rol:rol });
  userN.value = ""; passN.value = "";
  toast("✅ Usuario creado");
}

function verUsuarios() {
  db.collection("usuarios").onSnapshot(snap => {
    tablaUsuarios.innerHTML = "";
    snap.forEach(doc => {
      let u = doc.data();
      tablaUsuarios.innerHTML += `<tr>
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

function guardarUsuario(id) {
  let nueva = document.getElementById("pass-" + id).value;
  if (!nueva) return toast("Ingrese la nueva clave", "error");
  db.collection("usuarios").doc(id).update({ clave: nueva });
  toast("✅ Contraseña actualizada");
}

function eliminarUsuario(id) {
  if (!confirm("¿Eliminar este usuario?")) return;
  db.collection("usuarios").doc(id).delete();
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

function logout() {
  localStorage.removeItem("usuario");
  localStorage.removeItem("rol");
  location.href = "index.html";
}

// ===== PRE-ENTRADAS =====
function crearPreEntrada() {
  let p    = productoPE.value;
  let r    = referenciaPE.value;
  let pac  = parseInt(pacasPE.value);
  let lote = document.getElementById("lotePE").value.trim();
  if (!pac) return toast("Ingrese cantidad", "error");

  showSpinner();
  db.collection("preentradas").add({
    fecha: new Date().toLocaleString(), fechaISO: new Date().toISOString(),
    producto:p, referencia:r, pacas:pac, lote,
    usuarioProduccion: localStorage.getItem("usuario"),
    estado: "pendiente"
  }).then(() => {
    pacasPE.value = "";
    document.getElementById("lotePE").value = "";
    hideSpinner();
    toast("✅ Pre-entrada enviada a confirmación");
  }).catch(e => { hideSpinner(); toast("❌ Error: " + e.message, "error"); });
}

function verPreEntradas() {
  db.collection("preentradas").onSnapshot(snap => {
    _preentradasData = [];
    snap.forEach(doc => _preentradasData.push({ ...doc.data(), _id: doc.id }));
    _preentradasData.sort((a, b) => (b.fechaISO||"") > (a.fechaISO||"") ? 1 : -1);

    let pendientes = _preentradasData.filter(x => x.estado === "pendiente");

    let badgeE = document.getElementById("badgeEntradas");
    if (badgeE) {
      badgeE.textContent  = pendientes.length;
      badgeE.style.display = pendientes.length ? "inline" : "none";
    }

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
      fecha: new Date().toLocaleString(), fechaISO: new Date().toISOString(),
      producto, referencia, pacas, lote: lote||"",
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
    let snap = await db.collection("inventario").get();
    let data = [];
    for (let doc of snap.docs) {
      let x = doc.data();
      let confDoc = await db.collection("estibas").doc(x.producto + "_" + x.referencia).get();
      let estibas = confDoc.exists ? (x.pacas / confDoc.data().pacas).toFixed(2) : 0;
      data.push({ Producto:x.producto, Referencia:x.referencia, Pacas:x.pacas, Estibas:estibas });
    }
    let ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{wch:25},{wch:15},{wch:10},{wch:10}];
    let wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "Inventario_ONE_CARIBE.xlsx");
  } catch(e) { toast("❌ Error: " + e.message, "error"); }
  hideSpinner();
}

function imprimirInventario() {
  db.collection("inventario").get().then(snap => {
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
      w.document.write(`<html><head><title>Inventario ONE CARIBE</title>
      <style>body{font-family:Arial;padding:30px;}table{width:100%;border-collapse:collapse;}
      th{background:#1e293b;color:white;padding:12px;text-align:center;}
      td{padding:12px;border-bottom:1px solid #ddd;text-align:center;}
      tr:nth-child(even){background:#f9fafb;}.total{margin-top:20px;text-align:right;font-weight:bold;}</style></head>
      <body>
        <div style="display:flex;justify-content:space-between;margin-bottom:20px;">
          <div><b style="font-size:22px">ONE CARIBE</b><div style="color:#555;font-size:13px">Reporte de Inventario</div></div>
          <div style="color:#555;font-size:13px">${new Date().toLocaleString()}</div>
        </div>
        <table><tr><th>Producto</th><th>Referencia</th><th>Pacas</th><th>Estibas</th></tr>${filas.join("")}</table>
        <div class="total">TOTAL PACAS: ${total} &nbsp;|&nbsp; TOTAL ESTIBAS: ${totalEstibas.toFixed(2)}</div>
        <div style="margin-top:30px;text-align:center;color:#555;font-size:12px;">© 2026 ONE CARIBE</div>
      </body></html>`);
      w.document.close(); w.print();
    });
  });
}

// ===== ROLES =====
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

// ===== PERMISOS =====
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
  toast("✅ Permisos guardados");
}
