/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Client service web melanissimo
 */

ChromeUtils.import("resource://gre/modules/Services.jsm");



//etapes d'utilisation du client
//en cours et/ou derniere utilisation
//chaines correspondantes:m2sEtape-<type>
//si les valeurs sont modifiees => mettre a jour cm2m2ssimo.properties
//non initialise
const STEP_NONINIT=0;
//initialisation du client (=> client initialise)
const STEP_INIT=1;
//contact du service
const STEP_CONTACT=STEP_INIT+1;
//authentification
const STEP_AUTH=STEP_CONTACT+1;
//creation du message
const STEP_CREATEMSG=STEP_AUTH+1;
//duree de garde
const STEP_GARDE=STEP_CREATEMSG+1;
//envoi d'un fichier
const STEP_SENDFILE=STEP_GARDE+1;
//envoi du message
const STEP_SENDMSG=STEP_SENDFILE+1;
//annulation
const STEP_ABORT=STEP_SENDMSG+1;
//etat en erreur
const STEP_ERROR=1000;



/*
 * interface ecouteur pour les notifications de ClientM2s
 */
/*
interface ClientM2sListener : nsISupports
{
  //fin d'execution des methodes principales et succes
  //result : 0 si ok, sinon code erreur
  void onInitClientEnd(result);
  void onContactServiceEnd(result);
  void onAuthenticateEnd(result);
  void onCreateMessageEnd(result);
  void onSetGardeEnd(result);
  void onSendFileEnd(result);
  void onSendMessageEnd(result);
  void onAbortEnd();
  //appelee en cas d'erreur dans une des methodes principales
  void onError(sourceErreur, codeErreur, messageErreur);
  //indicateur de progresssion de requete (ex: envoi de fichier)
  void onProgress({total:aEvt.total, transmis:aEvt.loaded});
}*/




/*
 * Client d'acces du service Mélanissimo
 *
 * ecouteur instance ClientM2sListener
 */
function ClientM2s(ecouteur) {
  m2sTrace("ClientM2s ecouteur:"+ecouteur);
  this._notifications=ecouteur;
}


ClientM2s.prototype={

  //version du service supportee
  _versionService:"1.0",

  get versionService(){
    return this._versionService;
  },

  //specifications du service (JSON)
  //correspond aux caracteristiques/valeurs du message supportees
  //pour une version donnée, les champs ne changent pas, seules les valeurs peuvent changer
  _specsService: null,

  //retourne les specifications sous forme d'objet
  get specsService(){
    return this._specsService;
  },
  
  //retourne les specifications au format JSON
  get jsonSpecsService(){

    if (null==this._specsService)
      return null;
    return JSON.stringify(this._specsService);
  },

  _currentStep:STEP_NONINIT,

  get currentStep() {
    return this._currentStep;
  },

  //url du service
  //preference melanissimo.service.url (mise a jour si changement depuis serveur)
  _urlService: null,

  get urlService(){
    return this._urlService;
  },

  //derniere erreur enregistree
  //source: http, client
  _sourceErreur: "",
  //-1 erreur interne, sinon code http, 0 => pas d'erreur
  _codeErreur: 0,
  //message http ou interne
  _messageErreur: "",

  //retourne la derniere erreur dans un objet
  //indices : source, code, message
  get lastError() {
    let erreur={};
    erreur.source=this._sourceErreur;
    erreur.code=this._codeErreur;
    erreur.message=this._messageErreur;
    return erreur;
  },


  //derniere url executee
  _lastUrl: null,

  get lastUrl() {
    return this._lastUrl;
  },
  set lastUrl(url) {
    this._lastUrl=url;
  },


  /* Fonctions principales */

  //initialisation du client
  //return true si ok, false sinon
  InitClient: function() {

    if (!this.EnterStep(STEP_INIT)){
      return;
    }

    //this.InitVariables();
    this.lastUrl=null;
    this.urlAbort=null;

    this._specsService=null;

    //url du service
    try{

      this._urlService=Services.prefs.getCharPref("melanissimo.service.url");
      m2sTrace("ClientM2s InitClient service.url:"+this._urlService);
      m2sEcritLog(M2S_LOGS_MODULE, "Initialisation du client - url du service configuree:", this._urlService);

    } catch(ex){
      this._urlService=null;
      m2sTrace("ClientM2s InitClient - exception getCharPref melanissimo.service.url:"+ex);
      m2sEcritLog(M2S_LOGS_MODULE, "Echec de lecture de l'url du service lors de l'initialisation du client", "exception");
      this.SetError("Initialisation", -1, "Echec de lecture de l'url du service lors de l'initialisation du client");
      this.currentStep=STEP_ERROR;
      return false;
    }

    this.ClearError();

    this.currentStep=STEP_INIT;

    this.onInitClientEnd(0);

    return true;
  },

  //contact du service
  //@param tailleMsg taille totale des éléments du message (nombre octets optionnel)
  ContactService: function(tailleMsg) {

    m2sTrace("ClientM2s ContactService tailleMsg:"+tailleMsg);

    if (!this.EnterStep(STEP_CONTACT))
      return;

    //requete contact du service
    let req=this.HttpClient;

    let _this=this;

    var ecouteur={
      
      onerror:  function(result){

        m2sTrace("ClientM2s ContactService httpRequest.onerror result:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Appel du service - erreur d'execution de la requete", result);
        _this.SetError(req.SourceErreur, req.ResultCode, req.MessageErreur);
      },
      
      onloadend:  function(result){

        if (200==result) {
          
          //succes
          m2sTrace("ClientM2s ContactService 200==result");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de l'appel du service");

          //a ce stade memoriser les specifications du service
          let reqParams=_this.GetRequestParams("POST");
          if (reqParams &&
              reqParams.paramètres &&
              reqParams.paramètres.Informatif){

            m2sTrace("ClientM2s ContactService memorisation specifications du service");
            _this._specsService=reqParams.paramètres.Informatif;

            //detection redirection
            //la redirection est automatiquement gerer en interne par xmlHttpRequest
            if (_this.detectRedirection()){
              //gerer redirection
              _this.gereRedirection();
            }

            //notification
            _this.onContactServiceEnd(result);

          } else {
            m2sTrace("ClientM2s ContactService ECHEC memorisation specifications du service");
            m2sEcritLog(M2S_LOGS_REQ, "ECHEC de memorisation des specifications du service");
            //erreur
            _this.SetError("Serveur", -1, "ECHEC de memorisation des specifications du service");
          }
          
        } else {

          //autres cas : erreur?
          m2sTrace("ClientM2s ContactService result != 200");
          m2sEcritLog(M2S_LOGS_REQ, "Erreur de l'appel du service ou non gere - code retour:"+result);

          _this.SetError(req.SourceErreur, req.ResultCode, req.MessageErreur);
        }
      }
    }

    req.methode="GET";
    req.params=null;

    if (0<tailleMsg){
      //ajouter taille dans l'url
      req.url=this.urlService+"/"+tailleMsg;
      m2sTrace("ClientM2s ContactService url avec taille:"+req.url);
    } else {
      req.url=this.urlService;
    }

    this.lastUrl=req.url;

    m2sTrace("ClientM2s ContactService - execution de la requete");
    m2sEcritLog(M2S_LOGS_REQ, "Appel du service - execution de la requete");
    req.ExecuteRequete(ecouteur);
  },

  //authentification
  //uid: identifiant ldap
  //mdp: mot de passe
  //courriel
  Authenticate: function(uid, mdp, courriel) {

    m2sTrace("ClientM2s Authenticate");

    if (!this.EnterStep(STEP_AUTH))
      return;

    let _this=this;

    //verifier parametres
    if (null==uid || ""==uid) {
      this.SetError("client", -1, "Identifiant non valide pour executer l'authentification");
      return;
    }
    
    if (null==mdp || ""==mdp) {
      this.SetError("client", -1, "Mot de passe non valide pour executer l'authentification");
      return;
    }
    
    if (null==courriel || ""==courriel) {
      this.SetError("client", -1, "Courriel non valide pour executer l'authentification");
      return;
    }

    //calcul url d'annulation
    if (null==this.CalcUrlAbort()){
      m2sTrace("ClientM2s Authenticate echec de calcul de l'url d'annulation");
      m2sEcritLog(M2S_LOGS_REQ, "Authentification - echec de calcul de l'url d'annulation");
    }

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("POST");
    if (null==reqParams){
      this.SetError("http", -1, "Authenticate - echec recherche de la requete");
      return;
    }

    let urlAuth=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==urlAuth){
      this.SetError("http", -1, "Authenticate - echec de calcul de l'url");
      return;
    }

    let nbparams=0;
    function fixeParams(key, value){
      m2sTrace("ClientM2s stringify key:"+key+" - value:"+value);
      if ("identifiantLdap"==key){
        nbparams++;
        return uid;
      } else if ("motDePasseLdap"==key){
        nbparams++;
        return mdp;
      } else if ("courrielExpéditeur"==key){
        nbparams++;
        return courriel;
      } else if ("versionService"==key){
        nbparams++;
        return _this.versionService;
      }
      
      return value;
    }
    
    let strParams=JSON.stringify(reqParams.paramètres.Obligatoire, fixeParams);
    if (4!=nbparams){
      m2sTrace("ClientM2s Authenticate nombre de parametres incorrect:"+nbparams);
      this.SetError(MS2_CLIENT_HTTP, "Authenticate - le nombre de parametres n'est pas conforme");
      return;
    }

    //requete http
    let req=this.HttpClient;

    var ecouteur={

      onerror: function(result){

        m2sTrace("ClientM2s Authenticate onerror code:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Authentication - erreur d'execution de la requete");
        _this.SetError(req.SourceErreur, result, req.MessageErreur);
      },

      onloadend: function(result){

        if (200==result || 300==result) {

          //succes
          m2sTrace("ClientM2s Authenticate Succes");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de l'authentification");

          //notification
          _this.onAuthenticateEnd(result);

        } else {

          //autres cas : changement url ou erreur?
          m2sTrace("ClientM2s Authenticate erreur:"+result);
          m2sEcritLog(M2S_LOGS_REQ, "Echec d'authentification - code retour:"+result);

          _this.SetError(req.SourceErreur, result, req.MessageErreur);
        }
      }
    }

    req.methode=reqParams.méthode;
    req.url=urlAuth;
    this.lastUrl=urlAuth;
    req.params=strParams;

    if (reqParams.contentType)
      req.AddHeader("Content-Type", reqParams.contentType);

    m2sTrace("ClientM2s Authenticate - execution de la requete");
    m2sEcritLog(M2S_LOGS_REQ, "Authentification - execution de la requete");
    req.ExecuteRequete(ecouteur);
  },

  //creation du message
  // @param jsonMessage message melanissimo au format chaine json
  CreateMessage: function(jsonMessage) {

    m2sTrace("ClientM2s CreateMessage");

    if (!this.EnterStep(STEP_CREATEMSG))
      return;

    let _this=this;

    //verifier parametres
    if (null==jsonMessage || ""==jsonMessage) {
      this.SetError("client", -1, "Paramètres non valides pour créer le message");
      return;
    }

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("POST");
    if (null==reqParams){
      this.SetError("http", -1, "CreateMessage - echec recherche de la requete");
      return;
    }

    let urlMsg=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==urlMsg){
      this.SetError("http", -1, "CreateMessage - echec de calcul de l'url");
      return;
    }

    //calcul url d'annulation
    if (null==this.CalcUrlAbort()){
      m2sTrace("ClientM2s CreateMessage echec de calcul de l'url d'annulation");
      m2sEcritLog(M2S_LOGS_REQ, "Creation du message - echec de calcul de l'url d'annulation");
    }

    //requete http
    let req=this.HttpClient;

    var ecouteur={

      onerror: function(result){

        m2sTrace("ClientM2s CreateMessage onerror code:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Creation du message - erreur d'execution de la requete");
        _this.SetError(req.SourceErreur, result, req.MessageErreur);
        return;
      },

      onloadend: function (result){

        if (202==result) {

          //succes
          m2sTrace("ClientM2s CreateMessage Succes");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de creation du message");

          //notification
          _this.onCreateMessageEnd(result);

        } else {

          //autres cas : changement url ou erreur?
          m2sTrace("ClientM2s CreateMessage erreur:"+result);
          m2sEcritLog(M2S_LOGS_REQ, "Echec de creation du message - code retour:"+result);

          _this.SetError(req.SourceErreur, result, req.MessageErreur);
        }
        
        return;
      }
    }

    req.methode=reqParams.méthode;
    req.url=urlMsg;
    this.lastUrl=urlMsg;
    req.params=jsonMessage;

    if (reqParams.contentType)
      req.AddHeader("Content-Type", reqParams.contentType);

    m2sTrace("ClientM2s CreateMessage - execution de la requete");
    m2sEcritLog(M2S_LOGS_REQ, "Creation du message - execution de la requete");
    req.ExecuteRequete(ecouteur);
  },

  //duree de garde des fichiers en nombre de jours (optionnel)
  //sans valeur, la requete est executee sans parametres
  SetGarde: function(jours) {

    m2sTrace("ClientM2s SetGarde nombre jours:"+jours);

    if (!this.EnterStep(STEP_GARDE))
      return;

    let _this=this;

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("POST");
    if (null==reqParams){
      this.SetError("http", -1, "SetGarde - echec recherche de la requete");
      return;
    }

    let urlGarde=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==urlGarde){
      this.SetError("http", -1, "SetGarde - echec de calcul de l'url");
      return;
    }

    let nbparams=0;
    function fixeParams(key, value){
      m2sTrace("ClientM2s stringify key:"+key+" - value:"+value);
      if ("duréeGarde"==key){
        nbparams++;
        if (jours)
          return jours;
      }
      return value;
    }
    
    let strParams=JSON.stringify(reqParams.paramètres.Facultatif, fixeParams);
    if (1!=nbparams){
      m2sTrace("ClientM2s SetGarde nombre de parametres incorrect:"+nbparams);
      this.SetError(MS2_CLIENT_HTTP, "Garde - le nombre de parametres n'est pas conforme");
      return;
    }

    //calcul url d'annulation
    if (null==this.CalcUrlAbort()){
      m2sTrace("ClientM2s SetGarde echec de calcul de l'url d'annulation");
      m2sEcritLog(M2S_LOGS_REQ, "Garde du message - echec de calcul de l'url d'annulation");
    }

    //requete http
    let req=this.HttpClient;

    var ecouteur={

      onerror: function(result){

        m2sTrace("ClientM2s SetGarde onerror code:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Garde du message - erreur d'execution de la requete");
        _this.SetError(req.SourceErreur, result, req.MessageErreur);
      },

      onloadend: function (result){

        if (202==result) {

          //succes
          m2sTrace("ClientM2s SetGarde Succes");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de la garde du message");

          //notification
          _this.onSetGardeEnd(result);

        } else {

          //autres cas : changement url ou erreur?
          m2sTrace("ClientM2s SetGarde erreur:"+result);
          m2sEcritLog(M2S_LOGS_REQ, "Echec de la garde du message - code retour:"+result);

          _this.SetError(req.SourceErreur, result, req.MessageErreur);
        }
      }
    }

    req.methode=reqParams.méthode;
    req.url=urlGarde;
    this.lastUrl=urlGarde;
    req.params=strParams;

    if (reqParams.contentType)
      req.AddHeader("Content-Type", reqParams.contentType);

    m2sTrace("ClientM2s SetGarde - execution de la requete parametres:"+strParams);
    m2sEcritLog(M2S_LOGS_REQ, "Garde du message - execution de la requete");
    req.ExecuteRequete(ecouteur);
  },

  //envoi d'un fichier
  //fichierM2s: instance m2sFichier
  SendFile: function(fichierM2s) {

    m2sTrace("ClientM2s SendFile fichier:"+fichierM2s.chemin);

    if (!this.EnterStep(STEP_SENDFILE))
      return;

    let _this=this;

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("PUT");
    if (null==reqParams){
      this.SetError("http", -1, "SendFile - echec recherche de la requete");
      return;
    }

    let urlFichier=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==urlFichier){
      this.SetError("http", -1, "SendFile - echec de calcul de l'url");
      return;
    }

    //calcul url d'annulation
    if (null==this.CalcUrlAbort()){
      m2sTrace("ClientM2s SendFile echec de calcul de l'url d'annulation");
      m2sEcritLog(M2S_LOGS_REQ, "Garde du message - echec de calcul de l'url d'annulation");
    }

    //requete http
    let req=this.HttpClient;

    var ecouteur={

      onprogress: function(progression) {
        //m2sTrace("ClientM2s onprogress transmis:"+progression.transmis);
        _this.onProgress(progression);
      },

      onerror: function(result){

        m2sTrace("ClientM2s SendFile onerror code:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Envoi d'un fichier - erreur d'execution de la requete");
        _this.SetError(req.SourceErreur, result, req.MessageErreur);
      },

      onloadend: function (result){

        if (202==result || 201==result) {

          //succes
          m2sTrace("ClientM2s SendFile Succes");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de l'envoi du fichier");

          //notification
          _this.onSendFileEnd(result);

        } else {

          //autres cas : changement url ou erreur?
          m2sTrace("ClientM2s SendFile erreur:"+result);
          m2sEcritLog(M2S_LOGS_REQ, "Echec de l'envoi du fichier - code retour:"+result);

          _this.SetError(req.SourceErreur, result, req.MessageErreur);
        }
      }
    }

    req.methode=reqParams.méthode;
    req.url=urlFichier;
    this.lastUrl=urlFichier;

    File.createFromNsIFile(fichierM2s.File).then(file=>{
      req.params=file;
      if (reqParams.contentType)
        req.AddHeader("Content-Type", reqParams.contentType);
      req.ExecuteRequete(ecouteur);
    });

    m2sTrace("ClientM2s SendFile - execution de la requete");
    m2sEcritLog(M2S_LOGS_REQ, "Envoi d'un fichier - execution de la requete", fichierM2s.chemin);
  },

  //envoi du message
  SendMessage: function() {

    m2sTrace("ClientM2s SendMessage");

    if (!this.EnterStep(STEP_SENDMSG))
      return;

    let _this=this;

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("POST");
    if (null==reqParams){
      this.SetError("http", -1, "SendMessage - echec recherche de la requete");
      return;
    }

    let urlEnvoi=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==urlEnvoi){
      this.SetError("http", -1, "SendMessage - echec de calcul de l'url");
      return;
    }

    //requete http
    let req=this.HttpClient;

    var ecouteur={

      onerror: function(result){

        m2sTrace("ClientM2s SendMessage onerror code:"+result);
        m2sEcritLog(M2S_LOGS_REQ, "Envoi du message - erreur d'execution de la requete");
        _this.SetError(req.SourceErreur, result, req.MessageErreur);
      },

      onloadend: function (result){

        if (200==result) {

          //succes
          m2sTrace("ClientM2s SendMessage Succes");
          m2sEcritLog(M2S_LOGS_REQ, "Succes de l'envoi du message");

          //notification
          _this.onSendMessageEnd(result);

        } else {

          //autres cas : changement url ou erreur?
          m2sTrace("ClientM2s SendMessage erreur:"+result);
          m2sEcritLog(M2S_LOGS_REQ, "Echec de l'envoi du message - code retour:"+result);

          _this.SetError(req.SourceErreur, result, req.MessageErreur);
        }
      }
    }

    req.methode=reqParams.méthode;
    req.url=urlEnvoi;
    this.lastUrl=urlEnvoi;

    req.params='{}';

    if (reqParams.contentType)
      req.AddHeader("Content-Type", reqParams.contentType);

    m2sTrace("ClientM2s SendMessage - execution de la requete");
    m2sEcritLog(M2S_LOGS_REQ, "Envoi du message - execution de la requete");
    req.ExecuteRequete(ecouteur);
  },

  //annulation
  //annule la requete http en cours eventuelle
  Abort: function(uid, mdp) {

    m2sTrace("ClientM2s Annulation");

    if (STEP_CONTACT==this.currentStep){
      //annulatation requete en cours (cas particulier STEP_CONTACT trop long)
      this.HttpClient.Annulation();
      this.onAbortEnd(0);
      return;
    }

    if (!this.EnterStep(STEP_ABORT)){
      this.onAbortEnd(0);
      return;
    }

    //requete http courante
    this.HttpClient.Annulation();

    this.onAbortEnd(0);
  },

  /* Fonctions/donnees internes */
  SetError: function(sourceErreur, codeErreur, messageErreur) {

    this._sourceErreur=sourceErreur;
    this._codeErreur=codeErreur;
    this._messageErreur=messageErreur;

    m2sTrace("ClientM2s SetError sourceErreur:"+sourceErreur+" - codeErreur:"+codeErreur+" - messageErreur:"+messageErreur);
    this.onError(sourceErreur, codeErreur, messageErreur);
  },

  ClearError: function(){
    this._sourceErreur="";
    this._codeErreur=0;
    this._messageErreur="";
  },

  //url d'annulation d'operation
  _urlAbort: null,

  get urlAbort(){
    return this._urlAbort;
  },

  set urlAbort(url){
    this._urlAbort=url;
  },

  //calcule l'url d'annulation depuis la derniere reponse
  //appelee en debut de methode (ex: CreateMessage)
  CalcUrlAbort: function(){

    this.urlAbort=null;

    //preparer les parametres de requete
    let reqParams=this.GetRequestParams("DELETE");
    if (null==reqParams){
      this.SetError("http", -1, "CalcUrlAbort - echec recherche de la requete d'annulation");
      return null;
    }

    this.urlAbort=this.GetNextUrl(reqParams.protocole, reqParams.url);
    if (null==this.urlAbort){
      this.SetError("http", -1, "CalcUrlAbort - echec de calcul de l'url d'annulation");
      return null;
    }

    return this.urlAbort;
  },

  //retourne true si l'etape STEP_xxx est realisable
  //l'execution des requetes apres contact du service implique que this.HttpClient.JSONResponse soit valide
  CanExecuteStep: function(step) {

    if (null==step)
      return false;

    let courant=this.currentStep;
    m2sTrace("ClientM2s CanExecuteStep courant:"+courant);

    if (STEP_ERROR==courant)
      return false;

    switch(step){
      case STEP_INIT: if (STEP_INIT==courant || STEP_NONINIT==courant)
                        return true;
                      break;
      //contact du service
      case STEP_CONTACT:  if (STEP_INIT==courant || STEP_CONTACT==courant)
                            return true;
                          break;
      //authentification
      case STEP_AUTH: if (STEP_CONTACT==courant)
                        return this.ReponseContientRequete();
                      break;
      //creation du message
      case STEP_CREATEMSG:  if (STEP_AUTH==courant)
                              return this.ReponseContientRequete();
                            break;

      //garde du fichier
      case STEP_GARDE:  if (STEP_CREATEMSG==courant)
                              return this.ReponseContientRequete();
                            break;
      //envoi d'un fichier
      case STEP_SENDFILE: if (STEP_GARDE==courant || STEP_SENDFILE==courant)
                            //return true;
                            return this.ReponseContientRequete();
                          break;
      //envoi du message
      case STEP_SENDMSG:  if (STEP_SENDFILE==courant || STEP_CREATEMSG==courant)

                            return this.ReponseContientRequete();
                          break;
                          
      //annulation : a partir d'authentification
      case STEP_ABORT: if (STEP_CONTACT<=courant && courant<STEP_ABORT)
                        return true;
                        
      default: return false;
    }
    
    return false;
  },

  set currentStep(step) {
    this._currentStep=step;
  },

  //test et positionne l'étape
  //@return true si ok, false si erreur
  EnterStep: function(step){

    if (!this.CanExecuteStep(step)){
      m2sTrace("ClientM2s EnterStep Etape non valide:"+step);
      this.SetError("", -1, "Etape non valide:"+m2sMessageFromName("m2sEtape-"+step));
      return false;
    }
    
    this.currentStep=step;
    
    return true;
  },

  //client http
  _httpClient: null,

  get HttpClient(){

    if (null==this._httpClient){
      m2sTrace("ClientM2s new m2sHttpRequest");
      this._httpClient=new m2sHttpRequest();
    }
    
    return this._httpClient;
  },


  //retourne l'objet pour la requete recherchee
  //recherche basee uniquement sur la methode
  GetRequestParams: function(methode) {

    try{

      if (false==this.ReponseContientRequete()){
        m2sTrace("ClientM2s GetRequestParams pas de requete dans la reponse");
        return null;
      }

      let requetes=this.HttpClient.JSONResponse.requêtesPossibles;

      const nb=requetes.length;
      for (var i=0;i<nb;i++){
        if (methode==requetes[i].méthode.toUpperCase()){
          m2sTrace("ClientM2s GetRequestParams methode presente:"+methode);
          return requetes[i];
        }
      }
      
    } catch(ex){
      m2sTrace("ClientM2s GetRequestParams exception+"+ex);
    }
    
    return null;
  },

  //retourne l'url pour la requete suivante
  //construit l'url sur la base du protocol, de l'url courante et de la valeur urlRelative
  GetNextUrl: function(protocol, urlRelative) {

    let last=this.lastUrl;
    if (null==last || ""==last) {
      this.SetError("client", -1, "Url courante non valide");
      return null;
    }

    if ('/'!=last.charAt(last.length-1))
      last+='/';

    let uri=Services.io.newURI(last, null, null);

    if (!uri.schemeIs(protocol)){

      m2sTrace("GetNextUrl scheme different");

      let scheme=uri.scheme;
      let hostport=uri.hostPort;
      let path=uri.path;

      uri=Services.io.newURI("https://"+hostport+path, null, null);

    }

    let newUrl=uri.resolve(urlRelative);

    m2sTrace("ClientM2s url calculee:"+newUrl);

    return newUrl;
  },

  //retourne true si this._httpReponseParse est une reponse qui contient les elements pour une requete serveur
  ReponseContientRequete: function() {

    if (null==this.HttpClient.JSONResponse) {
      m2sTrace("ClientM2s ReponseContientRequete null==this.HttpClient.JSONResponse");
      return false;
    }
    
    if (this.HttpClient.JSONResponse.requêtesPossibles &&
        0<this.HttpClient.JSONResponse.requêtesPossibles.length){
      return true;
    }

    m2sTrace("ClientM2s ReponseContientRequete !requêtesPossibles");
    return false;
  },

  //detection de redirection
  //retourne true si redirection
  detectRedirection: function(){

    let request=this.HttpClient.httpRequest;
    if (request.channel.originalURI.spec!=
        request.channel.URI.spec){
      m2sTrace("ClientM2s detectRedirection redirection");
      return true;
    }
    
    return false;
  },

  gereRedirection: function(){
    
    m2sTrace("ClientM2s gereRedirection");
    //positionner nouvelle url courante
    let request=this.HttpClient.httpRequest;
    let newurl=request.channel.URI.spec;
    this.lastUrl=newurl;

    //calculer et memoriser nouvelle url de service
    let compos=newurl.split("/");
    newurl=compos[0]+"//"+compos[2]+"/"+compos[3];
    m2sTrace("ClientM2s gereRedirection nouvelle url de service:"+newurl);
    Services.prefs.setCharPref("melanissimo.service.url", newurl);
  },

  /* notifications de fin d'operations */
  //ecouteur externe
  _notifications: null,

  onInitClientEnd: function(result){
    m2sTrace("ClientM2s onInitClientEnd:"+result);

    if (null!=this._notifications && this._notifications.onInitClientEnd)
      this._notifications.onInitClientEnd(result);
  },
  
  onContactServiceEnd: function(result){
    m2sTrace("ClientM2s onContactServiceEnd:"+result);

    if (null!=this._notifications && this._notifications.onContactServiceEnd)
      this._notifications.onContactServiceEnd(result);
  },
  
  onAuthenticateEnd: function(result){
    m2sTrace("ClientM2s onAuthenticateEnd:"+result);

    if (null!=this._notifications && this._notifications.onAuthenticateEnd)
      this._notifications.onAuthenticateEnd(result);
  },
  
  onCreateMessageEnd: function(result){
    m2sTrace("ClientM2s onCreateMessageEnd:"+result);

    if (null!=this._notifications && this._notifications.onCreateMessageEnd)
      this._notifications.onCreateMessageEnd(result);
  },
  
  onSetGardeEnd: function(result){
    m2sTrace("ClientM2s onSetGardeEnd:"+result);

    if (null!=this._notifications && this._notifications.onSetGardeEnd)
      this._notifications.onSetGardeEnd(result);
  },
  
  onSendFileEnd: function(result){
    m2sTrace("ClientM2s onSendFileEnd:"+result);

    if (null!=this._notifications && this._notifications.onSendFileEnd)
      this._notifications.onSendFileEnd(result);
  },
  
  onSendMessageEnd: function(result){
    m2sTrace("ClientM2s onSendMessageEnd:"+result);

    if (null!=this._notifications && this._notifications.onSendMessageEnd)
      this._notifications.onSendMessageEnd(result);
  },
  
  onAbortEnd: function(result){
    m2sTrace("ClientM2s onAbortEnd:"+result);

    if (null!=this._notifications && this._notifications.onAbortEnd)
      this._notifications.onAbortEnd(result);
  },
  
  //appelee en cas d'erreur dans une des methodes principales
  onError: function(sourceErreur, codeErreur, messageErreur){

    m2sTrace("ClientM2s onError");
    if (null!=this._notifications && this._notifications.onError)
      this._notifications.onError(sourceErreur, codeErreur, messageErreur);
  },

  onProgress: function(progression){

    if (null!=this._notifications && this._notifications.onProgress)
      this._notifications.onProgress(progression);
  }
}
