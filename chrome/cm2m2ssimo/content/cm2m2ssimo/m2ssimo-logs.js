/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Fonctions de logs console et fichier
 */

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource://gre/modules/FileUtils.jsm");


/**
* Génération de logs dans la console
*/
var gM2ssimoTrace=false;
var gM2ssimoConsole=null;


function m2sTrace(msg){

  if (!gM2ssimoTrace){
    let t=Services.prefs.getBoolPref("melanissimo.trace");
    if (t)
      gM2ssimoConsole=Services.console;
    gM2ssimoTrace=true;
  }
  
  if (gM2ssimoConsole)
    gM2ssimoConsole.logStringMessage("[m2ssimo] - "+msg);
}



/**
* Enregistrements des evenement dans un fichier et dans la console (doublage)
*/

//nom du fichier log
const M2S_FICHIER_LOG="m2ssimo.log";

const M2S_FICHIER_LOG_SEP="\t";

let gM2sFichierLogs=null;

//sources d'evenement
const M2S_LOGS_MODULE="M2SSIMO";
const M2S_LOGS_GEN="General";
const M2S_LOGS_CFG="Configuration";
const M2S_LOGS_REQ="Requete serveur";
const M2S_LOGS_UI="UI";

//taille maxi du fichier de logs avant rotation
const M2S_LOGS_MAX=1000000;
const M2S_FICHIER_LOG1="m2ssimo-1.log";

/* rotation fichier logs
 supprime *-1.log existant
 renomme en *-1.log
 cree *.log
*/
function m2sLogsRotate(){

  m2sTrace("m2sLogsRotate");

  try{

    let fichier=Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    fichier.append(M2S_FICHIER_LOG);
    m2sTrace("m2sLogsRotate fichier."+fichier.path);
    fichier.moveTo(null, M2S_FICHIER_LOG1);

  } catch(ex){
    m2sTrace("m2sLogsRotate exception:"+ex);
  }
}


//initialisation
function m2sInitLogs(){

  m2sTrace("m2sInitLogs");

  try{

    let prefBranch=Services.prefs.getBranch(null);
    let traces=prefBranch.getBoolPref("melanissimo.logs");
    if (!traces) {
      m2sTrace("m2sInitLogs logs fichier desactive");
      return;
    }

    let fichier=Services.dirsvc.get("ProfD", Components.interfaces.nsIFile);
    fichier.append(M2S_FICHIER_LOG);

    if (fichier.exists()){
      
      m2sTrace("m2sInitLogs fichier existant");
      //test taille fichier
      if (fichier.fileSize>M2S_LOGS_MAX){
        m2sLogsRotate();
      }
      
    } else {
      m2sTrace("m2sInitLogs creation du fichier:"+M2S_FICHIER_LOG);
      fichier.create(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, FileUtils.PERMS_FILE);
    }

    gM2sFichierLogs=Components.classes["@mozilla.org/network/file-output-stream;1"].createInstance(Components.interfaces.nsIFileOutputStream);
    gM2sFichierLogs.init(fichier, FileUtils.MODE_WRONLY|FileUtils.MODE_CREATE|FileUtils.MODE_APPEND, FileUtils.PERMS_FILE, 0);


  } catch(ex){
    m2sTrace("m2sInitLogs exception."+ex);
  }
}


//écriture evenement (fichier + console)
function m2sEcritLog(source, description, donnees){
  
  if (null==gM2sFichierLogs)
    m2sInitLogs();
  if (null==gM2sFichierLogs){
    return;
  }

  try{

    if (donnees)
      m2sTrace(source+" - "+description+" - "+donnees);
    else
      m2sTrace(source+" - "+description);

    if (null==gM2sFichierLogs){
      m2sTrace("m2sEcritLog fichier non initialise");
      return;
    }

    //date heure
    let dh=new Date();
    let strdh="["+dh.getDate()+"/"+(dh.getMonth()+1)+"/"+dh.getFullYear()+" "+dh.getHours()+":"+dh.getMinutes()+":"+dh.getSeconds()+"]";
    let src="";
    if (null!=source)
      src=source;
    let desc="";
    if (null!=description)
      desc=description;
    let don="";
    if (null!=donnees)
      don=donnees;

    let msg=strdh+M2S_FICHIER_LOG_SEP+"["+src+"]"+M2S_FICHIER_LOG_SEP+
            "\""+desc+"\""+M2S_FICHIER_LOG_SEP+"\""+don+"\"\x0D\x0A";

    gM2sFichierLogs.write(msg, msg.length);
    gM2sFichierLogs.flush();


  } catch(ex){
    m2sTrace("m2sEcritLog exception."+ex);
  }
}
