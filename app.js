// ================= INIT =================
function initApp(){
checkAuth();
cargarSelects();
verEntradas();
verSalidas();
verInventario();
cargarConfig();
verUsuarios();
mostrar("entradas");
setUserInfo();
}

// ================= LOGIN =================
function checkAuth(){
if(!localStorage.getItem("usuario")){
location.href="index.html";
}
}

function setUserInfo(){
userInfo.innerText = localStorage.getItem("usuario");
}

// ================= UI =================
function mostrar(id){

if(!puedeAcceder(id)){
alert("❌ No tienes permiso");
return;
}

if(id==="config" || id==="usuarios"){
if(!pedirClaveAdmin()) return;
}

document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";
}

// ================= SELECTS =================
function cargarSelects(){
llenar("productoE","referenciaE");
llenar("productoS","referenciaS");
}

function llenar(p,r){
let prod=document.getElementById(p);
let ref=document.getElementById(r);

prod.innerHTML="";
catalogo.productos.forEach(x=>{
prod.innerHTML+=`<option>${x}</option>`;
});

prod.onchange=()=>{
ref.innerHTML="";
catalogo.referencias[prod.value].forEach(y=>{
ref.innerHTML+=`<option>${y}</option>`;
});
};

prod.onchange();
}

// ================= ENTRADAS =================
function entrada(){

let p=productoE.value;
let r=referenciaE.value;
let pac=parseInt(pacasE.value);

if(!pac) return alert("Ingrese cantidad");

db.collection("entradas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

actualizarInventario(p,r,pac);

pacasE.value="";
alert("Entrada registrada");
}

// ================= SALIDAS =================
function salida(){

let p=productoS.value;
let r=referenciaS.value;
let pac=parseInt(pacasS.value);

if(!pac) return alert("Ingrese cantidad");

let clave = p+"_"+r;

db.collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists) return alert("Sin inventario");

let data=doc.data();

if(data.pacas<pac) return alert("No hay suficiente");

db.collection("salidas").add({
fecha:new Date().toLocaleString(),
producto:p,
referencia:r,
pacas:pac,
usuario:localStorage.getItem("usuario")
});

db.collection("inventario").doc(clave).update({
pacas:data.pacas-pac
});

pacasS.value="";
alert("Salida registrada");

});
}

// ================= TABLAS =================
function verEntradas(){

db.collection("entradas").orderBy("fecha","desc")
.onSnapshot(snap=>{
tablaEntradas.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
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

db.collection("salidas").orderBy("fecha","desc")
.onSnapshot(snap=>{
tablaSalidas.innerHTML="";
snap.forEach(doc=>{
let x=doc.data();
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

// ================= INVENTARIO =================
function actualizarInventario(p,r,pac){

let clave = p+"_"+r;

db.collection("inventario").doc(clave).get()
.then(doc=>{

if(!doc.exists){

db.collection("inventario").doc(clave).set({
producto:p,
referencia:r,
pacas:pac
});

}else{

let data=doc.data();

db.collection("inventario").doc(clave).update({
pacas:data.pacas+pac
});

}

});
}

function verInventario(){

db.collection("inventario").onSnapshot(snap=>{

tablaInventario.innerHTML="";

snap.forEach(doc=>{
let x=doc.data();

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

// ================= CONFIG =================
function cargarConfig(){

db.collection("estibas").onSnapshot(snap=>{

let conf=[];
snap.forEach(d=>conf.push(d.data()));

let html="";

catalogo.productos.forEach(p=>{
catalogo.referencias[p].forEach(r=>{

let item=conf.find(x=>x.producto==p && x.referencia==r);

html+=`
<tr>
<td>${p}</td>
<td>${r}</td>
<td><input id="c-${p}-${r}" value="${item?item.pacas:''}"></td>
<td><button onclick="guardarFila('${p}','${r}')">Guardar</button></td>
</tr>`;

});
});

tablaConfig.innerHTML=html;

});
}

function guardarFila(p,r){

let val=parseInt(document.getElementById(`c-${p}-${r}`).value);
if(!val) return alert("Ingrese valor");

let clave=p+"_"+r;

db.collection("estibas").doc(clave).set({
producto:p,
referencia:r,
pacas:val
});

alert("Guardado");
}

// ================= LIMPIAR =================
function limpiar(tipo){

let clave=document.getElementById("claveAdmin").value;

let usuarios=JSON.parse(localStorage.getItem("usuarios"))||[];
let admin=usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(!admin) return alert("Clave incorrecta");
if(!confirm("¿Eliminar datos?")) return;

db.collection(tipo).get().then(snap=>{
snap.forEach(doc=>{
db.collection(tipo).doc(doc.id).delete();
});
});

alert("Eliminado");
}

// ================= USUARIOS =================
function crearUsuario(){

let u=userN.value.trim();
let c=passN.value.trim();
let rol=rolN.value;

if(!u||!c) return alert("Complete campos");

db.collection("usuarios").add({usuario:u,clave:c,rol:rol});

userN.value="";
passN.value="";
alert("Usuario creado");
}

function verUsuarios(){

db.collection("usuarios").onSnapshot(snap=>{

tablaUsuarios.innerHTML="";

snap.forEach(doc=>{
let u=doc.data();

tablaUsuarios.innerHTML+=`
<tr>
<td>${u.usuario}</td>
<td>${u.clave}</td>
<td>${u.rol}</td>
<td><button onclick="eliminarUsuario('${doc.id}')">🗑</button></td>
</tr>`;
});

});
}

function eliminarUsuario(id){
if(!confirm("¿Eliminar usuario?")) return;
db.collection("usuarios").doc(id).delete();
}

// ================= ACCESO =================
function puedeAcceder(id){

let rol=localStorage.getItem("rol");

if(rol==="Admin") return true;
if(rol==="Supervisor") return id!=="config" && id!=="usuarios";
if(rol==="Operador") return id==="entradas"||id==="salidas";

return false;
}

function pedirClaveAdmin(){

let clave=prompt("Clave admin:");
if(!clave) return false;

let usuarios=JSON.parse(localStorage.getItem("usuarios"))||[];

let admin=usuarios.find(x=>x.rol==="Admin" && x.clave===clave);

if(admin) return true;

alert("Clave incorrecta");
return false;
}
function toggleMenu(){

let sidebar = document.querySelector(".sidebar");

if(sidebar.style.left === "0px"){
sidebar.style.left = "-220px";
}else{
sidebar.style.left = "0px";
}

}
if('serviceWorker' in navigator){
navigator.serviceWorker.register('service-worker.js');
}
