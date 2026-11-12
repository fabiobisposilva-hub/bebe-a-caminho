/* Testes da versão com várias famílias, usando um servidor simulado com as mesmas regras do banco */
const { JSDOM } = require("jsdom");
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/../app/index.html", "utf8").replace(/<script src="https:\/\/cdn[^>]+><\/script>/, "").replace("function icsFile(evs){", "window.__icsFile = e=>icsFile(e);\nfunction icsFile(evs){");
/* o Pré-natal está desligado no app (PRENATAL = false); os testes dele religam a chave com runPN */
const htmlPN = html.replace("const PRENATAL = false;", "const PRENATAL = true;");
let PAGE = html;
const FB = "fam-bispo", BABY = "bebe-maria";
const PH = __dirname + "/fixtures/fotos/";

function makeDB(){
  return {
    users: {"fabio@x.com":{id:"u-fabio", pw:"segredo1"}, "ana@x.com":{id:"u-ana", pw:"segredo2"}, "carlos@x.com":{id:"u-carlos", pw:"segredo3"}},
    perfis: [
      {id:"u-fabio", email:"fabio@x.com", nome:"Fabio Bispo", papel:"Pai"},
      {id:"u-ana", email:"ana@x.com", nome:"Ana Souza", papel:"Tia"},
      {id:"u-carlos", email:"carlos@x.com", nome:"Carlos Lima", papel:"Pai"},
    ],
    familias: [{id:FB, nome:"Família Bispo Mendonça", criado_por:"u-fabio"}],
    membros: [
      {familia_id:FB, user_id:"u-fabio", papel:"responsavel", status:"aprovado"},
      {familia_id:FB, user_id:"u-ana", papel:"visitante", status:"aprovado"},
    ],
    convites: [],
    bebes: [{id:BABY, familia_id:FB, nome:"Maria Bispo Mendonça", dpp:"2027-01-28", nasc:null, sexo:"F", foto_path:null, ordem:0}],
    registros: [
      {id:"r1", bebe_id:BABY, tipo:"momento", data:"2026-10-01", texto:"Ultrassom 3D", dados:{}, foto_path:null, visivel:true, autor:"u-fabio", criado_em:"2026-10-01T10:00:00Z"},
      {id:"r2", bebe_id:BABY, tipo:"consulta", data:"2026-10-02", texto:"Consulta privada", dados:{}, foto_path:null, visivel:false, autor:"u-fabio", criado_em:"2026-10-02T10:00:00Z"},
    ],
    albuns: [{id:"a1", familia_id:FB, nome:"Gestação", autor:"u-fabio", criado_em:"2026-10-01T00:00:00Z"}],
    album_fotos: [], rotina: [], push_subs: [], files: {}, n: 0,
  };
}

function mockSupabase(db, startUser){
  let user = startUser ? {id: db.users[startUser].id, email: startUser} : null;
  const mem = (fid)=>db.membros.find(m=>m.familia_id === fid && m.user_id === user?.id);
  const resp = fid=>{ const m = mem(fid); return !!m && m.papel === "responsavel" && m.status === "aprovado"; };
  const ve = fid=>{ const m = mem(fid); return !!m && m.status === "aprovado"; };
  const famBebe = bid=>(db.bebes.find(b=>b.id === bid) || {}).familia_id;
  const famAlbum = aid=>(db.albuns.find(a=>a.id === aid) || {}).familia_id;
  const read = {
    perfis: r=>r.id === user?.id || db.membros.some(e=>e.user_id === user?.id && e.papel === "responsavel" && e.status === "aprovado" && db.membros.some(o=>o.familia_id === e.familia_id && o.user_id === r.id)),
    familias: r=>!!mem(r.id) || r.criado_por === user?.id,
    membros: r=>r.user_id === user?.id || resp(r.familia_id),
    convites: r=>resp(r.familia_id),
    bebes: r=>ve(r.familia_id),
    registros: r=>resp(famBebe(r.bebe_id)) || (r.visivel && ve(famBebe(r.bebe_id))),
    albuns: r=>ve(r.familia_id),
    album_fotos: r=>ve(famAlbum(r.album_id)),
    rotina: r=>resp(famBebe(r.bebe_id)),
    push_subs: r=>r.user_id === user?.id,
  };
  const write = {
    perfis: r=>r.id === user?.id,
    familias: r=>r.criado_por === user?.id || resp(r.id),
    membros: r=>resp(r.familia_id),
    convites: r=>resp(r.familia_id),
    bebes: r=>resp(r.familia_id),
    registros: r=>resp(famBebe(r.bebe_id)),
    albuns: r=>resp(r.familia_id),
    album_fotos: r=>resp(famAlbum(r.album_id)),
    rotina: r=>resp(famBebe(r.bebe_id)),
    push_subs: r=>r.user_id === user?.id && resp(r.familia_id),
  };
  function builder(t){
    let op = "select", filters = [], payload = null, single = false;
    const b = {
      select(){ return b; }, order(){ return b; }, limit(){ return b; }, gte(){ return b; },
      eq(k, v){ filters.push(r=>r[k] === v); return b; },
      in(k, vs){ filters.push(r=>vs.includes(r[k])); return b; },
      insert(p){ op = "insert"; payload = p; return b; },
      upsert(p){ op = "upsert"; payload = p; return b; },
      update(p){ op = "update"; payload = p; return b; },
      delete(){ op = "delete"; return b; },
      single(){ single = true; return b; },
      then(res, rej){ return Promise.resolve(run()).then(res, rej); },
    };
    const RLS = {data:null, error:{message:"new row violates row-level security policy for table \"" + t + "\""}};
    function run(){
      const tbl = db[t], match = r=>filters.every(f=>f(r));
      if (op === "select"){ const rows = tbl.filter(r=>read[t](r) && match(r)); return {data: single ? rows[0] : rows, error:null}; }
      if (op === "insert"){
        const row = Object.assign({id: t + "-" + (++db.n), autor: user?.id, criado_em: new Date().toISOString()}, payload);
        if (!write[t](row)) return RLS;
        tbl.push(row);
        if (t === "familias") db.membros.push({familia_id: row.id, user_id: row.criado_por, papel:"responsavel", status:"aprovado"});
        return {data: single ? row : [row], error:null};
      }
      if (op === "upsert"){
        if (!write[t](payload)) return RLS;
        const i = tbl.findIndex(r=>r.endpoint === payload.endpoint); if (i >= 0) tbl[i] = Object.assign(tbl[i], payload); else tbl.push(Object.assign({}, payload));
        return {data:[payload], error:null};
      }
      if (op === "update"){ const rows = tbl.filter(r=>read[t](r) && match(r) && write[t](r)); rows.forEach(r=>Object.assign(r, payload)); return {data: single ? rows[0] : rows, error:null}; }
      if (op === "delete"){ const rows = tbl.filter(r=>match(r) && write[t](r)); db[t] = tbl.filter(r=>!rows.includes(r)); return {data:rows, error:null}; }
    }
    return b;
  }
  return {
    from: builder,
    rpc: async (fn, args)=>{
      const c = db.convites.find(x=>x.codigo === String(args.cod).toUpperCase());
      if (fn === "info_convite"){
        if (!c) return {data:[], error:null};
        const f = db.familias.find(x=>x.id === c.familia_id), p = db.perfis.find(x=>x.id === c.criado_por);
        return {data:[{familia:f.nome, papel:c.papel, convidado_por:(p?.nome||"").split(" ")[0], valido: c.usos < c.max_usos}], error:null};
      }
      if (fn === "usar_convite"){
        if (!user) return {data:null, error:{message:"Entre na sua conta primeiro."}};
        if (!c) return {data:null, error:{message:"Convite não encontrado. Confira o código."}};
        if (mem(c.familia_id)) return {data:c.familia_id, error:null};
        if (c.usos >= c.max_usos) return {data:null, error:{message:"Este convite expirou ou já foi usado. Peça um novo."}};
        db.membros.push({familia_id:c.familia_id, user_id:user.id, papel:c.papel, status:"pendente"}); c.usos++;
        return {data:c.familia_id, error:null};
      }
    },
    auth: {
      getSession: async ()=>({data:{session: user ? {user} : null}}),
      onAuthStateChange(){ return {data:{subscription:{unsubscribe(){}}}}; },
      signInWithPassword: async ({email, password})=>{
        const u = db.users[email];
        if (!u || u.pw !== password) return {data:null, error:{message:"Invalid login credentials"}};
        user = {id:u.id, email}; return {data:{user, session:{user}}, error:null};
      },
      signUp: async ({email, password, options})=>{
        if (db.users[email]) return {data:null, error:{message:"User already registered"}};
        const id = "u-" + email.split("@")[0]; db.users[email] = {id, pw:password};
        db.perfis.push(Object.assign({id, email}, options.data, {aceite_privacidade: options.data.aceite}));
        user = {id, email}; return {data:{user, session:{user}}, error:null};
      },
      signOut: async ()=>{ user = null; return {error:null}; },
      updateUser: async ()=>({data:{user}, error:null}),
      resetPasswordForEmail: async ()=>({data:{}, error:null}),
    },
    storage: { from: ()=>({
      upload: async (path)=>{
        const seg = path.split("/");
        const ok = (seg[0] === "capas" && seg[1] === user?.id) || resp(seg[0]);
        if (!ok) return {data:null, error:{message:"new row violates row-level security policy"}};
        db.files[path] = true; return {data:{path}, error:null};
      },
      download: async (path)=>db.files[path] ? {data: Buffer.isBuffer(db.files[path]) ? new (globalThis.__Blob)([db.files[path]], {type:"application/pdf"}) : new (globalThis.__Blob)(["x"], {type:"image/jpeg"}), error:null} : {data:null, error:{message:"not found"}},
      remove: async ()=>({data:[], error:null}),
    })},
  };
}

const RESULT = {ok:0, fail:0};
function runPN(...a){ PAGE = htmlPN; return run(...a).finally(()=>{ PAGE = html; }); }
function run(name, startUser, url, steps, prep){
  return new Promise(res=>{
    const db = makeDB(); if (prep) prep(db);
    const dom = new JSDOM(PAGE, { runScripts:"dangerously", pretendToBeVisual:true, url: url || "https://bebe.example/", beforeParse(w){
      w.IntersectionObserver = class{ observe(){} unobserve(){} };
      w.HTMLDialogElement.prototype.showModal = function(){ this.open = true; };
      w.HTMLDialogElement.prototype.close = function(){ this.open = false; };
      w.scrollTo = ()=>{};
      if (db.__ls) for (const [k, v] of Object.entries(db.__ls)) w.localStorage.setItem(k, typeof v === "function" ? v() : v);
      globalThis.__Blob = w.Blob;
      if (!w.Blob.prototype.arrayBuffer) w.Blob.prototype.arrayBuffer = function(){ return new Promise((ok,no)=>{ const r = new w.FileReader(); r.onload=()=>ok(r.result); r.onerror=no; r.readAsArrayBuffer(this); }); };
      if (!w.TextDecoder) w.TextDecoder = require("util").TextDecoder;
      w.URL.createObjectURL = ()=>"blob:teste"; w.URL.revokeObjectURL = ()=>{};
      w.createImageBitmap = ()=>Promise.reject(new Error("sem decodificador"));
      w.Image = class { set src(v){ setTimeout(()=>this.onerror && this.onerror(new w.Event("error")), 5); } };
      w.supabase = { createClient: ()=>mockSupabase(db, startUser) };
      { const FI = require("fake-indexeddb"); w.indexedDB = new FI.IDBFactory(); }
      { const pdfjs = require("pdfjs-dist/legacy/build/pdf.js");
        pdfjs.GlobalWorkerOptions.workerSrc = require.resolve("pdfjs-dist/legacy/build/pdf.worker.js");
        w.pdfjsLib = { GlobalWorkerOptions: pdfjs.GlobalWorkerOptions, getDocument: o=>pdfjs.getDocument({data: Uint8Array.from(o.data), verbosity: 0}) }; }
    }});
    const w = dom.window, L = ()=>w.document.getElementById("lockScr");
    const view = id=>w.document.getElementById(id).textContent;
    const btn = label=>[...w.document.querySelectorAll("button")].find(b=>!b.closest("[hidden]") && b.textContent.trim() === label);
    const wait = ms=>new Promise(r=>setTimeout(r, ms));
    const assert = (c, m)=>{ if (!c) throw new Error(m); };
    const login = async (email, pw)=>{ btn("Já tenho conta").click(); const i = L().querySelectorAll("input"); i[0].value = email; i[1].value = pw; btn("Entrar").click(); await wait(200); };
    const unlock = async pw=>{ w.document.getElementById("lkPw").value = pw; btn("Entrar").click(); await wait(200); };
    setTimeout(async ()=>{
      try{ await steps({w, db, L, view, btn, wait, assert, login, unlock}); console.log("OK  ", name); RESULT.ok++; }
      catch(e){ console.log("FAIL", name, "→", e.message); RESULT.fail++; process.exitCode = 1; }
      res();
    }, 300);
  });
}

(async()=>{
  await run("família Bispo continua igual (dados migrados)", null, null, async ({w, view, login, assert})=>{
    await login("fabio@x.com", "segredo1");
    assert(L => true, "");
    assert(view("view-tl").includes("Ultrassom 3D") && view("view-tl").includes("Consulta privada"), "vê os registros");
    assert(!w.document.getElementById("tab-rt").hidden, "abas de responsável");
  });

  await run("casal novo cria a própria família e não vê a dos Bispo", null, null, async ({w, db, L, view, btn, wait, login, assert})=>{
    await login("carlos@x.com", "segredo3");
    assert(L().textContent.includes("Criar a família do meu bebê"), "oferece criar família");
    btn("Criar a família do meu bebê").click();
    const nome = L().querySelector("input"); assert(nome.value === "Família Lima", "sugere o nome: " + nome.value);
    btn("Criar família").click(); await wait(250);
    assert(L().hidden, "entrou no app");
    assert(w.document.getElementById("setDlg").open, "abre o cadastro do bebê");
    w.document.getElementById("sName").value = "Pedro";
    w.document.getElementById("setForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(150);
    const fam = db.familias.find(f=>f.nome === "Família Lima");
    assert(db.bebes.some(b=>b.nome === "Pedro" && b.familia_id === fam.id), "bebê na família nova");
    assert(!view("view-tl").includes("Ultrassom 3D"), "não vê o diário dos Bispo");
    w.document.getElementById("fab").click();
    w.document.getElementById("fTxt").value = "Pedro chutou";
    w.document.getElementById("addForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(150);
    assert(db.registros.some(r=>r.texto === "Pedro chutou"), "registrou na família nova");
  });

  await run("convite de responsável: link, cadastro, pedido e autorização", null, null, async ({w, db, L, view, btn, wait, login, assert})=>{
    await login("fabio@x.com", "segredo1");
    w.document.getElementById("openSettings").click(); await wait(50);
    btn("Convidar responsável").click(); await wait(150);
    const c = db.convites[0];
    assert(c && c.papel === "responsavel" && c.max_usos === 1, "convite criado");
    assert(L().textContent.includes("?convite=" + c.codigo), "mostra o link");
  }, null);

  // Thaís (ou qualquer parceiro) abre o link do convite
  await run("pessoa convidada entra pelo link e fica aguardando", null, "https://bebe.example/?convite=ABCD2345", async ({w, db, L, btn, wait, assert})=>{
    await wait(150);
    assert(L().textContent.includes("Fabio te convidou para ser responsável pelo diário da Família Bispo Mendonça"), "mostra o convite");
    btn("Criar sua conta").click();
    const i = L().querySelectorAll("input");
    i[0].value = "Thaís Mendonça"; i[1].value = "thais@x.com"; i[2].value = "1990-03-03"; i[3].value = "senha123"; i[4].value = "senha123";
    btn("Criar conta").click(); await wait(150);
    assert(L().textContent.includes("aceite a Política de Privacidade"), "exige aceite");
    L().querySelector('input[type=checkbox]').checked = true;
    btn("Criar conta").click(); await wait(300);
    const m = db.membros.find(x=>x.user_id === "u-thais");
    assert(m && m.papel === "responsavel" && m.status === "pendente", "pedido pendente de responsável");
    assert(L().textContent.includes("aguardando autorização"), "tela de aguardando");
    assert(db.perfis.find(p=>p.id === "u-thais").aceite_privacidade, "aceite gravado");
  }, db=>db.convites.push({codigo:"ABCD2345", familia_id:FB, papel:"responsavel", criado_por:"u-fabio", usos:0, max_usos:1}));

  await run("Fabio autoriza; convidada vira responsável", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    assert(view("notices").includes("Thaís Mendonça") && view("notices").includes("quer ser responsável"), "cartão do pedido");
    btn("Autorizar").click(); await wait(100);
    assert(db.membros.find(x=>x.user_id === "u-thais").status === "aprovado", "aprovada");
  }, db=>{ db.users["thais@x.com"] = {id:"u-thais", pw:"senha123"}; db.perfis.push({id:"u-thais", email:"thais@x.com", nome:"Thaís Mendonça"}); db.membros.push({familia_id:FB, user_id:"u-thais", papel:"responsavel", status:"pendente"}); });

  await run("visitante não enxerga outras famílias nem edita", null, null, async ({w, view, login, assert})=>{
    await login("ana@x.com", "segredo2");
    assert(view("view-tl").includes("Ultrassom 3D") && !view("view-tl").includes("Consulta privada"), "só o liberado");
    assert(!view("view-tl").includes("Pedro"), "nada da outra família");
    assert(w.document.getElementById("fab").hidden && w.document.getElementById("openSettings").hidden, "sem edição");
  }, db=>{ db.familias.push({id:"fam-lima", nome:"Família Lima", criado_por:"u-carlos"}); db.bebes.push({id:"bebe-pedro", familia_id:"fam-lima", nome:"Pedro"}); db.registros.push({id:"rp", bebe_id:"bebe-pedro", tipo:"momento", data:"2026-10-10", texto:"Pedro chutou", visivel:true}); });

  await run("avó em duas famílias troca pelo seletor", null, null, async ({w, view, wait, login, assert})=>{
    await login("ana@x.com", "segredo2");
    const sel = w.document.getElementById("famSel");
    assert(!sel.hidden && sel.options.length === 2, "seletor com 2 famílias");
    const lima = [...sel.options].find(o=>o.textContent === "Família Lima");
    sel.value = lima.value; sel.dispatchEvent(new w.Event("change")); await wait(250);
    assert(view("view-tl").includes("Pedro chutou") && !view("view-tl").includes("Ultrassom 3D"), "mostra só a família escolhida");
  }, db=>{ db.familias.push({id:"fam-lima", nome:"Família Lima", criado_por:"u-carlos"}); db.bebes.push({id:"bebe-pedro", familia_id:"fam-lima", nome:"Pedro"}); db.registros.push({id:"rp", bebe_id:"bebe-pedro", tipo:"momento", data:"2026-10-10", texto:"Pedro chutou", visivel:true}); db.membros.push({familia_id:"fam-lima", user_id:"u-ana", papel:"visitante", status:"aprovado"}); });

  await run("fotos vão para a pasta da família", "fabio@x.com", null, async ({w, db, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const real = w.document.createElement.bind(w.document); let picker = null;
    w.document.createElement = (t, ...a)=>{ const e = real(t, ...a); if (t === "input") picker = e; return e; };
    btn("Adicionar fotos").click(); w.document.createElement = real;
    Object.defineProperty(picker, "files", {value: [new w.File([fs.readFileSync(PH + "camera.jpg")], "camera.jpg", {type:"image/jpeg", lastModified: Date.now()})]});
    picker.dispatchEvent(new w.Event("change")); await wait(300);
    w.document.getElementById("dateOk").click(); await wait(300);
    const r = db.registros.find(x=>x.foto_path);
    assert(r && r.foto_path.startsWith(FB + "/diario/") && r.data === "2026-08-17", "foto em " + (r && r.foto_path) + " com data " + (r && r.data));
  });

  await runPN("pré-natal: exame marcado com PDF, agenda e lembrete", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    assert(view("view-pn").includes("Pré-natal da mãe"), "aba pré-natal");
    btn("+ Exame").click(); await wait(50);
    const fut = new Date(Date.now() + 5*86400000), iso = fut.getFullYear()+"-"+String(fut.getMonth()+1).padStart(2,"0")+"-"+String(fut.getDate()).padStart(2,"0");
    w.document.getElementById("pnExame").value = "Ultrassom morfológico";
    w.document.getElementById("pnData").value = iso;
    w.document.getElementById("pnHora").value = "14:30";
    w.document.getElementById("pnLocal").value = "Clínica Imagem";
    const real = w.document.createElement.bind(w.document); let picker = null;
    w.document.createElement = (t, ...a)=>{ const e = real(t, ...a); if (t === "input") picker = e; return e; };
    btn("📎 Anexar PDF ou foto").click(); w.document.createElement = real;
    Object.defineProperty(picker, "files", {value:[new w.File(["%PDF-1.4 teste"], "pedido-exame.pdf", {type:"application/pdf"})]});
    picker.dispatchEvent(new w.Event("change")); await wait(150);
    w.document.getElementById("pnForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(250);
    const r = db.registros.find(x=>x.tipo === "pn_exame");
    assert(r && r.data === iso && r.dados.hora === "14:30" && r.dados.exame === "Ultrassom morfológico", "exame salvo");
    assert(r.dados.anexos.length === 1 && r.dados.anexos[0].path.startsWith(FB + "/prenatal/") && r.dados.anexos[0].path.endsWith(".pdf") && db.files[r.dados.anexos[0].path], "PDF anexado na pasta da família");
    assert(w.document.getElementById("remDlg").open, "abre o lembrete depois de salvar exame futuro");
    const g = [...w.document.querySelectorAll("#remBody a")].find(a=>a.textContent.includes("Google Agenda"));
    assert(g && g.href.includes("calendar.google.com") && g.href.includes("T143000"), "link do Google Agenda com horário");
    w.document.getElementById("remClose").click();
    w.document.getElementById("tab-tl").click(); await wait(50);
    assert(view("view-tl").includes("Próximos 30 dias") && view("view-tl").includes("Ultrassom morfológico"), "agenda no Diário");
    assert(!w.document.querySelector("#view-tl article") || ![...w.document.querySelectorAll("#view-tl article")].some(a=>a.textContent.includes("Ultrassom morfológico")), "pré-natal não entra na linha do tempo");
  });

  await run("visitante não vê a aba pré-natal nem os exames", null, null, async ({w, view, login, assert})=>{
    await login("ana@x.com", "segredo2");
    assert(w.document.getElementById("tab-pn").hidden, "aba escondida");
    assert(!view("view-tl").includes("TOTG"), "exame invisível");
  }, db=>db.registros.push({id:"pn1", bebe_id:BABY, tipo:"pn_exame", data:"2026-10-05", texto:"", dados:{exame:"TOTG"}, visivel:false}));

  await run("arquivo de calendário com alarmes", "fabio@x.com", null, async ({w, assert, unlock})=>{
    await unlock("segredo1");
    const ics = w.eval('window.__icsFile([{title:"Consulta, teste", date:"2026-12-01", time:"09:00", local:"UBS"},{title:"Vacina BCG", date:"2027-01-29"}])');
    assert(ics.includes("DTSTART:20261201T090000") && ics.includes("TRIGGER:-P1D") && ics.includes("TRIGGER:-PT2H"), "evento com hora e 2 alarmes");
    assert(ics.includes("DTSTART;VALUE=DATE:20270129") && ics.includes("DTEND;VALUE=DATE:20270130") && ics.includes("TRIGGER:-PT15H"), "evento de dia inteiro");
    assert(ics.includes("SUMMARY:Consulta\\, teste"), "vírgula escapada");
  });

  await runPN("guia do pré-natal: semana, exames, vacinas e fontes", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    const g = view("view-pn");
    const dum = new Date(2027,0,28); dum.setDate(dum.getDate()-280);
    const sem = Math.floor((new Date(new Date().toDateString()) - dum)/86400000/7);
    assert(g.includes("Guia do pré-natal") && g.includes("Agora: " + sem + "ª semana"), "mostra a semana atual (" + sem + ")");
    assert(g.includes("no mínimo 7") && g.includes("TOTG 75 g (de preferência entre 24 e 28 semanas)") && g.includes("VSR"), "consultas, exames e vacinas");
    assert(g.includes("Caderneta Brasileira da Gestante – edição 2026") && g.includes("atualizado em 30/01/2026"), "fontes citadas");
    // registrar a dTpa pelo guia
    const linha = [...w.document.querySelectorAll("#view-pn .it")].find(d=>d.textContent.startsWith("dTpa"));
    [...linha.querySelectorAll("button")].find(b=>b.textContent === "Registrar").click(); await wait(50);
    assert(w.document.getElementById("pnVacina").value === "dTpa", "vacina já preenchida");
    w.document.getElementById("pnForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(200);
    assert(db.registros.some(r=>r.tipo === "pn_vacina" && r.dados.vacina === "dTpa"), "vacina gravada");
    const linha2 = [...w.document.querySelectorAll("#view-pn .it")].find(d=>d.textContent.startsWith("dTpa"));
    assert(linha2.textContent.includes("Registrada em") && linha2.textContent.includes("✓"), "aparece como feita");
  });

  const LD = __dirname + "/fixtures/laudos/", PRIV = __dirname + "/fixtures/privado/";
  const pickFiles = (w, label, files)=>{
    const real = w.document.createElement.bind(w.document); let picker = null;
    w.document.createElement = (t, ...a)=>{ const e = real(t, ...a); if (t === "input") picker = e; return e; };
    [...w.document.querySelectorAll("button")].find(b=>!b.closest("[hidden]") && b.textContent.trim() === label).click();
    w.document.createElement = real;
    Object.defineProperty(picker, "files", {value: files}); picker.dispatchEvent(new w.Event("change"));
  };
  await runPN("ler laudo do laboratório: 6 exames, atualiza o marcado e cria os outros", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    pickFiles(w, "📄 Ler laudo", [new w.File([fs.readFileSync(LD + "laboratorio.pdf")], "laboratorio.pdf", {type:"application/pdf"})]);
    await wait(1500);
    const dlg = w.document.getElementById("laudoDlg");
    assert(dlg.open, "abre a conferência");
    const body = w.document.getElementById("laudoBody").textContent;
    assert(body.includes("Data do resultado encontrada no laudo (coleta em 08/10/2026)"), "data do resultado com coleta");
    assert(body.includes("Vai atualizar o registro de 05/10/2026 (marcado)") || body.includes("Vai atualizar o registro de 05/10/2026"), "achou o hemograma marcado");
    assert(w.document.getElementById("laudoSave").textContent === "Salvar 6 exames", "6 exames: " + w.document.getElementById("laudoSave").textContent);
    w.document.getElementById("laudoSave").click(); await wait(400);
    assert(!dlg.open, "fechou depois de salvar");
    const pn = db.registros.filter(r=>r.tipo === "pn_exame");
    assert(pn.length === 6, "6 exames no pré-natal, achei " + pn.length);
    const hemo = pn.find(r=>r.id === "pnm1");
    assert(hemo && hemo.data === "2026-10-10" && hemo.dados.coleta === "2026-10-08" && /Hemoglobina 11,8/.test(hemo.texto), "hemograma marcado atualizado com data do resultado");
    assert(hemo.dados.anexos.length === 1 && hemo.dados.anexos[0].path.startsWith(FB + "/laudos/") && hemo.dados.lidos.includes(hemo.dados.anexos[0].path), "laudo anexado e lido");
    const toxo = pn.find(r=>/Toxo/.test(r.dados.exame));
    assert(toxo && /IgG reagente · IgM não reagente/.test(toxo.texto) && toxo.data === "2026-10-10", "toxo com IgG/IgM");
    assert(new Set(pn.map(r=>r.dados.anexos[0].path)).size === 1, "um único arquivo para todos");
    assert(view("view-pn").includes("Registrado em 10/10/2026"), "guia marca como feito");
  }, db=>db.registros.push({id:"pnm1", bebe_id:BABY, tipo:"pn_exame", data:"2026-10-05", texto:"", dados:{exame:"Hemograma"}, visivel:false}));

  await runPN("anexar ultrassom no formulário preenche sozinho", "fabio@x.com", null, async ({w, db, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    btn("+ Exame").click(); await wait(50);
    pickFiles(w, "📎 Anexar PDF ou foto", [new w.File([fs.readFileSync(LD + "ultrassom.pdf")], "ultrassom.pdf", {type:"application/pdf"})]);
    await wait(1500);
    assert(w.document.getElementById("pnExame").value === "Ultrassom morfológico", "nome: " + w.document.getElementById("pnExame").value);
    assert(w.document.getElementById("pnData").value === "2026-08-22", "data do laudo");
    assert(/IG 17s 3d/.test(w.document.getElementById("pnTxt").value), "resultado");
    w.document.getElementById("pnForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(300);
    const r = db.registros.find(x=>x.tipo === "pn_exame");
    assert(r && r.data === "2026-08-22" && r.dados.lidos.length === 1 && r.dados.anexos[0].path.endsWith(".pdf"), "salvo e marcado como lido");
  });

  await runPN("anexo antigo não lido: aviso e leitura atualiza o próprio registro", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    assert(view("view-pn").includes("1 anexo ainda não foi lido"), "aviso de não lido");
    btn("Ler agora").click(); await wait(1500);
    assert(w.document.getElementById("laudoBody").textContent.includes("Vai atualizar o registro de 01/11/2026"), "vai atualizar o dono do anexo");
    w.document.getElementById("laudoSave").click(); await wait(300);
    const r = db.registros.find(x=>x.id === "old1");
    assert(r.data === "2026-08-22" && r.dados.lidos.includes("fam-bispo/prenatal/u.pdf") && /IG 17s/.test(r.texto), "registro antigo atualizado: " + r.data);
    assert(db.registros.filter(x=>x.tipo === "pn_exame").length === 1, "sem duplicar");
    assert(!view("view-pn").includes("ainda não foi lido"), "aviso some");
  }, db=>{ db.registros.push({id:"old1", bebe_id:BABY, tipo:"pn_exame", data:"2026-11-01", texto:"", dados:{exame:"Ultrassom morfológico", anexos:[{path:"fam-bispo/prenatal/u.pdf", nome:"ultrassom.pdf", tipo:"application/pdf"}]}, visivel:false});
           db.files["fam-bispo/prenatal/u.pdf"] = fs.readFileSync(LD + "ultrassom.pdf"); });

  await run("teste do pezinho vai para a Caderneta do bebê", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-cd").click(); await wait(50);
    pickFiles(w, "📄 Ler laudo", [new w.File([fs.readFileSync(LD + "pezinho.pdf")], "pezinho.pdf", {type:"application/pdf"})]);
    await wait(1500);
    const sel = [...w.document.querySelectorAll("#laudoBody select")];
    assert(sel[0].value === "bebe" && sel[1].value === "Normal", "bebê e Normal");
    assert(![...sel[0].options].some(o=>o.value === "mae"), "sem pré-natal: o laudo não oferece Mãe · pré-natal");
    w.document.getElementById("laudoSave").click(); await wait(300);
    const r = db.registros.find(x=>x.tipo === "exame");
    assert(r && r.dados.ex === "pezinho" && r.dados.res === "Normal" && r.data === "2026-09-15", "teste do pezinho registrado");
    assert(view("view-cd").includes("15/09/2026") && view("view-cd").includes("pezinho.pdf"), "aparece na Caderneta com o laudo");
  }, db=>{ db.bebes[0].nasc = "2026-09-01"; });

  await run("fotos sem data: escolhe a primeira, as outras seguem, e é obrigatório", "fabio@x.com", null, async ({w, db, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    assert(!btn("Pelos arquivos"), "sem o botão Pelos arquivos");
    const sem = n=>new w.File([fs.readFileSync(PH + "1000012345.jpg")], n, {type:"image/jpeg", lastModified: Date.now()});
    pickFiles(w, "Adicionar fotos", [new w.File([fs.readFileSync(PH + "camera.jpg")], "1000000001.jpg", {type:"image/jpeg", lastModified: Date.now()}), sem("1000000002.jpg"), sem("1000000003.jpg")]);
    await wait(400);
    const ins = [...w.document.querySelectorAll("#dateList .drow input[type=date]")];
    assert(ins[0].value === "2026-08-17" && ins[1].value === "" && ins[2].value === "", "câmera lida, sem data vazias: " + ins.map(i=>i.value));
    assert(w.document.getElementById("dateList").textContent.includes("chegaram sem a data") || w.document.getElementById("dateList").textContent.includes("fotos chegaram sem a data"), "aviso");
    w.document.getElementById("dateOk").click(); await wait(50);
    assert(w.document.getElementById("dateDlg").open && w.document.getElementById("dateList").textContent.includes("Escolha a data das 2 fotos"), "obriga escolher");
    ins[1].value = "2026-09-29"; ins[1].dispatchEvent(new w.Event("input"));
    assert(ins[2].value === "2026-09-29", "a próxima seguiu");
    assert(w.document.getElementById("dateList").textContent.includes("Mesma data da foto anterior"), "marca a estimada");
    w.document.getElementById("dateOk").click(); await wait(400);
    const ds = db.registros.filter(r=>r.foto_path).map(r=>r.data).sort();
    assert(JSON.stringify(ds) === JSON.stringify(["2026-08-17","2026-09-29","2026-09-29"]), "datas salvas: " + ds);
  });

  await run("depois do nascimento: diário e álbum organizados pelo mês de vida", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const t = view("view-tl");
    assert(t.includes("1º mês de vida") && t.includes("0 a 1 mês · 01/09/2026 a 30/09/2026"), "1º mês");
    assert(t.includes("2º mês de vida") && t.includes("1 a 2 meses · 01/10/2026 a "), "2º mês");
    assert(/Agosto 2026\d{2}ª semana/.test(t), "antes do nascimento continua por mês e semana");
    const heads = [...w.document.querySelectorAll("#view-tl .month h2")].map(h=>h.textContent);
    assert(heads[0] === "2º mês de vida" && heads.includes("1º mês de vida"), "ordem: " + heads.join(" | "));
    w.document.getElementById("tab-ft").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    const g = [...w.document.querySelectorAll(".pgh b")].map(b=>b.textContent);
    assert(JSON.stringify(g) === JSON.stringify(["Agosto 2026","1º mês de vida","2º mês de vida"]), "grupos do álbum: " + g.join(" | "));
    assert(w.document.querySelector(".pgh small").textContent.includes("semana"), "gestação mostra a semana");
  }, db=>{
    db.bebes[0].nasc = "2026-09-01";
    db.registros.push({id:"b0", bebe_id:BABY, tipo:"momento", data:"2026-08-20", texto:"Barriga de 7 meses", dados:{}, visivel:false},
                      {id:"b1", bebe_id:BABY, tipo:"momento", data:"2026-09-10", texto:"Primeiro banho", dados:{}, visivel:false},
                      {id:"b2", bebe_id:BABY, tipo:"momento", data:"2026-10-05", texto:"Sorriso", dados:{}, visivel:false});
    db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"},
                        {id:"f2", album_id:"a1", foto_path:"fam-bispo/albuns/2.jpg", data:"2026-09-02"},
                        {id:"f3", album_id:"a1", foto_path:"fam-bispo/albuns/3.jpg", data:"2026-10-02"});
  });

  await run("visitante: sem baixar, marca-d'água; responsável: botão Baixar; abas com ícones", null, null, async ({w, view, btn, wait, login, assert})=>{
    await login("ana@x.com", "segredo2");
    assert(w.document.body.classList.contains("visit"), "modo visitante no corpo da página");
    assert(w.document.querySelectorAll("nav.tabs button svg").length >= 9, "ícones nas abas");
    w.document.getElementById("tab-ft").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    w.document.querySelector(".photogrid button.ph").click(); await wait(100);
    assert(w.document.getElementById("lbDl").hidden, "visitante sem Baixar");
    assert(!w.document.getElementById("lbWm").hidden && w.document.getElementById("lbWm").textContent.includes("Só visualização · Ana"), "marca-d'água com o nome");
    const ev = new w.MouseEvent("contextmenu", {bubbles:true, cancelable:true});
    w.document.getElementById("lbImg").dispatchEvent(ev);
    assert(ev.defaultPrevented, "toque longo/menu bloqueado");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}); db.files["fam-bispo/albuns/1.jpg"] = true; });

  await run("responsável vê Baixar e sem marca-d'água", "fabio@x.com", null, async ({w, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    btn("Álbuns").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    w.document.querySelector(".photogrid button.ph").click(); await wait(100);
    assert(!w.document.getElementById("lbDl").hidden && w.document.getElementById("lbWm").hidden, "Baixar visível, sem marca");
    assert(!w.document.body.classList.contains("visit"), "não é visitante");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}); db.files["fam-bispo/albuns/1.jpg"] = true; });

  await run("consulta de 2 meses: Anotar já traz a data prevista e fica no mês certo", "fabio@x.com", null, async ({w, db, view, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-cd").click(); await wait(50);
    const row = [...w.document.querySelectorAll("#view-cd .it")].find(d=>d.textContent.startsWith("Consulta de 2 meses"));
    [...row.querySelectorAll("button")].find(b=>b.textContent === "Anotar").click(); await wait(50);
    assert(w.document.getElementById("fDate").value === "2026-07-01" && w.document.getElementById("fVisita").value === "c2", "data prevista e consulta: " + w.document.getElementById("fDate").value);
    assert(w.document.getElementById("visHint").textContent.includes("consulta de 2 meses"), "dica da consulta");
    w.document.getElementById("fDate").value = "2026-07-20";
    w.document.getElementById("fPeso").value = "5,1";
    w.document.getElementById("addForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(200);
    const r = db.registros.find(x=>x.tipo === "consulta" && x.data === "2026-07-20");
    assert(r && r.dados.visita === "c2" && r.data === "2026-07-20", "salva ligada à consulta de 2 meses: " + JSON.stringify(r) + " err=" + w.document.getElementById("addErr").textContent + " open=" + w.document.getElementById("addDlg").open + " tipo=" + [...w.document.querySelectorAll("#typeSeg button")].find(b=>b.getAttribute("aria-pressed")==="true")?.dataset.t);
    w.document.getElementById("tab-cd").click(); await wait(50);
    const row2 = [...w.document.querySelectorAll("#view-cd .it")].find(d=>d.textContent.startsWith("Consulta de 2 meses"));
    assert(row2.textContent.includes("Feita 20/07/2026") && row2.textContent.includes("5,100 kg"), "aparece feita no mês certo");
    // pela data, sem escolher: 4 meses
    w.document.getElementById("fab").click(); await wait(50);
    [...w.document.querySelectorAll("#typeSeg button")].find(b=>b.dataset.t === "consulta").click();
    w.document.getElementById("fDate").value = "2026-09-03"; w.document.getElementById("fDate").dispatchEvent(new w.Event("input"));
    assert(w.document.getElementById("visHint").textContent.includes("Pela data, é a consulta de 4 meses"), "detecta pela data");
  }, db=>{ db.bebes[0].nasc = "2026-05-01"; });

  await run("ao cadastrar o nascimento: aviso para pôr vacinas e consultas no calendário", "fabio@x.com", null, async ({w, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("openSettings").click(); await wait(50);
    w.document.getElementById("sBirth").value = "2026-10-30";
    w.document.getElementById("setForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(200);
    assert(w.document.getElementById("remDlg").open && w.document.getElementById("remBody").textContent.includes("Bem-vinda ao mundo, Maria"), "aviso de nascimento");
    let blob = null; w.URL.createObjectURL = b=>{ blob = b; return "blob:x"; };
    btn("Colocar vacinas e consultas no calendário").click(); await wait(100);
    const ics = await new Promise(r=>{ const fr = new w.FileReader(); fr.onload = ()=>r(fr.result); fr.readAsText(blob); });
    assert(ics.includes("SUMMARY:Vacina de Maria: Penta") && ics.includes("DTSTART;VALUE=DATE:20261230"), "penta aos 2 meses (30/12)");
    assert(ics.includes("Consulta de rotina de Maria"), "consultas incluídas");
    w.document.getElementById("tab-tl").click(); await wait(50);
    assert(!view("notices").includes("Vacinas e consultas no calendário"), "não pede de novo depois de colocar");
  });

  const THAIS = db=>{ db.users["thais@x.com"] = {id:"u-thais", pw:"senha123"}; db.perfis.push({id:"u-thais", email:"thais@x.com", nome:"Thaís Mendonça", papel:"Mãe"}); db.membros.push({familia_id:FB, user_id:"u-thais", papel:"responsavel", status:"aprovado"}); };
  const fakePush = w=>{
    const st = {sub:null};
    w.Notification = {permission:"default", requestPermission: async()=>{ w.Notification.permission = "granted"; return "granted"; }};
    w.PushManager = function(){};
    const reg = {pushManager:{ getSubscription: async()=>st.sub, subscribe: async(o)=>{ st.key = o.applicationServerKey; st.sub = {endpoint:"https://fcm.googleapis.com/fcm/send/xyz", toJSON(){ return {endpoint:this.endpoint, keys:{p256dh:"P", auth:"A"}}; }, unsubscribe: async()=>{ st.sub = null; return true; }}; return st.sub; } }};
    Object.defineProperty(w.navigator, "serviceWorker", {value:{ getRegistration: async()=>reg, register: async()=>reg, ready: Promise.resolve(reg) }, configurable:true});
    return st;
  };

  await run("bom dia: no 1º login a mãe vê a primeira mensagem e autoriza; depois pode parar", "thais@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    const st = fakePush(w);
    await unlock("senha123"); await wait(700);
    const dlg = w.document.getElementById("remDlg");
    assert(dlg.open, "convite aberto");
    const t = w.document.getElementById("remBody").textContent;
    assert(t.includes("Mamãe, estou muito feliz por estar sendo gerada por você. Aquele chutinho de hoje foi um oi!") && t.includes("— Com amor, Maria"), "primeira mensagem: " + t.slice(0, 200));
    assert(t.includes("até os 3 meses de Maria") && t.includes("Só você recebe"), "pede autorização");
    btn("Sim, quero receber").click(); await wait(200);
    assert(!dlg.open, "fechou");
    assert(db.push_subs.length === 1 && db.push_subs[0].user_id === "u-thais" && db.push_subs[0].familia_id === FB && st.key && st.key.length === 65, "inscrição salva: " + JSON.stringify(db.push_subs));
    const card = view("view-tl");
    assert(/(Bom dia|Boa tarde|Boa noite), Thaís!/.test(card) && card.includes("semana · faltam") && card.includes("Você recebe uma mensagem todo dia às 9h"), "cartão com status");
    btn("Parar mensagens").click(); await wait(200);
    assert(db.push_subs.length === 0 && st.sub === null, "inscrição removida");
    assert(view("view-tl").includes("Mensagens de bom dia pausadas"), "pausado");
    btn("Retomar").click(); await wait(100);
    assert(btn("🔔 Receber todo dia às 9h"), "pode reativar");
  }, THAIS);

  await run("bom dia: celular sem notificações recebe pelo calendário, até 2 semanas após a data provável", "thais@x.com", null, async ({w, view, btn, wait, unlock, assert})=>{
    await unlock("senha123"); await wait(700);
    assert(w.document.getElementById("remDlg").open && btn("Receber pelo calendário"), "oferece o calendário no convite");
    let blob = null; w.URL.createObjectURL = b=>{ blob = b; return "blob:x"; };
    btn("Receber pelo calendário").click(); await wait(100);
    const ics = await new Promise(r=>{ const fr = new w.FileReader(); fr.onload = ()=>r(fr.result); fr.readAsText(blob); });
    const n = (ics.match(/BEGIN:VEVENT/g) || []).length;
    assert(n >= 90 && ics.includes("T090000") && ics.includes("TRIGGER:PT0M") && ics.includes("DTSTART:20270211T090000") && !ics.includes("20270212T09"), "eventos: " + n);
  }, THAIS);

  await run("bom dia: o pai não vê o cartão nem o convite", "fabio@x.com", null, async ({w, view, wait, unlock, assert})=>{
    fakePush(w);
    await unlock("segredo1"); await wait(700);
    assert(!view("view-tl").includes("Bom dia, ") && !view("view-tl").includes("Mensagem de hoje") && !w.document.getElementById("remDlg").open, "nada para o pai");
  }, THAIS);

  await run("bom dia: depois do nascimento, mensagem do pós-parto com a dica do dia", "thais@x.com", null, async ({w, view, wait, unlock, assert})=>{
    await unlock("senha123"); await wait(700);
    w.document.getElementById("remDlg").open && w.document.getElementById("remBody").querySelector("button.ghost")?.click();
    const t = view("view-tl");
    assert(t.includes("Maria tem 5 dias") && t.includes("Dica de cuidado: Coto umbilical") && t.includes("Peça ajuda: hoje e todos os dias."), "pós-parto: " + t.slice(0, 300));
    assert(t.includes("Caderneta da Criança, 6ª edição"), "fonte");
  }, db=>{ THAIS(db); const d = new Date(Date.now() - 5*86400000); db.bebes[0].nasc = d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); });

  await run("álbum: data em cada foto; mudar a data de uma, de todas, e apagar o álbum", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    btn("Álbuns").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    assert(!w.document.querySelector(".photogrid .dt") && !w.document.getElementById("lbX"), "fotos sem data por cima e sem ✕");
    // uma foto: abre, Mudar data
    w.document.querySelectorAll(".photogrid button.ph")[0].click(); await wait(100);
    assert(!w.document.getElementById("lbDate").hidden, "botão Mudar data na foto");
    w.document.getElementById("lbDate").click(); await wait(50);
    const i1 = w.document.querySelector("#dateList input[type=date]");
    assert(w.document.getElementById("dateDlg").open && i1.value === "2026-08-17", "abre com a data atual");
    i1.value = "2026-08-10"; i1.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(150);
    assert(db.album_fotos.find(f=>f.id === "f1").data === "2026-08-10", "salvou a data nova");
    w.document.getElementById("lbox").hidden = true;
    // todas de uma vez
    btn("Mudar datas das fotos").click(); await wait(50);
    const all = w.document.querySelector("#dateList label input[type=date]");
    all.value = "2026-09-05"; all.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(200);
    assert(db.album_fotos.every(f=>f.data === "2026-09-05"), "todas atualizadas: " + db.album_fotos.map(f=>f.data));
    // apagar
    btn("Apagar álbum").click(); await wait(50);
    assert(view("view-ft").includes("Não dá para desfazer"), "pede confirmação");
    btn("Sim, apagar").click(); await wait(150);
    assert(!db.albuns.some(a=>a.id === "a1") && !view("view-ft").includes("Gestação"), "álbum apagado");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}, {id:"f2", album_id:"a1", foto_path:"fam-bispo/albuns/2.jpg", data:null}); });

  await run("visitante não vê Mudar data nem Apagar álbum", null, null, async ({w, btn, wait, login, assert})=>{
    await login("ana@x.com", "segredo2");
    w.document.getElementById("tab-ft").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    assert(!btn("Apagar álbum") && !btn("Mudar datas das fotos"), "sem botões de edição");
    w.document.querySelector(".photogrid button.ph").click(); await wait(100);
    assert(w.document.getElementById("lbDate").hidden, "sem Mudar data");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}); });

  await run("capa do álbum: escolher, trocar de novo e cancelar", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const capa = ()=>w.document.querySelector(".albcard .ph").getAttribute("data-img");
    btn("Álbuns").click(); await wait(100);
    assert(capa() === "fam-bispo/albuns/1.jpg", "sem escolha, a capa é a primeira foto");
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    btn("Escolher capa").click(); await wait(50);
    assert(view("view-ft").includes("Escolha a capa"), "pede para tocar na foto");
    w.document.querySelectorAll(".photogrid button.ph")[2].click(); await wait(150);
    assert(db.albuns.find(a=>a.id === "a1").capa_path === "fam-bispo/albuns/3.jpg", "capa gravada no banco");
    assert(w.document.getElementById("lbox").hidden !== false && !view("view-ft").includes("Escolha a capa"), "não abriu a foto e saiu do modo de escolha");
    // trocar de novo, depois
    btn("Escolher capa").click(); await wait(50);
    w.document.querySelectorAll(".photogrid button.ph")[1].click(); await wait(150);
    assert(db.albuns.find(a=>a.id === "a1").capa_path === "fam-bispo/albuns/2.jpg", "trocou a capa de novo");
    btn("‹ Álbuns").click(); await wait(50);
    assert(capa() === "fam-bispo/albuns/2.jpg", "a lista de álbuns mostra a capa escolhida");
    // Cancelar não muda nada
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    btn("Escolher capa").click(); await wait(50); btn("Cancelar").click(); await wait(50);
    w.document.querySelectorAll(".photogrid button.ph")[0].click(); await wait(100);
    assert(db.albuns.find(a=>a.id === "a1").capa_path === "fam-bispo/albuns/2.jpg" && !w.document.getElementById("lbox").hidden, "cancelar volta a abrir a foto normal");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}, {id:"f2", album_id:"a1", foto_path:"fam-bispo/albuns/2.jpg", data:"2026-08-18"}, {id:"f3", album_id:"a1", foto_path:"fam-bispo/albuns/3.jpg", data:"2026-08-19"}); });

  await run("capa do álbum: se a foto da capa for removida, volta para a primeira; visitante não vê Escolher capa", null, null, async ({w, btn, wait, login, assert})=>{
    await login("ana@x.com", "segredo2");
    w.document.getElementById("tab-ft").click(); await wait(100);
    assert(w.document.querySelector(".albcard .ph").getAttribute("data-img") === "fam-bispo/albuns/1.jpg", "capa removida → primeira foto");
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    assert(!btn("Escolher capa"), "visitante não troca a capa");
  }, db=>{ db.albuns[0].capa_path = "fam-bispo/albuns/apagada.jpg"; db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}); });

  const seedShare = (w, list)=>new Promise((ok, no)=>{
    const r = w.indexedDB.open("bebe-share", 1);
    r.onupgradeneeded = ()=>r.result.createObjectStore("f", {autoIncrement:true});
    r.onsuccess = ()=>{ const tx = r.result.transaction("f", "readwrite"); list.forEach(x=>tx.objectStore("f").add(x)); tx.oncomplete = ok; tx.onerror = no; };
  });
  const sem = n=>({blob: fs.readFileSync(PH + "1000012345.jpg").buffer.slice(0), name: n, type: "image/jpeg", lastModified: Date.now()});

  await run("compartilhar da galeria/WhatsApp → álbum: a data vem do nome da foto", "fabio@x.com", "https://bebe.example/?compartilhado=1", async ({w, db, btn, wait, unlock, assert})=>{
    await seedShare(w, [sem("IMG-20260817-WA0001.jpg"), sem("20260902_143522.jpg")]);
    await unlock("segredo1"); await wait(700);
    assert(w.location.search === "", "limpa o endereço");
    const body = w.document.getElementById("remBody").textContent;
    assert(w.document.getElementById("remDlg").open && body.includes("2 fotos recebidas") && btn("📔 No Diário") && btn("+ Novo álbum"), "pergunta onde: " + body);
    btn("🖼 Álbum: Gestação").click(); await wait(100);
    assert(w.document.getElementById("albDlg").open && w.document.getElementById("albCount").textContent === "2 fotos recebidas", "abre o álbum com as fotos");
    w.document.getElementById("albForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(400);
    const ins = [...w.document.querySelectorAll("#dateList .drow input[type=date]")].map(i=>i.value);
    assert(JSON.stringify(ins) === JSON.stringify(["2026-08-17","2026-09-02"]), "datas pelo nome: " + ins);
    w.document.getElementById("dateOk").click(); await wait(400);
    const ds = db.album_fotos.filter(f=>f.album_id === "a1").map(f=>f.data).sort();
    assert(JSON.stringify(ds) === JSON.stringify(["2026-08-17","2026-09-02"]), "salvas: " + ds);
    const left = await new Promise(ok=>{ const r = w.indexedDB.open("bebe-share", 1); r.onsuccess = ()=>{ const c = r.result.transaction("f").objectStore("f").count(); c.onsuccess = ()=>ok(c.result); }; });
    assert(left === 0, "não sobra nada guardado");
  });

  await run("compartilhar → Diário", "fabio@x.com", "https://bebe.example/?compartilhado=1", async ({w, db, btn, wait, unlock, assert})=>{
    await seedShare(w, [sem("IMG-20261005-WA0003.jpg")]);
    await unlock("segredo1"); await wait(700);
    btn("📔 No Diário").click(); await wait(400);
    const i = w.document.querySelector("#dateList .drow input[type=date]");
    assert(i && i.value === "2026-10-05", "data pelo nome: " + (i && i.value));
    w.document.getElementById("dateOk").click(); await wait(400);
    assert(db.registros.some(r=>r.foto_path && r.data === "2026-10-05"), "no diário com a data certa");
  });

  await run("compartilhar para a mãe não mostra o bom dia por cima", "thais@x.com", "https://bebe.example/?compartilhado=1", async ({w, btn, wait, unlock, assert})=>{
    await seedShare(w, [sem("IMG-20261005-WA0003.jpg")]);
    await unlock("senha123"); await wait(700);
    assert(btn("📔 No Diário"), "mostra a escolha das fotos");
  }, THAIS);

  await run("história do mês e do ano, com marcos, consultas, vacinas e fotos", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1"); await wait(300);
    const t = view("view-tl");
    assert(t.includes("📖 A história do 1º mês de Maria") && t.includes("📖 A história do 2º mês de Maria"), "histórias dos meses que terminaram");
    assert(!t.includes("📖 A história do 13º mês"), "mês atual ainda sem história");
    assert(t.includes("📖 O 1º ano de Maria"), "história do ano");
    assert(t.includes("📖 A história da espera por Maria") && t.includes("📖 A história de agosto de 2025"), "gestação");
    const cards = [...w.document.querySelectorAll("#view-tl .story h3")].map(h=>h.textContent);
    assert(cards.indexOf("📖 O 1º ano de Maria") < cards.indexOf("📖 A história do 12º mês de Maria") || !cards.includes("📖 A história do 12º mês de Maria"), "ano antes do 12º mês: " + cards.join(" | "));
    // abre a do 2º mês
    const c2 = [...w.document.querySelectorAll("#view-tl .story")].find(d=>d.querySelector("h3").textContent === "📖 A história do 2º mês de Maria");
    c2.querySelector("button.btn").click(); await wait(50);
    const h = w.document.getElementById("storyBody").textContent;
    assert(w.document.getElementById("storyDlg").open, "abre");
    assert(h.includes("um marco: primeiro sorriso!") && h.includes("Sorriu para o papai."), "marco: " + h);
    assert(h.includes("na consulta, Maria pesava 5,200 kg") && h.includes("ganhou 1,70 kg") || h.includes("ganhou 1700 g"), "consulta: " + h);
    assert(h.includes("tomou as vacinas") && h.includes("corajosa"), "vacinas: " + h);
    assert(h.includes("Ficaram guardadas 2 fotos neste mês (1 no diário e 1 nos álbuns)"), "fotos: " + h);
    assert(w.document.querySelectorAll("#storyBody .sth").length === 2, "miniaturas");
    w.document.getElementById("storyClose").click();
    // ano
    [...w.document.querySelectorAll("#view-tl .story")].find(d=>d.textContent.includes("1º ano de Maria")).querySelector("button.btn").click(); await wait(50);
    const y = w.document.getElementById("storyBody").textContent;
    assert(y.includes("O grande marco do ano: primeiro sorriso") && y.includes("passou de 3,500 kg para 9,500 kg") && y.includes("Feliz 1º aniversário, Maria!"), "ano: " + y);
    // enviar
    let sent = null; w.navigator.share = async o=>{ sent = o; };
    btn("Enviar a história").click(); await wait(50);
    assert(sent && sent.text.startsWith("O 1º ano de Maria") && sent.text.includes("BeBê a CaMinHo"), "envia o texto");
    w.document.getElementById("storyClose").click();
    // "Salvar" sem Drive
    w.document.getElementById("fab").click(); await wait(30);
    assert(w.document.getElementById("saveBtn").textContent === "Salvar", "botão: " + w.document.getElementById("saveBtn").textContent);
  }, db=>{
    const iso = d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
    const now = new Date(), nasc = new Date(now.getFullYear()-1, now.getMonth()-0, now.getDate()-10);
    const at = (m, dd)=>iso(new Date(nasc.getFullYear(), nasc.getMonth()+m, nasc.getDate()+dd));
    db.bebes[0].nasc = iso(nasc); db.bebes[0].sexo = "F"; db.bebes[0].nome = "Maria";
    db.registros.push(
      {id:"s0", bebe_id:BABY, tipo:"momento", data:"2025-08-20", texto:"Primeiro ultrassom", dados:{}, visivel:false},
      {id:"s1", bebe_id:BABY, tipo:"medida", data:at(0,0), texto:"", dados:{peso:"3,5", alt:"49"}, visivel:false},
      {id:"s2", bebe_id:BABY, tipo:"momento", data:at(0,5), texto:"Primeiro banho em casa", dados:{}, visivel:false},
      {id:"s3", bebe_id:BABY, tipo:"marco", data:at(1,3), texto:"Sorriu para o papai", dados:{marco:"sorriso"}, visivel:false},
      {id:"s4", bebe_id:BABY, tipo:"consulta", data:at(1,6), texto:"", dados:{peso:"5,2", alt:"57"}, visivel:false},
      {id:"s5", bebe_id:BABY, tipo:"vacina", data:at(1,7), texto:"", dados:{vacs:["penta1","vip1"]}, visivel:false, foto_path:"fam-bispo/diario/v.jpg"},
      {id:"s6", bebe_id:BABY, tipo:"medida", data:at(11,20), texto:"", dados:{peso:"9,5", alt:"74"}, visivel:false});
    db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:at(1,10)});
  });

  await run("atualizar a página logo depois não pede a senha e volta na mesma aba", "fabio@x.com", null, async ({w, L, view, wait, assert})=>{
    await wait(400);
    assert(L().hidden, "entrou direto, sem senha");
    assert(view("view-tl").includes("Ultrassom 3D"), "diário carregado");
  }, db=>{ db.__ls = {"pm-uso": ()=>String(Date.now() - 5 * 60000)}; });

  await run("depois de 30 minutos sem usar, pede a senha", "fabio@x.com", null, async ({w, L, wait, unlock, assert})=>{
    await wait(400);
    assert(!L().hidden && w.document.getElementById("lkPw"), "pede a senha");
    await unlock("segredo1");
    assert(L().hidden && +w.localStorage.getItem("pm-uso") > Date.now() - 5000, "destravou e marcou o uso");
  }, db=>{ db.__ls = {"pm-uso": ()=>String(Date.now() - 31 * 60000)}; });

  await run("botão Voltar do celular: fecha janela, sai do álbum, volta ao Diário e só sai no segundo toque", "fabio@x.com", null, async ({w, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const back = async ()=>{ w.history.back(); await wait(80); };
    assert(w.history.state && w.history.state.bb === 1, "proteção ativa");
    w.document.getElementById("fab").click(); await wait(30);
    assert(w.document.getElementById("addDlg").open, "janela aberta");
    await back();
    assert(!w.document.getElementById("addDlg").open && w.history.state.bb === 1, "fechou a janela e continua no app");
    btn("Álbuns").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    w.document.querySelector(".photogrid button.ph").click(); await wait(80);
    await back(); assert(w.document.getElementById("lbox").hidden, "fechou a foto");
    await back(); assert(w.document.querySelector(".albcard"), "voltou para a lista de álbuns");
    await back(); assert(!w.document.getElementById("view-tl").hidden, "voltou para o Diário");
    await back();
    assert(w.document.getElementById("toast")?.classList.contains("on") && w.document.getElementById("toast").textContent.includes("de novo para sair"), "avisa antes de sair");
    assert(w.history.state && w.history.state.bb === 1, "ainda no app");
  }, db=>{ db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-08-17"}); db.files["fam-bispo/albuns/1.jpg"] = true; });

  await run("sair da conta apaga o destravamento", "fabio@x.com", null, async ({w, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.location.reload = ()=>{};
    w.document.getElementById("openSettings").click(); await wait(50);
    const b = [...w.document.querySelectorAll("button")].find(x=>/^Sair/.test(x.textContent.trim()) && !x.closest("[hidden]"));
    assert(b, "botão Sair"); b.click(); await wait(150);
    assert(!w.localStorage.getItem("pm-uso"), "não fica destravado");
  });

  /* laudo real do Sabin: fica em tests/fixtures/privado (fora do Git). Sem ele, o teste é pulado. */
  if (fs.existsSync(PRIV + "sabin.pdf")){
  await runPN("laudo do Sabin: 42 exames lidos, a lista do pré-natal continua e ler de novo não duplica", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    pickFiles(w, "📄 Ler laudo", [new w.File([fs.readFileSync(PRIV + "sabin.pdf")], "sabin.pdf", {type:"application/pdf"})]);
    for (let i = 0; i < 80 && !w.document.querySelector("#laudoBody .grp"); i++) await wait(250);
    const rows = ()=>[...w.document.querySelectorAll("#laudoBody .grp")].map(g=>{ const i = g.querySelectorAll("input"); return [i[1].value, i[2].value, g.lastChild.textContent]; });
    const r = rows(), get = n=>(r.find(x=>x[0] === n) || [])[1] || "";
    assert(r.length === 42, "exames: " + r.length);
    assert(w.document.querySelector("#laudoBody input[type=date]").value === "2026-10-15", "data do resultado");
    assert(get("Coombs indireto") === "Negativo" && get("Hemograma").startsWith("Hemoglobina 10,8 g/dL · Hematócrito 31,0 %"), "coombs/hemograma");
    assert(get("TOTG 75 g (curva glicêmica)") === "jejum 72 · 1 h 79 · 2 h 123 mg/dL", "totg: " + get("TOTG 75 g (curva glicêmica)"));
    assert(get("Toxoplasmose (IgG e IgM)") === "IgG não reagente (< 0,18 UI/mL) · IgM não reagente (0,21)", "toxo: " + get("Toxoplasmose (IgG e IgM)"));
    assert(get("Rubéola (IgG e IgM)").startsWith("IgG reagente (43,60 UI/mL)"), "rubéola");
    assert(get("Ferritina") === "72 ng/mL" && get("Vitamina D3 25-hidroxi") === "57 ng/mL" && get("Vitamina A") === "34,0 mcg/dL" && get("Urocultura com antibiograma").startsWith("Negativa"), "outros exames");
    assert(get("Bilirrubina total e frações").includes("Bilirrubina direta 0,10 mg/dL"), "bilirrubinas");
    w.document.getElementById("laudoSave").click();
    for (let i = 0; i < 80 && w.document.getElementById("laudoDlg").open; i++) await wait(100);
    const pn = db.registros.filter(x=>x.tipo === "pn_exame");
    const nomes = pn.map(x=>x.dados.exame);
    assert(pn.length === 42 && new Set(nomes).size === 42 && pn.find(x=>x.id === "pnm1").texto.includes("Hemoglobina 10,8"), "41 novos + o hemograma marcado atualizado: " + pn.length + " / " + new Set(nomes).size);
    console.log("     exames salvos:", nomes.join(" | "));
    console.log("     exemplos:", pn.slice(0, 8).map(x=>x.dados.exame + " = " + x.texto).join(" || "));
    assert(db.registros.some(x=>x.id === "r1") && db.registros.some(x=>x.id === "r2"), "o resto continua");
    const t = view("view-pn");
    assert(w.document.querySelector("#view-pn details").open && t.includes("Guia do pré-natal") && t.includes("Exames do 3º trimestre"), "guia continua aberto");
    assert(t.includes("Ferritina") && t.includes("Hemograma"), "lista com os exames");
    // ler de novo: atualiza, não duplica
    pickFiles(w, "📄 Ler laudo", [new w.File([fs.readFileSync(PRIV + "sabin.pdf")], "sabin2.pdf", {type:"application/pdf"})]);
    for (let i = 0; i < 120 && !(w.document.getElementById("laudoBody").textContent.includes("sabin2.pdf") && w.document.querySelector("#laudoBody .grp")); i++) await wait(250);
    assert(rows().length === 42, "2ª leitura: " + rows().length);
    assert(rows().every(x=>x[2].startsWith("Vai atualizar")), "atualiza: " + rows().filter(x=>!x[2].startsWith("Vai atualizar")).map(x=>x[0]).join(", "));
  }, db=>db.registros.push({id:"pnm1", bebe_id:BABY, tipo:"pn_exame", data:"2026-10-14", texto:"", dados:{exame:"Hemograma"}, visivel:false}));
  } else console.log("PULADO laudo do Sabin (coloque o PDF em tests/fixtures/privado/sabin.pdf)");

  await runPN("guia do pré-natal fica como a pessoa deixou", "fabio@x.com", null, async ({w, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-pn").click(); await wait(50);
    const d = ()=>w.document.querySelector("#view-pn details");
    assert(d().open, "aberto mesmo com exames");
    d().open = false; d().dispatchEvent(new w.Event("toggle")); 
    w.document.getElementById("tab-tl").click(); w.document.getElementById("tab-pn").click(); await wait(50);
    assert(!d().open, "fechado porque a pessoa fechou");
  }, db=>db.registros.push({id:"pnm1", bebe_id:BABY, tipo:"pn_exame", data:"2026-10-14", texto:"", dados:{exame:"Hemograma"}, visivel:false}));

  await run("marco errado: editar na aba Marcos e apagar", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    w.document.getElementById("tab-ms").click(); await wait(50);
    const row = ()=>[...w.document.querySelectorAll("#view-ms .ms")].find(d=>d.textContent.startsWith("Primeiro sorriso"));
    assert(row().textContent.includes("Feito") && row().querySelector("button") && [...row().querySelectorAll("button")].some(b=>b.textContent === "Editar"), "tem Editar");
    [...row().querySelectorAll("button")].find(b=>b.textContent === "Editar").click(); await wait(30);
    assert(w.document.getElementById("addDlg").open && w.document.getElementById("addTitle").textContent === "Editar registro", "abre editando");
    assert(w.document.getElementById("fMarco").value === "sorriso" && w.document.getElementById("fDate").value === "2026-10-20" && w.document.getElementById("fTxt").value === "Sorriu", "preenchido");
    w.document.getElementById("fMarco").value = "cabeca"; w.document.getElementById("fDate").value = "2026-10-25"; w.document.getElementById("fTxt").value = "Sustentou a cabeça";
    w.document.getElementById("addForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(150);
    const r = db.registros.find(x=>x.id === "m1");
    assert(r.dados.marco === "cabeca" && r.data === "2026-10-25" && r.texto === "Sustentou a cabeça" && db.registros.filter(x=>x.tipo === "marco").length === 1, "atualizou sem duplicar");
    assert(!row().textContent.includes("Feito"), "sorriso volta a ficar em aberto");
    const cab = ()=>[...w.document.querySelectorAll("#view-ms .ms")].find(d=>d.textContent.startsWith("Sustenta a cabeça"));
    [...cab().querySelectorAll("button")].find(b=>b.textContent === "Apagar").click(); await wait(30);
    [...cab().querySelectorAll("button")].find(b=>b.textContent === "Sim, apagar").click(); await wait(150);
    assert(!db.registros.some(x=>x.id === "m1") && !cab().textContent.includes("Feito"), "apagado");
  }, db=>{ db.bebes[0].nasc = "2026-10-01"; db.registros.push({id:"m1", bebe_id:BABY, tipo:"marco", data:"2026-10-20", texto:"Sorriu", dados:{marco:"sorriso"}, visivel:false}); });

  await run("editar um registro do diário pelo botão Editar", "fabio@x.com", null, async ({w, db, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const card = [...w.document.querySelectorAll("#view-tl article")].find(a=>a.textContent.includes("Ultrassom 3D"));
    [...card.querySelectorAll("button")].find(b=>b.textContent === "Editar").click(); await wait(30);
    w.document.getElementById("fTxt").value = "Ultrassom 3D: ela sorriu!";
    w.document.getElementById("addForm").dispatchEvent(new w.Event("submit", {cancelable:true})); await wait(150);
    assert(db.registros.find(x=>x.id === "r1").texto === "Ultrassom 3D: ela sorriu!" && db.registros.filter(x=>x.tipo === "momento").length === 1, "editado");
    assert(w.document.getElementById("view-tl").textContent.includes("ela sorriu"), "aparece atualizado");
  });

  await run("bibliotecas da internet com versão fixa (uma atualização de fora não quebra o app)", "fabio@x.com", null, async ({assert})=>{
    const src = fs.readFileSync(__dirname + "/../app/index.html", "utf8");
    const libs = [...src.matchAll(/https:\/\/cdn\.jsdelivr\.net\/npm\/([^"'\s)]+)/g)].map(m=>m[1]);
    assert(libs.length >= 4, "achei as bibliotecas: " + libs.length);
    const soltas = libs.filter(x=>!/@\d+\.\d+\.\d+/.test(x));
    assert(!soltas.length, "sem versão exata: " + soltas.join(", "));
  });

  await run("versão sem pré-natal: sem aba, sem atalho, sem agenda da mãe, e os dados antigos ficam guardados", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    assert(htmlPN !== html, "a chave PRENATAL existe no app");
    await unlock("segredo1");
    assert(w.document.getElementById("tab-pn").hidden, "aba Pré-natal escondida para o responsável");
    assert(!btn("Pré-natal"), "sem o atalho Pré-natal no Diário");
    assert(!view("view-tl").includes("Ultrassom morfológico"), "consulta/exame da mãe fora da agenda");
    w.document.getElementById("tab-pn").click(); await wait(50);
    assert(!w.document.getElementById("view-tl").hidden && w.document.getElementById("view-pn").hidden, "mesmo forçando, volta ao Diário");
    assert(db.registros.some(x=>x.id === "pnf1"), "registro antigo não foi apagado");
  }, db=>db.registros.push({id:"pnf1", bebe_id:BABY, tipo:"pn_exame", data: new Date(Date.now() + 5*864e5).toISOString().slice(0,10), texto:"", dados:{exame:"Ultrassom morfológico"}, visivel:false}));

  console.log("\n" + RESULT.ok + " passaram, " + RESULT.fail + " falharam");
})();
