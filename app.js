// ================= SUCURSAL =================
function sucursalDB(){
return db.collection("sucursales")
.doc(localStorage.getItem("sucursal"));
}

// ================= INIT =================
function initApp(){

if(!localStorage.getItem("sucursal")){
localStorage.setItem("sucursal","Barranquilla");
}

checkAuth();
setUserInfo();

cargarSelects();
verEntradas();
verSalidas();
verInventario();
cargarConfig();
verUsuarios();

aplicarPermisosMenu();
mostrar("entradas");
}

// ================= AUTH =================
function checkAuth(){

if(!localStorage.getItem("usuario")){
location.href="index.html";
return;
}

if(!localStorage.getItem("permisos")){
alert("Sesión inválida");
location.href="index.html";
}
}

// ================= USER =================
function setUserInfo(){
userInfo.innerText =
localStorage.getItem("usuario") + " - " +
localStorage.getItem("sucursal");
}

// ================= UI =================
function mostrar(id){

if(!puedeAcceder(id)){
alert("❌ No tienes permiso");
return;
}

if((id==="config"||id==="usuarios")){
pedirClaveAdmin().then(ok=>{
if(!ok) return;

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";
});
return;
}

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";
}

// ================= PERMISOS =================
function puedeAcceder(id){

let p = JSON.parse(localStorage.getItem("permisos"));
if(!p) return false;

return {
entradas:p.entradas,
salidas:p.salidas,
inventario:p.inventario,
config:p.config,
usuarios:p.usuarios
}[id] || false;
}

// ================= ADMIN =================
async function pedirClaveAdmin(){

let clave = prompt("Clave admin:");
if(!clave) return false;

let suc = localStorage.getItem("sucursal");

let snap = await db.collection("sucursales")
.doc(suc)
.collection("usuarios")
.where("rol","==","Admin")
.where("clave","==",clave)
.get();

return !snap.empty;
}

// ================= ENTRADAS =================
function entrada(){

let p=productoE.value;
let r=referenciaE.value;
let pac=parseInt(pacasE.value);

if(!pac) return alert("Ingrese cantidad");

sucursalDB().collection("entradas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

actualizarInventario(p,r,pac);

pacasE.value="";
}

// ================= INVENTARIO =================
function actualizarInventario(p,r,pac){

let clave=p+"_"+r;

sucursalDB().collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists){
sucursalDB().collection("inventario").doc(clave).set({
producto:p,
referencia:r,
pacas:pac
});
}else{
let d=doc.data();
sucursalDB().collection("inventario").doc(clave).update({
pacas:d.pacas+pac
});
}
});
}

// ================= SALIDAS =================
function salida(){

let p=productoS.value;
let r=referenciaS.value;
let pac=parseInt(pacasS.value);

if(!pac) return;

let clave=p+"_"+r;

sucursalDB().collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists) return alert("Sin inventario");

let d=doc.data();

if(d.pacas<pac) return alert("No hay suficiente");

sucursalDB().collection("salidas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

sucursalDB().collection("inventario").doc(clave).update({
pacas:d.pacas-pac
});
});
}

// ================= VER DATOS =================
function verEntradas(){
sucursalDB().collection("entradas").onSnapshot(s=>{
tablaEntradas.innerHTML="";
s.forEach(d=>{
let x=d.data();
tablaEntradas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>`;
});
});
}

function verSalidas(){
sucursalDB().collection("salidas").onSnapshot(s=>{
tablaSalidas.innerHTML="";
s.forEach(d=>{
let x=d.data();
tablaSalidas.innerHTML+=`
<tr>
<td>${x.fecha}</td>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${x.usuario}</td>
</tr>`;
});
});
}

function verInventario(){
sucursalDB().collection("inventario").onSnapshot(s=>{
tablaInventario.innerHTML="";
s.forEach(d=>{
let x=d.data();
tablaInventario.innerHTML+=`
<tr>
<td>${x.producto}</td>
<td>${x.referencia}</td>
<td>${x.pacas}</td>
<td>${(x.pacas/42).toFixed(2)}</td>
</tr>`;
});
});
}

// ================= MENU =================
function aplicarPermisosMenu(){

let p=JSON.parse(localStorage.getItem("permisos"));
if(!p) return;

if(!p.config) document.querySelector("[onclick=\"mostrar('config')\"]").style.display="none";
if(!p.usuarios) document.querySelector("[onclick=\"mostrar('usuarios')\"]").style.display="none";
if(!p.inventario) document.querySelector("[onclick=\"mostrar('inventario')\"]").style.display="none";
}

// ================= LOGOUT =================
function logout(){
localStorage.clear();
location.href="index.html";
}
