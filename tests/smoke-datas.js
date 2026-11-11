/* testes rápidos só desta versão, usando o mesmo simulador do smoke2 */
const src = require("fs").readFileSync(__dirname + "/smoke.js", "utf8");
const head = src.slice(0, src.indexOf("(async()=>{"));
eval(head + `
(async()=>{
  const FOTOS = db=>{
    db.registros.push({id:"rf", bebe_id:BABY, tipo:"momento", data:"2026-11-03", texto:"", dados:{}, foto_path:"fam-bispo/diario/x.jpg", visivel:false, criado_em:"2026-11-03T10:00:00Z"});
    db.album_fotos.push({id:"f1", album_id:"a1", foto_path:"fam-bispo/albuns/1.jpg", data:"2026-11-03"}, {id:"f2", album_id:"a1", foto_path:"fam-bispo/albuns/2.jpg", data:"2026-11-03"});
    Object.assign(db.files, {"fam-bispo/diario/x.jpg":true, "fam-bispo/albuns/1.jpg":true, "fam-bispo/albuns/2.jpg":true});
  };
  await run("diário: Mudar data no cartão e na foto em tela cheia", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    const card = [...w.document.querySelectorAll("#view-tl article")].find(a=>a.querySelector(".ph"));
    [...card.querySelectorAll("button")].find(b=>b.textContent === "Mudar data").click(); await wait(50);
    assert(w.document.getElementById("dateDlg").open, "abre o diálogo");
    const inp = w.document.querySelector("#dateList input[type=date]"); inp.value = "2026-08-17"; inp.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(150);
    assert(db.registros.find(r=>r.id === "rf").data === "2026-08-17", "data salva pelo cartão: " + db.registros.find(r=>r.id === "rf").data);
    const card2 = [...w.document.querySelectorAll("#view-tl article")].find(a=>a.querySelector(".ph"));
    card2.querySelector(".ph").click(); await wait(100);
    assert(!w.document.getElementById("lbDate").hidden, "botão Mudar data na foto");
    w.document.getElementById("lbDate").click(); await wait(50);
    const inp2 = w.document.querySelector("#dateList input[type=date]"); inp2.value = "2026-09-01"; inp2.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(150);
    assert(db.registros.find(r=>r.id === "rf").data === "2026-09-01", "data salva pela foto");
  }, FOTOS);
  await run("álbum: mudar a data de uma foto, de várias e apagar o álbum", "fabio@x.com", null, async ({w, db, view, btn, wait, unlock, assert})=>{
    await unlock("segredo1");
    btn("Álbuns").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    w.document.querySelectorAll(".photogrid button.ph")[1].click(); await wait(100);
    assert(!w.document.getElementById("lbDate").hidden, "Mudar data na foto do álbum");
    w.document.getElementById("lbDate").click(); await wait(50);
    let inp = w.document.querySelector("#dateList input[type=date]"); inp.value = "2026-08-20"; inp.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(150);
    assert(db.album_fotos.find(f=>f.id === "f2").data === "2026-08-20", "uma foto");
    assert(w.document.getElementById("lbInfo").textContent.includes("20/08/2026"), "tela cheia mostra a data nova: " + w.document.getElementById("lbInfo").textContent);
    w.document.getElementById("lbClose").click(); await wait(50);
    btn("Mudar datas das fotos").click(); await wait(100);
    const all = w.document.querySelector("#dateList label input[type=date]"); all.value = "2026-07-15"; all.dispatchEvent(new w.Event("input"));
    w.document.getElementById("dateOk").click(); await wait(200);
    assert(db.album_fotos.every(f=>f.data === "2026-07-15"), "várias de uma vez");
    btn("Apagar álbum").click(); await wait(50);
    assert(view("view-ft").includes("Não dá para desfazer"), "pede confirmação");
    btn("Sim, apagar").click(); await wait(150);
    assert(!db.albuns.some(a=>a.id === "a1") && view("view-ft").includes("Álbuns de fotos") && !view("view-ft").includes("Gestação"), "álbum apagado");
  }, FOTOS);
  await run("visitante: sem Mudar data e sem Apagar álbum", null, null, async ({w, view, wait, login, assert})=>{
    await login("ana@x.com", "segredo2");
    w.document.getElementById("tab-ft").click(); await wait(100);
    [...w.document.querySelectorAll(".albcard")][0].click(); await wait(100);
    assert(!view("view-ft").includes("Apagar álbum") && !view("view-ft").includes("Mudar datas"), "sem botões");
    w.document.querySelector(".photogrid button.ph").click(); await wait(100);
    assert(w.document.getElementById("lbDate").hidden, "sem Mudar data");
  }, FOTOS);
})();`);
