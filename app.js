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

// ================= AUTH =================
function checkAuth(){
if(!localStorage.getItem("usuario")){
location.href="index.html";
}
}

function setUserInfo(){
document.getElementById("userInfo").innerText = localStorage.getItem("usuario");
}

// ================= VISTAS =================
function mostrar(id){

if(!puedeAcceder(id)){
alert("❌ No tienes permiso");
return;
}

// 🔥 VALIDACIÓN REAL FIREBASE
if(id==="config" || id==="usuarios"){

let clave = prompt("Clave admin:");
if(!clave) return;

db.collection("usuarios")
.where("rol","==","Admin")
.where("clave","==",clave)
.get()
.then(snap=>{

if(snap.empty){
alert("❌ Clave incorrecta");
return;
}

abrirVista(id);

});

return;
}

abrirVista(id);
}

function abrirVista(id){
document.querySelectorAll(".vista").forEach(v=>v.style.display="none");
document.getElementById(id).style.display="block";
}

// ================= PERMISOS =================
function puedeAcceder(id){

let rol = localStorage.getItem("rol");

if(rol==="Admin") return true;
if(rol==="Supervisor") return id!=="config" && id!=="usuarios";
if(rol==="Operador") return id==="entradas"||id==="salidas"||id==="inventario";

return false;
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
<td id="estiba-${doc.id}">0</td>
</tr>`;

calcularEstibas(doc.id,x.producto,x.referencia,x.pacas);

});

});
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
}

function verUsuarios(){

db.collection("usuarios").onSnapshot(snap=>{

tablaUsuarios.innerHTML="";

snap.forEach(doc=>{
let u=doc.data();

tablaUsuarios.innerHTML+=`
<tr>
<td>${u.usuario}</td>
<td><input id="pass-${doc.id}" value="${u.clave}"></td>
<td>${u.rol}</td>
<td>
<button onclick="guardarUsuario('${doc.id}')">💾</button>
<button onclick="eliminarUsuario('${doc.id}')">🗑</button>
</td>
</tr>`;
});

});
}

function guardarUsuario(id){

let nueva=document.getElementById("pass-"+id).value;

if(!nueva) return;

db.collection("usuarios").doc(id).update({
clave:nueva
});
}

function eliminarUsuario(id){
if(!confirm("¿Eliminar usuario?")) return;
db.collection("usuarios").doc(id).delete();
}

// ================= LOGOUT =================
function logout(){
localStorage.clear();
location.href="index.html";
}
