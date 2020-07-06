/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Interface utilisateur d'envoi
 */

function m2sErrValidInit(){

  m2sTrace("m2sErrValidInit m2sErrValidInit");

  if("arguments" in window && window.arguments.length > 0) {

    let erreurs=window.arguments[0];

    let liste=document.getElementById("errvalid-liste");

    for (var i=0;i<erreurs.length;i++){

      let erreur=erreurs[i];
      m2sTrace("m2sErrValidInit erreur.element:"+erreur.element+" - erreur.erreur:"+erreur.erreur);

      let item=document.createElement("row");
      let cell1=document.createElement("label");
      let cell2=document.createElement("label");
      cell1.setAttribute("value", erreur.element);
      cell2.setAttribute("value", erreur.erreur);

      item.appendChild(cell1);
      item.appendChild(cell2);
      liste.appendChild(item);
    }

  } else {
    m2sTrace("m2sErrValidInit pas d'arguments");
    window.close();
  }
}
