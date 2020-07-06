/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Interface utilisateur d'envoi
 *
 * appel de la boite:
 * var params={_msgcompose:msgcompose, _msgtype:msgtype, _identite:identite, _accountKey:accountKey, _msgwindow:msgwindow, _progress:progress};
 * window.openDialog("chrome://cm2m2ssimo/content/m2ssimo-ui.xul", "", "chrome, dialog, modal", params);
 *
 */

ChromeUtils.import("resource://gre/modules/Services.jsm");
ChromeUtils.import("resource:///modules/mailServices.js");

const Cc=Components.classes;
const Ci=Components.interfaces;


/* parametres d'appel de la boite */
function m2sDlgParams(dlgArguments) {
  
  this.msgcompose=dlgArguments._msgcompose;
  this.msgtype=dlgArguments._msgtype;
  this.identite=dlgArguments._identite;
  this.accountKey=dlgArguments._accountKey;
  this.msgwindow=dlgArguments._msgwindow;
  this.progress=dlgArguments._progress;
  this.retour=0;
}

m2sDlgParams.prototype={
  
  msgcompose:null,
  msgtype:null,
  identite:null,
  accountKey:null,
  msgwindow:null,
  progress:null,
  retour:0
}


function m2sDlgInit() {

  try {

    //arguments d'appel
    if("arguments" in window &&
        window.arguments.length > 0) {

      let params=new m2sDlgParams(window.arguments[0]);

      m2ssimoUI.Init(params);

    } else {

      m2sTrace("m2sDlgInit !arguments");
      m2sAfficheErrId("m2sTitreEnvoi", "m2sUIErreurParams");
      m2sDlgCancel();
    }

  } catch(ex){

    if (ex instanceof m2sExeception){
      ex.dump();
      //afficher l'erreur
      ex.AfficheUI();
    } else {
      m2sTrace("m2sDlgInit exception:"+ex);
      m2sAfficheErrId("m2sTitreEnvoi", "m2sUIErreurParams");
    }

    m2sDlgCancel();
  }
}

function m2sDlgEnd() {

  window.arguments[0]._retour=m2ssimoUI.dlgParams.retour;

  window.close();

  return true;
}


function m2sDlgCancel() {

  window.arguments[0]._retour=-1;

  //si envoi en cours => annulation de l'envoi
  m2ssimoUI.Annulation();

  return false;
}


//bouton envoyer
function m2sDlgAccept(){

  let dlg=document.getElementById("m2ssimmo");
  dlg.setAttribute("buttondisabledaccept", true);

  //recuperer valeur de garde
  let jours=document.getElementById("m2ui-jours").value;
  m2sTrace("m2sDlgAccept jours:"+jours);
  m2ssimoUI.garde=Math.round(jours);//force int

  //valider le message
  m2ssimoUI.switchUITab(TAB_PREPARE);
  window.setTimeout(m2sDlgAcceptDelai, 100);

  return false;
}

function m2sDlgAcceptDelai(){

  //valider le message
  m2sTrace("m2sDlgAcceptDelai valider le message");
  let res=m2ssimoUI.ValideMessage();

  if (false==res){
    m2sTrace("m2sDlgAcceptDelai ValideMessage false!");
    //fermeture
    m2sDlgCancel();
    return;
  }

  //2eme contact du service
  //evite "timeout"
  m2ssimoUI.ContactService();
}


// onoff : true => sablier
function m2sSablier(onoff) {

  if (onoff)
    window.setCursor("wait");
  else
    window.setCursor("auto");
}


/* bouton de tests */
function m2sDlgBtTests() {

  m2sTrace("m2sDlgBtTests");

}

/* variables et fonctions d'envoi melanissimo pour l'interface UI */
const TAB_CONTACT=0;
const TAB_GARDE=1;
const TAB_PREPARE=2;
const TAB_ENVOI=3;

var m2ssimoUI={

  //parametres d'appel de la boite
  dlgParams: null,

  //instance m2sMessage
  m2msg: null,

  //index courant du fichier en cours d'envoi
  indexFichier: 0,

  //client melanissimo
  m2client: null,

  //garde en jours
  _garde:0,

  set garde(jours){

    this._garde=jours;
  },

  get garde(){
    return this._garde;
  },

  //calcul temps restant
  compteur:{
    
    taille:{
      //taille totale des fichiers
      total:0,
      //taille cumulee envoyee
      envoye:0,
      //taille en cours d'envoi
      encours:0,
      //taille fichier en cours d'envoi
      fichier:0
    },
    
    //temps de debut
    debut:0,

    //mise a jour du compteur de temps restant a partir de l'evenement onprogress
    updateCompteur: function(progression){

      this.taille.encours=progression.transmis;
      //m2sTrace("m2ssimoUI updateCompteur encours:"+this.taille.encours);
    },

    //retourne temps total restant en secondes
    getTempsRestant: function(){

      let envoye=this.taille.envoye+this.taille.encours;
      //m2sTrace("m2ssimoUI getTempsRestant envoye:"+envoye);
      let restant=this.taille.total-envoye;
      //m2sTrace("m2ssimoUI getTempsRestant restant:"+restant);
      let tps=(new Date()).getTime();
      let duree1=tps-this.debut;
      //m2sTrace("m2ssimoUI getTempsRestant duree1 (s):"+duree1/1000);
      let duree2=(restant*duree1)/envoye;
      duree2=Math.round(duree2/1000);
      //m2sTrace("m2ssimoUI getTempsRestant (s):"+duree2);

      return duree2;
    },

    //retourne le libelle du temps total restant h min s
    getLibTempsRestant: function(){

      let reste=this.getTempsRestant();

      let h=Math.floor(reste/3600);
      let m=Math.floor((reste-(h*3600))/60);
      let s=Math.floor(reste-(h*3600)-(m*60));
      //m2sTrace("m2ssimoUI updateTempsRestant h:"+h+" - m:"+m+" - s:"+s);
      let lib="";
      if (0<h)
        lib+=h.toString()+" h ";
      if (0<m)
        lib+=m.toString()+" min ";
      lib+=s.toString()+" s";
      return lib;
    },

    //timestamp last update
    get lastUpdate(){
      return this._lastUpdate;
    },
    set lastUpdate(temps){
      this._lastUpdate=temps;
    },
    _lastUpdate:0,
  },

  //mise a jour du libelle du temps restant
  //pour eviter effet de clignotement - mise a jour toute les n secondes
  updateTempsRestant: function(progression){

    if (0==progression.transmis){
      return;
    }

    let t=(new Date()).getTime();
    if (0<this.compteur.lastUpdate &&
        (2000>(t-this.compteur.lastUpdate)))
      return;

    if (0==this.compteur.lastUpdate){
      this.compteur.lastUpdate=t;
      this.libRestant.value="---";
      return;
    }
    
    this.compteur.lastUpdate=t;

    this.compteur.updateCompteur(progression);

    let reste=this.compteur.getLibTempsRestant();

    this.libRestant.value=reste;
  },
  
  _libRestant:null,
  
  get libRestant(){
    
    if (null==this._libRestant){
      this._libRestant=document.getElementById("m2ui-restant");
      this._lastUpdate=0;
    }
    return this._libRestant;
  },


  //initialiation
  Init: function(params){

    m2sTrace("m2ssimoUI Init");

    m2sSablier(true);

    this.dlgParams=params;

    this.m2msg=new m2sMessage();
    this.garde=0;

    //etendre les listes de contacts
    try {
      
      m2sTrace("m2ssimoUI Init etendre les listes de contacts");

      this.dlgParams.msgcompose.expandMailingLists();

    } catch(ex){
      
      m2sTrace("m2ssimoUI Init exception:"+ex);
      m2sEcritLog("Client", "Erreur lors de la resolution des destinataires du message");

      m2sAfficheErrId("m2sTitreEnvoi", "m2sErreurListes");

      m2sSablier(false);

      //fermeture
      window.close();
      return;
    }

    this.switchUITab(TAB_CONTACT);

    //construire le message
    m2sTrace("m2ssimoUI Init construire le message");
    this.m2msg.md5fichiers=false;
    this.m2msg.CreateMessage(this.dlgParams.msgcompose, this.dlgParams.identite, this.dlgParams.accountKey);
    this.indexFichier=0;

    this.m2client=new ClientM2s(this);

    m2sTrace("m2ssimoUI Init initialiation du client");
    this.SetStatutUI("m2sUIStatutInit");

    this.m2client.InitClient();
  },

  switchUITab: function(tabid){
    
    
    let deck=document.getElementById("m2uideck");
    deck.setAttribute("selectedIndex", tabid);
  },

  initPageGarde: function(){

    this.switchUITab(TAB_GARDE);
    this.SetStatutUI("");

    //recuperer plage de valeurs
    let specs=this.m2client.specsService;

    //controle valeur de garde
    let txt=document.getElementById("m2ui-jours");
    txt.setAttribute("min", specs.minDuréeGarde);
    txt.setAttribute("max", specs.maxDuréeGarde);
    
    if (specs.duréeGardePréconisée)
      txt.value=specs.duréeGardePréconisée;
    else
      txt.value=(specs.maxDuréeGarde+specs.minDuréeGarde)/2;

    let dlg=document.getElementById("m2ssimmo");
    dlg.setAttribute("buttondisabledaccept", false);
  },

  //affichage statut dans l'interface
  SetStatutUI: function(msg){

    this.statutUI.value=msg;
  },

  _statutUI:null,
  
  get statutUI(){

    if (null==this._statutUI)
      this._statutUI=document.getElementById("m2ui-statut");

    return this._statutUI;
  },

  ContactService: function(){

    let tailleTotale=this.m2msg.tailleMsg;
    m2sTrace("m2ssimoUI ContactService tailleTotale:"+tailleTotale);

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutContact"));
    this.initVumetre(STEP_CONTACT);

    //compteur de temps
    this.compteur.taille.total=tailleTotale;

    this.m2client.ContactService(tailleTotale);
  },

  //fonction d'annulation de l'envoi en cours
  Annulation: function(){

    m2sTrace("m2ssimoUI Annulation");

    if (!this.m2client.CanExecuteStep(STEP_ABORT)){
      m2sTrace("m2ssimoUI pas d'annulation");
      window.close();
      return;
    }

    let login=this.getCredentials();

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutAnnul"));
    this.initVumetre(STEP_ABORT);

    m2sTrace("m2ssimoUI Annulation du message");
    this.m2client.Abort(login.user, login.mdp);
  },

  //validation du message après contact du service
  //return true si ok
  //affiche les erreurs et/ou exception
  ValideMessage: function(){

    m2sTrace("m2ssimoUI ValideMessage");

    let jsonSpecs=this.m2client.jsonSpecsService;

    let erreurs=[];

    try{

      m2sSablier(true);

      //forcer calcul md5 ici
      this.m2msg.UpdateFichiersMd5();

      let validateur=new m2MessageValidateur(jsonSpecs);

      erreurs=validateur.ValideMessage(this.m2msg.message);

      m2sSablier(false);

    } catch(ex){

      m2sSablier(false);

      if (ex instanceof m2sExeception){
        ex.dump();
        //afficher l'erreur
        ex.AfficheUI();
      } else {
        m2sTrace("m2ssimoUI ValideMessage exception:"+ex);
        m2sAfficheErrId("m2sTitreEnvoi", "m2sUIErreurParams");
      }
      
      return false;
    }

    if (erreurs && erreurs.length){

      //afficher les erreurs
      m2sDisplayErrValid(erreurs);

      m2sTrace("m2ssimoUI ValideMessage erreurs detectees");
      return false;

    } else {
      
      m2sTrace("m2ssimoUI ValideMessage OK");
      return true;
    }

    return true;
  },

  //authentification aupres du service
  //force la demande de mot de passe si necessaire
  Authenticate: function(){

    m2sTrace("m2ssimoUI Authenticate");

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutAuth"));
    this.initVumetre(STEP_AUTH);

    try {

      let login=this.getCredentials();

      m2sTrace("m2ssimoUI Authenticate user:"+login.user);

      if (null==login.user ||
          ""==login.user){
        throw new m2sExeception("Aucune utilisateur pour accountKey:"+this.dlgParams.accountKey,-1, "m2ssimo-ui.js", "Authenticate");
      }

      if (null==login.mdp || ""==login.mdp){
        
        m2sTrace("m2ssimoUI Authenticate user non authentifie");
        //forcer demande de mot de passe
        let mdp={};

        let res=Services.prompt.promptPassword(window, "pacome", login.user, mdp, null, {});

        if (1!=res){
          //echec authentification
          m2sTrace("m2ssimoUI Authenticate promptPacome res:"+res);
          m2sAfficheErrId("m2sTitreEnvoi", "m2sUIErreurAuth");
          //fermeture
          m2sDlgCancel();
          return;
        }

        login.mdp=mdp.value;
      }

      //authentification service melanissimo
      m2sTrace("m2ssimoUI Authentification du client");
      this.m2client.Authenticate(login.user, login.mdp, this.dlgParams.identite.email);

    } catch(ex){
      
      if (ex instanceof m2sExeception){
        ex.dump();
        //afficher l'erreur
        ex.AfficheUI();
      } else {
        m2sTrace("m2ssimoUI Authenticate exception:"+ex);
        m2sAfficheErrId("m2sTitreEnvoi", "m2sUIErreurParams");
      }
      
      //fermeture
      m2sDlgCancel();
      return;
    }
  },

  //retourne objet user,mdp à partir de l'identite
  getCredentials: function(){

    let compte=MailServices.accounts.getAccount(this.dlgParams.accountKey);

    if (null==compte){
      m2sTrace("m2ssimoUI getCredentials pas de compte correspondant pour accountKey:"+this.dlgParams.accountKey);
      throw new m2sExeception("Pas de compte correspondant pour accountKey:"+this.dlgParams.accountKey,-1, "m2ssimo-ui.js", "getCredentials");
    }

    let login={
      user: compte.incomingServer.username,
      mdp: compte.incomingServer.password
    };

    return login;
  },

  //creation du message sur le service web
  CreateMessage: function(){

    m2sTrace("m2ssimoUI CreateMessage");

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutCree"));

    this.m2client.CreateMessage(this.m2msg.jsonMessage);
  },

  //fixer la garde du message sur le service web
  SetGarde: function(){

    m2sTrace("m2ssimoUI SetGarde");

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutGarde"));
    this.initVumetre(STEP_GARDE);

    this.m2client.SetGarde(this.garde);
  },

  //envoi d'un fichier sur le service web
  SendFile: function(){

    m2sTrace("m2ssimoUI SendFile");

    let i=this.indexFichier;

    let fichier=this.m2msg.GetFichier(this.indexFichier);

    if (null==fichier){
      //erreur fatale!
      m2sTrace("!!! m2ssimoUI SendFile null==fichier");
      return;
    }

    m2sTrace("m2ssimoUI SendFile envoi du fichier:"+fichier.chemin);

    this.SetStatutUI(m2sMessageFormatFromName("m2sUIStatutFichier", [fichier.nom], 1));
    this.initVumetre(STEP_SENDFILE);

    //compteur de temps
    this.compteur.taille.encours=0;
    this.compteur.taille.fichier=fichier.taille;

    this.m2client.SendFile(fichier);
    this.indexFichier++;
  },

  //envoi du message effectif
  SendMessage: function(){

    m2sTrace("m2ssimoUI SendMessage");

    this.SetStatutUI(m2sMessageFromName("m2sUIStatutEnvoi"));
    this.initVumetre(STEP_SENDMSG);

    this.m2client.SendMessage();
  },


  /* vu metre */
  _vumetre: null,
  
  get vumetre(){
    
    if (null==this._vumetre)
      this._vumetre=document.getElementById("m2ui-vumetre");

    return this._vumetre;
  },
  
  //initisalition
  initVumetre: function(mode){

    if (STEP_SENDFILE==mode){
      this.vumetre.setAttribute("mode", "determined");
      this.vumetre.setAttribute("max", 100);
      this.vumetre.setAttribute("value", "0");
    } else {
      this.vumetre.setAttribute("mode", "undetermined");
    }
  },
  //mise a jour vumetre
  updateVumetre: function(progression){

    if (STEP_SENDFILE==this.m2client.currentStep){
      let pc=Math.round((progression.transmis * 100) / progression.total);
      this.vumetre.setAttribute("value", pc);
    }
  },

  // copie du message dans elements envoyes
  // sans les pièces jointes

  // instance CopieEnvoiM2ssimo
  m2copieEnvoi: null,

  CopieElementsEnvoyes: function(){

    this.m2copieEnvoi=new CopieEnvoiM2ssimo(this);

    this.m2copieEnvoi.CopieMessage(this.dlgParams.msgcompose, this.dlgParams.identite, this.dlgParams.accountKey,
                                    this.dlgParams.msgwindow, this.dlgParams.progress);
  },

  onCopieErreur: function(code){
    // erreur dans copie elements envoyes n'est pas une erreur d'envoir melanissimo
    // notifier utilisateur
    this.dlgParams.retour=0;
    
    //fermeture
    m2sDlgEnd();
  },

  onCopieSucces: function(){

    this.dlgParams.retour=0;
    //fermeture
    m2sDlgEnd();
  },


  /* notifications client melanissimo */
  onInitClientEnd: function(result){
    m2sTrace("m2ssimoUI onInitClientEnd:"+result);

    this.ContactService();
  },

  //apppelee 2 fois
  //1ere : à l'initialiation
  //2eme : apres le choix de la duree de garde par l'utilisateur
  onContactServiceEnd: function(result){
    m2sTrace("m2ssimoUI onContactServiceEnd:"+result);

    m2sSablier(false);

    //1ere : à l'initialiation
    if (0==this.garde) {
      m2sTrace("m2ssimoUI onContactServiceEnd appel page choix de garde");
      this.initPageGarde();

    } else {

      //2eme : apres le choix de la duree de garde par l'utilisateur
      //authentification
      m2sTrace("m2ssimoUI onContactServiceEnd => authentification");
      this.Authenticate();
    }

  },
  
  onAuthenticateEnd: function(result){
    m2sTrace("m2ssimoUI onAuthenticateEnd:"+result);

    if (300==result){
      this.switchUITab(TAB_ENVOI);
      //succes => creer le message sur le service
      this.CreateMessage();
    }
  },
  
  onCreateMessageEnd: function(result){
    m2sTrace("m2ssimoUI onCreateMessageEnd:"+result);

    this.switchUITab(TAB_ENVOI);
    //succes
    this.SetGarde();
  },
  
  onSetGardeEnd: function(result){
    m2sTrace("m2ssimoUI onSetGardeEnd:"+result);

    //donnees compteur
    this.compteur.debut=(new Date()).getTime();

    this.SendFile();
  },
  
  onSendFileEnd: function(result){
    m2sTrace("m2ssimoUI onSendFileEnd:"+result);

    //mis a jour donnees compteur
    this.compteur.taille.envoye+=this.compteur.taille.fichier;
    this.compteur.taille.encours=0;

    if (202==result) {

      //suivant
      m2sTrace("m2ssimoUI onSendFileEnd fichier suivant");
      this.SendFile();

    } else if (201==result) {//dernier fichier envoye
      m2sTrace("m2ssimoUI onSendFileEnd dernier fichier => envoi du message");

      this.SendMessage();

    } else {
      //erreur anormale!
    }
  },
  
  onSendMessageEnd: function(result){
    m2sTrace("m2ssimoUI onSendMessageEnd:"+result);

    //affichage operation terminee => non
    this.dlgParams.retour=0;

    // copie dans elements envoyes
    this.CopieElementsEnvoyes();

  },
  
  onAbortEnd: function(result){
    m2sTrace("m2ssimoUI onAbortEnd");
    window.close();
  },
  
  //appelee en cas d'erreur dans une des methodes principales
  onError: function(sourceErreur, codeErreur, messageErreur){
    m2sTrace("m2ssimoUI onError sourceErreur:"+sourceErreur+" - codeErreur:"+codeErreur+" - messageErreur:"+messageErreur);

    m2sSablier(false);

    m2sAfficheErrMsg(sourceErreur, messageErreur);

    //fermeture
    window.close();
    return;
  },

  //indicateur de progression
  //exploite pour le chargement des fichiers
  onProgress: function(progression){

    this.updateVumetre(progression);

    this.updateTempsRestant(progression);
  }
}
