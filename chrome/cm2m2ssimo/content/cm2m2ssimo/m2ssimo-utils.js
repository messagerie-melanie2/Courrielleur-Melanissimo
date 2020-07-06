/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Fonctions utilitaires
 */
ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/iteratorUtils.jsm");


//chaine du fichier cm2m2ssimo.properties
var gM2sBundle=null;

function m2sMessageFromName(msgid){
  
  if (null==gM2sBundle)
    gM2sBundle=Services.strings.createBundle("chrome://cm2m2ssimo/locale/cm2m2ssimo.properties");

  return gM2sBundle.GetStringFromName(msgid);
}

function m2sMessageFormatFromName(msgid, vals, nb){
  
  if (null==gM2sBundle)
    gM2sBundle=Services.strings.createBundle("chrome://cm2m2ssimo/locale/cm2m2ssimo.properties");

  return gM2sBundle.formatStringFromName(msgid, vals, nb);
}

/*
 * affiche une boite alert a partir des identifiants titre et message
 * titreId : identifiant du titre cm2m2ssimo.properties (optionnel)
 * msgId : identifiant du message cm2m2ssimo.properties
 */
function m2sAfficheErrId(titreId, msgId){

  let titre="";
  if (titreId)
    titre=m2sMessageFromName(titreId);
  let msg=m2sMessageFromName(msgId);
  
  m2sAfficheMsg(titre, msg);
}


/*
 * Affichage des erreurs serveur http
 * source: source d'erreur
 * msg: message d'erreur
 */
function m2sAfficheErrMsg(source, msg){

  //logguer
  m2sEcritLog("Affichage erreur", msg, source);

  let titre=m2sMessageFromName("m2sTitreEnvoi");
  
  m2sAfficheMsg(titre, msg);
}


function m2sAfficheMsg(titre, msg){
  
  Services.prompt.alert(null, titre, msg);
}


/*
 * function d'exception
 *
 * @param message (optionnel)
 * @param code (optionnel)
 * @param fichier nom du fichier (optionnel)
 * @param fonction nom de la fonction (optionnel)
 */
function m2sExeception(message, code, fichier, fonction) {

  this.message=message;
  this.code=code;
  this.fichier=fichier;
  this.fonction=fonction;
}

m2sExeception.prototype={
  
  dump: function(){
    m2sTrace("m2sExeception code:"+this.code+" - message:"+this.message+"\nfichier:"+this.fichier+" - fonction:"+this.fonction);
  },

  AfficheUI: function(){

    //logguer les exceptions
    let data=(this.code?"Code:"+this.code:"");
    data+=(this.fichier?" - Fichier:"+this.fichier:"");
    data+=(this.fonction?" - Fonction:"+this.fonction:"");
    m2sEcritLog("EXCEPTION", this.message, data);

    let titre=m2sMessageFromName("m2sModuleExTitre");
    let msg=this.message;
    if (-1!=this.code)
      msg+="\nCode erreur: "+this.code;
                        
    Services.prompt.alert(null, titre, msg);
  }
}


/*
 * Notification utilisateur d'un type d'envoi non gere
 * msgtype type nsIMsgCompDeliverMode sert d'index pour la chaine a afficher
 */
function m2sNotifTypeMsgNonGere(msgtype) {

  m2sTrace("m2sNotifTypeMsgNonGere - type:"+msgtype);
  let titre=m2sMessageFromName("m2sModuleTitre");

  let msg2="";
  try{
    msg2=m2sMessageFromName("m2sTypenongere"+"-"+msgtype);
  } catch(ex){
    msg2=m2sMessageFormatFromName("m2sTypenongere-n", [msgtype], 1);
  }
  m2sTrace("m2sNotifTypeMsgNonGere - msg2:"+msg2);
  let msg1=m2sMessageFormatFromName("m2sTypenongere", [msg2], 1);

  Services.prompt.alert(null, titre, msg1);
}


/*
 * Affichage de l'interface d'envoi
 *
 * params={_msgcompose:msgcompose, _msgtype:msgtype, _identite:identite, _accountKey:accountKey, _msgwindow:msgwindow, _progress:progress};
 *
 */
function m2sDisplayUI(params){

  m2sEcritLog(M2S_LOGS_UI, "Affichage de la boîte d'envoi Mélanissimo");

  return window.openDialog("chrome://cm2m2ssimo/content/m2ssimo-ui.xul", "", "chrome, modal, centerscreen", params);
}

/*
 * Affichage de la liste des erreurs de validation
 *
 * erreurs : tableau de m2sMsgErreurValid
 */
function m2sDisplayErrValid(erreurs){

  m2sEcritLog(M2S_LOGS_UI, "Boite d'affichage d'erreur de validation");

  return window.openDialog("chrome://cm2m2ssimo/content/m2ssimo-errval.xul", "", "chrome, modal, resizable, centerscreen", erreurs);
}

/*
 * Demande a l'utilisateur d'utiliser melanissimo
 * @return 1 si oui, 0 si non
 */
function m2sDemandeEnvoi(){

  let titre=m2sMessageFromName("m2sTitreEnvoi");
  let msg=m2sMessageFromName("m2sDemandeEnvoi");

  let bt=Services.prompt.confirmEx(null, titre, msg, dlgmsg.STD_YES_NO_BUTTONS, null, null, null, null, {});
  
  if (0==bt){
    m2sEcritLog(M2S_LOGS_UI, "Boite de demande d'envoi Mélanissimo", "réponse OUI");
    return 1;
  }
  
  m2sEcritLog(M2S_LOGS_UI, "Boite de demande d'envoi Mélanissimo", "réponse NON");
  return 0;
}

/*
 * Calcul approximatif de la taille du message
 * sert a determiner depuis la fenetre de composition si le message doit passer par melanssimo
 * le calcul est realise sur la base du corps du message et des pieces jointes eventuelles
 * @param msgcompose instance nsIMsgCompose
 * @return taille en octets
 */
function m2sTailleComposition(msgcompose) {

  let tailleTotale=0;

  //taille sujet
  tailleTotale+=msgcompose.compFields.subject.length;

  if (msgcompose.composeHTML){

    //mode html
    //taille du corps
    tailleTotale+=msgcompose.editor.outputToString('text/html', nsIDocumentEncoder.OutputBodyOnly |
                                                    nsIDocumentEncoder.OutputNoScriptContent|
                                                    nsIDocumentEncoder.OutputCRLineBreak |
                                                    nsIDocumentEncoder.OutputLFLineBreak |
                                                    nsIDocumentEncoder.OutputAbsoluteLinks).length;
    //taille des images
    let editorMail=msgcompose.editor.QueryInterface(Components.interfaces.nsIEditorMailSupport);
    let objets=editorMail.getEmbeddedObjects();
    let nb=objets.length;

    m2sTrace("m2sTailleComposition getEmbeddedObjects nombre:"+nb);
    for (var i=0;i<nb;i++){

      let obj=null;
      try{
        obj=objets.QueryElementAt(i, Components.interfaces.nsIDOMElement);
      }catch(ex){
        m2sTrace("m2sTailleComposition nsIDOMElement exception:"+ex);
        continue;
      }

      if (null==obj){
        m2sTrace("m2sTailleComposition nsIDOMElement obj==null i:"+i);
        continue;
      }

      let nosend=obj.getAttribute("moz-do-not-send");
      if ("true"==nosend) {
        m2sTrace("m2sTailleComposition nsIDOMElement moz-do-not-send==true i:"+i);
        continue;
      }

      if (!(obj instanceof Components.interfaces.nsIDOMHTMLImageElement)){
        m2sTrace("m2sTailleComposition nsIDOMElement pas une image i:"+i);
        continue;
      }

      let img=null;
      try{

        img=obj.QueryInterface(Components.interfaces.nsIDOMHTMLImageElement);

        if (img && img.src){
          m2sTrace("m2sTailleComposition image src:"+img.src);
          if (0==img.src.indexOf("file:///")){

            let chemin=img.src;
            let fileHandler=Services.io.getProtocolHandler("file")
                                .QueryInterface(Components.interfaces.nsIFileProtocolHandler);
            let fichier=fileHandler.getFileFromURLSpec(chemin);

            //verifier existe et type fichier
            if (fichier.exists()){
              let l=fichier.fileSize;
              m2sTrace("m2sTailleComposition taille fichier image:"+l);
              tailleTotale+=l;

            } else {
              m2sTrace("m2sTailleComposition fichier image inexistant:"+chemin);
            }
          } else{
            m2sTrace("m2sTailleComposition pas de conversion image possible!");
          }
        }

      }catch(ex){
        m2sTrace("m2sTailleComposition exception:"+ex);
        continue;
      }
    }

  } else {

    //mode texte
    //taille du corps
    tailleTotale+=msgcompose.editor.outputToString('text/plain', nsIDocumentEncoder.OutputFormatted |
                                                   nsIDocumentEncoder.OutputCRLineBreak |
                                                   nsIDocumentEncoder.OutputLFLineBreak).length;
  }

  //taille des pieces jointes
  for (let attachment of fixIterator(msgcompose.compFields.attachments,
                                     Components.interfaces.nsIMsgAttachment)) {
    tailleTotale+=attachment.size;
  }

  return tailleTotale;
}
