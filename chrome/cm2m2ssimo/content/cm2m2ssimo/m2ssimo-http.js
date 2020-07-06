/*
 * Module courrielleur - cm2m2ssimo (envoi melanssimo depuis le courrielleur)
 * Client http base sur XMLHttpRequest pour m2sHttpRequest
 */

ChromeUtils.import("resource://gre/modules/Services.jsm");

//source d'erreur client http
const MS2_CLIENT_HTTP="Client http";
const MS2_SERVEUR_HTTP="Serveur";


function m2sHttpRequest(){

  this.Init();
}


m2sHttpRequest.prototype={

  _httpRequest: null,

  get httpRequest(){

    if (null==this._httpRequest){
      this._httpRequest=new XMLHttpRequest();
    }
    return this._httpRequest;
  },
  
  //userAgent modifie
  _ua:null,
  
  get userAgent(){
    return this._ua;
  },
  
  initUserAgent: function(){
    
    //version de courrielleur
    let vercm2=Services.prefs.getCharPref("courrielleur.version");
    
    this._ua="Courrielleur/"+vercm2+" "+navigator.userAgent;
  },

  //logs details des requetes/reponses
  _debug:null,

  get debug(){

    if (null==this._debug){
      //preference melanissimo.logs.debug
      try{

        this._debug=Services.prefs.getBoolPref("melanissimo.logs.debug");
        if (this._debug)
          m2sTrace("m2sHttpRequest logs en mode debug");
      } catch(ex){
        this._debug=false;
      }
    }
    
    return this._debug;
  },

  Init: function() {

    this._httpRequest=null;
    this._headers=[];
    this.methode=null;
    this.url=null;
    this.params=null;
    this.MessageErreur=null;
    this.SourceErreur=MS2_CLIENT_HTTP;
    
    this.initUserAgent();

    this.SaveHttpResponse(null);
  },

  _methode: null,

  get methode(){
    return this._methode;
  },
  set methode(methode){
    this._methode=methode;
  },

  _url: null,

  get url(){
    return this._url;
  },
  set url(url){
    this._url=url;
  },

  _params: null,

  get params(){
    return this._params;
  },
  set params(params){
    this._params=params;
  },

  _headers:[],

  AddHeader: function(header, value){
    this._headers[header]=value;
  },

  RemoveHeader: function(header){

    if (this._headers[header])
      this._headers[header]=null;
  },

  //execution asynchrone de la requete
  //  ecouteur{
  //    onprogress: => req.upload.onprogress
  //    onload: => req.onload
  //    onerror: => req.onerror
  //  }
  //result : code resultat (code http, ou 0 ou -1 si erreur interne
  //retourne true si la requete est lancee, false sinon
  ExecuteRequete: function(ecouteur){

    try {

      let req=this.httpRequest;

      let _this=this;

      req.upload.onprogress=function(aEvt) {

        if (aEvt.lengthComputable && ecouteur && ecouteur.onprogress)
          ecouteur.onprogress({total:aEvt.total, transmis:aEvt.loaded});
      }

      req.onload=function(aEvt) {

        let request=aEvt.target;
        let statut=request.status;

        m2sTrace("m2sHttpRequest onload statut:"+statut);
        m2sTrace("m2sHttpRequest onload statusText:"+request.statusText);
        m2sTrace("m2sHttpRequest onload uri:"+request.channel.URI.spec);
        m2sEcritLog(M2S_LOGS_REQ, "Requete http - code resultat", statut);

        if (200<=statut && 400>statut){

          //memoriser la reponse
          let res=_this.SaveHttpResponse(request);

          if (false==res){
            _this.SourceErreur=req.getResponseHeader('Server');
            _this.MessageErreur=m2sMessageFromName("m2sServiceErrReponse");

            if (ecouteur && ecouteur.onerror)
              ecouteur.onerror(-1);
            return;
          }

        } else{
          _this.HandleHttpError(request);
        }

        if (ecouteur && ecouteur.onloadend)
          ecouteur.onloadend(statut);
      }

      req.onerror=function(aEvt) {

        let request=aEvt.target;
        let statut=request.status;

        m2sTrace("m2sHttpRequest onerror statut:"+statut);
        m2sEcritLog(M2S_LOGS_REQ, "Requete http - erreur d'execution de la requete", statut);

        if (0==statut){
          m2sTrace("m2sHttpRequest onerror 0==statut");
          _this.ResultCode=-1;
          _this.MessageErreur="Erreur réseau lors de l'appel du service Web Mélanissimo";
          _this.SourceErreur=MS2_CLIENT_HTTP;

        } else {
          _this.HandleHttpError(request);
        }

        if (ecouteur && ecouteur.onerror)
          ecouteur && ecouteur.onerror(statut);
        
        return;
      }

      req.open(this.methode, this.url, true);

      req.setRequestHeader("Accept-Charset", "UTF-8");
      //mantis 4205 - modification de userAgent
      m2sTrace("m2sHttpRequest modification de userAgent:"+this.userAgent);     
      req.setRequestHeader("User-Agent", this.userAgent);     

      if (this._headers){
        for (var header in this._headers) {
          if (this._headers[header]) {
            m2sTrace("m2sHttpRequest ExecRequete header:"+header+" - value:"+this._headers[header]);
            req.setRequestHeader(header, this._headers[header]);
          }
        }
      }

      m2sTrace("m2sHttpRequest ExecRequete req.send methode:"+this.methode+" - url:"+this.url);

      if (this.debug){
        //ecrire les logs des details de la requete (sauf mot de passe)
        m2sEcritLog(M2S_LOGS_REQ, "Envoi de la requete http");
        m2sEcritLog(M2S_LOGS_REQ, "Méthode", this.methode);
        m2sEcritLog(M2S_LOGS_REQ, "Url", this.url);
        for (var header in this._headers) {
          if (this._headers[header]) {
            m2sEcritLog(M2S_LOGS_REQ, "Entete", header+": "+this._headers[header]);
          }
        }
        if (this.params && this.params.indexOf) {
          if (-1==this.params.indexOf("motDePasseLdap")){
            m2sEcritLog(M2S_LOGS_REQ, "Parametres", this.params);
          } else {
            m2sEcritLog(M2S_LOGS_REQ, "Parametres", "*** pas d'enregistrement");
          }
        }
      }

      req.send(this.params);

    } catch(ex) {
      m2sTrace("m2sHttpRequest ExecRequete exception:"+ex);
      m2sEcritLog(M2S_LOGS_REQ, "Exception lors de l'execution d'une requete");
      return false;
    }

    return true;
  },

  Annulation: function() {
    
    if (null==this._httpRequest)
      return;

    m2sTrace("m2sHttpRequest annulation de la requete");
    this._httpRequest.abort();
  },

  //retourne la derniere reponse sous forme d'objet JSON
  //null si erreur de reponse/conversion
  get JSONResponse() {
    return this._httpJSONResponse;
  },

  set JSONResponse(jsonReponse) {
    this._httpJSONResponse=jsonReponse;
  },

  //Retourne le dernier code resultat (code http ou 0/-1 si erreur)
  get ResultCode(){
    return this._resultCode;
  },

  set ResultCode(result){
    this._resultCode=result;
  },

  //retourne le message d'erreur (200>result>=400)
  get MessageErreur(){
    return this._errMessage;
  },

  set MessageErreur(msg){
    this._errMessage=msg;
  },


  //retourne la source d'erreur
  get SourceErreur(){
    return this._sourceErreur;
  },

  set SourceErreur(source){
    this._sourceErreur=source;
  },

  //Retourne les entetes de reponse
  //format texte: <header>:<value>\n...
  //null si aucune
  get AllResponseHeaders(){
    return this._httpResponseHeaders;
  },


  /* fonctions/donnees internes */

  //donnees de reponse de la derniere requete http
  _resultCode: 0,
  _httpResponseHeaders: null,
  //la reponse convertie en objet JSON(null si pas de JSON - ex:404)
  _httpJSONResponse: null,
  //message d'erreur
  _errMessage: null,
  //source d'erreur (entete server ou MS2_CLIENT_HTTP)
  _sourceErreur: MS2_CLIENT_HTTP,


  //gestion des erreurs du serveur/requetes
  //le corps peut prendre differentes forme
  //l'erreur peut etre retournee par differents dispositifs (server apache, melanissimo)
  //le code erreur est memorise dans _resultCode
  //le message d'erreur est memorise/construit dans _errMessage
  HandleHttpError: function(req) {

    this.SaveHttpResponse(null);

    this.ResultCode=-1;
    this.MessageErreur="Echec de la requete";
    this.SourceErreur=MS2_CLIENT_HTTP;

    try {

      this.ResultCode=req.status;
      this.MessageErreur=req.statusText;

      if (req.responseText && ""!=req.responseText) {

        m2sTrace("m2sHttpRequest HandleHttpError responseText:"+req.responseText);

        let contentType=req.getResponseHeader('Content-Type');
        m2sTrace("m2sHttpRequest HandleHttpError contentType:"+contentType);

        this.SourceErreur=req.getResponseHeader('Server');

        if (contentType &&
            0==contentType.indexOf('application/json;')){
              
          try {
            
            let rep=JSON.parse(req.responseText);
            this.MessageErreur=rep.Message.texte;

          } catch(ex){
            m2sTrace("m2sHttpRequest HandleHttpError exception JSON.parse:"+ex);
          }

        }
      }

      this._httpResponseHeaders=req.getAllResponseHeaders();
      m2sTrace("m2sHttpRequest HandleHttpError getAllResponseHeaders:"+this._httpResponseHeaders);

    } catch(ex){
      m2sTrace("m2sHttpRequest HandleHttpError exception:"+ex);
    }
  },

  //enregistre la reponse d'une requete http
  //reçu au format json depuis le service web
  //retourne true si ok
  SaveHttpResponse: function(req) {

    if (null==req) {
      this.ResultCode=null;
      this._httpResponseHeaders=null;
      this.JSONResponse=null;
      return false;
    }

    this.ResultCode=req.status;
    m2sTrace("m2sHttpRequest SaveHttpResponse httpCode:"+this.ResultCode);
    this._httpResponseHeaders=req.getAllResponseHeaders();
    m2sTrace("m2sHttpRequest SaveHttpResponse getAllResponseHeaders:"+this._httpResponseHeaders);
    this.JSONResponse=null;
    m2sTrace("m2sHttpRequest SaveHttpResponse responseText:"+req.responseText);

    //conversion JSON.parse
    if (req.responseText && ""!=req.responseText){

      let contentType=req.getResponseHeader('Content-Type');
      m2sTrace("m2sHttpRequest SaveHttpResponse contentType:"+contentType);

      if (null==contentType ||
          0!=contentType.indexOf('application/json;')){
        m2sTrace("m2sHttpRequest SaveHttpResponse Content-Type non conforme");
        m2sEcritLog(M2S_LOGS_REQ, "La valeur Content-Type de la reponse du serveur n'est pas conforme", contentType);
        
        return false;
      }

      try{

        this.JSONResponse=JSON.parse(req.responseText);

        return true;

      } catch(ex) {
        m2sTrace("m2sHttpRequest SaveHttpResponse exception JSON.parse:"+ex);
        m2sEcritLog(M2S_LOGS_REQ, "Echec de conversion de la reponse du serveur");
        return false;
     }
    }
    
    //pas de body
    return true;
  }
}
